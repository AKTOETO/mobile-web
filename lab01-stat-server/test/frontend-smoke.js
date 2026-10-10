'use strict';

/**
 * Опциональный UI-тест (нужен jsdom: npm i -D jsdom).
 *
 * Запускает сервер на временных данных, открывает страницы сайта в jsdom
 * (эмуляция браузера) и проверяет, что JS действительно:
 *   - отправляет события статистики;
 *   - обрабатывает нажатия кнопок форм (фильтр каталога, форма обратной связи);
 *   - заполняет KPI, графики и таблицы на дашборде.
 *
 *   node test/frontend-smoke.js
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const PORT = Number(process.env.TEST_PORT || 3222);
const BASE = `http://127.0.0.1:${PORT}`;
const PROJECT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'tmp-data-smoke');

const results = [];
function check(name, cond, details) {
  results.push({ name, ok: Boolean(cond) });
  console.log(`[${cond ? 'OK  ' : 'FAIL'}] ${name}${details ? ' — ' + details : ''}`);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** jsdom не умеет рисовать на canvas — подставляем заглушку контекста. */
function canvasStub() {
  const noop = () => {};
  return new Proxy({}, {
    get(t, p) {
      if (p === 'measureText') return (s) => ({ width: String(s).length * 6 });
      if (typeof p === 'string' && !(p in t)) return noop;
      return t[p];
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

async function loadPage(url) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    if (!/Could not parse CSS|Not implemented: HTMLCanvasElement/.test(e.message)) {
      console.log('[jsdom error]', e.message);
    }
  });

  const dom = await JSDOM.fromURL(url, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // В jsdom нет fetch — подключаем сетевой fetch Node.js.
      window.fetch = (input, init) =>
        fetch(typeof input === 'string' ? new URL(input, window.location.href).href : input, init);
      window.AbortController = AbortController;
      window.HTMLCanvasElement.prototype.getContext = function () { return canvasStub(); };
      window.confirm = () => true;
    },
  });

  await new Promise((resolve) => dom.window.addEventListener('load', resolve));
  await wait(900);
  return dom;
}

async function main() {
  const server = spawn(process.execPath, [path.join(PROJECT, 'server', 'server.js')], {
    env: Object.assign({}, process.env, {
      PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR, SEED_ON_START: '0',
    }),
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write('[server:err] ' + d));

  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch (e) { /* ждём сервер */ }
    await wait(200);
  }

  // --- главная страница: асинхронный сбор статистики ----------------------
  const home = await loadPage(`${BASE}/index.html`);
  const doc = home.window.document;
  check('index: JS получил идентификатор посетителя и сессии',
    doc.getElementById('visitorId').textContent.length > 8 &&
    doc.getElementById('sessionId').textContent.length > 8);
  check('index: блок «Что уже произошло на сайте» заполнен ответом API',
    doc.querySelector('[data-stat="pageViews"]').textContent !== '—',
    'pageViews=' + doc.querySelector('[data-stat="pageViews"]').textContent);

  doc.getElementById('demoAction').click();
  await wait(600);
  const afterClick = await (await fetch(`${BASE}/api/stats?range=all`)).json();
  check('index: клик по кнопке с data-track отправил событие action',
    afterClick.lifetime.actions >= 1, 'actions=' + afterClick.lifetime.actions);
  check('index: просмотр страницы засчитан сервером',
    afterClick.lifetime.pageViews >= 1, 'pageViews=' + afterClick.lifetime.pageViews);
  home.window.close();

  // --- каталог: web-форма фильтра -----------------------------------------
  const catalog = await loadPage(`${BASE}/catalog.html`);
  const cdoc = catalog.window.document;
  const before = cdoc.querySelectorAll('#catalog .card').length;
  cdoc.getElementById('category').value = 'phones';
  cdoc.getElementById('filterForm').dispatchEvent(new catalog.window.Event('submit', { cancelable: true }));
  await wait(400);
  const after = cdoc.querySelectorAll('#catalog .card').length;
  check('catalog: кнопка «Применить фильтр» обработана JS без перезагрузки',
    before === 6 && after === 4, `до=${before}, после=${after}`);
  cdoc.getElementById('resetFilter').click();
  await wait(200);
  check('catalog: кнопка «Сбросить» вернула все товары',
    cdoc.querySelectorAll('#catalog .card').length === 6);
  catalog.window.close();

  // --- форма обратной связи ------------------------------------------------
  const contact = await loadPage(`${BASE}/contact.html`);
  const fdoc = contact.window.document;
  fdoc.getElementById('name').value = 'Анна';
  fdoc.getElementById('email').value = 'anna@mai.ru';
  fdoc.getElementById('message').value = 'Как считается длительность сессии?';
  fdoc.getElementById('sendFeedback').click();
  await wait(900);
  const okMessage = fdoc.querySelector('#formMessages li');
  check('contact: форма отправлена асинхронно, получен ответ сервера',
    okMessage && /Сообщение отправлено/.test(okMessage.textContent));
  check('contact: таблица сообщений обновлена данными с сервера',
    /anna@mai.ru/.test(fdoc.querySelector('#feedbackTable tbody').textContent));

  fdoc.getElementById('name').value = 'A';
  fdoc.getElementById('email').value = 'нет-почты';
  fdoc.getElementById('message').value = 'аб';
  fdoc.getElementById('sendFeedback').click();
  await wait(900);
  const badMessage = fdoc.querySelector('#formMessages li');
  check('contact: серверная валидация выведена на страницу',
    badMessage && !badMessage.classList.contains('ok') && /e-mail/i.test(badMessage.textContent));
  contact.window.close();

  // --- дашборд --------------------------------------------------------------
  const dash = await loadPage(`${BASE}/dashboard.html`);
  const ddoc = dash.window.document;
  check('dashboard: KPI заполнены статистикой',
    ddoc.querySelector('[data-kpi="pageViews"]').textContent !== '—' &&
    ddoc.querySelector('[data-kpi="uniqueVisitors"]').textContent !== '—');
  check('dashboard: все 4 графика инициализированы на canvas',
    ddoc.querySelectorAll('canvas').length === 4 &&
    [...ddoc.querySelectorAll('canvas')].every((c) => c.width > 100));
  check('dashboard: таблица последних сессий заполнена',
    ddoc.querySelectorAll('#sessionsTable tbody tr').length >= 1);
  check('dashboard: список страниц в фильтре получен с сервера',
    ddoc.querySelectorAll('#page option').length >= 3);

  ddoc.getElementById('seedDemo').click();
  await wait(1500);
  check('dashboard: кнопка «Демо-данные» пересчитала показатели',
    Number(ddoc.querySelector('[data-kpi="pageViews"]').textContent.replace(/\s/g, '')) > 10);

  ddoc.getElementById('range').value = '7d';
  ddoc.getElementById('range').dispatchEvent(new dash.window.Event('change'));
  await wait(900);
  check('dashboard: период «7 дней» применён к отчёту',
    /последние 7 дней/.test(ddoc.getElementById('reportRange').textContent));

  ddoc.getElementById('resetStats').click();
  await wait(1200);
  check('dashboard: кнопка «Сбросить» обнулила статистику',
    ddoc.querySelector('[data-kpi="pageViews"]').textContent === '0');
  dash.window.close();

  server.kill('SIGTERM');
}

main()
  .catch((e) => check('выполнение UI-теста', false, e.message))
  .finally(() => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\nИтого: ${results.length - failed.length} из ${results.length}`);
    process.exit(failed.length ? 1 : 0);
  });

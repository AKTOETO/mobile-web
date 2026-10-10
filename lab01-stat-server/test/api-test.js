'use strict';

/**
 * Интеграционный тест: запускает сервер на отдельном порту в отдельной папке
 * с данными и проверяет web-интерфейс и API.
 *
 *   node test/api-test.js
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const fsp = require('node:fs/promises');

const PORT = Number(process.env.TEST_PORT || 3111);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(__dirname, 'tmp-data');

const results = [];
let server = null;

function check(name, condition, details) {
  results.push({ name, ok: Boolean(condition), details: details || '' });
  const mark = condition ? 'OK  ' : 'FAIL';
  console.log(`[${mark}] ${name}${details ? ' — ' + details : ''}`);
}

async function waitReady() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch (e) { /* сервер ещё поднимается */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('сервер не поднялся за 12 секунд');
}

async function main() {
  await fsp.rm(DATA_DIR, { recursive: true, force: true });

  server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DATA_DIR: DATA_DIR,
      SEED_ON_START: '0',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write('[server] ' + d));
  server.stderr.on('data', (d) => process.stderr.write('[server:err] ' + d));

  await waitReady();

  // 1. Статические файлы (html / css / js)
  const home = await fetch(`${BASE}/index.html`);
  const homeText = await home.text();
  check('GET /index.html отдаёт страницу сайта', home.ok && homeText.includes('WebLab'));

  const dashboard = await fetch(`${BASE}/dashboard.html`);
  const dashboardText = await dashboard.text();
  check('GET /dashboard.html отдаёт дашборд', dashboard.ok && dashboardText.includes('reportForm'));

  const css = await fetch(`${BASE}/css/style.css`);
  const cssText = await css.text();
  check('CSS содержит адаптивные @media-правила', css.ok && /@media\s*\(\s*max-width/.test(cssText));

  const tracker = await fetch(`${BASE}/js/tracker.js`);
  const trackerText = await tracker.text();
  check('tracker.js использует async/await и fetch', tracker.ok && /async function/.test(trackerText) && /fetch\(/.test(trackerText));

  const api = await fetch(`${BASE}/js/api.js`);
  const apiText = await api.text();
  check('api.js использует Promise/AbortController', api.ok && /AbortController/.test(apiText));

  const notFound = await fetch(`${BASE}/nope.html`);
  check('несуществующая страница возвращает 404', notFound.status === 404);

  const traversal = await fetch(`${BASE}/../package.json`);
  check('путь за пределы public недоступен', traversal.status === 404 || traversal.status === 403);

  // 2. Сбор статистики через API
  const visitorId = 'test-visitor-1';
  const sessionId = 'test-session-1';
  const ua = 'Mozilla/5.0 (Linux; U; Android 8.1.0; ru-ru; Jolla X) Aurora Browser/2.0.0.21';

  const view1 = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'pageview', visitorId, sessionId, page: '/index.html', ua }),
  });
  check('POST /api/events принимает pageview', view1.status === 201);

  await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'pageview', visitorId, sessionId, page: '/catalog.html', ua, referrer: 'https://google.com/search?q=mai' }),
  });

  await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'action', visitorId, sessionId, page: '/catalog.html', label: 'catalog:filter', ua }),
  });

  const view2 = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'pageview', visitorId: 'test-visitor-2', sessionId: 'test-session-2', page: '/index.html', origin: `http://localhost:${PORT}/`, ua: 'Mozilla/5.0 (Windows NT 10.0)', referrer: `http://localhost:${PORT}/index.html` }),
  });
  check('второй посетитель учтён', view2.status === 201);

  const end = await fetch(`${BASE}/api/session-end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, visitorId, ua }),
  });
  const endData = await end.json();
  check('POST /api/session-end закрывает сессию', end.ok && endData.session && endData.session.closed === true);

  // 3. Аналитика
  const statsRes = await fetch(`${BASE}/api/stats?range=24h`);
  const stats = await statsRes.json();
  check('просмотры страниц посчитаны', stats.totals.pageViews === 3, `pageViews=${stats.totals.pageViews}`);
  check('уникальные посетители посчитаны', stats.totals.uniqueVisitors === 2, `uniqueVisitors=${stats.totals.uniqueVisitors}`);
  check('сессии посчитаны', stats.totals.sessions === 2, `sessions=${stats.totals.sessions}`);
  check('нажатия кнопок посчитаны', stats.totals.actions === 1, `actions=${stats.totals.actions}`);
  check('длительность сессии посчитана', stats.totals.avgSessionDurationSec >= 0);
  check('есть точки для графика по времени', Array.isArray(stats.timeline) && stats.timeline.length > 0, `точек=${stats.timeline.length}`);
  check('список популярных страниц построен', stats.topPages.some((p) => p.page === '/index.html' && p.views === 2));
  check('устройства определены по User-Agent (Аврора)', stats.devices.aurora === 1, JSON.stringify(stats.devices));
  check('внутренние переходы определены по origin страницы', stats.sources.internal === 1 && stats.totals.sessions === 2, JSON.stringify(stats.sources));

  const pagesRes = await fetch(`${BASE}/api/pages`);
  const pagesData = await pagesRes.json();
  check('GET /api/pages возвращает страницы', pagesData.pages.length >= 2);

  const sessionsRes = await fetch(`${BASE}/api/sessions?limit=5`);
  const sessionsData = await sessionsRes.json();
  check('GET /api/sessions возвращает сессии', sessionsData.sessions.length === 2);

  // 4. Web-форма
  const badForm = await fetch(`${BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'A', email: 'bad', message: 'hi' }),
  });
  const badData = await badForm.json();
  check('форма с ошибками получает 422 и список ошибок', badForm.status === 422 && badData.errors.length >= 2);

  const goodForm = await fetch(`${BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Иван', email: 'ivan@mai.ru', topic: 'question', message: 'Вопрос по лабораторной работе' }),
  });
  check('корректная форма принимается (201)', goodForm.status === 201);

  const feedbackRes = await fetch(`${BASE}/api/feedback`);
  const feedbackData = await feedbackRes.json();
  check('GET /api/feedback возвращает сообщения', feedbackData.feedback.length === 1);

  // 5. Экспорт и демо-данные
  const csvRes = await fetch(`${BASE}/api/export.csv?type=sessions&range=24h`);
  const csvText = await csvRes.text();
  check('экспорт CSV работает', csvRes.ok && csvText.includes('visitorId') && csvText.split('\n').length >= 3);

  const seedRes = await fetch(`${BASE}/api/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitors: 8, days: 3, seed: 42 }),
  });
  const seedData = await seedRes.json();
  check('демо-данные генерируются', seedRes.status === 201 && seedData.events > 10, `событий=${seedData.events}`);

  const weekStats = await (await fetch(`${BASE}/api/stats?range=7d`)).json();
  check('недельный отчёт содержит данные', weekStats.totals.pageViews > 10, `pageViews=${weekStats.totals.pageViews}`);

  const allStats = await (await fetch(`${BASE}/api/stats?range=all`)).json();
  check('отчёт «всё время» считает уникальных посетителей', allStats.lifetime.uniqueVisitors >= 10, `visitors=${allStats.lifetime.uniqueVisitors}`);

  // 6. Сохранение на диск и сброс
  const fileExists = await fsp.stat(path.join(DATA_DIR, 'stats.json')).then(() => true).catch(() => false);
  check('статистика сохранена в data/stats.json', fileExists);

  const resetRes = await fetch(`${BASE}/api/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  });
  check('сброс статистики работает', resetRes.status === 200);

  const afterReset = await (await fetch(`${BASE}/api/stats?range=all`)).json();
  check('после сброса счётчики обнулены', afterReset.lifetime.pageViews === 0 && afterReset.lifetime.uniqueVisitors === 0);

  // 7. Ошибочные запросы
  const badJson = await fetch(`${BASE}/api/events`, { method: 'POST', body: '{ не json' });
  check('битый JSON даёт 400', badJson.status === 400);

  const unknownApi = await fetch(`${BASE}/api/unknown`);
  check('неизвестный API-метод даёт 404', unknownApi.status === 404);
}

main()
  .catch((err) => {
    check('выполнение теста', false, err.message);
  })
  .finally(async () => {
    if (server) server.kill('SIGTERM');
    const failed = results.filter((r) => !r.ok);
    console.log('');
    console.log(`Итого: ${results.length - failed.length} из ${results.length} проверок пройдено.`);
    process.exit(failed.length ? 1 : 0);
  });

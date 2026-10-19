#!/usr/bin/env node
'use strict';

/**
 * Скриншоты результата для отчёта (report/REPORT.md).
 *
 * Скрипт сам поднимает сервер лабораторной на временной базе статистики,
 * открывает страницы в headless Chrome (Puppeteer), выполняет реальные действия
 * пользователя — фильтр каталога, отправка формы, клик по мобильному меню —
 * и сохраняет PNG в report/screenshots/.
 *
 * Запуск из корня лабораторной работы:
 *   npm install                      # нужен puppeteer-core (dev-зависимость)
 *   node report/src/screenshots/capture.js
 * Браузер: Google Chrome / Chromium (переменная CHROME_PATH, по умолчанию google-chrome-stable)
 */

const path = require('node:path');
const fs = require('node:fs');
const { spawn, execSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');

const LAB_ROOT = path.resolve(__dirname, '..', '..', '..');
const PORT = Number(process.env.SHOT_PORT || 3355);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join(LAB_ROOT, 'report', 'screenshots');
const DATA_DIR = path.join(LAB_ROOT, 'report', '.screens-data');
const CHROME_CANDIDATES = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'];

/** Puppeteer требует абсолютный путь к браузеру — находим его через PATH. */
function resolveChrome() {
  const preferred = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : CHROME_CANDIDATES;
  for (const name of preferred) {
    if (name.charAt(0) === '/' && fs.existsSync(name)) return name;
    try {
      const found = execSync(`command -v ${name}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (found && fs.existsSync(found)) return fs.realpathSync(found);
    } catch (err) { /* пробуем следующий кандидат */ }
  }
  throw new Error('не найден Chrome/Chromium, укажите CHROME_PATH=/путь/к/браузеру');
}

// User-Agent телефона под управлением Sailfish OS / Аврора — сервер относит визит к устройству aurora.
const AURORA_UA = 'Mozilla/5.0 (Linux; U; Android 8.1.0; ru-ru; Jolla X) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Version/2.0 Mobile Safari/537.36 Aurora Browser/2.0.0.21';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch (err) { /* сервер ещё поднимается */ }
    await wait(200);
  }
  throw new Error('сервер не поднялся');
}

async function shot(page, name, options) {
  await page.screenshot(Object.assign({ path: path.join(OUT, name) }, options || {}));
  console.log('скриншот:', name);
}

async function openDesktop(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  return page;
}

async function openMobile(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent(AURORA_UA);
  return page;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  const server = spawn(process.execPath, [path.join(LAB_ROOT, 'server', 'server.js')], {
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DATA_DIR,
      SEED_ON_START: '1',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write('[server] ' + d));
  server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));

  let browser;
  const facts = {};
  try {
    await waitForServer();
    browser = await puppeteer.launch({
      executablePath: resolveChrome(),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
        '--force-color-profile=srgb', '--font-render-hinting=none'],
    });

    // ---------------- Десктоп: обход сайта ----------------
    const page = await openDesktop(browser);

    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-stat="pageViews"]');
      return el && el.textContent.trim() !== '';
    });
    await shot(page, '01-index-desktop.png');

    // Каталог: было / стало после нажатия кнопки формы
    await page.goto(`${BASE}/catalog.html`, { waitUntil: 'networkidle2' });
    await shot(page, '02-catalog-desktop.png');
    facts.catalogBefore = await page.$eval('#filterNote', (el) => el.textContent.trim());

    await page.select('#category', 'phones');
    await page.type('#maxPrice', '20000');
    await page.click('#filterForm button[type="submit"]');
    await page.waitForFunction(() => document.querySelectorAll('#catalog .card').length > 0);
    await shot(page, '03-catalog-filtered.png');
    facts.catalogAfter = await page.$eval('#filterNote', (el) => el.textContent.trim());
    facts.catalogCards = await page.$$eval('#catalog .card', (els) => els.map((e) => e.querySelector('h3').textContent));

    // Обратная связь: ошибка серверной валидации
    await page.goto(`${BASE}/contact.html`, { waitUntil: 'networkidle2' });
    await page.type('#name', 'И');
    await page.type('#email', 'нет-почты');
    await page.type('#message', 'ок');
    await page.evaluate(() => {
      document.getElementById('name').setAttribute('minlength', '1');
      document.getElementById('message').setAttribute('minlength', '1');
    });
    await page.click('#sendFeedback');
    await page.waitForFunction(() => document.querySelectorAll('#formMessages li').length > 0);
    await shot(page, '04-contact-validation.png');
    facts.validationErrors = await page.$$eval('#formMessages li', (els) => els.map((e) => e.textContent.trim()));

    // Обратная связь: успешная отправка и таблица сообщений
    await page.evaluate(() => {
      document.getElementById('name').setAttribute('minlength', '2');
      document.getElementById('message').setAttribute('minlength', '5');
    });
    await page.click('#clearFeedback');
    await page.type('#name', 'Иван Петров');
    await page.type('#email', 'ivan@example.ru');
    await page.select('#topic', 'question');
    await page.type('#message', 'Вопрос по методике расчёта длительности сессий.');
    await page.click('#sendFeedback');
    await page.waitForFunction(() => document.querySelectorAll('#feedbackTable tbody tr').length > 0);
    await shot(page, '05-contact-sent.png');
    facts.formStatus = await page.$eval('#formStatus', (el) => el.textContent.trim());
    facts.feedbackRows = await page.$$eval('#feedbackTable tbody tr', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));

    // Дашборд на ПК
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('#sessionsTable tbody tr').length;
      const kpi = document.querySelector('[data-kpi="pageViews"]');
      return rows > 0 && kpi && kpi.textContent.trim() !== '0';
    });
    await wait(600);
    await shot(page, '06-dashboard-desktop.png', { fullPage: true });
    facts.kpi = await page.$$eval('[data-kpi]', (els) => els.map((e) => `${e.getAttribute('data-kpi')}=${e.textContent.trim()}`));
    facts.canvas = await page.$$eval('canvas', (els) => els.map((e) => `${e.id} ${e.width}x${e.height}`));
    facts.sessionRows = await page.$$eval('#sessionsTable tbody tr', (els) =>
      els.slice(0, 3).map((e) => e.textContent.replace(/\s+/g, ' ').trim()));

    // Дашборд: выбранный период «7 дней» и фильтр по странице
    await page.select('#range', '7d');
    await page.select('#page', '/catalog.html');
    await page.click('#applyReport');
    await page.waitForFunction(() => document.getElementById('reportRange').textContent.includes('7 дней'));
    await wait(500);
    await shot(page, '07-dashboard-filter-7d-catalog.png', { fullPage: true });
    facts.reportRange = await page.$eval('#reportRange', (el) => el.textContent.trim());
    facts.kpiFiltered = await page.$$eval('[data-kpi]', (els) => els.map((e) => `${e.getAttribute('data-kpi')}=${e.textContent.trim()}`));

    // ---------------- Телефон (Аврора) ----------------
    const mobile = await openMobile(browser);

    await mobile.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
    await mobile.waitForFunction(() => document.querySelector('[data-stat="pageViews"]').textContent.trim() !== '');
    await shot(mobile, '08-index-aurora.png');
    facts.mobileVisitorId = await mobile.$eval('#visitorId', (el) => el.textContent.trim());
    facts.mobileStats = await mobile.$$eval('[data-stat]', (els) => els.map((e) => `${e.getAttribute('data-stat')}=${e.textContent.trim()}`));

    await mobile.click('#navToggle');
    await mobile.waitForFunction(() => document.getElementById('mainNav').classList.contains('is-open'));
    await shot(mobile, '09-index-aurora-menu.png');

    await mobile.goto(`${BASE}/catalog.html`, { waitUntil: 'networkidle2' });
    await mobile.evaluate(() => {
      document.getElementById('filterForm').addEventListener('submit', () => {}, false);
    });
    await mobile.tap('#filterForm button[type="submit"]');
    await shot(mobile, '10-catalog-aurora.png');

    await mobile.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2' });
    await mobile.waitForFunction(() => document.querySelectorAll('#sessionsTable tbody tr').length > 0);
    await wait(600);
    await shot(mobile, '11-dashboard-aurora.png', { fullPage: true });
    facts.auroraCanvas = await mobile.$$eval('canvas', (els) => els.map((e) => `${e.id} ${e.width}x${e.height}`));
    facts.auroraKpi = await mobile.$$eval('[data-kpi]', (els) => els.map((e) => `${e.getAttribute('data-kpi')}=${e.textContent.trim()}`));

    // Дашборд на ПК после визита с «Авроры» — виден сектор aurora
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle2' });
    await page.select('#range', 'all');
    await page.waitForFunction(() => document.querySelectorAll('#sessionsTable tbody tr').length > 0);
    await wait(600);
    await shot(page, '12-dashboard-devices-aurora.png', { fullPage: true });

    const stats = await (await fetch(`${BASE}/api/stats?range=all`)).json();
    fs.writeFileSync(path.join(OUT, 'capture-summary.json'), JSON.stringify({
      capturedAt: new Date().toISOString(),
      totals: stats.totals,
      lifetime: stats.lifetime,
      devices: stats.devices,
      sources: stats.sources,
      facts,
    }, null, 2));
    console.log('сводка визитов:', JSON.stringify(stats.totals));

    await page.close();
    await mobile.close();
  } catch (err) {
    console.error('ошибка:', err.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
}

main();

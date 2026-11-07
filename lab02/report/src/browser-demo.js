'use strict';

/**
 * Демонстрация части 2 на ПК: Firefox (headless) + geckodriver.
 *
 * Открывает тестовую страницу с ?auto=1, ждёт завершения автодемо (13 шагов
 * CRUD и кодов ответа), затем страницу документации и сохраняет скриншоты.
 *
 *   node lab02/report/src/browser-demo.js
 *
 * Скриншоты: lab02/report/screenshots/pc-firefox-*.png
 * Журнал:    lab02/report/logs/pc-firefox-demo.log
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REPORT = path.resolve(__dirname, '..');
const BASE = process.env.LAB02_BASE_URL || 'https://127.0.0.1:8443';
const GECKODRIVER = process.env.GECKODRIVER || '/snap/bin/geckodriver';

const logLines = [];
function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  logLines.push(line);
  console.log(line);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function http(method, url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    json = null;
  }
  if (!res.ok) {
    throw new Error(`WebDriver ${method} ${url} -> ${res.status}: ${text}`);
  }
  return json;
}

async function waitForGeckodriver(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = await http('GET', `http://127.0.0.1:${port}/status`);
      if (status && status.value && status.value.ready !== false) return;
    } catch (e) {
      // сервер ещё не поднялся
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('geckodriver не запустился');
}

async function saveScreenshot(sessionId, port, file) {
  const result = await http('GET', `http://127.0.0.1:${port}/session/${sessionId}/screenshot`);
  await fs.writeFile(file, Buffer.from(result.value, 'base64'));
  log('скриншот: ' + file);
}

async function main() {
  await fs.mkdir(path.join(REPORT, 'screenshots'), { recursive: true });
  await fs.mkdir(path.join(REPORT, 'logs'), { recursive: true });

  const port = await freePort();
  const driver = spawn(GECKODRIVER, ['--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  driver.stderr.setEncoding('utf8');
  let driverErr = '';
  driver.stderr.on('data', (chunk) => { driverErr += chunk; });

  let sessionId = null;
  try {
    await waitForGeckodriver(port, 15000);
    log('geckodriver запущен на порту ' + port);

    const session = await http('POST', `http://127.0.0.1:${port}/session`, {
      capabilities: {
        alwaysMatch: {
          browserName: 'firefox',
          acceptInsecureCerts: true,
          'moz:firefoxOptions': { args: ['-headless', '--width=1280', '--height=900'] },
        },
      },
    });
    sessionId = session && session.value && session.value.sessionId;
    if (!sessionId) throw new Error('geckodriver не вернул sessionId: ' + JSON.stringify(session));
    log('сессия Firefox: ' + sessionId);

    await http('POST', `http://127.0.0.1:${port}/session/${sessionId}/url`,
      { url: BASE + '/?auto=1' });
    log('открыта страница ' + BASE + '/?auto=1');

    const deadline = Date.now() + 90000;
    let demo = null;
    while (Date.now() < deadline) {
      const result = await http('POST',
        `http://127.0.0.1:${port}/session/${sessionId}/execute/sync`, {
          script: 'return window.__demo ? window.__demo : null;',
          args: [],
        });
      demo = result.value;
      if (demo && demo.done) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!demo || !demo.done) throw new Error('автодемо не завершилось за 90 с');

    const failed = (demo.steps || []).filter((s) => !s.ok);
    log('автодемо: ' + (demo.steps.length - failed.length) + '/' + demo.steps.length +
      ' шагов, ok=' + demo.ok);
    for (const step of failed) {
      log('  FAIL ' + step.name + ': ожидалось ' + step.expected + ', получено ' + step.actual);
    }
    await saveScreenshot(sessionId, port,
      path.join(REPORT, 'screenshots', 'pc-firefox-demo.png'));

    await http('POST', `http://127.0.0.1:${port}/session/${sessionId}/url`,
      { url: BASE + '/docs.html' });
    await new Promise((r) => setTimeout(r, 1500));
    const title = await http('GET', `http://127.0.0.1:${port}/session/${sessionId}/title`);
    log('открыта документация, заголовок: ' + title.value);
    await saveScreenshot(sessionId, port,
      path.join(REPORT, 'screenshots', 'pc-firefox-docs.png'));

    if (!demo.ok) throw new Error('автодемо завершилось с ошибками');
  } finally {
    if (sessionId) {
      await http('DELETE', `http://127.0.0.1:${port}/session/${sessionId}`).catch(() => {});
    }
    driver.kill('SIGTERM');
    await new Promise((resolve) => {
      const timer = setTimeout(() => { driver.kill('SIGKILL'); resolve(); }, 3000);
      driver.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    if (driverErr) log('geckodriver stderr: ' + driverErr.split('\n').slice(0, 20).join(' | '));
    await fs.writeFile(path.join(REPORT, 'logs', 'pc-firefox-demo.log'),
      logLines.join('\n') + '\n', 'utf8');
  }
}

main().catch((e) => {
  console.error('Ошибка демонстрации: %s', e.stack || e.message);
  process.exitCode = 1;
});

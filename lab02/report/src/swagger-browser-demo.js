'use strict';

// Firefox + WebDriver: запросы выполняются настоящими кнопками Swagger UI.
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const report = path.resolve(__dirname, '..');
const base = process.env.LAB02_BASE_URL || 'https://127.0.0.1:8443';

async function main() {
  const port = await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const value = server.address().port;
      server.close(() => resolve(value));
    });
  });
  const driver = spawn(process.env.GECKODRIVER || '/snap/bin/geckodriver', ['--port', String(port)],
    { stdio: 'ignore' });
  const url = 'http://127.0.0.1:' + port;
  async function call(method, suffix, body) {
    const response = await fetch(url + suffix, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data.value;
  }
  let id;
  try {
    for (let i = 0; i < 50; i++) {
      try { await call('GET', '/status'); break; } catch (_) { await new Promise(r => setTimeout(r, 200)); }
    }
    const session = await call('POST', '/session', { capabilities: { alwaysMatch: {
      browserName: 'firefox', acceptInsecureCerts: true,
      'moz:firefoxOptions': { args: ['-headless', '--width=1280', '--height=1000'] },
    } } });
    id = session.sessionId;
    await call('POST', '/session/' + id + '/url', { url: base + '/docs.html?auto=1' });
    let result;
    for (let i = 0; i < 180; i++) {
      result = await call('POST', '/session/' + id + '/execute/sync', {
        script: 'return window.__swaggerDemo || { status: document.getElementById("swagger-status").textContent, text: document.body.innerText.slice(-2000) };', args: [],
      });
      if (result.done) break;
      await new Promise(r => setTimeout(r, 500));
    }
    const screenshot = await call('GET', '/session/' + id + '/screenshot');
    await fs.writeFile(path.join(report, 'screenshots/pc-firefox-docs.png'), Buffer.from(screenshot, 'base64'));
    const text = JSON.stringify({ url: base + '/docs.html?auto=1', ...result }, null, 2);
    await fs.writeFile(path.join(report, 'logs/swagger-firefox-demo.log'), text + '\n');
    console.log(text);
    if (!result.done || !result.ok) throw new Error('Проверка Swagger UI не пройдена');
  } finally {
    if (id) await call('DELETE', '/session/' + id).catch(() => {});
    driver.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

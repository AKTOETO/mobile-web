'use strict';
// Настоящий Firefox: нажать кнопки панели, проверить результат и сделать снимки.
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const net = require('node:net');
const REPORT = path.resolve(__dirname, '../report');
const BASE = 'http://127.0.0.1:9084';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}
let driver, session, endpoint;
async function wd(method, route, body) {
  const response = await fetch(endpoint + route, { method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result.value;
}
const execute = script => wd('POST', `/session/${session}/execute/sync`, { script, args: [] });
async function screenshot(name) {
  const data = await wd('GET', `/session/${session}/moz/screenshot/full`);
  await fs.writeFile(path.join(REPORT, 'screenshots', name), Buffer.from(data, 'base64'));
}
(async () => {
  const port = await freePort(); endpoint = `http://127.0.0.1:${port}`;
  driver = spawn('/snap/bin/geckodriver', ['--port', String(port)], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) {
      try { if ((await wd('GET', '/status')).ready) break; } catch {}
      await sleep(250);
    }
    const created = await wd('POST', '/session', { capabilities: { alwaysMatch: {
      browserName: 'firefox', 'moz:firefoxOptions': { args: ['-headless', '--width=1500', '--height=1200'] } } } });
    session = created.sessionId;
    await wd('POST', `/session/${session}/url`, { url: BASE });
    await sleep(3000);
    assert.equal(await execute('return document.querySelectorAll(".container").length'), 6);
    assert.match(await execute('return document.getElementById("push-state").textContent'), /v[12]\.0\.0/);
    console.log('PASS панель: 6 контейнеров, WebSocket подключён, nginx отвечает');
    for (const name of ['balance', 'failover', 'recover', 'deploy', 'rollback']) {
      await execute(`document.querySelector('[data-scenario="${name}"]').click();`);
      let finished = false;
      for (let i = 0; i < 90; i++) {
        await sleep(400);
        const message = await execute('return document.getElementById("message").textContent');
        const ready = await execute('return !document.querySelector("[data-scenario]").disabled');
        if (ready && message.startsWith('ПОДТВЕРЖДЕНО')) { finished = true; break; }
        if (ready && message.startsWith('ОБНАРУЖЕНЫ')) throw new Error(message);
      }
      assert.ok(finished, 'Кнопка не завершила сценарий ' + name);
      const evidence = await (await fetch(BASE + '/api/evidence')).json();
      assert.equal(evidence[0].name, name); assert.equal(evidence[0].passed, true);
      console.log('PASS кнопка', name, evidence[0].result.successful + '/' + evidence[0].result.total);
      await screenshot('monitor-' + name + '.png');
    }
    await fs.writeFile(path.join(REPORT, 'logs', 'browser-evidence.json'),
      JSON.stringify(await (await fetch(BASE + '/api/evidence')).json(), null, 2));
    console.log('ИТОГО: 5 кнопок проверены в Firefox; снимки сохранены');
  } finally {
    if (session) await wd('DELETE', '/session/' + session).catch(() => {});
    if (driver) driver.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

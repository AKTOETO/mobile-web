'use strict';
// Локальная панель стенда: Docker Engine API, реальные пробы nginx, доказательства.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const BACKENDS = ['blue1', 'blue2', 'green1', 'green2'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const routing = '/etc/nginx/routing';
const events = [], samples = [];
let serial = 0, busy = '', probing = true, lastDocker = [], dockerError = '', inspecting = false;
let proofs = [];
try { proofs = JSON.parse(fs.readFileSync('/evidence/scenarios.json', 'utf8')); } catch {}
const colour = () => fs.readFileSync(path.join(routing, 'colour'), 'utf8').trim();
function event(message, detail = '') {
  const item = { time: new Date().toISOString(), message, detail };
  events.unshift(item);
  events.splice(80);
  console.log(JSON.stringify(item));
}
function docker(method, resource, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({ socketPath: '/var/run/docker.sock', path: '/v1.47' + resource,
      signal: AbortSignal.timeout(15000),
      method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, res => {
      const chunks = [];
      res.on('data', part => chunks.push(part));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        if (res.statusCode >= 300) return reject(new Error(`Docker ${res.statusCode}: ${text}`));
        if (!text) return resolve(null);
        try { resolve(JSON.parse(text)); } catch { resolve(text); }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('Docker timeout')));
    req.on('error', reject);
    req.end(data);
  });
}
async function containers() {
  const filter = encodeURIComponent(JSON.stringify({ label: ['com.docker.compose.project=lab03'] }));
  return docker('GET', '/containers/json?all=1&filters=' + filter);
}
async function container(service) {
  const item = (await containers()).find(c => c.Labels['com.docker.compose.service'] === service);
  if (!item) throw new Error('Контейнер не найден: ' + service);
  return item;
}
async function refreshDocker() {
  if (inspecting) return;
  inspecting = true;
  try {
    lastDocker = await Promise.all((await containers()).filter(c => c.Labels['com.docker.compose.service'] !== 'tests').map(async c => {
      const detail = await docker('GET', `/containers/${c.Id}/json`);
      return { id: c.Id.slice(0, 12), name: c.Labels['com.docker.compose.service'], image: detail.Config.Image,
        state: detail.State.Status, status: c.Status, restarts: detail.RestartCount,
        health: detail.State.Status === 'running' ? detail.State.Health?.Status || 'running' : 'stopped' };
    }));
    dockerError = '';
  } catch (error) { dockerError = error.message; }
  finally { inspecting = false; }
}
async function execNginx(args) {
  const nginx = await container('nginx');
  const exec = await docker('POST', `/containers/${nginx.Id}/exec`, {
    Cmd: ['nginx', ...args], AttachStdout: true, AttachStderr: true });
  await docker('POST', `/exec/${exec.Id}/start`, { Detach: false, Tty: false });
  const result = await docker('GET', `/exec/${exec.Id}/json`);
  if (result.ExitCode !== 0) throw new Error('nginx ' + args.join(' ') + ': код ' + result.ExitCode);
}
async function waitHealthy(name) {
  const end = Date.now() + 12000;
  while (Date.now() < end) {
    try {
      const res = await fetch(`http://${name}:3000/api/health`, { signal: AbortSignal.timeout(1000) });
      const value = await res.json();
      if (res.ok && value.instance === name && value.status === 'ok') return value;
    } catch {}
    await sleep(300);
  }
  throw new Error('Backend не готов: ' + name);
}
async function start(name) {
  if (!BACKENDS.includes(name)) throw new Error('Недопустимый backend');
  const item = await container(name);
  if (item.State !== 'running') await docker('POST', `/containers/${item.Id}/start`);
  await waitHealthy(name);
  event('Backend запущен и проверен', name);
}
async function stop(name) {
  if (!BACKENDS.includes(name)) throw new Error('Недопустимый backend');
  const item = await container(name);
  if (item.State === 'running') await docker('POST', `/containers/${item.Id}/stop?t=2`);
  event('Backend остановлен', name);
}
async function switchColour(target) {
  if (!['blue', 'green'].includes(target)) throw new Error('Укажите blue или green');
  const pair = BACKENDS.filter(name => name.startsWith(target));
  // Проверяем всю целевую пару ДО изменения конфигурации.
  for (const name of pair) await waitHealthy(name);
  const file = path.join(routing, 'active.conf');
  const previous = fs.readFileSync(file, 'utf8');
  const addresses = [];
  for (const name of pair) {
    const item = await container(name);
    const detail = await docker('GET', `/containers/${item.Id}/json`);
    const address = detail.NetworkSettings.Networks.lab03_inventory?.IPAddress;
    if (!address) throw new Error('Нет адреса в Docker-сети: ' + name);
    addresses.push(address);
  }
  // Постоянные адреса Compose сохраняют upstream при stop/start и пересоздании.
  fs.writeFileSync(file, addresses.map(address => `server ${address}:3000 max_fails=1 fail_timeout=2s;\n`).join(''));
  try {
    await execNginx(['-t']);
    await execNginx(['-s', 'reload']);
  } catch (error) { fs.writeFileSync(file, previous); throw error; }
  // Не объявляем успех, пока nginx действительно не выдаёт целевую версию.
  const expected = target === 'blue' ? '1.0.0' : '2.0.0';
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const sample = await probe('switch-check');
    if (sample.status === 200 && sample.version === expected) { ready = true; break; }
    await sleep(100);
  }
  if (!ready) {
    fs.writeFileSync(file, previous);
    await execNginx(['-s', 'reload']);
    throw new Error('Новая версия не появилась через nginx; выполнен откат');
  }
  fs.writeFileSync(path.join(routing, 'colour'), target + '\n');
  event('nginx: проверка и graceful reload завершены', target + ' / v' + expected);
}
async function probe(origin = 'monitor') {
  const began = Date.now();
  const item = { id: ++serial, time: new Date().toISOString(), origin, status: 0, backend: '', version: '' };
  try {
    const res = await fetch('http://nginx:9083/api/health', { signal: AbortSignal.timeout(2500) });
    item.status = res.status;
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const body = JSON.parse(text);
    item.backend = res.headers.get('x-backend') || '';
    item.version = body.version;
    if (body.instance !== item.backend) throw new Error('Метаданные backend не совпали');
  } catch (error) { item.error = error.message; }
  item.ms = Date.now() - began;
  samples.push(item);
  if (samples.length > 5000) samples.shift();
  return item;
}
function summarize(rows) {
  const counts = Object.fromEntries(BACKENDS.map(name => [name, 0]));
  let errors = 0;
  for (const row of rows) {
    if (row.status !== 200 || row.error) errors++;
    else if (Object.hasOwn(counts, row.backend)) counts[row.backend]++;
  }
  return { total: rows.length, errors, successful: rows.length - errors, counts,
    versions: [...new Set(rows.filter(row => row.version).map(row => row.version))] };
}
function accessLog() {
  try {
    const file = '/var/log/lab03/access.log';
    const size = fs.statSync(file).size, length = Math.min(size, 60000);
    const fd = fs.openSync(file, 'r'), buffer = Buffer.alloc(length);
    try { fs.readSync(fd, buffer, 0, length, size - length); } finally { fs.closeSync(fd); }
    return buffer.toString().split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } }).slice(-50).reverse();
  } catch { return []; }
}
async function exclusive(label, fn) {
  if (busy) throw Object.assign(new Error('Выполняется: ' + busy), { status: 409 });
  busy = label;
  try { return await fn(); } finally { busy = ''; await refreshDocker(); }
}
async function scenario(name) {
  if (!['balance', 'failover', 'deploy', 'rollback', 'recover'].includes(name)) throw new Error('Неизвестный сценарий');
  return exclusive('Сценарий ' + name, async () => {
    const began = new Date().toISOString();
    event('Начало сценария', name);
    let target = colour(), failed = '';
    if (name === 'balance' || name === 'recover') {
      for (const backend of BACKENDS) await start(backend);
      if (name === 'balance') await switchColour('blue');
      target = colour();
      await sleep(2300); // истечение пассивного fail_timeout
    }
    const offset = serial;
    const initial = colour();
    if ((name === 'deploy' && initial === 'green') || (name === 'rollback' && initial === 'blue')) {
      throw new Error('Этот релиз уже активен. Для нового перехода сначала выберите другую пару.');
    }
    // Для деплоя поток идёт ДО, ВО ВРЕМЯ и ПОСЛЕ reload.
    const own = [];
    let actionError;
    let action = Promise.resolve();
    if (name === 'deploy' || name === 'rollback') {
      target = name === 'deploy' ? 'green' : 'blue';
      for (const backend of BACKENDS.filter(b => b.startsWith(target))) await start(backend);
      action = sleep(700).then(() => switchColour(target)).catch(error => { actionError = error; });
    } else if (name === 'failover') {
      failed = BACKENDS.find(b => b.startsWith(target));
      await stop(failed);
    }
    const count = name === 'deploy' || name === 'rollback' ? 100 : 40;
    for (let i = 0; i < count; i++) { own.push(await probe('scenario:' + name)); await sleep(80); }
    await action;
    if (actionError) throw actionError;
    const result = summarize(own);
    const continuous = summarize(samples.filter(row => row.id > offset));
    let passed = result.errors === 0 && continuous.errors === 0;
    if (name === 'balance') passed &&= result.counts.blue1 > 0 && result.counts.blue2 > 0;
    if (name === 'failover') passed &&= result.counts[failed] === 0 && result.counts[target + '2'] > 0;
    if (name === 'deploy' || name === 'rollback') {
      const expected = target === 'green' ? '2.0.0' : '1.0.0';
      passed &&= own.at(-1).version === expected;
      if (initial !== target) passed &&= result.versions.length === 2;
    }
    const proof = { name, began, ended: new Date().toISOString(), initial, target, failed, passed,
      result, continuous, requests: own, nginx: accessLog().slice(0, 15) };
    proofs.unshift(proof); proofs.splice(20);
    fs.writeFileSync('/evidence/scenarios.json', JSON.stringify(proofs, null, 2));
    event(passed ? 'Сценарий подтверждён' : 'Проверка обнаружила ошибки', `${name}: ${result.successful}/${result.total}`);
    return proof;
  });
}
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function body(req) {
  let text = '';
  for await (const part of req) {
    text += part;
    if (text.length > 4096) throw new Error('Слишком большой запрос');
  }
  return JSON.parse(text || '{}');
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://monitor');
    if (req.method === 'GET' && url.pathname === '/api/live') return json(res, 200, { status: 'ok' });
    if (req.method === 'GET' && url.pathname === '/api/state') {
      let nginxStatus = '';
      try { nginxStatus = await (await fetch('http://nginx:9083/nginx_status', { signal: AbortSignal.timeout(1000) })).text(); } catch {}
      return json(res, 200, { time: new Date().toISOString(), colour: colour(), busy, probing,
        dockerError, containers: lastDocker, totals: summarize(samples), samples: samples.slice(-30).reverse(),
        events, proofs: proofs.map(({ requests, nginx, ...proof }) => proof), nginx: accessLog(), nginxStatus });
    }
    if (req.method === 'GET' && url.pathname === '/api/evidence') return json(res, 200, proofs);
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      // Управление доступно только с той же origin; curl/CLI без Origin допустимы.
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(res, 403, { error: 'Origin mismatch' });
      const data = await body(req);
      if (url.pathname === '/api/scenario') return json(res, 200, await scenario(data.name));
      if (url.pathname === '/api/action') {
        return json(res, 200, await exclusive(data.action, async () => {
          if (data.action === 'start') await start(data.target);
          else if (data.action === 'stop') await stop(data.target);
          else if (data.action === 'switch') await switchColour(data.target);
          else if (data.action === 'reset') { samples.length = 0; event('Счётчики запросов очищены'); }
          else if (data.action === 'traffic') probing = Boolean(data.enabled);
          else throw new Error('Неизвестное действие');
          return { ok: true, colour: colour() };
        }));
      }
    }
    const files = { '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' };
    if (req.method === 'GET' && files[url.pathname]) {
      const file = files[url.pathname];
      res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript; charset=utf-8' :
        file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(path.join(__dirname, 'public', file)));
    }
    json(res, 404, { error: 'Ресурс не найден' });
  } catch (error) { event('Ошибка операции', error.message); json(res, error.status || 400, { error: error.message }); }
});
(async function polling() {
  while (true) { if (probing) await probe(); await sleep(250); }
})().catch(error => event('Проба остановлена', error.message));
refreshDocker();
setInterval(refreshDocker, 1500);
server.listen(9084, '0.0.0.0', () => event('Панель запущена', 'http://localhost:9084'));

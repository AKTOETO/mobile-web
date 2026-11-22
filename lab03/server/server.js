'use strict';
// Самостоятельный сервис мониторинга инвентаря; только стандартные модули.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('./websocket');
const instance = process.env.INSTANCE || 'blue1';
const release = require(process.env.RELEASE === '2' ? './release-v2' : './release-v1');
const version = release.version;
const port = Number(process.env.PORT || 9311);
let sequence = 0;
const catalog = () => release.items(JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8')));
const metadata = () => ({ instance, version, time: new Date().toISOString() });
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Backend', instance);
  res.setHeader('X-App-Version', version);
  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' });
    return res.end(JSON.stringify({ error: 'Сервис мониторинга поддерживает только чтение' }));
  }
  if (url.pathname === '/api/health') return res.end(JSON.stringify({ ...metadata(), status: 'ok' }));
  if (url.pathname === '/api/items') return res.end(JSON.stringify({ ...metadata(), items: catalog() }));
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Ресурс не найден' }));
});
const ws = new WebSocketServer(server, { path: '/ws' });
ws.on('connection', conn => {
  conn.sendJson({ type: 'hello', ...metadata(), message: 'Push-канал подключён' });
  console.log(JSON.stringify({ event: 'ws-connected', ...metadata() }));
});
const timer = setInterval(() => {
  // Каждый backend сам публикует наблюдение общего неизменяемого каталога.
  ws.broadcast({ type: 'inventory', ...metadata(), sequence: ++sequence,
    ...release.notification(catalog()), total: catalog().reduce((n, item) => n + item.quantity, 0) });
}, 3000);
server.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ event: 'listen', port, ...metadata() })));
process.on('SIGTERM', () => {
  clearInterval(timer);
  ws.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
});

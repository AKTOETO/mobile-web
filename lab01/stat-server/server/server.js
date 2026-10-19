'use strict';

/**
 * Сервер статистики аналитики сайта (лабораторная работа №1, вариант 7).
 *
 * Только встроенные модули Node.js — никаких внешних зависимостей,
 * поэтому сервер запускается в локальной сети без npm install.
 *
 *   node server/server.js            http://localhost:3000
 *   PORT=8080 node server/server.js  http://<ip-локальной-сети>:8080
 */

const http = require('node:http');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const config = require('./config');
const Storage = require('./storage');
const computeStats = require('./analytics');
const seedDemo = require('./seed');
const { createRealtime } = require('./realtime');

const storage = new Storage(config);
storage.load();

const STARTED_AT = new Date().toISOString();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const PAGES = {
  '/': '/index.html',
  '/dashboard': '/dashboard.html',
};

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Запрос слишком большой'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(Object.assign(new Error('Некорректный JSON в теле запроса'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || '';
}

function requestHost(req) {
  const host = req.headers.host || '';
  return host.split(':')[0];
}

function meta(req) {
  return { ip: clientIp(req), ua: req.headers['user-agent'] || '', host: req.headers.host || '' };
}

function csvEscape(value) {
  const s = String(value === undefined || value === null ? '' : value);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, columns) {
  const lines = [columns.join(';')];
  for (const row of rows) lines.push(columns.map((c) => csvEscape(row[c])).join(';'));
  return lines.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function handleApi(req, res, url) {
  const route = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method || 'GET';

  // Служебная информация о сервере.
  if (method === 'GET' && route === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      service: 'lab01-stat-server',
      version: config.version,
      startedAt: STARTED_AT,
      uptimeSec: Math.round((Date.now() - config.startedAt) / 1000),
      dataFile: storage.statsFile,
      sessionTimeoutSec: config.sessionTimeoutSec,
      heartbeatSec: config.heartbeatSec,
      websocket: {
        path: '/ws',
        clients: realtime.wss.clients.size,
      },
    });
  }

  // Основной запрос дашборда: сводка + данные для графиков.
  if (method === 'GET' && route === '/api/stats') {
    const stats = computeStats(storage.state, {
      range: url.searchParams.get('range') || '24h',
      page: url.searchParams.get('page') || '',
      limit: url.searchParams.get('limit') || 15,
      selfHost: requestHost(req),
    });
    return sendJson(res, 200, stats);
  }

  // Список страниц, которые когда-либо просматривали (для фильтра формы).
  if (method === 'GET' && route === '/api/pages') {
    const map = new Map();
    for (const e of storage.state.events) {
      if (e.type === 'pageview') map.set(e.page, (map.get(e.page) || 0) + 1);
    }
    const pages = [...map.entries()]
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views);
    return sendJson(res, 200, { pages });
  }

  // Последние сессии (таблица на дашборде).
  if (method === 'GET' && route === '/api/sessions') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 15, 1), 50);
    const sessions = Object.values(storage.state.sessions)
      .sort((a, b) => b.lastEvent - a.lastEvent)
      .slice(0, limit)
      .map((s) => ({
        id: s.id,
        visitorId: s.visitorId,
        device: s.device,
        start: s.start,
        end: s.end,
        open: !s.closed,
        durationSec: s.closed
          ? s.durationSec
          : Math.min(Math.round((s.lastEvent - s.start) / 1000), config.sessionTimeoutSec),
        pageViews: s.pageViews,
        actions: s.actions,
        entryPage: s.entryPage,
        exitPage: s.exitPage,
      }));
    return sendJson(res, 200, { sessions });
  }

  // Сообщения из web-формы демонстрационного сайта.
  if (method === 'GET' && route === '/api/feedback') {
    return sendJson(res, 200, { feedback: storage.state.feedback.slice(-50).reverse() });
  }

  // Приём события от клиента (вызывается асинхронно из tracker.js).
  if (method === 'POST' && route === '/api/events') {
    const body = await readBody(req, config.maxBodyBytes);
    const event = storage.addEvent(body, meta(req));
    realtime.notifyChange(event.type, event);
    return sendJson(res, 201, {
      ok: true,
      eventId: event.id,
      sessionId: event.sessionId,
      counters: storage.state.counters,
    });
  }

  // Клиент сообщает, что сессию нужно закрыть (закрытие вкладки/страницы).
  if (method === 'POST' && (route === '/api/session-end' || route === '/api/events/end')) {
    const body = await readBody(req, config.maxBodyBytes);
    const session = storage.endSession(body, meta(req));
    if (session) realtime.notifyChange('session_end');
    return sendJson(res, session ? 200 : 404, {
      ok: Boolean(session),
      session: session || null,
    });
  }

  // Обработка нажатия кнопки «Отправить» web-формы.
  if (method === 'POST' && route === '/api/feedback') {
    const body = await readBody(req, config.maxBodyBytes);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const message = String(body.message || '').trim();
    const errors = [];
    if (name.length < 2) errors.push('Укажите имя (минимум 2 символа).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('Некорректный e-mail.');
    if (message.length < 5) errors.push('Сообщение слишком короткое (минимум 5 символов).');
    if (errors.length) return sendJson(res, 422, { ok: false, errors });

    const item = storage.addFeedback({ ...body, name, email, message }, meta(req));
    realtime.notifyChange('feedback');
    return sendJson(res, 201, { ok: true, id: item.id, createdAt: new Date(item.ts).toISOString() });
  }

  // Экспорт результатов в CSV (кнопка на дашборде).
  if (method === 'GET' && route === '/api/export.csv') {
    const type = url.searchParams.get('type') || 'sessions';
    const stats = computeStats(storage.state, {
      range: url.searchParams.get('range') || '24h',
      page: url.searchParams.get('page') || '',
      limit: 50,
      selfHost: requestHost(req),
    });
    let csv = '';
    if (type === 'pages') {
      csv = toCsv(stats.topPages, ['page', 'views', 'visitors']);
    } else if (type === 'timeline') {
      csv = toCsv(
        stats.timeline.map((p) => ({
          bucket: new Date(p.t).toISOString(),
          label: p.label,
          views: p.views,
          visitors: p.visitors,
        })),
        ['bucket', 'label', 'views', 'visitors']
      );
    } else {
      csv = toCsv(stats.recentSessions, [
        'id', 'visitorId', 'device', 'start', 'end', 'durationSec', 'pageViews', 'actions', 'entryPage', 'exitPage',
      ]);
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return sendText(res, 200, '\uFEFF' + csv, 'text/csv; charset=utf-8', {
      'Content-Disposition': `attachment; filename="stats-${type}-${stamp}.csv"`,
    });
  }

  // Кнопка «Сбросить статистику».
  if (method === 'POST' && route === '/api/reset') {
    const body = await readBody(req, config.maxBodyBytes).catch(() => ({}));
    if (body.confirm !== true) {
      return sendJson(res, 400, { ok: false, error: 'Нужно подтвердить сброс: {"confirm": true}' });
    }
    await storage.reset();
    realtime.notifyChange('reset');
    return sendJson(res, 200, { ok: true, message: 'Статистика очищена' });
  }

  // Кнопка «Заполнить демо-данными» (удобно для демонстрации графиков).
  if (method === 'POST' && route === '/api/seed') {
    const body = await readBody(req, config.maxBodyBytes).catch(() => ({}));
    const result = seedDemo(storage, {
      visitors: Number(body.visitors) || 24,
      days: Number(body.days) || 7,
      seed: Number(body.seed) || Date.now() % 100000,
    });
    await storage.save();
    realtime.notifyChange('seed');
    return sendJson(res, 201, { ok: true, ...result });
  }

  return sendJson(res, 404, { ok: false, error: 'API-метод не найден', route });
}

// ---------------------------------------------------------------------------
// Статические файлы (html / css / js)
// ---------------------------------------------------------------------------

async function handleStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, 'Метод не поддерживается');
  }

  let pathname = decodeURIComponent(url.pathname);
  if (PAGES[pathname]) pathname = PAGES[pathname];
  if (pathname.endsWith('/')) pathname += 'index.html';

  const normalized = path.posix.normalize(pathname);
  const filePath = path.join(config.publicDir, normalized);

  // Защита от выхода за пределы папки public.
  if (!filePath.startsWith(config.publicDir)) {
    return sendText(res, 403, 'Доступ запрещён');
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!MIME[ext]) return sendText(res, 404, 'Не найдено');

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return sendText(res, 404, 'Не найдено');
    const body = await fsp.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext],
      'Content-Length': body.length,
      // Учебный проект: кэш не мешают правкам, но короткого кэша достаточно.
      'Cache-Control': ext === '.html' ? 'no-store' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    if (err.code === 'ENOENT') return sendText(res, 404, 'Не найдено');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Маршрутизация
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      await handleStatic(req, res, url);
    }
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[server]', err);
    if (url.pathname.startsWith('/api/')) {
      sendJson(res, status, { ok: false, error: err.message || 'Внутренняя ошибка' });
    } else if (!res.headersSent) {
      sendText(res, status, err.message || 'Ошибка сервера');
    }
  }
});

// WebSocket-сервер /ws — «живые» обновления статистики для мобильного приложения.
const realtime = createRealtime(server, { storage, config });

function printAccessUrls() {
  const port = server.address().port;
  console.log('');
  console.log('  Сервер статистики аналитики сайта (вариант 7) запущен');
  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  На этом ПК:      http://localhost:${port}/`);
  console.log(`  Дашборд:         http://localhost:${port}/dashboard.html`);
  for (const iface of config.lanAddresses()) {
    console.log(`  В локальной сети: http://${iface.address}:${port}/   (${iface.name})`);
  }
  console.log('  На телефоне (Аврора) откройте адрес из строки «В локальной сети».');
  console.log(`  WebSocket для приложения: ws://<адрес>:${port}/ws`);
  console.log('  Данные: ', storage.statsFile);
  console.log('');
}

async function shutdown(signal) {
  console.log(`\n[${signal}] останавливаю сервер, сохраняю статистику...`);
  realtime.close();
  server.close();
  try {
    await storage.flush();
  } catch (err) {
    console.error('[server] не удалось сохранить статистику:', err.message);
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('[server] необработанное исключение:', err);
});

server.listen(config.port, config.host, () => {
  printAccessUrls();
  if (process.env.SEED_ON_START === '1' && storage.state.events.length === 0) {
    const result = seedDemo(storage, { visitors: 24, days: 7 });
    storage.save().then(() => console.log(`[seed] добавлено демо-событий: ${result.events}`));
  }
});

module.exports = server;

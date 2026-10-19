'use strict';

/**
 * «Живой» слой поверх WebSocket: связывает хранилище статистики с
 * подключёнными клиентами (в т.ч. мобильным приложением под Аврора ОС).
 *
 * Клиент после подключения получает снимок статистики и далее — обновления
 * в реальном времени. Формат сообщений описан в docs/03-api.md.
 */

const computeStats = require('./analytics');
const { WebSocketServer } = require('./websocket');

const REFRESH_DEBOUNCE_MS = 500;

/**
 * @param {import('node:http').Server} httpServer
 * @param {{ storage: object, config: object, path?: string }} deps
 */
function createRealtime(httpServer, deps) {
  const { storage, config } = deps;
  const wss = new WebSocketServer(httpServer, { path: deps.path || '/ws' });

  let refreshTimer = null;
  let heartbeatTimer = null;

  function selfHostOf(req) {
    return String(req.headers.host || '').split(':')[0];
  }

  function computeFor(conn) {
    return computeStats(storage.state, {
      range: conn.range,
      page: conn.page,
      limit: conn.limit,
      selfHost: conn.host,
    });
  }

  function sendStats(conn) {
    if (conn.closed) return;
    conn.sendJson({ type: 'stats', data: computeFor(conn) });
  }

  function sendPages(conn) {
    const map = new Map();
    for (const e of storage.state.events) {
      if (e.type === 'pageview') map.set(e.page, (map.get(e.page) || 0) + 1);
    }
    const pages = [...map.entries()]
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views);
    conn.sendJson({ type: 'pages', data: pages });
  }

  function scheduleRefresh() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      for (const conn of wss.clients) {
        if (!conn.closed) sendStats(conn);
      }
    }, REFRESH_DEBOUNCE_MS);
    if (refreshTimer.unref) refreshTimer.unref();
  }

  /**
   * Уведомляет всех клиентов об изменении данных.
   * @param {string} reason  краткая причина (pageview, feedback, seed, reset, ...)
   * @param {object} [event] необязательное событие для «ленты в реальном времени»
   */
  function notifyChange(reason, event) {
    wss.broadcast({
      type: 'update',
      reason,
      counters: storage.state.counters,
      serverTime: Date.now(),
    });
    if (event) {
      wss.broadcast({ type: 'event', reason, event, counters: storage.state.counters });
    }
    scheduleRefresh();
  }

  function handleMessage(conn, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      conn.sendJson({ type: 'error', error: 'Ожидался JSON' });
      return;
    }
    if (!msg || typeof msg !== 'object') {
      conn.sendJson({ type: 'error', error: 'Ожидался объект JSON' });
      return;
    }

    switch (msg.type) {
      case 'subscribe':
        if (typeof msg.range === 'string') conn.range = msg.range;
        if (typeof msg.page === 'string') conn.page = msg.page;
        if (msg.limit) conn.limit = msg.limit;
        sendStats(conn);
        break;

      case 'stats':
      case 'refresh':
        sendStats(conn);
        break;

      case 'pages':
        sendPages(conn);
        break;

      case 'ping':
        conn.sendJson({ type: 'pong', serverTime: Date.now(), echo: msg.t || null });
        break;

      case 'track': {
        const input = msg.event && typeof msg.event === 'object' ? msg.event : msg;
        const event = storage.addEvent(input, {
          ip: conn.remoteAddress,
          ua: input.ua || '',
          host: conn.host,
        });
        conn.sendJson({
          type: 'tracked',
          eventId: event.id,
          sessionId: event.sessionId,
          counters: storage.state.counters,
        });
        notifyChange('track', event);
        break;
      }

      default:
        conn.sendJson({ type: 'error', error: `Неизвестный тип сообщения: ${msg.type}` });
    }
  }

  wss.on('connection', (conn, req) => {
    conn.range = '24h';
    conn.page = '';
    conn.limit = 15;
    conn.host = selfHostOf(req);

    conn.sendJson({
      type: 'hello',
      service: 'lab01-stat-server',
      version: config.version,
      protocol: 'aurora-stat/1',
      serverTime: Date.now(),
      heartbeatSec: config.heartbeatSec,
    });
    sendStats(conn);

    conn.on('message', (text, isText) => {
      if (!isText) return;
      handleMessage(conn, text);
    });
  });

  heartbeatTimer = setInterval(() => {
    for (const conn of wss.clients) {
      if (conn.closed) continue;
      if (conn.isAlive === false) {
        conn.close(1001, 'Нет ответа на ping');
        continue;
      }
      conn.isAlive = false;
      conn.ping();
    }
  }, Math.max(5, config.heartbeatSec) * 1000);
  if (heartbeatTimer.unref) heartbeatTimer.unref();

  function close() {
    if (refreshTimer) clearTimeout(refreshTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    wss.close();
  }

  return { wss, notifyChange, close };
}

module.exports = { createRealtime };

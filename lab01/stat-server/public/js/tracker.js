'use strict';

/**
 * tracker.js — асинхронный сбор статистики посещений (клиентская часть).
 *
 * Подключается на каждой странице сайта. Делает:
 *   1) pageview   — при открытии страницы;
 *   2) action     — при клике по элементу с атрибутом data-track;
 *   3) heartbeat  — каждые 30 с, пока страница видима (продлевает сессию);
 *   4) session_end— при уходе со страницы (fetch keepalive или sendBeacon).
 *
 * Все обращения к серверу асинхронные: async/await + fetch + Promise.
 * Не использует современный синтаксис (optional chaining и т.п.),
 * чтобы работать в браузере телефона под управлением Аврора.
 */

(function (global) {
  var EVENT_URL = '/api/events';
  var END_URL = '/api/session-end';
  var VISITOR_KEY = 'weblab.visitorId';
  var SESSION_KEY = 'weblab.sessionId';
  var CONSENT_KEY = 'weblab.consent';
  var HEARTBEAT_MS = 30000;
  var MAX_QUEUE = 25;

  // ---------------------------------------------------------------- utils --

  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    var bytes = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = [];
    for (var j = 0; j < 16; j += 1) {
      hex.push(('0' + bytes[j].toString(16)).slice(-2));
    }
    return hex.slice(0, 4).join('') + '-' + hex.slice(4, 6).join('') + '-' +
      hex.slice(6, 8).join('') + '-' + hex.slice(8, 10).join('') + '-' + hex.slice(10).join('');
  }

  function readLS(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeLS(key, value) {
    try { global.localStorage.setItem(key, value); } catch (e) { /* приватный режим */ }
  }
  function readSS(key) {
    try { return global.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function writeSS(key, value) {
    try { global.sessionStorage.setItem(key, value); } catch (e) { /* приватный режим */ }
  }

  var visitorId = readLS(VISITOR_KEY) || uuid();
  writeLS(VISITOR_KEY, visitorId);

  var sessionId = readSS(SESSION_KEY) || uuid();
  writeSS(SESSION_KEY, sessionId);

  var consent = readLS(CONSENT_KEY);
  consent = consent === null ? true : consent === '1';

  var queue = [];          // события, не отправленные из-за ошибок сети
  var heartbeatTimer = null;
  var finished = false;

  // ------------------------------------------------------------- payload ---

  function basePayload() {
    return {
      visitorId: visitorId,
      sessionId: sessionId,
      page: global.location.pathname,
      origin: global.location.origin || '',
      referrer: global.document.referrer || '',
      ua: global.navigator.userAgent || '',
      lang: global.navigator.language || '',
      screen: (global.screen ? global.screen.width + 'x' + global.screen.height : ''),
      tz: (function () {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
      })(),
      ts: Date.now()
    };
  }

  // ------------------------------------------------------------- sending ---

  async function postJson(url, payload, useKeepalive) {
    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: Boolean(useKeepalive),
      cache: 'no-store',
      credentials: 'omit'
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json().catch(function () { return {}; });
  }

  /** Отправляет событие; при неудаче кладёт его в очередь на повтор. */
  async function sendEvent(type, extra) {
    if (!consent) return null;
    var payload = basePayload();
    payload.type = type;
    if (extra) {
      Object.keys(extra).forEach(function (key) { payload[key] = extra[key]; });
    }

    try {
      var result = await postJson(EVENT_URL, payload, false);
      flushQueue();
      return result;
    } catch (err) {
      if (queue.length < MAX_QUEUE) queue.push(payload);
      console.warn('[tracker] событие не отправлено, добавлено в очередь:', err.message);
      return null;
    }
  }

  /** Повторяет неотправленные события по одному (Promise-цепочка). */
  async function flushQueue() {
    if (!queue.length) return;
    var pending = queue.splice(0, queue.length);
    for (var i = 0; i < pending.length; i += 1) {
      try {
        await postJson(EVENT_URL, pending[i], false);
      } catch (err) {
        queue.push(pending[i]);
        return;
      }
    }
  }

  /** Финальное сообщение о закрытии сессии (для корректной длительности). */
  async function endSession() {
    if (finished || !consent) return;
    finished = true;
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }

    var payload = basePayload();
    payload.type = 'session_end';

    // sendBeacon надёжнее работает при закрытии вкладки.
    if (global.navigator && typeof global.navigator.sendBeacon === 'function') {
      try {
        var blob = new global.Blob([JSON.stringify(payload)], { type: 'application/json' });
        if (global.navigator.sendBeacon(END_URL, blob)) return;
      } catch (e) { /* переходим к fetch */ }
    }
    try {
      await postJson(END_URL, payload, true);
    } catch (err) {
      console.warn('[tracker] не удалось сообщить о закрытии сессии:', err.message);
    }
  }

  // ------------------------------------------------------------- tracking --

  function trackPageView() {
    sendEvent('pageview');
  }

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(function () {
      if (global.document.visibilityState === 'visible') sendEvent('heartbeat');
    }, HEARTBEAT_MS);
  }

  function bindClickTracking() {
    global.document.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== global.document) {
        if (target.getAttribute && target.getAttribute('data-track')) {
          sendEvent('action', { label: target.getAttribute('data-track') });
          break;
        }
        target = target.parentNode;
      }
    }, true);
  }

  function bindLifecycle() {
    global.document.addEventListener('visibilitychange', function () {
      if (global.document.visibilityState === 'hidden') {
        endSession();
      } else if (finished) {
        // Пользователь вернулся во вкладку — начинаем новую сессию наблюдений.
        finished = false;
        startHeartbeat();
      }
    });
    global.addEventListener('pagehide', endSession);
    global.addEventListener('beforeunload', endSession);
  }

  function renderIds() {
    var v = global.document.getElementById('visitorId');
    var s = global.document.getElementById('sessionId');
    if (v) v.textContent = visitorId;
    if (s) s.textContent = sessionId;
  }

  // ------------------------------------------------------------- public ----

  var Tracker = {
    visitorId: visitorId,
    sessionId: sessionId,
    hasConsent: function () { return consent; },
    setConsent: function (value) {
      consent = Boolean(value);
      writeLS(CONSENT_KEY, consent ? '1' : '0');
      if (consent && !finished) { startHeartbeat(); sendEvent('pageview'); }
    },
    sendEvent: sendEvent,
    action: function (label) { return sendEvent('action', { label: label || 'click' }); },
    endSession: endSession,
    queued: function () { return queue.length; }
  };

  global.MAITracker = Tracker;

  function init() {
    renderIds();
    trackPageView();
    bindClickTracking();
    bindLifecycle();
    startHeartbeat();
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);

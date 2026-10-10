'use strict';

/**
 * Хранилище статистики.
 *
 * Все данные лежат в одном JSON-файле (data/stats.json):
 *   visitors  — посетители (уникальные посетители = размер этого словаря);
 *   sessions  — сессии visits (длительность, число просмотров, страницы);
 *   events    — «сырые» события (pageview / action / heartbeat / session_end);
 *   feedback  — сообщения из web-формы демонстрационного сайта.
 *
 * Запись на диск выполняется пачками (debounce), файл заменяется атомарно
 * (запись во временный файл + rename), чтобы статистику не повредить обрывом.
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const SCHEMA_VERSION = 1;
const ID_RE = /^[A-Za-z0-9_.:#-]{1,64}$/;

/** Простое определение типа устройства по User-Agent (в т.ч. Аврора / Sailfish). */
function detectDevice(ua) {
  const s = String(ua || '');
  if (/aurora|sailfish|jolla/i.test(s)) return 'aurora';
  if (/ipad|tablet|playbook|silk|tablet browser/i.test(s)) return 'tablet';
  if (/mobi|android|iphone|ipod|windows phone|blackberry|nokia/i.test(s)) return 'mobile';
  if (/bot|crawl|spider|curl|python|node-fetch|wget/i.test(s)) return 'bot';
  return 'desktop';
}

function clamp(value, max) {
  const s = String(value === undefined || value === null ? '' : value);
  return s.length > max ? s.slice(0, max) : s;
}

function safeId(value, fallback) {
  const s = clamp(value, 64);
  return ID_RE.test(s) ? s : fallback;
}

function safePage(value) {
  const s = clamp(value, 200) || '/';
  // Храним только путь (без схемы/хоста/query), чтобы статистика была чистой.
  try {
    const u = new URL(s, 'http://localhost');
    return (u.pathname || '/').slice(0, 120);
  } catch (e) {
    return '/';
  }
}

function hostOf(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname || null;
  } catch (err) {
    return null;
  }
}

function emptyState() {
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    counters: {
      events: 0,
      pageViews: 0,
      actions: 0,
      heartbeats: 0,
      sessionEnds: 0,
      feedback: 0,
      trimmedEvents: 0,
    },
    visitors: {},
    sessions: {},
    events: [],
    feedback: [],
  };
}

class Storage {
  constructor(cfg) {
    this.cfg = cfg;
    this.state = emptyState();
    this.saveTimer = null;
    this.saving = null;
    this.dirty = false;
  }

  /** Загружает статистику с диска (или создаёт пустую). */
  load() {
    try {
      const raw = fs.readFileSync(this.cfg.dataFile, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = Object.assign(emptyState(), parsed);
      this.state.counters = Object.assign(emptyState().counters, parsed.counters || {});
      this.state.visitors = parsed.visitors || {};
      this.state.sessions = parsed.sessions || {};
      this.state.events = Array.isArray(parsed.events) ? parsed.events : [];
      this.state.feedback = Array.isArray(parsed.feedback) ? parsed.feedback : [];
      this.loadedCount = this.state.events.length;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('[storage] не удалось прочитать файл статистики, начинаю с пустого:', err.message);
      }
      this.state = emptyState();
      this.loadedCount = 0;
    }
    return this.state;
  }

  /** Откладывает запись на диск (несколько событий подряд пишутся одним файлом). */
  scheduleSave() {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save().catch((err) => console.error('[storage] ошибка записи:', err.message));
    }, this.cfg.saveDebounceMs);
    if (this.saveTimer.unref) this.saveTimer.unref();
  }

  /** Атомарная запись: tmp-файл + rename. */
  async save() {
    if (this.saving) return this.saving;
    this.state.updatedAt = new Date().toISOString();
    const dir = path.dirname(this.cfg.dataFile);
    await fsp.mkdir(dir, { recursive: true });
    const tmp = `${this.cfg.dataFile}.${process.pid}.tmp`;
    const payload = JSON.stringify(this.state, null, 2);
    this.saving = (async () => {
      await fsp.writeFile(tmp, payload, 'utf8');
      await fsp.rename(tmp, this.cfg.dataFile);
    })();
    try {
      await this.saving;
      this.dirty = false;
      this.savedOnce = true;
    } finally {
      this.saving = null;
    }
  }

  /** Принудительная запись при остановке процесса. */
  async flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty || !this.savedOnce) {
      await this.save();
    }
  }

  /** Полная очистка статистики. */
  async reset() {
    this.state = emptyState();
    await this.save();
    return this.state;
  }

  closeSession(session, at) {
    if (!session || session.closed) return session;
    session.closed = true;
    session.end = Math.max(session.start, at || session.lastEvent);
    session.durationSec = Math.min(
      Math.round((session.end - session.start) / 1000),
      this.cfg.sessionTimeoutSec
    );
    return session;
  }

  /**
   * Добавляет событие от клиента и обновляет производные показатели.
   * Возвращает записанное событие.
   */
  addEvent(input = {}, meta = {}) {
    const now = Date.now();
    const tsRaw = Number(input.ts);
    const ts = Number.isFinite(tsRaw) && tsRaw > 0 && tsRaw <= now ? tsRaw : now;

    const visitorId = safeId(input.visitorId, crypto.randomUUID());
    const sessionSeed = safeId(input.sessionId, crypto.randomUUID());
    const ua = clamp(input.ua || meta.ua, 250);
    const device = detectDevice(ua);
    const page = safePage(input.page);
    const referrer = clamp(input.referrer || '', 250);
    // «Внутренний» переход — посетитель пришёл с той же страницы/сайта, на котором стоит сервер.
    // Браузер сообщает origin (адрес своей страницы), поэтому сравнение не зависит от того,
    // по какому адресу открыли сайт: localhost, 127.0.0.1 или 192.168.1.15.
    const ownHost = hostOf(input.origin || (meta.host ? `http://${meta.host}` : ''));
    const referrerHost = hostOf(referrer);
    const internalReferrer = Boolean(referrerHost) && referrerHost === ownHost;
    const type = ['pageview', 'action', 'heartbeat', 'session_end'].includes(input.type)
      ? input.type
      : 'pageview';

    const state = this.state;

    let visitor = state.visitors[visitorId];
    if (!visitor) {
      visitor = {
        id: visitorId,
        firstSeen: ts,
        lastSeen: ts,
        visits: 0,
        pageViews: 0,
        ua,
        device,
        lang: clamp(input.lang, 20),
        screen: clamp(input.screen, 40),
        tz: clamp(input.tz, 40),
      };
      state.visitors[visitorId] = visitor;
    }
    visitor.lastSeen = Math.max(visitor.lastSeen, ts);
    if (ua) visitor.ua = ua;
    if (device !== 'unknown') visitor.device = device;

    // Если с прошлой активности прошло больше sessionTimeout — это уже новая сессия.
    let sessionId = sessionSeed;
    let session = state.sessions[sessionId];
    if (session && !session.closed && ts - session.lastEvent > this.cfg.sessionTimeoutSec * 1000) {
      this.closeSession(session, session.lastEvent);
      session = null;
    }
    if (session && session.closed) session = null;

    if (!session) {
      visitor.visits += 1;
      // sessionId может уже использоваться (например, клиент вернулся во вкладку
      // после session_end) — тогда создаём уникальный идентификатор.
      sessionId = sessionSeed;
      let attempt = 1;
      while (state.sessions[sessionId]) {
        attempt += 1;
        sessionId = `${sessionSeed}#${visitor.visits}-${attempt}`;
      }
      session = {
        id: sessionId,
        visitorId,
        start: ts,
        lastEvent: ts,
        end: null,
        closed: false,
        durationSec: 0,
        pageViews: 0,
        actions: 0,
        pages: {},
        entryPage: page,
        exitPage: page,
        referrer,
        referrerInternal: internalReferrer,
        ua,
        device,
      };
      state.sessions[sessionId] = session;
      this.trimSessions();
    }

    session.lastEvent = Math.max(session.lastEvent, ts);
    session.exitPage = page;

    const event = {
      id: crypto.randomUUID(),
      ts,
      type,
      visitorId,
      sessionId,
      page,
      label: clamp(input.label, 80),
      referrer,
      referrerInternal: internalReferrer,
      device,
      ip: clamp(meta.ip, 45),
    };

    if (type === 'pageview') {
      session.pageViews += 1;
      session.pages[page] = (session.pages[page] || 0) + 1;
      visitor.pageViews += 1;
      state.counters.pageViews += 1;
    } else if (type === 'action') {
      session.actions += 1;
      state.counters.actions += 1;
    } else if (type === 'heartbeat') {
      state.counters.heartbeats += 1;
    } else if (type === 'session_end') {
      state.counters.sessionEnds += 1;
    }

    this.insertEvent(event);
    state.counters.events += 1;
    this.trimEvents();

    if (type === 'session_end') {
      this.closeSession(session, ts);
    }

    this.scheduleSave();
    return event;
  }

  /** Явно закрывает сессию (например, когда клиент закрыл вкладку). */
  endSession(input = {}, meta = {}) {
    const now = Date.now();
    const sessionId = safeId(input.sessionId, '');
    const session = sessionId ? this.state.sessions[sessionId] : null;
    if (!session) return null;
    const at = Number(input.ts) > 0 ? Number(input.ts) : (session.lastEvent || now);
    this.closeSession(session, at);
    this.scheduleSave();
    return session;
  }

  addFeedback(input = {}, meta = {}) {
    const item = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      name: clamp(input.name, 80),
      email: clamp(input.email, 120),
      topic: clamp(input.topic, 40),
      message: clamp(input.message, 1000),
      page: safePage(input.page),
      visitorId: safeId(input.visitorId, ''),
      sessionId: safeId(input.sessionId, ''),
      ip: clamp(meta.ip, 45),
    };
    this.state.feedback.push(item);
    this.state.counters.feedback += 1;
    if (this.state.feedback.length > this.cfg.maxFeedback) {
      this.state.feedback.splice(0, this.state.feedback.length - this.cfg.maxFeedback);
    }
    this.scheduleSave();
    return item;
  }

  /**
   * Вставляет событие так, чтобы массив events всегда был отсортирован по времени.
   * В реальном времени события приходят по порядку (быстрая вставка в конец),
   * а при генерации демо-данных или поздних повторах нужна бинарная вставка.
   */
  insertEvent(event) {
    const events = this.state.events;
    if (!events.length || event.ts >= events[events.length - 1].ts) {
      events.push(event);
      return;
    }
    let low = 0;
    let high = events.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (events[mid].ts <= event.ts) low = mid + 1;
      else high = mid;
    }
    events.splice(low, 0, event);
  }

  trimEvents() {
    const overflow = this.state.events.length - this.cfg.maxEvents;
    if (overflow > 0) {
      this.state.events.splice(0, overflow);
      this.state.counters.trimmedEvents += overflow;
    }
  }

  trimSessions() {
    const ids = Object.keys(this.state.sessions);
    const overflow = ids.length - this.cfg.maxSessions;
    if (overflow <= 0) return;
    // Выбрасываем самые старые закрытые сессии.
    const closable = ids
      .filter((id) => this.state.sessions[id].closed)
      .sort((a, b) => this.state.sessions[a].end - this.state.sessions[b].end);
    for (let i = 0; i < overflow && i < closable.length; i += 1) {
      delete this.state.sessions[closable[i]];
    }
  }

  get statsFile() {
    return this.cfg.dataFile;
  }
}

module.exports = Storage;
module.exports.detectDevice = detectDevice;
module.exports.emptyState = emptyState;

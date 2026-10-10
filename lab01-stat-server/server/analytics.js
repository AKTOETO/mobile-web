'use strict';

/**
 * Аналитика: превращает накопленные события в показатели и данные для графиков.
 * Никаких внешних библиотек — только обычная обработка массивов/объектов.
 */

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const RANGES = {
  '24h': { ms: 24 * HOUR, bucketMs: HOUR, label: 'последние 24 часа' },
  '7d': { ms: 7 * DAY, bucketMs: 6 * HOUR, label: 'последние 7 дней' },
  '30d': { ms: 30 * DAY, bucketMs: DAY, label: 'последние 30 дней' },
  all: { ms: null, bucketMs: DAY, label: 'всё время' },
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function bucketKey(ts, bucketMs) {
  const d = new Date(ts);
  if (bucketMs >= DAY) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const hour = Math.floor(d.getHours() / (bucketMs / HOUR));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hour * (bucketMs / HOUR))}:00`;
}

function bucketLabel(ts, bucketMs) {
  const d = new Date(ts);
  if (bucketMs >= DAY) return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  return `${pad(d.getHours())}:00`;
}

function hostOf(referrer) {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname || null;
  } catch (e) {
    return null;
  }
}

/**
 * @param {object} state  полное состояние хранилища
 * @param {object} opts   { range, page, selfHost, limit }
 */
function computeStats(state, opts = {}) {
  const rangeKey = RANGES[opts.range] ? opts.range : '24h';
  const range = RANGES[rangeKey];
  const now = Date.now();
  const from = range.ms === null ? 0 : now - range.ms;
  const pageFilter = opts.page ? String(opts.page) : '';
  const selfHost = opts.selfHost || '';
  const limit = Math.min(Math.max(Number(opts.limit) || 15, 1), 50);

  const inWindow = (ts) => ts >= from && ts <= now;

  // --- события окна -------------------------------------------------------
  const events = state.events.filter(
    (e) => inWindow(e.ts) && (!pageFilter || e.page === pageFilter)
  );
  const pageViewEvents = events.filter((e) => e.type === 'pageview');

  const visitorsInWindow = new Set();
  for (const e of events) visitorsInWindow.add(e.visitorId);

  // --- сессии окна --------------------------------------------------------
  const sessions = Object.values(state.sessions)
    .filter((s) => inWindow(s.start) || inWindow(s.lastEvent))
    .filter((s) => !pageFilter || s.pages[pageFilter])
    .sort((a, b) => b.start - a.start);

  const durations = sessions
    .map((s) => (s.closed ? s.durationSec : Math.min(Math.round((s.lastEvent - s.start) / 1000), 1800)))
    .filter((d) => Number.isFinite(d));
  const openSessions = sessions.filter((s) => !s.closed).length;

  const totalPageViews = sessions.reduce((acc, s) => acc + s.pageViews, 0);
  const bounced = sessions.filter((s) => s.pageViews <= 1).length;

  // --- посещённые страницы ------------------------------------------------
  const pagesMap = new Map();
  for (const e of pageViewEvents) {
    const cur = pagesMap.get(e.page) || { page: e.page, views: 0, visitors: new Set() };
    cur.views += 1;
    cur.visitors.add(e.visitorId);
    pagesMap.set(e.page, cur);
  }
  const topPages = [...pagesMap.values()]
    .map((p) => ({ page: p.page, views: p.views, visitors: p.visitors.size }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);

  // --- временной ряд (график «просмотры по времени») ----------------------
  const timeline = new Map();
  const windowStart = range.ms === null
    ? (state.events.length ? state.events[0].ts : now - range.bucketMs)
    : from;
  for (let ts = windowStart; ts <= now; ts += range.bucketMs) {
    timeline.set(bucketKey(ts, range.bucketMs), { t: ts, views: 0, visitors: new Set() });
  }
  for (const e of pageViewEvents) {
    const key = bucketKey(e.ts, range.bucketMs);
    let bucket = timeline.get(key);
    if (!bucket) {
      bucket = { t: Math.floor(e.ts / range.bucketMs) * range.bucketMs, views: 0, visitors: new Set() };
      timeline.set(key, bucket);
    }
    bucket.views += 1;
    bucket.visitors.add(e.visitorId);
  }
  const timelinePoints = [...timeline.values()]
    .sort((a, b) => a.t - b.t)
    .map((b) => ({
      t: b.t,
      label: bucketLabel(b.t, range.bucketMs),
      views: b.views,
      visitors: b.visitors.size,
    }));

  // --- устройства ----------------------------------------------------------
  const devices = {};
  for (const s of sessions) {
    devices[s.device] = (devices[s.device] || 0) + 1;
  }

  // --- источники переходов -------------------------------------------------
  const sources = { direct: 0, internal: 0 };
  const external = new Map();
  for (const s of sessions) {
    const host = hostOf(s.referrer);
    if (!host) {
      sources.direct += 1;
    } else if (s.referrerInternal || (selfHost && host === selfHost)) {
      sources.internal += 1;
    } else {
      external.set(host, (external.get(host) || 0) + 1);
    }
  }
  const topExternal = [...external.entries()]
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // --- посетители -----------------------------------------------------------
  const allVisitors = Object.values(state.visitors);
  const returning = allVisitors.filter((v) => v.visits > 1).length;

  // --- «сейчас на сайте» ----------------------------------------------------
  const activeWindowMs = Math.max(5 * 60 * 1000, 0);
  const activeVisitors = allVisitors.filter((v) => now - v.lastSeen <= activeWindowMs).length;

  // --- всё время (без фильтра по диапазону) ---------------------------------
  const allSessions = Object.values(state.sessions);
  const lifetimeDurations = allSessions
    .map((s) => (s.closed
      ? s.durationSec
      : Math.min(Math.round((s.lastEvent - s.start) / 1000), 1800)))
    .filter((d) => Number.isFinite(d));

  const lifetime = {
    pageViews: state.counters.pageViews,
    uniqueVisitors: allVisitors.length,
    sessions: allSessions.length,
    avgSessionDurationSec: lifetimeDurations.length
      ? Math.round(lifetimeDurations.reduce((a, b) => a + b, 0) / lifetimeDurations.length)
      : 0,
    avgPagesPerSession: allSessions.length
      ? Math.round((allSessions.reduce((acc, s) => acc + s.pageViews, 0) / allSessions.length) * 100) / 100
      : 0,
    newVisitors: allVisitors.filter((v) => v.visits === 1).length,
    returningVisitors: returning,
    actions: state.counters.actions,
    feedback: state.counters.feedback,
    firstEvent: state.events.length ? state.events[0].ts : null,
    lastEvent: state.events.length ? state.events[state.events.length - 1].ts : null,
  };

  return {
    generatedAt: now,
    range: {
      key: rangeKey,
      label: range.label,
      from: range.ms === null ? (lifetime.firstEvent || now) : from,
      to: now,
      bucketMs: range.bucketMs,
      pageFilter,
    },
    totals: {
      pageViews: totalPageViews,
      uniqueVisitors: visitorsInWindow.size,
      sessions: sessions.length,
      openSessions,
      newVisitors: allVisitors.filter(
        (v) => v.firstSeen >= from && visitorsInWindow.has(v.id)
      ).length,
      returningVisitors: allVisitors.filter(
        (v) => v.visits > 1 && visitorsInWindow.has(v.id)
      ).length,
      actions: events.filter((e) => e.type === 'action').length,
      avgSessionDurationSec: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      maxSessionDurationSec: durations.length ? Math.max(...durations) : 0,
      avgPagesPerSession: sessions.length
        ? Math.round((totalPageViews / sessions.length) * 100) / 100
        : 0,
      bounceRate: sessions.length ? Math.round((bounced / sessions.length) * 1000) / 10 : 0,
      activeNow: activeVisitors,
    },
    lifetime,
    timeline: timelinePoints,
    topPages,
    devices,
    sources: { ...sources, external: topExternal },
    recentSessions: sessions.slice(0, limit).map((s) => ({
      id: s.id,
      visitorId: s.visitorId,
      device: s.device,
      start: s.start,
      end: s.end,
      durationSec: s.closed
        ? s.durationSec
        : Math.min(Math.round((s.lastEvent - s.start) / 1000), 1800),
      pageViews: s.pageViews,
      actions: s.actions,
      entryPage: s.entryPage,
      exitPage: s.exitPage,
      open: !s.closed,
    })),
    counters: state.counters,
  };
}

module.exports = computeStats;
module.exports.RANGES = RANGES;

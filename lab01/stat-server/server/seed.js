'use strict';

/**
 * Генератор демонстрационных данных.
 *
 * Нужен, чтобы на защите/демонстрации графики были наполнены:
 * сервер сам «проигрывает» поведение N посетителей за последние D дней
 * (включая посетителей с мобильных устройств и с Аврора).
 */

const PAGES = [
  { page: '/index.html', weight: 30 },
  { page: '/catalog.html', weight: 22 },
  { page: '/about.html', weight: 14 },
  { page: '/contact.html', weight: 10 },
  { page: '/', weight: 12 },
  { page: '/dashboard.html', weight: 12 },
];

const UAS = [
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', weight: 40 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15', weight: 18 },
  { ua: 'Mozilla/5.0 (Linux; Android 13; SM-A5360) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Mobile Safari/537.36', weight: 22 },
  { ua: 'Mozilla/5.0 (Linux; U; Android 8.1.0; ru-ru; Jolla X) AppleWebKit/537.36 (KHTML, like Gecko) Version/2.0 Mobile Safari/537.36 Aurora Browser/2.0.0.21', weight: 12 },
  { ua: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', weight: 8 },
];

const REFERRERS = [
  { referrer: '', weight: 26 },
  { referrer: 'http://localhost:3000/index.html', weight: 28 },
  { referrer: 'https://google.com/search?q=mai', weight: 18 },
  { referrer: 'https://mai.ru/study', weight: 12 },
  { referrer: 'https://pikabu.ru/story/analitika_site', weight: 8 },
  { referrer: 'https://t.me/mai_channel', weight: 8 },
];

function pickWeighted(list, rnd) {
  const weight = (item) => (item && typeof item.weight === 'number' ? item.weight : 1);
  const total = list.reduce((acc, item) => acc + weight(item), 0);
  let x = rnd() * total;
  for (const item of list) {
    x -= weight(item);
    if (x <= 0) return item;
  }
  return list[list.length - 1];
}

/** Детерминированный ГПСЧ, чтобы демо-данные были воспроизводимыми. */
function makeRandom(seed) {
  let s = seed >>> 0 || 123456789;
  return function rnd() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * @param {import('./storage')} storage
 * @param {object} opts { visitors, days, seed }
 */
function seedDemo(storage, opts = {}) {
  const visitorsCount = Math.max(1, Number(opts.visitors) || 24);
  const days = Math.max(1, Number(opts.days) || 7);
  const rnd = makeRandom(Number(opts.seed) || 20240501);
  const DAY = 24 * 3600 * 1000;
  const now = Date.now();

  let created = 0;

  for (let i = 0; i < visitorsCount; i += 1) {
    const visitorId = `demo-${String(i + 1).padStart(3, '0')}`;
    const profile = pickWeighted(UAS, rnd);
    const visits = 1 + Math.floor(rnd() * (rnd() > 0.65 ? 4 : 1));

    for (let v = 0; v < visits; v += 1) {
      const dayAgo = Math.floor(rnd() * days);
      const hour = Math.floor(8 + rnd() * 13); // деловая активность 8:00–21:00
      const start = now - dayAgo * DAY - Math.floor(rnd() * 2) * 3600 * 1000;
      const startTs = new Date(start).setHours(hour, Math.floor(rnd() * 60), 0, 0);
      const sessionId = `demo-s-${visitorId}-${v + 1}`;

      const pageCount = 1 + Math.floor(rnd() * 5);
      let ts = Math.min(startTs, now - 1000);

      storage.addEvent(
        {
          type: 'pageview',
          visitorId,
          sessionId,
          page: pickWeighted(PAGES, rnd).page,
          referrer: pickWeighted(REFERRERS, rnd).referrer,
          ua: profile.ua,
          ts,
          lang: 'ru-RU',
          screen: '1080x1920',
          tz: 'Europe/Moscow',
        },
        { ip: '192.168.1.' + (10 + (i % 120)), host: 'localhost:3000' }
      );
      created += 1;

      for (let p = 1; p < pageCount; p += 1) {
        ts += Math.floor((20 + rnd() * 160) * 1000); // 20–180 с на страницу
        if (ts > now) break;
        storage.addEvent(
          {
            type: 'pageview',
            visitorId,
            sessionId,
            page: pickWeighted(PAGES, rnd).page,
            referrer: 'http://localhost:3000/index.html',
            ua: profile.ua,
            ts,
          },
          { ip: '192.168.1.' + (10 + (i % 120)), host: 'localhost:3000' }
        );
        created += 1;

        if (rnd() > 0.6) {
          storage.addEvent(
            {
              type: 'action',
              visitorId,
              sessionId,
              page: '/catalog.html',
              label: rnd() > 0.5 ? 'filter:apply' : 'catalog:more',
              ua: profile.ua,
              ts: ts + 2000,
            },
            { ip: '192.168.1.' + (10 + (i % 120)), host: 'localhost:3000' }
          );
        }
      }

      const lastTs = Math.min(ts + Math.floor(rnd() * 120000), now);
      storage.addEvent(
        {
          type: 'session_end',
          visitorId,
          sessionId,
          page: '/index.html',
          ua: profile.ua,
          ts: lastTs,
        },
        { ip: '192.168.1.' + (10 + (i % 120)), host: 'localhost:3000' }
      );
    }
  }

  return { events: created, visitors: visitorsCount, days };
}

module.exports = seedDemo;

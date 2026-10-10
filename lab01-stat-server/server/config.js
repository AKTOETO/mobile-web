'use strict';

/**
 * Конфигурация сервера статистики (лабораторная работа №1, вариант 7).
 * Все параметры можно переопределить переменными окружения,
 * чтобы запускать сервер в локальной сети на нужном адресе/порту.
 */

const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function num(name, value) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : value;
}

const config = {
  // 0.0.0.0 — сервер доступен не только с самого ПК, но и по локальной сети
  // (нужно для демонстрации в браузере телефона под управлением Аврора).
  host: process.env.HOST || '0.0.0.0',
  port: num('PORT', 3000),

  publicDir: path.join(ROOT, 'public'),
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
  dataFile: process.env.DATA_FILE || '',

  // Сессия закрывается, если между событиями посетителя больше этого времени.
  sessionTimeoutSec: num('SESSION_TIMEOUT_SEC', 1800),
  // Период «пульса» клиента: пока страница открыта, клиент продлевает сессию.
  heartbeatSec: num('HEARTBEAT_SEC', 30),

  // Защита от разрастания файла статистики.
  maxEvents: num('MAX_EVENTS', 20000),
  maxSessions: num('MAX_SESSIONS', 5000),
  maxFeedback: num('MAX_FEEDBACK', 500),

  // Как часто сервер сбрасывает накопленные события на диск.
  saveDebounceMs: num('SAVE_DEBOUNCE_MS', 400),

  // Максимальный размер тела POST-запроса (байт).
  maxBodyBytes: num('MAX_BODY_BYTES', 65536),

  version: '1.0.0',
  startedAt: Date.now(),
};

config.dataFile = config.dataFile || path.join(config.dataDir, 'stats.json');

/** Возвращает список IPv4-адресов машины — для вывода ссылки на локальную сеть. */
config.lanAddresses = function lanAddresses() {
  const result = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const info of interfaces[name] || []) {
      if (info.family === 'IPv4' && !info.internal) {
        result.push({ name, address: info.address });
      }
    }
  }
  return result;
};

module.exports = config;

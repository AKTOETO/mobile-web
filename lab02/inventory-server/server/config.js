'use strict';

/**
 * Конфигурация сервера инвентаря (лабораторная работа №2, вариант 7).
 *
 * Все параметры можно переопределить переменными окружения — так сервер
 * запускается и в локальной сети, и в тестах на свободных портах.
 */

const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function num(name, value) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : value;
}

const config = {
  // 0.0.0.0 — сервер доступен не только с ПК, но и из локальной сети/эмулятора.
  host: process.env.HOST || '0.0.0.0',

  // HTTPS — основной порт; HTTP отвечает редиректом на HTTPS.
  httpsPort: num('HTTPS_PORT', 8443),
  httpPort: num('HTTP_PORT', 8080),

  publicDir: path.join(ROOT, 'public'),
  certDir: process.env.CERT_DIR || path.join(ROOT, 'certs'),
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),

  // Время жизни JWT и cookie с токеном (секунды).
  jwtTtlSec: num('JWT_TTL_SEC', 3600),
  tokenCookie: 'token',

  // Ограничение тела запроса (JSON предмета инвентаря небольшой).
  maxBodyBytes: num('MAX_BODY_BYTES', 256 * 1024),

  // 500-й код удобно проверять на защите; включается только в тестах/отладке.
  enableDebug: process.env.LAB02_DEBUG === '1' || process.env.NODE_ENV === 'test',

  apiPrefix: '/api/v1',
  version: '1.0.0',
  startedAt: Date.now(),
};

config.dataFile = process.env.DATA_FILE || path.join(config.dataDir, 'inventory.json');
config.secretFile = path.join(config.dataDir, 'jwt.secret');
config.httpsCert = path.join(config.certDir, 'server.crt');
config.httpsKey = path.join(config.certDir, 'server.key');
config.caCert = path.join(config.certDir, 'ca.crt');

/** Список IPv4-адресов машины — для подсказки адреса телефона. */
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

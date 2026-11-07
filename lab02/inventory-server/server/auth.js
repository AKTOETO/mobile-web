'use strict';

/**
 * Аутентификация: пароли (scrypt), JWT HS256, разбор Bearer/cookie.
 *
 * Внешних зависимостей нет — JWT собирается и проверяется вручную на
 * встроенном crypto (как требуют правила лабораторных этого репозитория).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), useSalt, 64).toString('hex');
  return { salt: useSalt, hash };
}

function verifyPassword(password, salt, expected) {
  const actual = hashPassword(password, salt).hash;
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(String(expected), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Читает секрет JWT из data/jwt.secret, создавая его при первом запуске. */
function loadSecret(secretFile) {
  try {
    const value = fs.readFileSync(secretFile, 'utf8').trim();
    if (value) return value;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(secretFile), { recursive: true });
  fs.writeFileSync(secretFile, secret + '\n', { mode: 0o600 });
  return secret;
}

/** Подписывает JWT (header.payload.signature), HS256. */
function signToken(payload, secret, ttlSec) {
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({ iat: now, exp: now + ttlSec }, payload);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = header + '.' + base64url(JSON.stringify(body));
  const signature = base64url(crypto.createHmac('sha256', secret).update(data).digest());
  return { token: data + '.' + signature, payload: body };
}

/** Проверяет подпись и срок действия. Возвращает payload или null. */
function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const data = parts[0] + '.' + parts[1];
  const expected = base64url(crypto.createHmac('sha256', secret).update(data).digest());
  const given = Buffer.from(parts[2]);
  const exp = Buffer.from(expected);
  if (given.length !== exp.length || !crypto.timingSafeEqual(given, exp)) return null;

  let payload;
  try {
    payload = JSON.parse(fromBase64url(parts[1]).toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

function parseCookies(header) {
  const result = {};
  if (!header) return result;
  for (const chunk of String(header).split(';')) {
    const idx = chunk.indexOf('=');
    if (idx < 0) continue;
    const name = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim();
    if (name) result[name] = decodeURIComponent(value);
  }
  return result;
}

/**
 * Возвращает токен из Authorization: Bearer <jwt> или из cookie token.
 * Порядок: заголовок важнее cookie.
 */
function tokenFromRequest(req, cookieName) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match) return { token: match[1].trim(), source: 'header' };
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[cookieName]) return { token: cookies[cookieName], source: 'cookie' };
  return { token: '', source: 'none' };
}

module.exports = {
  base64url,
  hashPassword,
  verifyPassword,
  loadSecret,
  signToken,
  verifyToken,
  parseCookies,
  tokenFromRequest,
};

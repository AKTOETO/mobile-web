'use strict';

/**
 * Интеграционный тест WebSocket-слоя сервера статистики.
 *
 * Клиент WebSocket реализован вручную на модуле net (рукопожатие RFC 6455 +
 * кадры с маскированием), чтобы тест не требовал npm-зависимостей.
 *
 *   node test/ws-test.js
 */

const net = require('node:net');
const crypto = require('node:crypto');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');

const PORT = Number(process.env.WS_TEST_PORT || 3122);
const DATA_DIR = path.join(__dirname, 'tmp-data-ws');
const URL_WS = `ws://127.0.0.1:${PORT}/ws`;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const results = [];
let server = null;

function check(name, condition, details) {
  results.push({ name, ok: Boolean(condition), details: details || '' });
  console.log(`[${condition ? 'OK  ' : 'FAIL'}] ${name}${details ? ' — ' + details : ''}`);
}

function encodeMasked(payload, opcode = 0x1) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  const length = data.length;
  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeUInt32BE(length >>> 0, 6);
  }
  header[0] = 0x80 | opcode;
  const mask = crypto.randomBytes(4);
  const masked = Buffer.from(data);
  for (let i = 0; i < masked.length; i += 1) masked[i] ^= mask[i & 3];
  return Buffer.concat([header, mask, masked]);
}

/** Простейший клиент WebSocket для теста (текстовые сообщения). */
class MiniWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = new URL(url);
    this.buffer = Buffer.alloc(0);
    this.messages = [];
    this.handshaken = false;
    this.open = false;
    this.closed = false;
    this.fragments = [];
    this.fragmentOpcode = 0;
    this.acceptValue = '';
    this._key = crypto.randomBytes(16).toString('base64');
    this.socket = net.connect(Number(this.url.port) || 80, this.url.hostname, () => {
      this.acceptValue = crypto
        .createHash('sha1')
        .update(this._key + GUID)
        .digest('base64');
      this.socket.write(
        `GET ${this.url.pathname || '/ws'} HTTP/1.1\r\n` +
          `Host: ${this.url.host}\r\n` +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Key: ${this._key}\r\n` +
          'Sec-WebSocket-Version: 13\r\n' +
          '\r\n'
      );
    });
    this.socket.on('data', (chunk) => this._onData(chunk));
    this.socket.on('error', (err) => this.emit('error', err));
    this.socket.on('close', () => {
      this.closed = true;
      this.emit('close');
    });
  }

  send(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    this.socket.write(encodeMasked(text, 0x1));
  }

  close() {
    if (this.closed) return;
    this.socket.write(encodeMasked(Buffer.alloc(0), 0x8));
    this.socket.end();
  }

  waitFor(type, timeoutMs = 3000) {
    const take = () => {
      const idx = this.messages.findIndex((m) => m && m.type === type);
      return idx >= 0 ? this.messages.splice(idx, 1)[0] : null;
    };
    const existing = take();
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off('message', onMessage);
        reject(new Error(`не дождались сообщения "${type}"`));
      }, timeoutMs);
      const onMessage = () => {
        const msg = take();
        if (msg) {
          clearTimeout(timer);
          this.off('message', onMessage);
          resolve(msg);
        }
      };
      this.on('message', onMessage);
    });
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (!this.handshaken) {
      const end = this.buffer.indexOf('\r\n\r\n');
      if (end < 0) return;
      const header = this.buffer.subarray(0, end).toString('latin1');
      this.buffer = this.buffer.subarray(end + 4);
      const accept = /sec-websocket-accept:\s*(.+)/i.exec(header);
      this.handshaken = /101/.test(header) && accept && accept[1].trim() === this.acceptValue;
      this.open = Boolean(this.handshaken);
      this.emit('open', this.handshaken);
      if (!this.handshaken) return;
    }
    let frame = this._decodeFrame();
    while (frame) {
      this._handleFrame(frame);
      frame = this._decodeFrame();
    }
  }

  _decodeFrame() {
    const buf = this.buffer;
    if (buf.length < 2) return null;
    const b0 = buf[0];
    const b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    let length = b1 & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (buf.length < 4) return null;
      length = buf.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (buf.length < 10) return null;
      length = buf.readUInt32BE(2) * 2 ** 32 + buf.readUInt32BE(6);
      offset = 10;
    }
    if (buf.length < offset + length) return null;
    const payload = Buffer.from(buf.subarray(offset, offset + length));
    this.buffer = buf.subarray(offset + length);
    return { fin, opcode, payload };
  }

  _handleFrame(frame) {
    const { fin, opcode, payload } = frame;
    if (opcode === 0x8) {
      this.closed = true;
      this.emit('close');
      return;
    }
    if (opcode === 0x9) {
      this.socket.write(encodeMasked(payload, 0xa));
      return;
    }
    if (opcode === 0xa) return;
    if (opcode === 0x0) {
      this.fragments.push(payload);
    } else {
      this.fragments = [payload];
      this.fragmentOpcode = opcode;
    }
    if (!fin) return;
    const text = Buffer.concat(this.fragments).toString('utf8');
    this.fragments = [];
    this.fragmentOpcode = 0;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch (err) {
      msg = { type: '_raw', text };
    }
    this.messages.push(msg);
    this.emit('message', msg);
  }
}

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new MiniWebSocket(URL_WS);
    const timer = setTimeout(() => reject(new Error('таймаут подключения')), 4000);
    ws.once('open', (ok) => {
      clearTimeout(timer);
      if (ok) resolve(ws);
      else reject(new Error('рукопожатие WebSocket не прошло'));
    });
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function waitReady() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (res.ok) return true;
    } catch (e) {
      /* сервер ещё поднимается */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('сервер не поднялся за 12 секунд');
}

async function main() {
  await fsp.rm(DATA_DIR, { recursive: true, force: true });
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DATA_DIR: DATA_DIR,
      SEED_ON_START: '0',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write('[server:err] ' + d));

  await waitReady();

  const ws = await connect();
  check('WebSocket подключается к /ws (101 Switching Protocols)', ws.open);

  const hello = await ws.waitFor('hello');
  check('сервер приветствует клиента (hello)', hello.service === 'lab01-stat-server');

  const snapshot = await ws.waitFor('stats');
  check('сразу приходит снимок статистики', snapshot.data && snapshot.data.totals && snapshot.data.timeline);

  ws.send({ type: 'subscribe', range: 'all' });
  const allStats = await ws.waitFor('stats', 3000).then((m) => m);
  check('подписка на диапазон возвращает статистику', allStats.data.range.key === 'all');

  ws.send({ type: 'ping', t: 1 });
  const pong = await ws.waitFor('pong');
  check('ping отвечает pong', pong.echo === 1);

  ws.send({ type: 'track', event: { type: 'pageview', page: '/aurora', visitorId: 'ws-visitor', ua: 'AuroraOS' } });
  const tracked = await ws.waitFor('tracked');
  check('событие через WebSocket записано', Boolean(tracked.eventId) && Boolean(tracked.sessionId));
  const update = await ws.waitFor('update');
  check('об изменении рассылается update', update.counters && update.counters.pageViews === 1);

  ws.send({ type: 'no-such-type' });
  const error = await ws.waitFor('error');
  check('неизвестный тип сообщения даёт error', typeof error.error === 'string');

  // HTTP-событие должно породить рассылку update всем WS-клиентам.
  await fetch(`http://127.0.0.1:${PORT}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'pageview', page: '/index.html', visitorId: 'http-visitor' }),
  });
  const update2 = await ws.waitFor('update');
  check('HTTP-событие транслируется в WebSocket', update2.counters.pageViews === 2);

  ws.close();
}

main()
  .catch((err) => check('выполнение теста', false, err.message))
  .finally(async () => {
    if (server) server.kill('SIGTERM');
    const failed = results.filter((r) => !r.ok);
    console.log('');
    console.log(`Итого: ${results.length - failed.length} из ${results.length} проверок пройдено.`);
    process.exit(failed.length ? 1 : 0);
  });

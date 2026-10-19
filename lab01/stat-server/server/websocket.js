'use strict';

/**
 * Минимальная реализация серверной части протокола WebSocket (RFC 6455)
 * на встроенных модулях Node.js. Внешние зависимости не нужны, поэтому
 * сервер продолжает запускаться «из коробки» без npm install.
 *
 * Поддерживается всё, что нужно учебному проекту:
 *   - рукопожатие Upgrade: websocket -> 101 Switching Protocols;
 *   - кадры text / binary / continuation (фрагментация);
 *   - служебные кадры ping / pong / close;
 *   - маскирование кадров клиента (обязательное по RFC для клиента);
 *   - ограничение размера сообщения.
 *
 * Использование:
 *   const { WebSocketServer } = require('./websocket');
 *   const wss = new WebSocketServer(httpServer, { path: '/ws' });
 *   wss.on('connection', (conn, req) => {
 *     conn.on('message', (text) => conn.sendJson({ echo: text }));
 *   });
 */

const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OPCODE = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
};

/** Вычисляет значение заголовка Sec-WebSocket-Accept. */
function acceptKey(clientKey) {
  return crypto
    .createHash('sha1')
    .update(String(clientKey) + MAGIC)
    .digest('base64');
}

/**
 * Кодирует один кадр WebSocket. Кадры сервера по RFC не маскируются.
 * @param {Buffer|string} payload
 * @param {number} opcode
 */
function encodeFrame(payload, opcode = OPCODE.TEXT) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  const length = data.length;

  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeUInt32BE(Math.floor(length / 2 ** 32), 2);
    header.writeUInt32BE(length >>> 0, 6);
  }
  header[0] = 0x80 | (opcode & 0x0f);
  return Buffer.concat([header, data]);
}

/**
 * Одно установленное соединение WebSocket.
 * События: 'message' (text|Buffer, isText), 'close'.
 */
class WebSocketConnection extends EventEmitter {
  constructor(socket, options = {}) {
    super();
    this.socket = socket;
    this.maxPayload = options.maxPayload || 1 << 20; // 1 МиБ
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentOpcode = 0;
    this.closed = false;
    this.isAlive = true;
    this.remoteAddress = (socket && socket.remoteAddress) || '';
    this.data = {};

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => this._finish());
    socket.on('error', () => this._finish());
    if (socket.setNoDelay) socket.setNoDelay(true);
  }

  /** Отправляет кадр указанного типа. */
  send(payload, opcode = OPCODE.TEXT) {
    if (this.closed || this.socket.destroyed) return false;
    try {
      return this.socket.write(encodeFrame(payload, opcode));
    } catch (err) {
      this._finish();
      return false;
    }
  }

  /** Отправляет объект как JSON-текст. */
  sendJson(value) {
    return this.send(JSON.stringify(value), OPCODE.TEXT);
  }

  ping() {
    return this.send(Buffer.alloc(0), OPCODE.PING);
  }

  /** Корректное закрытие: кадр close, затем разрыв TCP. */
  close(code = 1000, reason = '') {
    if (this.closed) return;
    const text = Buffer.from(String(reason), 'utf8');
    const payload = Buffer.alloc(2 + text.length);
    payload.writeUInt16BE(code, 0);
    text.copy(payload, 2);
    try {
      this.socket.write(encodeFrame(payload, OPCODE.CLOSE));
    } catch (err) {
      /* соединение уже мертво */
    }
    this._finish();
    if (this.socket.end) this.socket.end();
  }

  _finish() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close');
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    // Разбираем столько кадров, сколько уже полностью пришло.
    let frame = this._decodeFrame();
    while (frame && !this.closed) {
      this._handleFrame(frame);
      frame = this._decodeFrame();
    }
  }

  /** Возвращает разобранный кадр или null, если данных ещё недостаточно. */
  _decodeFrame() {
    const buf = this.buffer;
    if (buf.length < 2) return null;

    const b0 = buf[0];
    const b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const rsv = b0 & 0x70;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let length = b1 & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (buf.length < offset + 2) return null;
      length = buf.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (buf.length < offset + 8) return null;
      const high = buf.readUInt32BE(offset);
      const low = buf.readUInt32BE(offset + 4);
      length = high * 2 ** 32 + low;
      offset += 8;
    }

    if (length > this.maxPayload) {
      this.close(1009, 'Сообщение слишком большое');
      return null;
    }

    let maskKey = null;
    if (masked) {
      if (buf.length < offset + 4) return null;
      maskKey = buf.subarray(offset, offset + 4);
      offset += 4;
    }

    if (buf.length < offset + length) return null;

    const payload = Buffer.from(buf.subarray(offset, offset + length));
    if (maskKey) {
      for (let i = 0; i < payload.length; i += 1) {
        payload[i] ^= maskKey[i & 3];
      }
    }
    this.buffer = buf.subarray(offset + length);
    return { fin, rsv, opcode, payload };
  }

  _handleFrame(frame) {
    const { fin, rsv, opcode, payload } = frame;

    if (rsv !== 0) {
      this.close(1002, 'Зарезервированные биты не поддерживаются');
      return;
    }

    if (opcode === OPCODE.CLOSE) {
      this.close(1000);
      return;
    }
    if (opcode === OPCODE.PING) {
      this.send(payload, OPCODE.PONG);
      return;
    }
    if (opcode === OPCODE.PONG) {
      this.isAlive = true;
      return;
    }

    if (opcode === OPCODE.CONTINUATION) {
      if (!this.fragmentOpcode) {
        this.close(1002, 'Продолжение без начала сообщения');
        return;
      }
      this.fragments.push(payload);
    } else if (opcode === OPCODE.TEXT || opcode === OPCODE.BINARY) {
      if (this.fragmentOpcode) {
        this.close(1002, 'Новое сообщение до завершения предыдущего');
        return;
      }
      this.fragments = [payload];
      this.fragmentOpcode = opcode;
    } else {
      this.close(1002, `Неизвестный opcode: ${opcode}`);
      return;
    }

    if (!fin) return;

    const full = Buffer.concat(this.fragments);
    const isText = this.fragmentOpcode === OPCODE.TEXT;
    this.fragments = [];
    this.fragmentOpcode = 0;
    this.emit('message', isText ? full.toString('utf8') : full, isText);
  }
}

/**
 * WebSocket-сервер, работающий поверх существующего http.Server.
 * События: 'connection' (conn, req).
 */
class WebSocketServer extends EventEmitter {
  constructor(httpServer, options = {}) {
    super();
    this.path = options.path || '/ws';
    this.maxPayload = options.maxPayload || 1 << 20;
    this.clients = new Set();
    this.httpServer = httpServer;
    this._onUpgrade = this._onUpgrade.bind(this);
    httpServer.on('upgrade', this._onUpgrade);
  }

  _reject(socket, status, reason) {
    try {
      socket.write(
        `HTTP/1.1 ${status} ${reason}\r\n` +
          'Connection: close\r\n' +
          'Content-Length: 0\r\n' +
          '\r\n'
      );
    } catch (err) {
      /* ignore */
    }
    socket.destroy();
  }

  _onUpgrade(req, socket, head) {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch (err) {
      this._reject(socket, 400, 'Bad Request');
      return;
    }

    if (url.pathname !== this.path) {
      this._reject(socket, 404, 'Not Found');
      return;
    }

    const key = req.headers['sec-websocket-key'];
    const version = req.headers['sec-websocket-version'];
    const upgrade = String(req.headers.upgrade || '').toLowerCase();
    if (upgrade !== 'websocket' || !key || version !== '13') {
      this._reject(socket, 400, 'Bad Request');
      return;
    }

    const response =
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n` +
      '\r\n';
    try {
      socket.write(response);
    } catch (err) {
      socket.destroy();
      return;
    }

    const conn = new WebSocketConnection(socket, { maxPayload: this.maxPayload });
    if (head && head.length) conn._onData(head);

    this.clients.add(conn);
    conn.on('close', () => this.clients.delete(conn));
    this.emit('connection', conn, req);
  }

  /** Рассылает объект (как JSON) всем подключённым клиентам. */
  broadcast(value) {
    const text = JSON.stringify(value);
    for (const conn of this.clients) {
      if (!conn.closed) conn.send(text);
    }
  }

  /** Закрывает все соединения (при остановке сервера). */
  close() {
    for (const conn of this.clients) conn.close(1001, 'Сервер останавливается');
    this.clients.clear();
    this.httpServer.removeListener('upgrade', this._onUpgrade);
  }
}

module.exports = { WebSocketServer, WebSocketConnection, acceptKey, encodeFrame, OPCODE };

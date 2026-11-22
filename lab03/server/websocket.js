'use strict';
// Однонаправленный push RFC 6455: text, ping/pong, close; без расширений.
const { createHash } = require('node:crypto');
const { EventEmitter } = require('node:events');
function frame(opcode, text) {
  const data = Buffer.from(text);
  if (data.length > 65535) throw new Error('Слишком длинный push');
  const header = Buffer.alloc(data.length < 126 ? 2 : 4);
  header[0] = 0x80 | opcode;
  header[1] = data.length < 126 ? data.length : 126;
  if (header.length === 4) header.writeUInt16BE(data.length, 2);
  return Buffer.concat([header, data]);
}
class WebSocketServer extends EventEmitter {
  constructor(server, { path }) {
    super();
    this.clients = new Set();
    server.on('upgrade', (req, socket, head) => {
      const key = req.headers['sec-websocket-key'] || '';
      if (req.url !== path || req.method !== 'GET' ||
          req.headers['sec-websocket-version'] !== '13' ||
          !/^[A-Za-z0-9+/]{22}==$/.test(key)) {
        socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
        return;
      }
      const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
      const client = { socket, alive: true, sendJson: obj => socket.write(frame(1, JSON.stringify(obj))) };
      this.clients.add(client);
      let buffer = Buffer.alloc(0);
      const consume = chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 2) {
          const opcode = buffer[0] & 15;
          const size = buffer[1] & 127;
          // Клиенту разрешены только короткие маскированные служебные кадры.
          if ((buffer[0] & 0xf0) !== 0x80 || !(buffer[1] & 128) ||
              size > 125 || ![8, 9, 10].includes(opcode)) {
            socket.end(frame(8, Buffer.from([3, 235]))); // 1003
            return;
          }
          if (buffer.length < 6 + size) return;
          const payload = Buffer.from(buffer.subarray(6, 6 + size));
          for (let i = 0; i < size; i++) payload[i] ^= buffer[2 + i % 4];
          buffer = buffer.subarray(6 + size);
          if (opcode === 8) { socket.end(frame(8, payload)); return; }
          if (opcode === 9) socket.write(frame(10, payload));
          if (opcode === 10) client.alive = true;
        }
      };
      socket.on('data', consume);
      socket.on('error', () => socket.destroy());
      socket.on('close', () => this.clients.delete(client));
      this.emit('connection', client);
      if (head.length) consume(head);
    });
    this.heartbeat = setInterval(() => {
      for (const client of this.clients) {
        if (!client.alive) client.socket.destroy();
        else { client.alive = false; client.socket.write(frame(9, '')); }
      }
    }, 5000);
  }
  broadcast(value) {
    for (const client of this.clients) client.sendJson(value);
  }
  close() {
    clearInterval(this.heartbeat);
    for (const client of this.clients) client.socket.end(frame(8, Buffer.from([3, 233])));
  }
}
module.exports = { WebSocketServer };

'use strict';
const assert = require('node:assert/strict');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:9083';
(async () => {
  const health = await (await fetch(BASE + '/api/health')).json();
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws');
    let hello = false, pushes = 0;
    const timeout = setTimeout(() => {
      try {
        assert.ok(hello);
        assert.ok(pushes >= 3, 'Нужны push на протяжении двух heartbeat');
        socket.close(); resolve();
      } catch (error) { socket.close(); reject(error); }
    }, 11500);
    socket.addEventListener('error', error => { clearTimeout(timeout); reject(error); });
    socket.addEventListener('message', event => {
      try {
        const obj = JSON.parse(event.data);
        assert.equal(obj.version, health.version);
        assert.ok(obj.instance);
        if (obj.type === 'hello') hello = true;
        else {
          assert.equal(obj.type, 'inventory');
          assert.equal(obj.total, 44);
          if (obj.version === '2.0.0') assert.equal(obj.lowStockCount, 1);
          pushes++;
        }
      } catch (error) { clearTimeout(timeout); socket.close(); reject(error); }
    });
  });
  const invalid = await fetch(BASE + '/api/items', { method: 'POST' });
  assert.equal(invalid.status, 405);
  assert.equal(invalid.headers.get('allow'), 'GET');
  assert.equal((await fetch(BASE + '/missing')).status, 404);
  console.log('PASS WebSocket hello, push, ping/pong > 10 с; HTTP 405/404; версия', health.version);
})().catch(error => { console.error(error); process.exitCode = 1; });

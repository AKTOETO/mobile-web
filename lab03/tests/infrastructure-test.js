'use strict';
// Проверка из Docker: реальные контейнеры, nginx и API демонстрационной панели.
const assert = require('node:assert/strict');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:9083';
const MONITOR = process.env.MONITOR_URL || 'http://127.0.0.1:9084';
async function api(route, value, expected = 200) {
  const res = await fetch(MONITOR + route, { method: value ? 'POST' : 'GET',
    headers: value ? { 'Content-Type': 'application/json' } : {},
    body: value ? JSON.stringify(value) : undefined, signal: AbortSignal.timeout(45000) });
  const body = await res.json();
  assert.equal(res.status, expected, JSON.stringify(body));
  return body;
}
const action = (name, target) => api('/api/action', { action: name, target });
(async () => {
  try {
    for (const name of ['balance', 'failover', 'recover', 'deploy', 'rollback']) {
      const proof = await api('/api/scenario', { name });
      assert.equal(proof.passed, true, JSON.stringify(proof.result));
      assert.equal(proof.result.errors, 0);
      assert.equal(proof.continuous.errors, 0);
      if (name === 'balance') assert.ok(proof.result.counts.blue1 && proof.result.counts.blue2);
      if (name === 'failover') {
        assert.equal(proof.result.counts.blue1, 0);
        assert.equal(proof.result.counts.blue2, 40);
        const state = await api('/api/state');
        assert.equal(state.containers.find(c => c.name === 'blue1').state, 'exited');
      }
      if (name === 'deploy') {
        assert.deepEqual(new Set(proof.result.versions), new Set(['1.0.0', '2.0.0']));
        const items = await (await fetch(BASE + '/api/items')).json();
        assert.equal(items.items.filter(item => item.lowStock).length, 1);
      }
      console.log('PASS', name, `${proof.result.successful}/${proof.result.total}`,
        'распределение=' + JSON.stringify(proof.result.counts), 'версии=' + proof.result.versions);
    }
    await api('/api/scenario', { name: 'rollback' }, 400);
    console.log('PASS повторный откат на уже активный релиз не выдаётся за обновление');
    await action('stop', 'green1');
    await api('/api/action', { action: 'switch', target: 'green' }, 400);
    assert.equal((await (await fetch(BASE + '/api/health')).json()).version, '1.0.0');
    console.log('PASS нездоровый green отклонён, blue продолжает работать');
    await action('start', 'green1');
    // Управление не должно принимать произвольные контейнеры и межсайтовые запросы.
    await api('/api/action', { action: 'stop', target: 'nginx' }, 400);
    const denied = await fetch(MONITOR + '/api/action', { method: 'POST',
      headers: { Origin: 'https://example.org', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', target: 'blue1' }) });
    assert.equal(denied.status, 403);
    console.log('PASS ограничения управления контейнерами и Origin');
    const state = await api('/api/state');
    assert.equal(state.containers.length, 6);
    assert.equal(state.dockerError, '');
    assert.ok(state.nginx.some(item => item.backend));
    assert.match(state.nginxStatus, /Active connections:/);
    console.log('PASS Docker API, 6 контейнеров, настоящий журнал nginx и stub_status');
    console.log('ИТОГО: Docker-сценарии и проверки пройдены');
  } finally {
    for (const name of ['blue1', 'blue2', 'green1', 'green2']) await action('start', name);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

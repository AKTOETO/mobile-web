'use strict';
const names = { balance: 'Балансировка', failover: 'Отказ реплики', recover: 'Восстановление', deploy: 'Blue → Green', rollback: 'Откат на Blue' };
const $ = id => document.getElementById(id);
let state, sending = false, refreshing = false;
function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}
const clock = date => new Date(date).toLocaleTimeString('ru-RU');
async function api(url, data) {
  const response = await fetch(url, data === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'HTTP ' + response.status);
  return result;
}
async function act(url, data) {
  if (sending) return;
  sending = true;
  $('message').textContent = 'Операция выполняется…';
  try {
    const result = await api(url, data);
    $('message').textContent = result.passed === undefined ? 'Операция завершена.' :
      `${result.passed ? 'ПОДТВЕРЖДЕНО' : 'ОБНАРУЖЕНЫ ОШИБКИ'}: ${names[result.name]} · HTTP 200: ${result.result.successful}/${result.result.total} · версии ${result.result.versions.join(' → ')}`;
    $('message').className = result.passed === false ? 'error' : 'ok';
  } catch (error) { $('message').textContent = error.message; $('message').className = 'error'; }
  finally { sending = false; await refresh(); }
}
document.querySelectorAll('[data-scenario]').forEach(button => button.onclick = () => act('/api/scenario', { name: button.dataset.scenario }));
$('reset').onclick = () => act('/api/action', { action: 'reset' });
$('traffic').onclick = () => act('/api/action', { action: 'traffic', enabled: !state?.probing });
$('download').onclick = async () => {
  const evidence = await api('/api/evidence');
  const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }));
  const link = node('a'); link.href = url; link.download = 'lab03-demo-evidence.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    state = await api('/api/state');
    $('clock').textContent = clock(state.time);
    $('colour').textContent = state.colour.toUpperCase() + (state.colour === 'blue' ? ' · v1.0.0' : ' · v2.0.0');
    if (state.busy) { $('message').textContent = state.busy + '…'; $('message').className = ''; }
    else if (state.dockerError) { $('message').textContent = state.dockerError; $('message').className = 'error'; }
    else if ($('message').textContent === 'Подключение к мониторингу…') $('message').textContent = 'Готово. Начните с «Балансировка».';
    $('total').textContent = state.totals.total;
    $('successful').textContent = state.totals.successful;
    $('errors').textContent = state.totals.errors;
    $('errors').style.color = state.totals.errors ? 'var(--red)' : 'var(--green)';
    $('traffic').textContent = state.probing ? 'Пауза проб' : 'Продолжить пробы';
    $('containers').replaceChildren();
    const order = ['blue1', 'blue2', 'green1', 'green2', 'nginx', 'monitor'];
    for (const name of order) {
      const c = state.containers.find(item => item.name === name);
      if (!c) continue;
      const card = node('article', undefined, 'container ' + (name.startsWith('green') ? 'green ' : '') + (c.state !== 'running' ? 'stopped' : ''));
      card.append(node('h3', name), node('div', c.health, 'badge ' + (c.health === 'healthy' ? '' : 'bad')), node('div', c.state), node('small', c.image));
      if (['blue1', 'blue2', 'green1', 'green2'].includes(name)) {
        const running = c.state === 'running';
        const button = node('button', running ? 'Остановить' : 'Запустить');
        button.onclick = () => act('/api/action', { action: running ? 'stop' : 'start', target: name });
        card.append(button);
      }
      $('containers').append(card);
    }
    $('bars').replaceChildren();
    for (const [name, count] of Object.entries(state.totals.counts)) {
      const row = node('div', undefined, 'bar-row'), track = node('div', undefined, 'bar-track');
      const fill = node('div', undefined, 'bar-fill ' + (name.startsWith('green') ? 'green' : ''));
      fill.style.width = (100 * count / Math.max(1, state.totals.successful)) + '%';
      track.append(fill); row.append(node('span', name), track, node('strong', count)); $('bars').append(row);
    }
    $('stream').replaceChildren(...state.samples.slice().reverse().map(sample => {
      const dot = node('i', undefined, sample.error ? 'error' : sample.backend.startsWith('green') ? 'green' : '');
      dot.title = `${clock(sample.time)} · ${sample.status} · ${sample.backend} · ${sample.ms} мс`; return dot;
    }));
    $('proofs').replaceChildren(...state.proofs.map(proof => {
      const item = node('div', undefined, 'proof ' + (proof.passed ? '' : 'failed'));
      item.append(node('b', (proof.passed ? '✓ ' : '✕ ') + names[proof.name]), node('span',
        `${clock(proof.began)} · ${proof.result.successful}/${proof.result.total} HTTP 200 · ${proof.result.versions.join(' → ')} · ошибок непрерывного потока: ${proof.continuous.errors}`));
      return item;
    }));
    $('nginx-status').textContent = state.nginxStatus.trim();
    $('nginx-log').replaceChildren(...state.nginx.slice(0, 20).map(item => {
      const row = node('tr');
      row.append(node('td', clock(item.time)), node('td', item.status, item.status < 400 ? 'good' : 'bad'), node('td', item.backend || '—'),
        node('td', item.attempts), node('td', item.upstream)); return row;
    }));
    $('events').replaceChildren(...state.events.slice(0, 20).map(item => {
      const row = node('div', undefined, 'event'), detail = node('div', item.message);
      detail.append(node('small', item.detail)); row.append(node('time', clock(item.time)), detail); return row;
    }));
    document.querySelectorAll('button').forEach(button => { button.disabled = Boolean(state.busy) || sending; });
  } catch (error) { $('message').textContent = 'Мониторинг недоступен: ' + error.message; $('message').className = 'error'; }
  finally { refreshing = false; }
}
function push() {
  const url = new URL(location.href); url.port = '9083'; url.pathname = '/ws'; url.protocol = 'ws:';
  const socket = new WebSocket(url);
  socket.onopen = () => { $('push-state').textContent = 'Канал подключён'; };
  socket.onmessage = event => {
    try {
      const data = JSON.parse(event.data);
      $('push-state').textContent = `${data.instance} · v${data.version}`;
      $('push-text').textContent = `${clock(data.time)} · ${data.message}`;
    } catch {}
  };
  socket.onclose = () => { $('push-state').textContent = 'Переподключение…'; setTimeout(push, 1000); };
  socket.onerror = () => socket.close();
}
refresh(); setInterval(refresh, 1000); push();

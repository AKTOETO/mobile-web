'use strict';

/**
 * Хранилище инвентаря: один JSON-файл (как в lab01/stat-server), атомарная
 * запись через временный файл и rename.
 *
 * Структура файла:
 *   users  — пользователи с ролью и hash/salt пароля;
 *   items  — предметы инвентаря;
 *   meta   — rev (растёт на каждом изменении) и updatedAt (для Last-Modified).
 */

const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const { hashPassword, verifyPassword } = require('./auth');

function nowIso() {
  return new Date().toISOString();
}

const DEMO_ITEMS = [
  { name: 'Дрель ударная', quantity: 3, location: 'Склад A, стеллаж 2', condition: 'good' },
  { name: 'Шуруповёрт аккумуляторный', quantity: 5, location: 'Склад A, стеллаж 2', condition: 'new' },
  { name: 'Набор отвёрток', quantity: 12, location: 'Инструментальная, ящик 4', condition: 'good' },
  { name: 'Лестница-стремянка', quantity: 2, location: 'Коридор, ниша', condition: 'used' },
  { name: 'Огнетушитель ОП-4', quantity: 6, location: 'Пожарный щит', condition: 'new' },
  { name: 'Кабель удлинительный 20 м', quantity: 4, location: 'Склад B, полка 1', condition: 'broken' },
];

const DEMO_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'user', password: 'user123', role: 'user' },
  { username: 'viewer', password: 'viewer123', role: 'viewer' },
];

class Store {
  constructor(config) {
    this.config = config;
    this.state = null;
    this.saving = null;
  }

  async load() {
    await fsp.mkdir(path.dirname(this.config.dataFile), { recursive: true });

    let parsed = null;
    try {
      parsed = JSON.parse(await fsp.readFile(this.config.dataFile, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error('[store] не удалось прочитать %s: %s', this.config.dataFile, e.message);
      }
    }

    this.state = this.normalize(parsed);
    if (!parsed) {
      this.seedUsers();
      this.seedItems();
      await this.save();
    } else if (!Object.keys(this.state.users).length) {
      this.seedUsers();
      await this.save();
    }
    return this.state;
  }

  normalize(parsed) {
    const base = {
      users: {},
      items: {},
      meta: { rev: 1, createdAt: nowIso(), updatedAt: nowIso() },
    };
    if (!parsed || typeof parsed !== 'object') return base;

    if (parsed.users && typeof parsed.users === 'object') base.users = parsed.users;
    if (parsed.items && typeof parsed.items === 'object') base.items = parsed.items;
    if (parsed.meta && typeof parsed.meta === 'object') {
      base.meta = Object.assign(base.meta, parsed.meta);
    }
    base.meta.rev = Number.isInteger(base.meta.rev) ? base.meta.rev : 1;
    if (!base.meta.updatedAt) base.meta.updatedAt = nowIso();
    return base;
  }

  seedUsers() {
    for (const user of DEMO_USERS) {
      const { salt, hash } = hashPassword(user.password);
      this.state.users[user.username] = {
        username: user.username,
        role: user.role,
        salt,
        hash,
        createdAt: nowIso(),
      };
    }
  }

  seedItems() {
    for (const demo of DEMO_ITEMS) {
      this.insertItem(demo, false);
    }
  }

  insertItem(data, touch = true) {
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    const item = {
      id,
      name: data.name,
      quantity: data.quantity,
      location: data.location,
      condition: data.condition,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.state.items[id] = item;
    if (touch) this.touch();
    return item;
  }

  touch() {
    this.state.meta.rev += 1;
    this.state.meta.updatedAt = nowIso();
  }

  async save() {
    const payload = JSON.stringify(this.state, null, 2);
    const tmp = this.config.dataFile + '.' + process.pid + '.tmp';
    await fsp.writeFile(tmp, payload, 'utf8');
    await fsp.rename(tmp, this.config.dataFile);
  }

  authenticate(username, password) {
    const user = this.state.users[username];
    if (!user) return null;
    if (!verifyPassword(password, user.salt, user.hash)) return null;
    return { username: user.username, role: user.role };
  }

  user(username) {
    const user = this.state.users[username];
    return user ? { username: user.username, role: user.role, createdAt: user.createdAt } : null;
  }

  getItem(id) {
    return this.state.items[id] || null;
  }

  /**
   * Список с фильтрами: q (поиск по названию/месту), condition, сортировка,
   * пагинация. Возвращает предметы, всего и ревизию для ETag.
   */
  listItems(options = {}) {
    const q = (options.q || '').toString().trim().toLowerCase();
    const condition = (options.condition || '').toString().trim();
    const sort = ['name', 'quantity', 'updatedAt', 'createdAt'].includes(options.sort)
      ? options.sort
      : 'name';
    const order = options.order === 'desc' ? 'desc' : 'asc';
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);
    const offset = Math.max(Number(options.offset) || 0, 0);

    let items = Object.values(this.state.items);
    if (q) {
      items = items.filter((item) =>
        item.name.toLowerCase().includes(q) || item.location.toLowerCase().includes(q));
    }
    if (condition) {
      items = items.filter((item) => item.condition === condition);
    }

    const direction = order === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      if (sort === 'quantity') return (a.quantity - b.quantity) * direction;
      if (sort === 'updatedAt' || sort === 'createdAt') {
        return (new Date(a[sort]).getTime() - new Date(b[sort]).getTime()) * direction;
      }
      return a.name.localeCompare(b.name, 'ru') * direction;
    });

    const total = items.length;
    return {
      items: items.slice(offset, offset + limit),
      total,
      limit,
      offset,
      condition,
      q,
      sort,
      order,
      rev: this.state.meta.rev,
      updatedAt: this.state.meta.updatedAt,
    };
  }

  async createItem(data) {
    const item = this.insertItem(data);
    await this.save();
    return item;
  }

  async updateItem(id, data) {
    const item = this.state.items[id];
    if (!item) return null;
    Object.assign(item, data);
    item.version += 1;
    item.updatedAt = nowIso();
    this.touch();
    await this.save();
    return item;
  }

  async deleteItem(id) {
    if (!this.state.items[id]) return false;
    delete this.state.items[id];
    this.touch();
    await this.save();
    return true;
  }
}

module.exports = Store;

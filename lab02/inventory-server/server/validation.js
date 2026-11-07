'use strict';

/**
 * Валидация предмета инвентаря.
 *
 * Поля по варианту №7: название, количество, место хранения, состояние.
 * Возвращаем понятные ошибки (до 400 Bad Request с details).
 */

const CONDITIONS = ['new', 'good', 'used', 'broken'];

const CONDITION_LABELS = {
  new: 'новый',
  good: 'хорошее',
  used: 'б/у',
  broken: 'неисправен',
};

const MAX_NAME = 120;
const MAX_LOCATION = 120;
const MAX_QUANTITY = 1000000;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * @param {object} body   тело запроса
 * @param {object} opts   { partial: true } — для PATCH, проверяем только поля
 * @returns {{ok: boolean, value: object, errors: Array<{field, message}>}}
 */
function validateItem(body, opts = {}) {
  const partial = opts.partial === true;
  const errors = [];
  const value = {};
  const source = isPlainObject(body) ? body : {};

  const has = (field) => Object.prototype.hasOwnProperty.call(source, field);
  const need = (field) => partial ? has(field) : true;

  if (need('name')) {
    const name = normalizeString(source.name);
    if (typeof name !== 'string' || name.length === 0) {
      errors.push({ field: 'name', message: 'Укажите название предмета.' });
    } else if (name.length > MAX_NAME) {
      errors.push({ field: 'name', message: `Название не длиннее ${MAX_NAME} символов.` });
    } else {
      value.name = name;
    }
  }

  if (need('quantity')) {
    const quantity = source.quantity;
    if (!Number.isInteger(quantity) || quantity < 0) {
      errors.push({ field: 'quantity', message: 'Количество — целое число не меньше 0.' });
    } else if (quantity > MAX_QUANTITY) {
      errors.push({ field: 'quantity', message: `Количество не больше ${MAX_QUANTITY}.` });
    } else {
      value.quantity = quantity;
    }
  }

  if (need('location')) {
    const location = normalizeString(source.location);
    if (typeof location !== 'string' || location.length === 0) {
      errors.push({ field: 'location', message: 'Укажите место хранения.' });
    } else if (location.length > MAX_LOCATION) {
      errors.push({ field: 'location', message: `Место хранения не длиннее ${MAX_LOCATION} символов.` });
    } else {
      value.location = location;
    }
  }

  if (need('condition')) {
    const condition = normalizeString(source.condition);
    if (!CONDITIONS.includes(condition)) {
      errors.push({
        field: 'condition',
        message: 'Состояние: одно из new, good, used, broken.',
      });
    } else {
      value.condition = condition;
    }
  }

  return { ok: errors.length === 0, value, errors };
}

module.exports = {
  CONDITIONS,
  CONDITION_LABELS,
  validateItem,
  isPlainObject,
};

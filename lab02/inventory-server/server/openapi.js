'use strict';

/**
 * OpenAPI 3.0-описание API инвентаря (вариант 7).
 * Отдаётся по /api/v1/openapi.json, на него ссылается тестовая страница.
 */

const config = require('./config');

const itemSchema = {
  type: 'object',
  required: ['name', 'quantity', 'location', 'condition'],
  properties: {
    id: { type: 'string', format: 'uuid', example: '6f1c2f4e-1b8a-4c47-a9d6-2d3f0a1b2c3d' },
    name: { type: 'string', maxLength: 120, example: 'Дрель ударная' },
    quantity: { type: 'integer', minimum: 0, maximum: 1000000, example: 3 },
    location: { type: 'string', maxLength: 120, example: 'Склад A, стеллаж 2' },
    condition: { type: 'string', enum: ['new', 'good', 'used', 'broken'], example: 'good' },
    version: { type: 'integer', example: 1 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const itemInputSchema = {
  type: 'object',
  required: ['name', 'quantity', 'location', 'condition'],
  properties: {
    name: itemSchema.properties.name,
    quantity: itemSchema.properties.quantity,
    location: itemSchema.properties.location,
    condition: itemSchema.properties.condition,
  },
};

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string', example: 'validation_error' },
    message: { type: 'string', example: 'Проверьте поля запроса.' },
    details: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
};

function jsonResponse(description, schema) {
  return {
    description,
    headers: {
      ETag: { schema: { type: 'string' }, description: 'Версия ресурса для кэширования' },
      'Cache-Control': { schema: { type: 'string' } },
      'Last-Modified': { schema: { type: 'string' } },
    },
    content: {
      'application/json': { schema },
    },
  };
}

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Inventory API — лабораторная работа №2 (вариант 7)',
    version: config.version,
    description:
      'REST API инвентаря: предметы с названием, количеством, местом хранения и ' +
      'состоянием. Аутентификация — JWT (Authorization: Bearer) или cookie token. ' +
      'Поддерживаются ETag/If-None-Match и Last-Modified/If-Modified-Since.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Текущий сервер (HTTPS)',
    },
  ],
  tags: [
    { name: 'auth', description: 'Аутентификация и токены' },
    { name: 'items', description: 'Предметы инвентаря' },
    { name: 'system', description: 'Служебные методы' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['system'],
        summary: 'Состояние сервера и параметры запроса',
        description: 'Возвращает версию, время и разобранные заголовки Host, Accept, User-Agent.',
        responses: { 200: jsonResponse('Сервер работает', { type: 'object' }) },
      },
    },
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Вход по логину и паролю',
        description:
          'Демо-пользователи: admin/admin123 (роль admin), user/user123 (user), ' +
          'viewer/viewer123 (viewer). Возвращает JWT и ставит cookie token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', example: 'admin123' },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Токен выдан', {
            type: 'object',
            properties: {
              token: { type: 'string' },
              tokenType: { type: 'string', example: 'Bearer' },
              expiresIn: { type: 'integer', example: 3600 },
              user: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'user', 'viewer'] },
                },
              },
            },
          }),
          400: errorResponse('Не переданы логин или пароль'),
          401: errorResponse('Неверный логин или пароль'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['auth'],
        summary: 'Выход (сброс cookie)',
        responses: { 204: { description: 'Cookie очищена' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['auth'],
        summary: 'Текущий пользователь по токену',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: jsonResponse('Пользователь', {
            type: 'object',
            properties: {
              username: { type: 'string' },
              role: { type: 'string' },
              source: { type: 'string', enum: ['header', 'cookie'] },
            },
          }),
          401: errorResponse('Требуется токен'),
        },
      },
    },
    '/items': {
      get: {
        tags: ['items'],
        summary: 'Список предметов',
        description:
          'Поддерживает фильтры q (поиск по названию и месту), condition, сортировку ' +
          'sort/order и пагинацию limit/offset. Ответ кэшируется через ETag и Last-Modified.',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Поиск по названию/месту' },
          {
            name: 'condition',
            in: 'query',
            schema: { type: 'string', enum: ['new', 'good', 'used', 'broken'] },
          },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['name', 'quantity', 'updatedAt', 'createdAt'] },
          },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
        ],
        responses: {
          200: jsonResponse('Список предметов', {
            type: 'object',
            properties: {
              items: { type: 'array', items: itemSchema },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          }),
          304: { description: 'Данные не изменились (If-None-Match / If-Modified-Since)' },
          400: errorResponse('Некорректные параметры'),
          401: errorResponse('Требуется аутентификация'),
        },
      },
      post: {
        tags: ['items'],
        summary: 'Создать предмет',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: itemInputSchema } },
        },
        responses: {
          201: jsonResponse('Создано', itemSchema),
          400: errorResponse('Ошибка валидации'),
          401: errorResponse('Требуется аутентификация'),
          403: errorResponse('Роль не позволяет создавать (viewer)'),
        },
      },
    },
    '/items/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      get: {
        tags: ['items'],
        summary: 'Предмет по идентификатору',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: jsonResponse('Предмет', itemSchema),
          304: { description: 'Данные не изменились' },
          401: errorResponse('Требуется аутентификация'),
          404: errorResponse('Не найдено'),
        },
      },
      put: {
        tags: ['items'],
        summary: 'Заменить предмет целиком',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: itemInputSchema } },
        },
        responses: {
          200: jsonResponse('Обновлено', itemSchema),
          400: errorResponse('Ошибка валидации'),
          401: errorResponse('Требуется аутентификация'),
          403: errorResponse('Роль не позволяет изменять (viewer)'),
          404: errorResponse('Не найдено'),
        },
      },
      patch: {
        tags: ['items'],
        summary: 'Частично обновить предмет',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: itemInputSchema.properties,
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Обновлено', itemSchema),
          400: errorResponse('Ошибка валидации'),
          401: errorResponse('Требуется аутентификация'),
          403: errorResponse('Роль не позволяет изменять (viewer)'),
          404: errorResponse('Не найдено'),
        },
      },
      delete: {
        tags: ['items'],
        summary: 'Удалить предмет',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          204: { description: 'Удалено' },
          401: errorResponse('Требуется аутентификация'),
          403: errorResponse('Нужна роль admin'),
          404: errorResponse('Не найдено'),
        },
      },
    },
    '/debug/error': {
      get: {
        tags: ['system'],
        summary: 'Проверка обработки 500 (только в отладке/тестах)',
        description: 'Доступен при LAB02_DEBUG=1 или NODE_ENV=test.',
        responses: {
          500: errorResponse('Внутренняя ошибка сервера'),
          404: errorResponse('Отладка выключена'),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'token' },
    },
  },
};

module.exports = openapi;

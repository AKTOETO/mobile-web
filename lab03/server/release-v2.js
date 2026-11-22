'use strict';
// Новая обратно совместимая версия: контроль дефицита (остаток менее 10).
module.exports = {
  version: '2.0.0',
  items: rows => rows.map(row => ({ ...row, lowStock: row.quantity < 10 })),
  notification: rows => ({ message: 'Контроль дефицита: ' + rows.filter(row => row.lowStock).length + ' поз.',
    lowStockCount: rows.filter(row => row.lowStock).length }),
};

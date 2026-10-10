'use strict';

/**
 * CLI для подготовки данных:
 *   node server/seed-cli.js                 — добавить демо-данные
 *   node server/seed-cli.js --visitors=40 --days=14
 *   node server/seed-cli.js --reset         — очистить статистику
 */

const config = require('./config');
const Storage = require('./storage');
const seedDemo = require('./seed');

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(raw);
    if (!m) continue;
    args[m[1]] = m[2] === undefined ? true : m[2];
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const storage = new Storage(config);
  storage.load();

  if (args.reset) {
    await storage.reset();
    console.log('Статистика очищена:', storage.statsFile);
    return;
  }

  const result = seedDemo(storage, {
    visitors: Number(args.visitors) || 24,
    days: Number(args.days) || 7,
    seed: Number(args.seed) || 20240501,
  });
  await storage.save();
  console.log(
    `Добавлено демо-событий: ${result.events}, посетителей: ${result.visitors}, дней: ${result.days}`
  );
  console.log('Файл статистики:', storage.statsFile);
})().catch((err) => {
  console.error('Ошибка:', err.message);
  process.exit(1);
});

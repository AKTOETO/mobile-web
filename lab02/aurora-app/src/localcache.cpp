#include "localcache.h"

#include <QDateTime>
#include <QDebug>
#include <QDir>
#include <QJsonDocument>
#include <QSqlError>
#include <QSqlQuery>
#include <QStandardPaths>
#include <QUuid>
#include <QVariant>

LocalCache::LocalCache()
{
    m_connection = QStringLiteral("inventory-cache-%1")
            .arg(reinterpret_cast<quintptr>(this));
}

LocalCache::~LocalCache()
{
    if (m_db.isOpen()) m_db.close();
    if (QSqlDatabase::contains(m_connection)) {
        QSqlDatabase::removeDatabase(m_connection);
    }
}

bool LocalCache::open(QString *error)
{
    QString dir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    if (dir.isEmpty()) dir = QDir::homePath() + QStringLiteral("/.local/share/aurorainventory");
    QDir().mkpath(dir);
    m_path = dir + QStringLiteral("/inventory.db");

    m_db = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), m_connection);
    m_db.setDatabaseName(m_path);
    if (!m_db.open()) {
        if (error) *error = m_db.lastError().text();
        qWarning() << "SQLite: не удалось открыть" << m_path << m_db.lastError().text();
        return false;
    }

    if (!exec(QStringLiteral(
            "CREATE TABLE IF NOT EXISTS items ("
            " id TEXT PRIMARY KEY,"
            " name TEXT NOT NULL,"
            " quantity INTEGER NOT NULL DEFAULT 0,"
            " location TEXT NOT NULL DEFAULT '',"
            " condition TEXT NOT NULL DEFAULT 'good',"
            " version INTEGER NOT NULL DEFAULT 0,"
            " updated_at TEXT NOT NULL DEFAULT '')"))) {
        if (error) *error = QStringLiteral("не удалось создать таблицу items");
        return false;
    }

    if (!exec(QStringLiteral(
            "CREATE TABLE IF NOT EXISTS pending ("
            " id INTEGER PRIMARY KEY AUTOINCREMENT,"
            " method TEXT NOT NULL,"
            " item_id TEXT NOT NULL,"
            " payload TEXT NOT NULL DEFAULT '{}',"
            " queued_at TEXT NOT NULL DEFAULT '')"))) {
        if (error) *error = QStringLiteral("не удалось создать таблицу pending");
        return false;
    }

    qInfo() << "SQLite-кэш:" << m_path;
    return true;
}

QString LocalCache::path() const
{
    return m_path;
}

bool LocalCache::isOpen() const
{
    return m_db.isOpen();
}

bool LocalCache::exec(const QString &sql)
{
    QSqlQuery query(m_db);
    if (!query.exec(sql)) {
        qWarning() << "SQLite error:" << query.lastError().text() << "SQL:" << sql;
        return false;
    }
    return true;
}

ItemRecord LocalCache::fromQuery(const QSqlQuery &query)
{
    ItemRecord item;
    item.id = query.value(0).toString();
    item.name = query.value(1).toString();
    item.quantity = query.value(2).toInt();
    item.location = query.value(3).toString();
    item.condition = query.value(4).toString();
    item.version = query.value(5).toInt();
    item.updatedAt = query.value(6).toString();
    return item;
}

QJsonObject LocalCache::fieldsOf(const ItemRecord &item)
{
    QJsonObject object;
    object.insert(QStringLiteral("name"), item.name);
    object.insert(QStringLiteral("quantity"), item.quantity);
    object.insert(QStringLiteral("location"), item.location);
    object.insert(QStringLiteral("condition"), item.condition);
    return object;
}

void LocalCache::replaceAll(const QVector<ItemRecord> &items)
{
    if (!m_db.isOpen()) return;
    QSqlDatabase::database(m_connection).transaction();
    exec(QStringLiteral("DELETE FROM items"));
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "INSERT INTO items (id, name, quantity, location, condition, version, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)"));
    for (const ItemRecord &item : items) {
        query.addBindValue(item.id);
        query.addBindValue(item.name);
        query.addBindValue(item.quantity);
        query.addBindValue(item.location);
        query.addBindValue(item.condition);
        query.addBindValue(item.version);
        query.addBindValue(item.updatedAt);
        if (!query.exec()) {
            qWarning() << "SQLite insert:" << query.lastError().text();
        }
    }
    QSqlDatabase::database(m_connection).commit();
}

void LocalCache::upsert(const ItemRecord &item)
{
    if (!m_db.isOpen()) return;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "INSERT OR REPLACE INTO items (id, name, quantity, location, condition, version, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)"));
    query.addBindValue(item.id);
    query.addBindValue(item.name);
    query.addBindValue(item.quantity);
    query.addBindValue(item.location);
    query.addBindValue(item.condition);
    query.addBindValue(item.version);
    query.addBindValue(item.updatedAt);
    if (!query.exec()) {
        qWarning() << "SQLite upsert:" << query.lastError().text();
    }
}

void LocalCache::remove(const QString &id)
{
    if (!m_db.isOpen()) return;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("DELETE FROM items WHERE id = ?"));
    query.addBindValue(id);
    query.exec();
}

QVector<ItemRecord> LocalCache::all() const
{
    QVector<ItemRecord> result;
    if (!m_db.isOpen()) return result;
    QSqlQuery query(m_db);
    if (query.exec(QStringLiteral(
            "SELECT id, name, quantity, location, condition, version, updated_at"
            " FROM items ORDER BY name COLLATE NOCASE"))) {
        while (query.next()) result.append(fromQuery(query));
    }
    return result;
}

ItemRecord LocalCache::find(const QString &id) const
{
    if (!m_db.isOpen()) return ItemRecord();
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "SELECT id, name, quantity, location, condition, version, updated_at"
        " FROM items WHERE id = ?"));
    query.addBindValue(id);
    if (query.exec() && query.next()) return fromQuery(query);
    return ItemRecord();
}

bool LocalCache::contains(const QString &id) const
{
    if (!m_db.isOpen()) return false;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("SELECT 1 FROM items WHERE id = ?"));
    query.addBindValue(id);
    return query.exec() && query.next();
}

int LocalCache::count() const
{
    if (!m_db.isOpen()) return 0;
    QSqlQuery query(m_db);
    if (query.exec(QStringLiteral("SELECT COUNT(*) FROM items")) && query.next())
        return query.value(0).toInt();
    return 0;
}

qint64 LocalCache::enqueue(const QString &method, const QString &itemId, const QJsonObject &payload)
{
    if (!m_db.isOpen()) return -1;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "INSERT INTO pending (method, item_id, payload, queued_at) VALUES (?, ?, ?, ?)"));
    query.addBindValue(method);
    query.addBindValue(itemId);
    query.addBindValue(QString::fromUtf8(QJsonDocument(payload).toJson(QJsonDocument::Compact)));
    query.addBindValue(QDateTime::currentDateTimeUtc().toString(Qt::ISODate));
    if (!query.exec()) {
        qWarning() << "SQLite enqueue:" << query.lastError().text();
        return -1;
    }
    return query.lastInsertId().toLongLong();
}

QVector<LocalCache::PendingOp> LocalCache::pendingOps() const
{
    QVector<PendingOp> result;
    if (!m_db.isOpen()) return result;
    QSqlQuery query(m_db);
    if (query.exec(QStringLiteral(
            "SELECT id, method, item_id, payload FROM pending ORDER BY id"))) {
        while (query.next()) {
            PendingOp op;
            op.id = query.value(0).toLongLong();
            op.method = query.value(1).toString();
            op.itemId = query.value(2).toString();
            op.payload = QJsonDocument::fromJson(query.value(3).toByteArray()).object();
            result.append(op);
        }
    }
    return result;
}

int LocalCache::pendingCount() const
{
    if (!m_db.isOpen()) return 0;
    QSqlQuery query(m_db);
    if (query.exec(QStringLiteral("SELECT COUNT(*) FROM pending")) && query.next())
        return query.value(0).toInt();
    return 0;
}

void LocalCache::removePending(qint64 id)
{
    if (!m_db.isOpen()) return;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("DELETE FROM pending WHERE id = ?"));
    query.addBindValue(id);
    query.exec();
}

void LocalCache::removePendingForItem(const QString &itemId)
{
    if (!m_db.isOpen()) return;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("DELETE FROM pending WHERE item_id = ?"));
    query.addBindValue(itemId);
    query.exec();
}

void LocalCache::updatePendingPayload(qint64 id, const QJsonObject &payload)
{
    if (!m_db.isOpen()) return;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("UPDATE pending SET payload = ? WHERE id = ?"));
    query.addBindValue(QString::fromUtf8(QJsonDocument(payload).toJson(QJsonDocument::Compact)));
    query.addBindValue(id);
    query.exec();
}

bool LocalCache::lastPendingForItem(const QString &itemId, PendingOp *op) const
{
    if (!m_db.isOpen() || !op) return false;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "SELECT id, method, item_id, payload FROM pending WHERE item_id = ? ORDER BY id DESC LIMIT 1"));
    query.addBindValue(itemId);
    if (query.exec() && query.next()) {
        op->id = query.value(0).toLongLong();
        op->method = query.value(1).toString();
        op->itemId = query.value(2).toString();
        op->payload = QJsonDocument::fromJson(query.value(3).toByteArray()).object();
        return true;
    }
    return false;
}

void LocalCache::remapItemId(const QString &from, const QString &to)
{
    if (!m_db.isOpen() || from == to) return;
    QSqlDatabase::database(m_connection).transaction();

    QSqlQuery item(m_db);
    item.prepare(QStringLiteral("UPDATE items SET id = ? WHERE id = ?"));
    item.addBindValue(to);
    item.addBindValue(from);
    item.exec();

    QSqlQuery pending(m_db);
    pending.prepare(QStringLiteral("UPDATE pending SET item_id = ? WHERE item_id = ?"));
    pending.addBindValue(to);
    pending.addBindValue(from);
    pending.exec();

    QSqlDatabase::database(m_connection).commit();
}

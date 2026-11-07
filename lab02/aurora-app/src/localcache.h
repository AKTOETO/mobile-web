#ifndef LOCALCACHE_H
#define LOCALCACHE_H

#include "itemmodel.h"

#include <QJsonObject>
#include <QSqlDatabase>
#include <QString>
#include <QVector>

/**
 * Локальный кэш предметов и очередь отложенных операций (SQLite).
 *
 * Таблица items     — последняя известная копия предметов для offline-режима.
 * Таблица pending   — операции, которые не удалось выполнить на сервере:
 *                     CREATE/UPDATE/DELETE с полным телом запроса.
 */
class LocalCache
{
public:
    struct PendingOp {
        qint64 id = -1;
        QString method;
        QString itemId;
        QJsonObject payload;
    };

    LocalCache();
    ~LocalCache();

    bool open(QString *error = nullptr);
    QString path() const;
    bool isOpen() const;

    void replaceAll(const QVector<ItemRecord> &items);
    void upsert(const ItemRecord &item);
    void remove(const QString &id);
    QVector<ItemRecord> all() const;
    ItemRecord find(const QString &id) const;
    bool contains(const QString &id) const;
    int count() const;

    qint64 enqueue(const QString &method, const QString &itemId, const QJsonObject &payload);
    QVector<PendingOp> pendingOps() const;
    int pendingCount() const;
    void removePending(qint64 id);
    void removePendingForItem(const QString &itemId);
    void updatePendingPayload(qint64 id, const QJsonObject &payload);
    bool lastPendingForItem(const QString &itemId, PendingOp *op) const;

    /** Замена временного id ("local-...") на настоящий id с сервера. */
    void remapItemId(const QString &from, const QString &to);

private:
    bool exec(const QString &sql);
    static ItemRecord fromQuery(const class QSqlQuery &query);
    static QJsonObject fieldsOf(const ItemRecord &item);

    QSqlDatabase m_db;
    QString m_connection;
    QString m_path;
};

#endif // LOCALCACHE_H

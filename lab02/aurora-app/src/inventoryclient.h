#ifndef INVENTORYCLIENT_H
#define INVENTORYCLIENT_H

#include "itemmodel.h"
#include "localcache.h"

#include <QHash>
#include <QJsonValue>
#include <QNetworkCookieJar>
#include <QObject>
#include <QSettings>
#include <QString>
#include <QStringList>
#include <QUrl>

#include <functional>

class QNetworkAccessManager;
class QNetworkReply;
class QNetworkRequest;

/**
 * Cookie jar с сохранением в QSettings: cookie (включая HttpOnly token)
 * переживают перезапуск приложения.
 */
class PersistentCookieJar : public QNetworkCookieJar
{
public:
    explicit PersistentCookieJar(QSettings *settings, QObject *parent = nullptr);

    void load(const QUrl &url);
    void save();
    void clear();

protected:
    bool setCookiesFromUrl(const QList<QNetworkCookie> &cookieList, const QUrl &url) override;

private:
    QSettings *m_settings;
};

/**
 * Клиент REST API инвентаря для Аврора ОС.
 *
 * Умеет: асинхронные запросы (QNetworkAccessManager) с таймаутом, JWT и cookie
 * (QSettings + QNetworkCookieJar), JSON (QJsonDocument), SQLite-кэш и очередь
 * отложенных операций (QtSql), offline-режим и синхронизацию, демо-сценарий.
 */
class InventoryClient : public QObject
{
    Q_OBJECT
    Q_PROPERTY(ItemModel *model READ model CONSTANT)
    Q_PROPERTY(QString baseUrl READ baseUrl WRITE setBaseUrl NOTIFY settingsChanged)
    Q_PROPERTY(QString username READ username NOTIFY authChanged)
    Q_PROPERTY(QString role READ role NOTIFY authChanged)
    Q_PROPERTY(bool loggedIn READ loggedIn NOTIFY authChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(bool online READ online NOTIFY onlineChanged)
    Q_PROPERTY(bool simulateOffline READ simulateOffline WRITE setSimulateOffline NOTIFY onlineChanged)
    Q_PROPERTY(int pendingCount READ pendingCount NOTIFY pendingChanged)
    Q_PROPERTY(QString statusMessage READ statusMessage NOTIFY statusChanged)
    Q_PROPERTY(bool statusIsError READ statusIsError NOTIFY statusChanged)
    Q_PROPERTY(QString demoSummary READ demoSummary NOTIFY demoFinished)
    Q_PROPERTY(QString cachePath READ cachePath CONSTANT)

public:
    explicit InventoryClient(QObject *parent = nullptr);
    ~InventoryClient() override;

    ItemModel *model();

    QString baseUrl() const;
    void setBaseUrl(const QString &url);
    QString username() const;
    QString role() const;
    bool loggedIn() const;
    bool busy() const;
    bool online() const;
    bool simulateOffline() const;
    int pendingCount() const;
    QString statusMessage() const;
    bool statusIsError() const;
    QString demoSummary() const;
    QString cachePath() const;
    QString demoLogPath() const;

    Q_INVOKABLE void login(const QString &username, const QString &password);
    Q_INVOKABLE void logout();
    Q_INVOKABLE void refresh();
    Q_INVOKABLE void loadCacheOnly();
    Q_INVOKABLE void createItem(const QString &name, int quantity,
                                const QString &location, const QString &condition);
    Q_INVOKABLE void updateItem(const QString &id, const QString &name, int quantity,
                                const QString &location, const QString &condition);
    Q_INVOKABLE void deleteItem(const QString &id);
    Q_INVOKABLE void syncPending();
    Q_INVOKABLE void setSimulateOffline(bool offline);
    Q_INVOKABLE void startDemo();
    Q_INVOKABLE QString itemJson(const QString &id) const;
    Q_INVOKABLE QString demoLog() const;
    Q_INVOKABLE void clearStatus();

signals:
    void authChanged();
    void onlineChanged();
    void busyChanged();
    void pendingChanged();
    void statusChanged();
    void settingsChanged();
    void demoFinished();
    void demoLogChanged();

private:
    typedef std::function<void(int status, const QJsonValue &json, const QByteArray &raw)> ReplyHandler;
    typedef std::function<void(bool ok, const ItemRecord &item, const QString &note)> ItemHandler;
    typedef std::function<void(bool ok, const QString &note)> DeleteHandler;

    void request(const QByteArray &method, const QString &path, const QJsonObject &body,
                 ReplyHandler handler, const QString &tokenOverride = QString());

    void loginWith(const QString &username, const QString &password, std::function<void(bool)> done);
    void doRefresh(std::function<void(bool)> done);
    void doCreate(const QJsonObject &fields, ItemHandler done);
    void doUpdate(const QString &id, const QJsonObject &fields, ItemHandler done);
    void doDelete(const QString &id, DeleteHandler done);

    void applyLocalCreate(const QJsonObject &fields, ItemHandler done);
    void applyLocalUpdate(const QString &id, const QJsonObject &fields, ItemHandler done);
    void applyLocalDelete(const QString &id, DeleteHandler done);

    void syncAll(std::function<void(int ok, int fail)> done);
    void syncStep(const QVector<LocalCache::PendingOp> &ops, int index, int ok, int fail,
                  std::function<void(int ok, int fail)> done);

    void loadSettings();
    void saveAuth();
    void loadCacheToModel();
    void setStatus(const QString &message, bool error = false);
    void setOnline(bool online);
    void setBusy(int delta);

    void logDemo(const QString &line);
    void finishDemo(bool ok);
    void demoDeleteNext(const QStringList &ids, int index);

    static ItemRecord parseItem(const QJsonObject &object);
    static QJsonObject fieldsFrom(const QString &name, int quantity,
                                  const QString &location, const QString &condition);

    QSettings m_settings;
    QNetworkAccessManager *m_nam;
    PersistentCookieJar *m_jar;
    LocalCache m_cache;
    ItemModel m_model;

    QString m_baseUrl;
    QString m_token;
    QString m_username;
    QString m_role;
    bool m_online = false;
    bool m_simulateOffline = false;
    int m_inflight = 0;
    QString m_status;
    bool m_statusError = false;
    QString m_demoSummary;

    QHash<QString, QString> m_syncRemap;
    bool m_demoRunning = false;
    QStringList m_demoLog;
    QString m_demoOnlineId;
    QString m_demoTempId;
    QString m_demoTempRealId;
};

#endif // INVENTORYCLIENT_H

#include "inventoryclient.h"

#include <QBuffer>
#include <QDateTime>
#include <QDebug>
#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonValue>
#include <QNetworkAccessManager>
#include <QNetworkCookie>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QSslError>
#include <QSslCertificate>
#include <QSslSocket>
#include <QStandardPaths>
#include <QTimer>
#include <QUrl>
#include <QUuid>
#include <QVariant>

static QString errorMessage(int status, const QJsonValue &json);

// ---------------------------------------------------------------------------
// PersistentCookieJar
// ---------------------------------------------------------------------------

PersistentCookieJar::PersistentCookieJar(QSettings *settings, QObject *parent)
    : QNetworkCookieJar(parent)
    , m_settings(settings)
{
}

bool PersistentCookieJar::setCookiesFromUrl(const QList<QNetworkCookie> &cookieList, const QUrl &url)
{
    const bool changed = QNetworkCookieJar::setCookiesFromUrl(cookieList, url);
    if (changed) save();
    return changed;
}

void PersistentCookieJar::load(const QUrl &url)
{
    if (!m_settings) return;
    const QStringList rawList = m_settings->value(QStringLiteral("cookies/list")).toStringList();
    QList<QNetworkCookie> cookies;
    for (const QString &raw : rawList) {
        const QList<QNetworkCookie> parsed = QNetworkCookie::parseCookies(raw.toLatin1());
        cookies.append(parsed);
    }
    if (!cookies.isEmpty() && url.isValid()) {
        QNetworkCookieJar::setCookiesFromUrl(cookies, url);
        qInfo() << "Cookie: восстановлено" << cookies.size() << "из QSettings";
    }
}

void PersistentCookieJar::clear()
{
    setAllCookies(QList<QNetworkCookie>());
    if (m_settings) {
        m_settings->remove(QStringLiteral("cookies/list"));
        m_settings->sync();
    }
}

void PersistentCookieJar::save()
{
    if (!m_settings) return;
    QStringList rawList;
    for (const QNetworkCookie &cookie : allCookies()) {
        rawList.append(QString::fromLatin1(cookie.toRawForm()));
    }
    m_settings->setValue(QStringLiteral("cookies/list"), rawList);
    m_settings->sync();
}

// ---------------------------------------------------------------------------
// InventoryClient
// ---------------------------------------------------------------------------

InventoryClient::InventoryClient(QObject *parent)
    : QObject(parent)
    , m_nam(nullptr)
    , m_jar(nullptr)
{
    QString cacheError;
    m_cache.open(&cacheError);

    m_nam = new QNetworkAccessManager(this);
    m_jar = new PersistentCookieJar(&m_settings);
    m_nam->setCookieJar(m_jar);

    QFile caFile(QStringLiteral(":/certs/ca.crt"));
    QList<QSslCertificate> authorities;
    if (caFile.open(QIODevice::ReadOnly)) {
        authorities = QSslCertificate::fromData(caFile.readAll(), QSsl::Pem);
    }
    // Только CA этого сервера: системные CA здесь намеренно не используются.
    // Это позволяет безопасно разрешить смену IP без доверия чужим серверам.
    m_tls = QSslConfiguration::defaultConfiguration();
    m_tls.setCaCertificates(authorities);
    m_tls.setPeerVerifyMode(QSslSocket::VerifyPeer);
    if (authorities.isEmpty()) qCritical() << "TLS: встроенный CA не загружен";

    loadSettings();
    m_jar->load(QUrl(m_baseUrl));
    loadCacheToModel();

    if (!cacheError.isEmpty()) {
        setStatus(QStringLiteral("SQLite-кэш недоступен: ") + cacheError, true);
    } else if (m_token.isEmpty()) {
        setStatus(QStringLiteral("Войдите, чтобы загрузить инвентарь."));
    } else {
        setStatus(QStringLiteral("Сессия сохранена: %1 (%2). Нажмите «Обновить».")
                  .arg(m_username, m_role));
    }
}

InventoryClient::~InventoryClient()
{
}

ItemModel *InventoryClient::model()
{
    return &m_model;
}

QString InventoryClient::baseUrl() const { return m_baseUrl; }

void InventoryClient::setBaseUrl(const QString &url)
{
    QString normalized = url.trimmed();
    while (normalized.endsWith(QLatin1Char('/'))) normalized.chop(1);
    if (normalized.isEmpty()) normalized = QStringLiteral("https://10.0.2.2:8443");
    if (normalized == m_baseUrl) return;
    m_baseUrl = normalized;
    m_settings.setValue(QStringLiteral("server/url"), m_baseUrl);
    m_settings.sync();
    m_jar->load(QUrl(m_baseUrl));
    emit settingsChanged();
    if (!m_token.isEmpty()) refresh();
}

QString InventoryClient::username() const { return m_username; }
QString InventoryClient::role() const { return m_role; }
bool InventoryClient::loggedIn() const { return !m_token.isEmpty(); }
bool InventoryClient::busy() const { return m_inflight > 0 || m_updating; }
bool InventoryClient::online() const { return m_online; }
bool InventoryClient::simulateOffline() const { return m_simulateOffline; }
int InventoryClient::pendingCount() const { return m_cache.pendingCount(); }
QString InventoryClient::statusMessage() const { return m_status; }
bool InventoryClient::statusIsError() const { return m_statusError; }
QString InventoryClient::demoSummary() const { return m_demoSummary; }
QString InventoryClient::cachePath() const { return m_cache.path(); }

void InventoryClient::loadSettings()
{
    m_baseUrl = m_settings.value(QStringLiteral("server/url"),
                                 QStringLiteral("https://10.0.2.2:8443")).toString();
    m_token = m_settings.value(QStringLiteral("auth/token")).toString();
    m_username = m_settings.value(QStringLiteral("auth/username")).toString();
    m_role = m_settings.value(QStringLiteral("auth/role")).toString();
}

void InventoryClient::saveAuth()
{
    m_settings.setValue(QStringLiteral("auth/token"), m_token);
    m_settings.setValue(QStringLiteral("auth/username"), m_username);
    m_settings.setValue(QStringLiteral("auth/role"), m_role);
    m_settings.setValue(QStringLiteral("server/url"), m_baseUrl);
    m_settings.sync();
}

void InventoryClient::loadCacheToModel()
{
    m_model.setItems(m_cache.all());
    emit pendingChanged();
}

void InventoryClient::setStatus(const QString &message, bool error)
{
    m_status = message;
    m_statusError = error;
    emit statusChanged();
    if (error) qWarning().noquote() << message;
    else qInfo().noquote() << message;
}

void InventoryClient::clearStatus()
{
    setStatus(QString());
}

void InventoryClient::setOnline(bool online)
{
    if (m_online == online) return;
    m_online = online;
    emit onlineChanged();
}

void InventoryClient::setBusy(int delta)
{
    const bool wasBusy = busy();
    m_inflight += delta;
    if (m_inflight < 0) m_inflight = 0;
    if (wasBusy != busy()) emit busyChanged();
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

void InventoryClient::request(const QByteArray &method, const QString &path,
                              const QJsonObject &body, ReplyHandler handler,
                              const QString &tokenOverride)
{
    QUrl url(m_baseUrl + path);
    QNetworkRequest request(url);
    request.setSslConfiguration(m_tls);
    request.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    request.setRawHeader("Accept", "application/json");
    request.setRawHeader("User-Agent", "aurora-inventory/1.0 (Qt 5.6)");

    const QString token = tokenOverride.isNull() ? m_token : tokenOverride;
    if (!token.isEmpty()) {
        request.setRawHeader("Authorization", "Bearer " + token.toUtf8());
    }

    const QByteArray payload = body.isEmpty()
            ? QByteArray()
            : QJsonDocument(body).toJson(QJsonDocument::Compact);

    QNetworkReply *reply = nullptr;
    if (method == "GET") reply = m_nam->get(request);
    else if (method == "POST") reply = m_nam->post(request, payload);
    else if (method == "PUT") reply = m_nam->put(request, payload);
    else if (method == "PATCH") {
        QBuffer *buffer = new QBuffer;
        buffer->setData(payload);
        buffer->open(QIODevice::ReadOnly);
        reply = m_nam->sendCustomRequest(request, "PATCH", buffer);
        connect(reply, &QNetworkReply::finished, buffer, &QObject::deleteLater);
    }
    else if (method == "DELETE") reply = m_nam->deleteResource(request);
    else {
        if (handler) handler(0, QJsonValue(), QByteArray("неизвестный метод"));
        return;
    }

    setBusy(1);

    QTimer *timer = new QTimer(reply);
    timer->setSingleShot(true);
    connect(timer, &QTimer::timeout, reply, &QNetworkReply::abort);
    timer->start(8000);

    connect(reply, &QNetworkReply::sslErrors, this,
            [reply](const QList<QSslError> &errors) {
        // Адрес сервера может меняться. Цепочку проверяем только через наш CA,
        // а несовпадение имени допускаем; остальные TLS-ошибки остаются fatal.
        QList<QSslError> addressErrors;
        for (const QSslError &error : errors) {
            qWarning() << "TLS:" << error.errorString();
            if (error.error() == QSslError::HostNameMismatch) {
                addressErrors.append(error);
            }
        }
        if (!addressErrors.isEmpty()) reply->ignoreSslErrors(addressErrors);
    });

    connect(reply, &QNetworkReply::finished, this, [this, reply, timer, handler]() {
        timer->stop();
        const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QByteArray raw = reply->readAll();
        const QJsonDocument document = QJsonDocument::fromJson(raw);
        QJsonValue value;
        if (document.isObject()) value = QJsonValue(document.object());
        else if (document.isArray()) value = QJsonValue(document.array());

        setBusy(-1);
        if (status > 0) {
            setOnline(true);
            if (handler) handler(status, value, raw);
        } else {
            setOnline(false);
            if (handler) handler(0, QJsonValue(), reply->errorString().toUtf8());
        }
        reply->deleteLater();
    });
}

// ---------------------------------------------------------------------------
// Аутентификация
// ---------------------------------------------------------------------------

void InventoryClient::login(const QString &username, const QString &password)
{
    loginWith(username, password, [this](bool ok) {
        if (ok) doRefresh(nullptr);
    });
}

void InventoryClient::loginWith(const QString &username, const QString &password,
                                std::function<void (bool)> done)
{
    QJsonObject body;
    body.insert(QStringLiteral("username"), username);
    body.insert(QStringLiteral("password"), password);
    setStatus(QStringLiteral("Вход: %1...").arg(username));

    request("POST", QStringLiteral("/api/v1/auth/login"), body,
            [this, done](int status, const QJsonValue &json, const QByteArray &raw) {
        if (status == 200) {
            const QJsonObject object = json.toObject();
            m_token = object.value(QStringLiteral("token")).toString();
            const QJsonObject user = object.value(QStringLiteral("user")).toObject();
            m_username = user.value(QStringLiteral("username")).toString();
            m_role = user.value(QStringLiteral("role")).toString();
            saveAuth();
            m_jar->save();
            emit authChanged();
            setStatus(QStringLiteral("Вход выполнен: %1 (%2)").arg(m_username, m_role));
            if (done) done(true);
        } else if (status == 0) {
            setStatus(QStringLiteral("Сеть недоступна: ") + QString::fromUtf8(raw), true);
            if (done) done(false);
        } else {
            QString message = QString::fromUtf8(raw);
            const QJsonObject object = json.toObject();
            if (object.contains(QStringLiteral("message")))
                message = object.value(QStringLiteral("message")).toString();
            setStatus(QStringLiteral("Вход не выполнен (") + QString::number(status) + "): " + message, true);
            if (done) done(false);
        }
    });
}

void InventoryClient::logout()
{
    if (!m_token.isEmpty()) {
        request("POST", QStringLiteral("/api/v1/auth/logout"), QJsonObject(), ReplyHandler());
    }
    m_token.clear();
    m_username.clear();
    m_role.clear();
    m_jar->clear();
    m_jar->save();
    saveAuth();
    emit authChanged();
    loadCacheToModel();
    setStatus(QStringLiteral("Выполнен выход, показан локальный кэш."));
}

// ---------------------------------------------------------------------------
// Чтение и кэш
// ---------------------------------------------------------------------------

void InventoryClient::setSimulateOffline(bool offline)
{
    if (m_simulateOffline == offline) return;
    m_simulateOffline = offline;
    emit onlineChanged();
    if (offline) {
        loadCacheToModel();
        setStatus(QStringLiteral("Офлайн-режим включён: показан кэш (%1).").arg(m_model.count()));
    } else {
        setStatus(QStringLiteral("Офлайн-режим выключен: можно синхронизировать очередь."));
    }
}

void InventoryClient::refresh()
{
    if (busy()) return;
    if (m_simulateOffline) {
        loadCacheOnly();
        setStatus(QStringLiteral("Офлайн-режим включён: показан кэш (%1).").arg(m_model.count()));
        return;
    }
    if (!loggedIn()) {
        setStatus(QStringLiteral("Сначала войдите в систему."), true);
        return;
    }
    m_updating = true;
    emit busyChanged();
    // Сначала отправляем очередь, затем читаем итоговое состояние сервера.
    syncAll([this](int, int failed) {
        doRefresh([this, failed](bool ok) {
            m_updating = false;
            emit busyChanged();
            if (m_cache.pendingCount() > 0) {
                setStatus(QStringLiteral("Не все изменения отправлены. В очереди: %1; "
                                         "локальные данные сохранены.").arg(m_cache.pendingCount()), true);
            } else if (failed > 0 && ok) {
                setStatus(QStringLiteral("Список обновлён; ошибок синхронизации: %1.")
                          .arg(failed), true);
            }
        });
    });
}

void InventoryClient::loadCacheOnly()
{
    loadCacheToModel();
    setStatus(QStringLiteral("Локальный кэш: %1 предметов, в очереди %2.")
              .arg(m_model.count()).arg(m_cache.pendingCount()));
}

void InventoryClient::doRefresh(std::function<void (bool)> done)
{
    request("GET", QStringLiteral("/api/v1/items"), QJsonObject(),
            [this, done](int status, const QJsonValue &json, const QByteArray &) {
        if (status == 200) {
            QVector<ItemRecord> items;
            const QJsonArray array = json.toObject().value(QStringLiteral("items")).toArray();
            for (const QJsonValue &value : array) items.append(parseItem(value.toObject()));
            // Если сервер отклонил операцию или сеть пропала при синхронизации,
            // серверный снимок не должен затереть оставшиеся локальные правки.
            const QVector<ItemRecord> cached = m_cache.all();
            const QVector<LocalCache::PendingOp> pending = m_cache.pendingOps();
            for (const LocalCache::PendingOp &op : pending) {
                for (int i = items.size() - 1; i >= 0; --i) {
                    if (items.at(i).id == op.itemId) items.remove(i);
                }
                if (op.method != QLatin1String("DELETE")) {
                    for (const ItemRecord &item : cached) {
                        if (item.id == op.itemId) { items.append(item); break; }
                    }
                }
            }
            m_model.setItems(items);
            m_cache.replaceAll(items);
            emit pendingChanged();
            setStatus(QStringLiteral("Обновлено: %1 предметов с сервера.").arg(items.size()));
            if (done) done(true);
        } else if (status == 401) {
            setStatus(QStringLiteral("Сервер требует вход (401)."), true);
            if (done) done(false);
        } else if (status == 0) {
            loadCacheToModel();
            setStatus(QStringLiteral("Сеть недоступна: показан кэш (%1).")
                      .arg(m_model.count()), true);
            if (done) done(false);
        } else {
            setStatus(QStringLiteral("Ошибка чтения (") + QString::number(status) + "): " +
                      errorMessage(status, json), true);
            if (done) done(false);
        }
    });
}

// ---------------------------------------------------------------------------
// CRUD с офлайн-очередью
// ---------------------------------------------------------------------------

void InventoryClient::createItem(const QString &name, int quantity,
                                 const QString &location, const QString &condition)
{
    doCreate(fieldsFrom(name, quantity, location, condition),
             [](bool, const ItemRecord &, const QString &) {});
}

void InventoryClient::updateItem(const QString &id, const QString &name, int quantity,
                                 const QString &location, const QString &condition)
{
    doUpdate(id, fieldsFrom(name, quantity, location, condition), ItemHandler());
}

void InventoryClient::deleteItem(const QString &id)
{
    doDelete(id, DeleteHandler());
}

QJsonObject InventoryClient::fieldsFrom(const QString &name, int quantity,
                                        const QString &location, const QString &condition)
{
    QJsonObject fields;
    fields.insert(QStringLiteral("name"), name.trimmed());
    fields.insert(QStringLiteral("quantity"), quantity);
    fields.insert(QStringLiteral("location"), location.trimmed());
    fields.insert(QStringLiteral("condition"), condition);
    return fields;
}

void InventoryClient::doCreate(const QJsonObject &fields, ItemHandler done)
{
    if (m_simulateOffline) {
        applyLocalCreate(fields, done);
        return;
    }
    request("POST", QStringLiteral("/api/v1/items"), fields,
            [this, fields, done](int status, const QJsonValue &json, const QByteArray &) {
        if (status == 201) {
            const ItemRecord item = parseItem(json.toObject());
            m_cache.upsert(item);
            m_model.upsert(item);
            setStatus(QStringLiteral("Создан предмет: %1").arg(item.name));
            if (done) done(true, item, QStringLiteral("online"));
        } else if (status == 0) {
            applyLocalCreate(fields, done);
        } else {
            const QString note = QStringLiteral("код %1: %2")
                    .arg(status).arg(errorMessage(status, json));
            setStatus(QStringLiteral("Создание не выполнено: ") + note, true);
            if (done) done(false, ItemRecord(), note);
        }
    });
}

void InventoryClient::applyLocalCreate(const QJsonObject &fields, ItemHandler done)
{
    ItemRecord item;
    item.id = QStringLiteral("local-") +
            QUuid::createUuid().toString().remove(QLatin1Char('{')).remove(QLatin1Char('}'));
    item.name = fields.value(QStringLiteral("name")).toString();
    item.quantity = fields.value(QStringLiteral("quantity")).toInt();
    item.location = fields.value(QStringLiteral("location")).toString();
    item.condition = fields.value(QStringLiteral("condition")).toString();
    item.version = 0;
    item.updatedAt = QDateTime::currentDateTimeUtc().toString(Qt::ISODate);

    m_cache.upsert(item);
    m_model.upsert(item);
    m_cache.enqueue(QStringLiteral("CREATE"), item.id, fields);
    emit pendingChanged();
    setStatus(QStringLiteral("Офлайн: «%1» создан локально и поставлен в очередь.")
              .arg(item.name));
    if (done) done(true, item, QStringLiteral("offline-queue"));
}

void InventoryClient::doUpdate(const QString &id, const QJsonObject &fields, ItemHandler done)
{
    if (m_simulateOffline) {
        applyLocalUpdate(id, fields, done);
        return;
    }
    request("PUT", QStringLiteral("/api/v1/items/") + id, fields,
            [this, id, fields, done](int status, const QJsonValue &json, const QByteArray &raw) {
        Q_UNUSED(raw);
        if (status == 200) {
            const ItemRecord item = parseItem(json.toObject());
            m_cache.upsert(item);
            m_model.upsert(item);
            setStatus(QStringLiteral("Сохранено: %1").arg(item.name));
            if (done) done(true, item, QStringLiteral("online"));
        } else if (status == 0) {
            applyLocalUpdate(id, fields, done);
        } else if (status == 404) {
            m_cache.remove(id);
            m_model.removeById(id);
            setStatus(QStringLiteral("Предмет не найден на сервере (404)."), true);
            if (done) done(false, ItemRecord(), QStringLiteral("404"));
        } else {
            const QString note = QStringLiteral("код %1: %2")
                    .arg(status).arg(errorMessage(status, json));
            setStatus(QStringLiteral("Изменение не выполнено: ") + note, true);
            if (done) done(false, ItemRecord(), note);
        }
    });
}

void InventoryClient::applyLocalUpdate(const QString &id, const QJsonObject &fields, ItemHandler done)
{
    ItemRecord item = m_cache.find(id);
    if (item.id.isEmpty()) {
        setStatus(QStringLiteral("Нет предмета в кэше для изменения."), true);
        if (done) done(false, ItemRecord(), QStringLiteral("not-in-cache"));
        return;
    }
    item.name = fields.value(QStringLiteral("name")).toString();
    item.quantity = fields.value(QStringLiteral("quantity")).toInt();
    item.location = fields.value(QStringLiteral("location")).toString();
    item.condition = fields.value(QStringLiteral("condition")).toString();
    item.version += 1;
    item.updatedAt = QDateTime::currentDateTimeUtc().toString(Qt::ISODate);
    m_cache.upsert(item);
    m_model.upsert(item);

    LocalCache::PendingOp last;
    if (m_cache.lastPendingForItem(id, &last) &&
            (last.method == QLatin1String("CREATE") || last.method == QLatin1String("UPDATE"))) {
        m_cache.updatePendingPayload(last.id, fields);
    } else {
        m_cache.enqueue(QStringLiteral("UPDATE"), id, fields);
    }
    emit pendingChanged();
    setStatus(QStringLiteral("Офлайн: изменение «%1» в очереди.").arg(item.name));
    if (done) done(true, item, QStringLiteral("offline-queue"));
}

void InventoryClient::doDelete(const QString &id, DeleteHandler done)
{
    if (m_simulateOffline) {
        applyLocalDelete(id, done);
        return;
    }
    request("DELETE", QStringLiteral("/api/v1/items/") + id, QJsonObject(),
            [this, id, done](int status, const QJsonValue &json, const QByteArray &raw) {
        Q_UNUSED(json);
        Q_UNUSED(raw);
        if (status == 204 || status == 404) {
            m_cache.remove(id);
            m_model.removeById(id);
            setStatus(QStringLiteral("Предмет удалён."));
            if (done) done(true, QStringLiteral("online"));
        } else if (status == 0) {
            applyLocalDelete(id, done);
        } else {
            setStatus(QStringLiteral("Удаление не выполнено: код ") + QString::number(status), true);
            if (done) done(false, QStringLiteral("код ") + QString::number(status));
        }
    });
}

void InventoryClient::applyLocalDelete(const QString &id, DeleteHandler done)
{
    const bool local = id.startsWith(QStringLiteral("local-"));
    m_cache.remove(id);
    m_model.removeById(id);
    m_cache.removePendingForItem(id);
    if (!local) {
        m_cache.enqueue(QStringLiteral("DELETE"), id, QJsonObject());
    }
    emit pendingChanged();
    setStatus(local ? QStringLiteral("Офлайн: локальный предмет убран.")
                    : QStringLiteral("Офлайн: удаление поставлено в очередь."));
    if (done) done(true, QStringLiteral("offline-queue"));
}

// ---------------------------------------------------------------------------
// Синхронизация очереди
// ---------------------------------------------------------------------------

void InventoryClient::syncAll(std::function<void (int, int)> done)
{
    if (m_simulateOffline) {
        setStatus(QStringLiteral("Синхронизация невозможна: включён офлайн-режим."), true);
        if (done) done(0, 0);
        return;
    }
    if (!loggedIn()) {
        setStatus(QStringLiteral("Синхронизация: сначала войдите."), true);
        if (done) done(0, 0);
        return;
    }
    const QVector<LocalCache::PendingOp> ops = m_cache.pendingOps();
    if (ops.isEmpty()) {
        setStatus(QStringLiteral("Очередь пуста, синхронизировать нечего."));
        if (done) done(0, 0);
        return;
    }
    m_syncRemap.clear();
    setStatus(QStringLiteral("Синхронизация: %1 операций...").arg(ops.size()));
    syncStep(ops, 0, 0, 0, done);
}

void InventoryClient::syncStep(const QVector<LocalCache::PendingOp> &ops, int index,
                               int ok, int fail, std::function<void (int, int)> done)
{
    if (index >= ops.size()) {
        setStatus(QStringLiteral("Синхронизация завершена: %1 ок, %2 ошибок.").arg(ok).arg(fail),
                  fail > 0);
        emit pendingChanged();
        if (done) done(ok, fail);
        return;
    }

    const LocalCache::PendingOp op = ops.at(index);
    const QString id = m_syncRemap.value(op.itemId, op.itemId);

    std::function<void (int, int)> next = [this, ops, index, ok, fail, done](int addOk, int addFail) {
        QTimer::singleShot(60, this, [this, ops, index, ok, fail, done, addOk, addFail]() {
            syncStep(ops, index + 1, ok + addOk, fail + addFail, done);
        });
    };
    std::function<void (const QString &)> stop = [this, ok, fail, done](const QString &message) {
        setOnline(false);
        setStatus(QStringLiteral("Синхронизация остановлена: ") + message, true);
        emit pendingChanged();
        if (done) done(ok, fail);
    };

    if (op.method == QLatin1String("CREATE")) {
        request("POST", QStringLiteral("/api/v1/items"), op.payload,
                [this, op, next, stop](int status, const QJsonValue &json, const QByteArray &raw) {
            Q_UNUSED(raw);
            if (status == 201) {
                const ItemRecord item = parseItem(json.toObject());
                m_syncRemap.insert(op.itemId, item.id);
                m_cache.remapItemId(op.itemId, item.id);
                m_cache.removePending(op.id);
                m_cache.upsert(item);
                m_model.removeById(op.itemId);
                m_model.upsert(item);
                emit pendingChanged();
                next(1, 0);
            } else if (status == 0) {
                stop(QStringLiteral("сеть недоступна"));
            } else {
                stop(QStringLiteral("код %1: %2").arg(status).arg(errorMessage(status, json)));
            }
        });
        return;
    }

    if (op.method == QLatin1String("UPDATE")) {
        request("PUT", QStringLiteral("/api/v1/items/") + id, op.payload,
                [this, op, id, next, stop](int status, const QJsonValue &json, const QByteArray &raw) {
            Q_UNUSED(raw);
            if (status == 200) {
                const ItemRecord item = parseItem(json.toObject());
                m_cache.removePending(op.id);
                m_cache.upsert(item);
                m_model.upsert(item);
                emit pendingChanged();
                next(1, 0);
            } else if (status == 404) {
                m_cache.removePending(op.id);
                m_cache.remove(id);
                m_model.removeById(id);
                emit pendingChanged();
                next(0, 1);
            } else if (status == 0) {
                stop(QStringLiteral("сеть недоступна"));
            } else {
                stop(QStringLiteral("код %1: %2").arg(status).arg(errorMessage(status, json)));
            }
        });
        return;
    }

    if (op.method == QLatin1String("DELETE")) {
        request("DELETE", QStringLiteral("/api/v1/items/") + id, QJsonObject(),
                [this, op, id, next, stop](int status, const QJsonValue &, const QByteArray &) {
            if (status == 204 || status == 404) {
                m_cache.removePending(op.id);
                m_cache.remove(id);
                m_model.removeById(id);
                emit pendingChanged();
                next(1, 0);
            } else if (status == 0) {
                stop(QStringLiteral("сеть недоступна"));
            } else {
                stop(QStringLiteral("код %1: операция удаления сохранена в очереди").arg(status));
            }
        });
        return;
    }

    // Неизвестная операция — пропускаем.
    m_cache.removePending(op.id);
    next(0, 1);
}

// ---------------------------------------------------------------------------
// Вспомогательные
// ---------------------------------------------------------------------------

ItemRecord InventoryClient::parseItem(const QJsonObject &object)
{
    ItemRecord item;
    item.id = object.value(QStringLiteral("id")).toString();
    item.name = object.value(QStringLiteral("name")).toString();
    item.quantity = object.value(QStringLiteral("quantity")).toInt();
    item.location = object.value(QStringLiteral("location")).toString();
    item.condition = object.value(QStringLiteral("condition")).toString();
    item.version = object.value(QStringLiteral("version")).toInt();
    item.updatedAt = object.value(QStringLiteral("updatedAt")).toString();
    return item;
}

static QString errorMessage(int status, const QJsonValue &json)
{
    if (json.isObject()) {
        const QJsonObject object = json.toObject();
        if (object.contains(QStringLiteral("message")))
            return object.value(QStringLiteral("message")).toString();
        if (object.contains(QStringLiteral("error")))
            return object.value(QStringLiteral("error")).toString();
    }
    switch (status) {
    case 400: return QStringLiteral("некорректный запрос");
    case 401: return QStringLiteral("требуется аутентификация");
    case 403: return QStringLiteral("недостаточно прав");
    case 404: return QStringLiteral("не найдено");
    case 500: return QStringLiteral("внутренняя ошибка сервера");
    default: return QStringLiteral("ошибка");
    }
}

QString InventoryClient::itemJson(const QString &id) const
{
    const ItemRecord item = m_model.itemById(id);
    if (item.id.isEmpty()) return QString();
    QJsonObject object;
    object.insert(QStringLiteral("id"), item.id);
    object.insert(QStringLiteral("name"), item.name);
    object.insert(QStringLiteral("quantity"), item.quantity);
    object.insert(QStringLiteral("location"), item.location);
    object.insert(QStringLiteral("condition"), item.condition);
    object.insert(QStringLiteral("version"), item.version);
    return QString::fromUtf8(QJsonDocument(object).toJson(QJsonDocument::Compact));
}

// ---------------------------------------------------------------------------
// Демонстрация (--demo)
// ---------------------------------------------------------------------------

void InventoryClient::logDemo(const QString &line)
{
    if (!m_demoRunning) return;
    m_demoLog.append(line);
    qInfo().noquote() << line;
    QString dir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(dir);
    QFile file(dir + QStringLiteral("/demo.log"));
    if (file.open(QIODevice::Append | QIODevice::Text)) {
        file.write(line.toUtf8());
        file.write("\n");
    }
    emit demoLogChanged();
}

void InventoryClient::startDemo()
{
    if (m_demoRunning) return;
    m_demoRunning = true;
    m_demoLog.clear();
    m_demoOnlineId.clear();
    m_demoTempId.clear();
    m_demoTempRealId.clear();
    m_demoSummary.clear();

    QString dir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(dir);
    QFile file(dir + QStringLiteral("/demo.log"));
    if (file.open(QIODevice::WriteOnly | QIODevice::Truncate)) file.close();

    logDemo(QStringLiteral("=== Демо-сценарий Aurora Inventory (ЛР №2, вариант 7) ==="));
    logDemo(QStringLiteral("Сервер: ") + m_baseUrl);
    setStatus(QStringLiteral("Демо: вход admin..."));

    loginWith(QStringLiteral("admin"), QStringLiteral("admin123"), [this](bool ok) {
        logDemo(QStringLiteral("1. Вход admin: ") + (ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА")));
        if (!ok) {
            finishDemo(false);
            return;
        }
        QTimer::singleShot(350, this, [this]() {
            doRefresh([this](bool ok) {
                logDemo(QStringLiteral("2. Чтение списка: %1, предметов %2")
                        .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"))
                        .arg(m_model.count()));
                QJsonObject fields = fieldsFrom(QStringLiteral("Демо-предмет (Аврора)"), 1,
                                                QStringLiteral("Стенд Аврора"),
                                                QStringLiteral("new"));
                setStatus(QStringLiteral("Демо: создание предмета..."));
                doCreate(fields, [this, fields](bool ok, const ItemRecord &item, const QString &note) {
                    m_demoOnlineId = item.id;
                    logDemo(QStringLiteral("3. Создание: %1 (id=%2, %3)")
                            .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"), item.id, note));
                    QJsonObject updated = fields;
                    updated.insert(QStringLiteral("quantity"), 5);
                    updated.insert(QStringLiteral("condition"), QStringLiteral("good"));
                    doUpdate(m_demoOnlineId, updated,
                             [this](bool ok, const ItemRecord &item, const QString &note) {
                        logDemo(QStringLiteral("4. Обновление: %1, quantity=%2, %3")
                                .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"))
                                .arg(item.quantity).arg(note));
                        setSimulateOffline(true);
                        logDemo(QStringLiteral("5. Включён офлайн-режим (сеть не используется)"));
                        doRefresh([this](bool) {
                            logDemo(QStringLiteral("6. Чтение из кэша: предметов %1")
                                    .arg(m_model.count()));
                            QJsonObject offline = fieldsFrom(QStringLiteral("Офлайн-предмет (Аврора)"),
                                                             2, QStringLiteral("Удалённый склад"),
                                                             QStringLiteral("used"));
                            doCreate(offline, [this, offline](bool ok, const ItemRecord &item,
                                                              const QString &note) {
                                m_demoTempId = item.id;
                                logDemo(QStringLiteral("7. Офлайн-создание: %1 (temp id=%2, %3)")
                                        .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"),
                                             item.id, note));
                                QJsonObject changed = offline;
                                changed.insert(QStringLiteral("quantity"), 7);
                                changed.insert(QStringLiteral("condition"), QStringLiteral("good"));
                                doUpdate(item.id, changed,
                                         [this](bool ok, const ItemRecord &, const QString &note) {
                                    logDemo(QStringLiteral("8. Офлайн-изменение: %1, в очереди %2, %3")
                                            .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"))
                                            .arg(m_cache.pendingCount()).arg(note));
                                    setSimulateOffline(false);
                                    logDemo(QStringLiteral("9. Сеть восстановлена, синхронизация..."));
                                    setStatus(QStringLiteral("Демо: синхронизация..."));
                                    syncAll([this](int synced, int failed) {
                                        m_demoTempRealId = m_syncRemap.value(m_demoTempId, m_demoTempId);
                                        logDemo(QStringLiteral("10. Синхронизация: %1 ок, %2 ошибок")
                                                .arg(synced).arg(failed));
                                        logDemo(QStringLiteral("11. Временный id %1 -> серверный %2")
                                                .arg(m_demoTempId, m_demoTempRealId));
                                        doRefresh([this](bool ok) {
                                            logDemo(QStringLiteral("12. Список после sync: %1, предметов %2")
                                                    .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"))
                                                    .arg(m_model.count()));
                                            QJsonObject invalid;
                                            invalid.insert(QStringLiteral("name"), QString());
                                            invalid.insert(QStringLiteral("quantity"), -1);
                                            invalid.insert(QStringLiteral("location"), QString());
                                            invalid.insert(QStringLiteral("condition"), QStringLiteral("bad"));
                                            doCreate(invalid, [this](bool, const ItemRecord &,
                                                                     const QString &note) {
                                                logDemo(QStringLiteral("13. Ошибка валидации: ") + note);
                                                doDelete(QStringLiteral("00000000-0000-0000-0000-000000000000"),
                                                         [this](bool, const QString &note) {
                                                    logDemo(QStringLiteral("14. Удаление несуществующего: ")
                                                            + note);
                                                    QStringList ids;
                                                    if (!m_demoOnlineId.isEmpty()) ids.append(m_demoOnlineId);
                                                    if (!m_demoTempRealId.isEmpty() &&
                                                            m_demoTempRealId != m_demoOnlineId)
                                                        ids.append(m_demoTempRealId);
                                                    logDemo(QStringLiteral("15. Уборка демо-предметов: %1")
                                                            .arg(ids.size()));
                                                    demoDeleteNext(ids, 0);
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

void InventoryClient::demoDeleteNext(const QStringList &ids, int index)
{
    if (index >= ids.size()) {
        doRefresh([this](bool ok) {
            logDemo(QStringLiteral("16. Финальный список: %1, предметов %2")
                    .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА")).arg(m_model.count()));
            finishDemo(true);
        });
        return;
    }
    const QString id = ids.at(index);
    doDelete(id, [this, ids, index, id](bool ok, const QString &note) {
        logDemo(QStringLiteral("15.%1 Удаление %2: %3 (%4)")
                .arg(index + 1).arg(id, ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"), note));
        QTimer::singleShot(150, this, [this, ids, index]() {
            demoDeleteNext(ids, index + 1);
        });
    });
}

QString InventoryClient::demoLogPath() const
{
    return QStandardPaths::writableLocation(QStandardPaths::AppDataLocation)
            + QStringLiteral("/demo.log");
}

QString InventoryClient::demoLog() const
{
    if (!m_demoLog.isEmpty()) return m_demoLog.join(QStringLiteral("\n"));
    QFile file(demoLogPath());
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) return QString();
    return QString::fromUtf8(file.readAll());
}

void InventoryClient::finishDemo(bool ok)
{
    m_demoSummary = QStringLiteral("Демо завершено: %1, шагов %2")
            .arg(ok ? QStringLiteral("успешно") : QStringLiteral("с ошибками"))
            .arg(m_demoLog.size());
    logDemo(m_demoSummary);
    setStatus(m_demoSummary, !ok);
    emit demoFinished();
    m_demoRunning = false;
}

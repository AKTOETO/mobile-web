#include "statclient.h"

#include <QDateTime>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonValue>
#include <QSettings>
#include <QUuid>
#include <QtWebSockets/QWebSocket>

namespace {
const char *kDefaultUrl = "ws://192.168.1.100:3000/ws";
const int kPingIntervalMs = 25000;

QString uuidWithoutBraces()
{
    return QUuid::createUuid().toString()
        .remove(QLatin1Char('{'))
        .remove(QLatin1Char('}'));
}
}

StatClient::StatClient(QObject *parent)
    : QObject(parent)
    , m_socket(new QWebSocket(QString(), QWebSocketProtocol::VersionLatest, this))
    , m_connected(false)
    , m_autoReconnect(true)
    , m_live(true)
    , m_reconnectAttempt(0)
    , m_messageCount(0)
{
    QSettings settings;
    m_serverUrl = settings.value(QStringLiteral("serverUrl"), QString::fromLatin1(kDefaultUrl)).toString();
    m_autoReconnect = settings.value(QStringLiteral("autoReconnect"), true).toBool();
    m_live = settings.value(QStringLiteral("live"), true).toBool();
    m_range = QStringLiteral("24h");
    m_pageFilter = QString();

    m_visitorId = uuidWithoutBraces();
    m_sessionId = uuidWithoutBraces();

    m_pingTimer.setInterval(kPingIntervalMs);
    connect(&m_pingTimer, &QTimer::timeout, this, &StatClient::onPingTimer);

    m_reconnectTimer.setSingleShot(true);
    connect(&m_reconnectTimer, &QTimer::timeout, this, &StatClient::onReconnectTimer);

    connect(m_socket, &QWebSocket::connected, this, &StatClient::onConnected);
    connect(m_socket, &QWebSocket::disconnected, this, &StatClient::onDisconnected);
    connect(m_socket, &QWebSocket::textMessageReceived, this, &StatClient::onTextMessage);
    connect(m_socket, SIGNAL(error(QAbstractSocket::SocketError)), this,
            SLOT(onSocketError(QAbstractSocket::SocketError)));

    setStatus(tr("Не подключено"));
}

StatClient::~StatClient()
{
    m_socket->close();
}

QVariantList StatClient::sessions() const
{
    return m_stats.value(QStringLiteral("recentSessions")).toList();
}

QString StatClient::formatDuration(int seconds) const
{
    if (seconds < 0) {
        seconds = 0;
    }
    if (seconds < 60) {
        return tr("%1 с").arg(seconds);
    }
    if (seconds < 3600) {
        return tr("%1 мин %2 с").arg(seconds / 60).arg(seconds % 60);
    }
    return tr("%1 ч %2 мин").arg(seconds / 3600).arg((seconds % 3600) / 60);
}

QString StatClient::formatTime(qint64 milliseconds) const
{
    if (milliseconds <= 0) {
        return QStringLiteral("—");
    }
    return QDateTime::fromMSecsSinceEpoch(milliseconds).toString(QStringLiteral("dd.MM HH:mm"));
}

void StatClient::setServerUrl(const QString &url)
{
    if (m_serverUrl == url) {
        return;
    }
    m_serverUrl = url;
    QSettings settings;
    settings.setValue(QStringLiteral("serverUrl"), url);
    emit serverUrlChanged();

    if (m_connected || m_socket->state() != QAbstractSocket::UnconnectedState) {
        reconnect();
    }
}

void StatClient::setRange(const QString &range)
{
    if (m_range == range || range.isEmpty()) {
        return;
    }
    m_range = range;
    emit rangeChanged();
    if (m_connected) {
        QVariantMap msg;
        msg.insert(QStringLiteral("type"), QStringLiteral("subscribe"));
        msg.insert(QStringLiteral("range"), m_range);
        msg.insert(QStringLiteral("page"), m_pageFilter);
        sendJson(msg);
    }
}

void StatClient::setPageFilter(const QString &page)
{
    if (m_pageFilter == page) {
        return;
    }
    m_pageFilter = page;
    emit pageFilterChanged();
    if (m_connected) {
        QVariantMap msg;
        msg.insert(QStringLiteral("type"), QStringLiteral("subscribe"));
        msg.insert(QStringLiteral("range"), m_range);
        msg.insert(QStringLiteral("page"), m_pageFilter);
        sendJson(msg);
    }
}

void StatClient::setAutoReconnect(bool enabled)
{
    if (m_autoReconnect == enabled) {
        return;
    }
    m_autoReconnect = enabled;
    QSettings settings;
    settings.setValue(QStringLiteral("autoReconnect"), enabled);
    emit autoReconnectChanged();
    if (enabled && !m_connected) {
        scheduleReconnect();
    }
}

void StatClient::setLive(bool enabled)
{
    if (m_live == enabled) {
        return;
    }
    m_live = enabled;
    QSettings settings;
    settings.setValue(QStringLiteral("live"), enabled);
    emit liveChanged();
}

QUrl StatClient::normalizedUrl() const
{
    QString text = m_serverUrl.trimmed();
    if (text.isEmpty()) {
        text = QString::fromLatin1(kDefaultUrl);
    }
    if (!text.startsWith(QStringLiteral("ws://")) && !text.startsWith(QStringLiteral("wss://"))) {
        text.prepend(QStringLiteral("ws://"));
    }
    QUrl url(text);
    if (url.path().isEmpty() || url.path() == QStringLiteral("/")) {
        url.setPath(QStringLiteral("/ws"));
    }
    return url;
}

void StatClient::connectToServer()
{
    if (m_socket->state() != QAbstractSocket::UnconnectedState) {
        return;
    }
    m_reconnectTimer.stop();
    m_reconnectAttempt = 0;
    const QUrl url = normalizedUrl();
    setLastError(QString());
    setStatus(tr("Подключение к %1…").arg(url.toString()));
    emit logMessage(tr("Подключение к %1").arg(url.toString()));
    m_socket->open(url);
}

void StatClient::disconnectFromServer()
{
    m_autoReconnect = false;
    emit autoReconnectChanged();
    m_reconnectTimer.stop();
    m_socket->close();
    setStatus(tr("Отключено"));
}

void StatClient::reconnect()
{
    m_socket->abort();
    setConnected(false);
    m_reconnectTimer.stop();
    m_reconnectAttempt = 0;
    connectToServer();
}

void StatClient::refresh()
{
    if (!m_connected) {
        connectToServer();
        return;
    }
    QVariantMap msg;
    msg.insert(QStringLiteral("type"), QStringLiteral("subscribe"));
    msg.insert(QStringLiteral("range"), m_range);
    msg.insert(QStringLiteral("page"), m_pageFilter);
    sendJson(msg);
}

void StatClient::requestPages()
{
    if (!m_connected) {
        return;
    }
    QVariantMap msg;
    msg.insert(QStringLiteral("type"), QStringLiteral("pages"));
    sendJson(msg);
}

void StatClient::trackPageView(const QString &page, const QString &label)
{
    QVariantMap event;
    event.insert(QStringLiteral("type"), QStringLiteral("pageview"));
    event.insert(QStringLiteral("page"), page.isEmpty() ? QStringLiteral("/aurora") : page);
    event.insert(QStringLiteral("label"), label);
    event.insert(QStringLiteral("visitorId"), m_visitorId);
    event.insert(QStringLiteral("sessionId"), m_sessionId);
    event.insert(QStringLiteral("ua"), QStringLiteral("AuroraOS aurorastat/1.0"));
    event.insert(QStringLiteral("ts"), QDateTime::currentMSecsSinceEpoch());

    QVariantMap msg;
    msg.insert(QStringLiteral("type"), QStringLiteral("track"));
    msg.insert(QStringLiteral("event"), event);
    sendJson(msg);
    emit logMessage(tr("Отправлено событие pageview: %1").arg(event.value(QStringLiteral("page")).toString()));
}

void StatClient::trackAction(const QString &label, const QString &page)
{
    QVariantMap event;
    event.insert(QStringLiteral("type"), QStringLiteral("action"));
    event.insert(QStringLiteral("page"), page.isEmpty() ? QStringLiteral("/aurora") : page);
    event.insert(QStringLiteral("label"), label);
    event.insert(QStringLiteral("visitorId"), m_visitorId);
    event.insert(QStringLiteral("sessionId"), m_sessionId);
    event.insert(QStringLiteral("ua"), QStringLiteral("AuroraOS aurorastat/1.0"));
    event.insert(QStringLiteral("ts"), QDateTime::currentMSecsSinceEpoch());

    QVariantMap msg;
    msg.insert(QStringLiteral("type"), QStringLiteral("track"));
    msg.insert(QStringLiteral("event"), event);
    sendJson(msg);
    emit logMessage(tr("Отправлено событие action: %1").arg(label));
}

void StatClient::onConnected()
{
    setConnected(true);
    setLastError(QString());
    m_reconnectAttempt = 0;
    setStatus(tr("Подключено"));
    emit logMessage(tr("Соединение установлено"));
    m_pingTimer.start();

    QVariantMap msg;
    msg.insert(QStringLiteral("type"), QStringLiteral("subscribe"));
    msg.insert(QStringLiteral("range"), m_range);
    msg.insert(QStringLiteral("page"), m_pageFilter);
    sendJson(msg);
}

void StatClient::onDisconnected()
{
    const bool wasConnected = m_connected;
    setConnected(false);
    m_pingTimer.stop();
    setStatus(tr("Соединение потеряно"));
    if (wasConnected) {
        emit logMessage(tr("Соединение закрыто"));
    }
    if (m_autoReconnect && m_socket->state() == QAbstractSocket::UnconnectedState) {
        scheduleReconnect();
    }
}

void StatClient::onSocketError(QAbstractSocket::SocketError error)
{
    Q_UNUSED(error)
    setLastError(m_socket->errorString());
    emit logMessage(tr("Ошибка соединения: %1").arg(m_socket->errorString()));
    if (m_autoReconnect) {
        scheduleReconnect();
    }
}

void StatClient::onTextMessage(const QString &message)
{
    m_messageCount += 1;
    emit messageCountChanged();

    QJsonParseError parseError;
    const QJsonDocument doc = QJsonDocument::fromJson(message.toUtf8(), &parseError);
    if (parseError.error != QJsonParseError::NoError || !doc.isObject()) {
        return;
    }
    const QJsonObject obj = doc.object();
    const QString type = obj.value(QStringLiteral("type")).toString();

    if (type == QLatin1String("stats")) {
        m_stats = obj.value(QStringLiteral("data")).toObject().toVariantMap();
        m_counters = m_stats.value(QStringLiteral("counters")).toMap();
        emit statsChanged();
        emit countersChanged();
    } else if (type == QLatin1String("pages")) {
        m_pages = obj.value(QStringLiteral("data")).toArray().toVariantList();
        emit pagesChanged();
    } else if (type == QLatin1String("update")) {
        m_counters = obj.value(QStringLiteral("counters")).toObject().toVariantMap();
        emit countersChanged();
    } else if (type == QLatin1String("event")) {
        const QVariantMap event = obj.value(QStringLiteral("event")).toObject().toVariantMap();
        emit eventReceived(event);
    } else if (type == QLatin1String("error")) {
        setLastError(obj.value(QStringLiteral("error")).toString());
    }
}

void StatClient::onPingTimer()
{
    if (!m_connected) {
        return;
    }
    QVariantMap msg;
    msg.insert(QStringLiteral("type"), QStringLiteral("ping"));
    msg.insert(QStringLiteral("t"), QDateTime::currentMSecsSinceEpoch());
    sendJson(msg);
}

void StatClient::onReconnectTimer()
{
    if (m_autoReconnect && !m_connected) {
        connectToServer();
    }
}

void StatClient::sendJson(const QVariantMap &payload)
{
    if (m_socket->state() != QAbstractSocket::ConnectedState) {
        return;
    }
    const QJsonDocument doc(QJsonObject::fromVariantMap(payload));
    m_socket->sendTextMessage(QString::fromUtf8(doc.toJson(QJsonDocument::Compact)));
}

void StatClient::setConnected(bool connected)
{
    if (m_connected == connected) {
        return;
    }
    m_connected = connected;
    emit connectedChanged();
}

void StatClient::setStatus(const QString &status)
{
    if (m_status == status) {
        return;
    }
    m_status = status;
    emit statusChanged();
}

void StatClient::setLastError(const QString &error)
{
    if (m_lastError == error) {
        return;
    }
    m_lastError = error;
    emit lastErrorChanged();
}

void StatClient::scheduleReconnect()
{
    if (!m_autoReconnect || m_reconnectTimer.isActive()) {
        return;
    }
    const int delay = qMin(30000, 1000 * (1 << qMin(m_reconnectAttempt, 5)));
    m_reconnectAttempt += 1;
    setStatus(tr("Переподключение через %1 с…").arg(delay / 1000));
    m_reconnectTimer.start(delay);
}

#include "deployclient.h"
#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QSettings>
#include <QDateTime>
#include <QDebug>

DeployClient::DeployClient(QObject *parent) : QObject(parent)
{
    m_url = QSettings().value("baseUrl", "http://10.0.2.2:9083").toString();
    m_status = "Проверка доступности…";
    m_poll.setSingleShot(true);
    m_retry.setSingleShot(true);
    connect(&m_poll, &QTimer::timeout, this, &DeployClient::refresh);
    connect(&m_retry, &QTimer::timeout, this, &DeployClient::connectPush);
    connect(&m_socket, &QWebSocket::connected, this, [this]() {
        m_wsDelay = 1000;
        m_lastPush = QDateTime::currentMSecsSinceEpoch();
        record("WS подключён");
    });
    connect(&m_socket, &QWebSocket::disconnected, this, &DeployClient::retryPush);
    connect(&m_socket, static_cast<void (QWebSocket::*)(QAbstractSocket::SocketError)>(&QWebSocket::error),
            this, [this](QAbstractSocket::SocketError) { retryPush(); });
    connect(&m_socket, &QWebSocket::textMessageReceived, this, [this](const QString &text) {
        QJsonParseError error;
        const QJsonDocument doc = QJsonDocument::fromJson(text.toUtf8(), &error);
        if (error.error != QJsonParseError::NoError || !doc.isObject()) return;
        const QJsonObject obj = doc.object();
        m_lastPush = QDateTime::currentMSecsSinceEpoch();
        m_push = obj.value("instance").toString() + " / v" + obj.value("version").toString()
                + ": " + obj.value("message").toString();
        if (obj.value("type").toString() == "inventory") ++m_pushCount;
        record("PUSH " + m_push);
    });
    m_watchdog.setInterval(2000);
    connect(&m_watchdog, &QTimer::timeout, this, [this]() {
        if (m_socket.state() != QAbstractSocket::UnconnectedState &&
                QDateTime::currentMSecsSinceEpoch() - m_lastPush > 10000) {
            record("WS: таймаут, переподключение");
            m_socket.abort();
            retryPush();
        }
    });
    m_watchdog.start();
    m_poll.start(100);
    m_retry.start(200);
}

void DeployClient::record(const QString &message)
{
    const QString line = QDateTime::currentDateTime().toString("HH:mm:ss") + " " + message;
    qInfo().noquote() << line;
    m_history.prepend(line);
    while (m_history.size() > 9) m_history.removeLast();
    emit changed();
}

void DeployClient::configure(const QString &url)
{
    QUrl parsed(url.trimmed());
    if ((parsed.scheme() != "http" && parsed.scheme() != "https") || parsed.host().isEmpty()) {
        record("Некорректный адрес сервера");
        return;
    }
    ++m_generation;
    m_url = parsed.toString(QUrl::StripTrailingSlash);
    QSettings().setValue("baseUrl", m_url);
    m_socket.abort();
    m_wsDelay = 1000;
    m_httpDelay = 2000;
    m_retry.start(100);
    // Незавершённый запрос будет отброшен по номеру поколения.
    m_poll.start(100);
    emit changed();
}

void DeployClient::refresh()
{
    if (m_pending) { m_poll.start(250); return; }
    m_pending = true;
    const int generation = m_generation;
    QNetworkReply *reply = m_network.get(QNetworkRequest(QUrl(m_url + "/api/items")));
    QTimer *timeout = new QTimer(reply);
    timeout->setSingleShot(true);
    connect(timeout, &QTimer::timeout, reply, &QNetworkReply::abort);
    timeout->start(3000);
    connect(reply, &QNetworkReply::finished, this, [this, reply, generation]() {
        m_pending = false;
        if (generation != m_generation) { reply->deleteLater(); m_poll.start(50); return; }
        QJsonParseError error;
        const QJsonDocument doc = QJsonDocument::fromJson(reply->readAll(), &error);
        if (reply->error() == QNetworkReply::NoError && error.error == QJsonParseError::NoError &&
                doc.isObject() && doc.object().value("items").isArray()) {
            const QJsonObject obj = doc.object();
            m_status = "Сервис доступен";
            m_backend = obj.value("instance").toString() + " / v" + obj.value("version").toString();
            QStringList rows;
            foreach (const QJsonValue &value, obj.value("items").toArray()) {
                const QJsonObject item = value.toObject();
                rows << item.value("name").toString() + ": " + QString::number(item.value("quantity").toInt()) + " шт.";
            }
            m_items = rows.join("\n");
            m_httpDelay = 2000;
            record("REST OK " + m_backend);
        } else {
            m_status = "Сеть недоступна — повтор через " + QString::number(m_httpDelay / 1000) + " с";
            record("REST ERROR " + reply->errorString() + "; retry=" + QString::number(m_httpDelay));
        }
        m_poll.start(m_httpDelay);
        if (m_status != "Сервис доступен") m_httpDelay = qMin(m_httpDelay * 2, 16000);
        reply->deleteLater();
        emit changed();
    });
}

void DeployClient::connectPush()
{
    if (m_socket.state() != QAbstractSocket::UnconnectedState) return;
    QUrl url(m_url + "/ws");
    url.setScheme(url.scheme() == "https" ? "wss" : "ws");
    m_lastPush = QDateTime::currentMSecsSinceEpoch();
    m_socket.open(url);
}

void DeployClient::retryPush()
{
    if (m_retry.isActive()) return;
    record("WS отключён; retry=" + QString::number(m_wsDelay));
    m_retry.start(m_wsDelay);
    m_wsDelay = qMin(m_wsDelay * 2, 16000);
}

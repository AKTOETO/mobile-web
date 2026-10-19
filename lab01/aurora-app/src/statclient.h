#ifndef STATCLIENT_H
#define STATCLIENT_H

#include <QObject>
#include <QString>
#include <QVariantList>
#include <QVariantMap>
#include <QTimer>
#include <QUrl>
#include <QtNetwork/QAbstractSocket>

class QWebSocket;

/**
 * StatClient — клиент WebSocket-канала статистики сервера лабораторной работы.
 *
 * Класс доступен из QML как контекстное свойство `StatClient` (см. main.cpp).
 * Он отвечает за:
 *   - подключение к ws://<сервер>:3000/ws и переподключение при обрыве;
 *   - хранение последнего снимка статистики (stats/sessions/pages/counters);
 *   - отправку событий статистики от самого мобильного приложения (track).
 */
class StatClient : public QObject
{
    Q_OBJECT

    Q_PROPERTY(bool connected READ isConnected NOTIFY connectedChanged)
    Q_PROPERTY(QString serverUrl READ serverUrl WRITE setServerUrl NOTIFY serverUrlChanged)
    Q_PROPERTY(QString status READ status NOTIFY statusChanged)
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)
    Q_PROPERTY(QVariantMap stats READ stats NOTIFY statsChanged)
    Q_PROPERTY(QVariantList sessions READ sessions NOTIFY statsChanged)
    Q_PROPERTY(QVariantList pages READ pages NOTIFY pagesChanged)
    Q_PROPERTY(QVariantMap counters READ counters NOTIFY countersChanged)
    Q_PROPERTY(QString range READ range WRITE setRange NOTIFY rangeChanged)
    Q_PROPERTY(QString pageFilter READ pageFilter WRITE setPageFilter NOTIFY pageFilterChanged)
    Q_PROPERTY(bool autoReconnect READ autoReconnect WRITE setAutoReconnect NOTIFY autoReconnectChanged)
    Q_PROPERTY(bool live READ live WRITE setLive NOTIFY liveChanged)
    Q_PROPERTY(int messageCount READ messageCount NOTIFY messageCountChanged)

public:
    explicit StatClient(QObject *parent = nullptr);
    ~StatClient() override;

    bool isConnected() const { return m_connected; }
    QString serverUrl() const { return m_serverUrl; }
    QString status() const { return m_status; }
    QString lastError() const { return m_lastError; }
    QVariantMap stats() const { return m_stats; }
    QVariantList pages() const { return m_pages; }
    QVariantMap counters() const { return m_counters; }
    QString range() const { return m_range; }
    QString pageFilter() const { return m_pageFilter; }
    bool autoReconnect() const { return m_autoReconnect; }
    bool live() const { return m_live; }
    int messageCount() const { return m_messageCount; }

    /** Список сессий из последнего снимка статистики (для QML-модели таблицы). */
    QVariantList sessions() const;

    /** Человекочитаемая длительность: 42 -> «42 с», 3725 -> «1 ч 02 мин». */
    Q_INVOKABLE QString formatDuration(int seconds) const;
    /** Метка времени: миллисекунды -> «дд.ММ чч:мм». */
    Q_INVOKABLE QString formatTime(qint64 milliseconds) const;

public slots:
    void setServerUrl(const QString &url);
    void setRange(const QString &range);
    void setPageFilter(const QString &page);
    void setAutoReconnect(bool enabled);
    void setLive(bool enabled);

    /** Устанавливает соединение (если ещё не подключены). */
    Q_INVOKABLE void connectToServer();
    /** Закрывает соединение (автопереподключение отключать не нужно). */
    Q_INVOKABLE void disconnectFromServer();
    /** Переподключается и заново запрашивает данные. */
    Q_INVOKABLE void reconnect();
    /** Запрашивает свежий снимок статистики. */
    Q_INVOKABLE void refresh();
    /** Запрашивает список страниц. */
    Q_INVOKABLE void requestPages();
    /** Отправляет событие-просмотр страницы от мобильного приложения. */
    Q_INVOKABLE void trackPageView(const QString &page, const QString &label = QString());
    /** Отправляет событие-действие (нажатие кнопки и т.п.). */
    Q_INVOKABLE void trackAction(const QString &label, const QString &page = QString());

signals:
    void connectedChanged();
    void serverUrlChanged();
    void statusChanged();
    void lastErrorChanged();
    void statsChanged();
    void pagesChanged();
    void countersChanged();
    void rangeChanged();
    void pageFilterChanged();
    void autoReconnectChanged();
    void liveChanged();
    void messageCountChanged();
    /** Новое событие статистики, пришедшее по каналу (для «ленты» в UI). */
    void eventReceived(const QVariantMap &event);
    /** Строка для журнала приложения. */
    void logMessage(const QString &message);

private slots:
    void onConnected();
    void onDisconnected();
    void onSocketError(QAbstractSocket::SocketError error);
    void onTextMessage(const QString &message);
    void onPingTimer();
    void onReconnectTimer();

private:
    void sendJson(const QVariantMap &payload);
    void setConnected(bool connected);
    void setStatus(const QString &status);
    void setLastError(const QString &error);
    void scheduleReconnect();
    QUrl normalizedUrl() const;
    static QString defaultServerUrl();

    QWebSocket *m_socket;
    QTimer m_pingTimer;
    QTimer m_reconnectTimer;

    QString m_serverUrl;
    QString m_status;
    QString m_lastError;
    QVariantMap m_stats;
    QVariantList m_pages;
    QVariantMap m_counters;
    QString m_range;
    QString m_pageFilter;
    bool m_connected;
    bool m_autoReconnect;
    bool m_live;
    int m_reconnectAttempt;
    int m_messageCount;
    QString m_visitorId;
    QString m_sessionId;
};

#endif // STATCLIENT_H

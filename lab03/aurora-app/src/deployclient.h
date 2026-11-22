#ifndef DEPLOYCLIENT_H
#define DEPLOYCLIENT_H
#include <QObject>
#include <QNetworkAccessManager>
#include <QWebSocket>
#include <QTimer>

class DeployClient : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString baseUrl READ baseUrl NOTIFY changed)
    Q_PROPERTY(QString status READ status NOTIFY changed)
    Q_PROPERTY(QString backend READ backend NOTIFY changed)
    Q_PROPERTY(QString push READ push NOTIFY changed)
    Q_PROPERTY(QString items READ items NOTIFY changed)
    Q_PROPERTY(QString history READ history NOTIFY changed)
    Q_PROPERTY(int pushCount READ pushCount NOTIFY changed)
public:
    explicit DeployClient(QObject *parent = 0);
    QString baseUrl() const { return m_url; }
    QString status() const { return m_status; }
    QString backend() const { return m_backend; }
    QString push() const { return m_push; }
    QString items() const { return m_items; }
    QString history() const { return m_history.join("\n"); }
    int pushCount() const { return m_pushCount; }
    Q_INVOKABLE void configure(const QString &url);
    Q_INVOKABLE void refresh();
signals:
    void changed();
private:
    void connectPush();
    void retryPush();
    void record(const QString &message);
    QNetworkAccessManager m_network;
    QWebSocket m_socket;
    QTimer m_poll, m_retry, m_watchdog;
    QString m_url, m_status, m_backend, m_push, m_items;
    QStringList m_history;
    int m_pushCount = 0, m_wsDelay = 1000, m_httpDelay = 2000;
    bool m_pending = false;
    qint64 m_lastPush = 0;
    int m_generation = 0;
};
#endif

#include "inventoryclient.h"
#include <QCoreApplication>
#include <QJsonDocument>
#include <QJsonObject>
#include <QTimer>
#include <iostream>

// Интеграционный тест с настоящим HTTPS API и SQLite; настройки изолируются
// через XDG_CONFIG_HOME/XDG_DATA_HOME при запуске на эмуляторе.
int main(int argc, char **argv)
{
    QCoreApplication app(argc, argv);
    app.setOrganizationName("ru.mai");
    app.setApplicationName("inventory-sync-test");
    InventoryClient client;
    client.setBaseUrl(app.arguments().value(1, "https://10.0.2.2:8443"));
    int stage = 0;
    QString id;
    QString temporary;
    const QString name = "Unified refresh integration test";
    auto check = [&](bool ok, const char *message) {
        std::cout << (ok ? "PASS: " : "FAIL: ") << message << std::endl;
        if (!ok) app.exit(1);
        return ok;
    };
    auto quantity = [&]() {
        return QJsonDocument::fromJson(client.itemJson(id).toUtf8()).object().value("quantity").toInt();
    };
    QTimer timer;
    timer.setInterval(150);
    QObject::connect(&timer, &QTimer::timeout, [&]() {
        if (client.busy()) return;
        if (stage == 0) {
            if (!check(client.loggedIn(), "вход admin")) return;
            client.setSimulateOffline(true);
            client.createItem(name, 2, "Стенд", "new");
            for (int i = 0; i < client.model()->rowCount(); ++i) {
                const QModelIndex index = client.model()->index(i);
                if (client.model()->data(index, ItemModel::NameRole).toString() == name)
                    temporary = client.model()->data(index, ItemModel::IdRole).toString();
            }
            if (!check(temporary.startsWith("local-"), "офлайн-создание с временным id")) return;
            client.updateItem(temporary, name, 7, "Стенд", "good");
            client.refresh();
            if (!check(client.pendingCount() == 1 && !client.itemJson(temporary).isEmpty(),
                       "обновление офлайн сохраняет очередь и предмет")) return;
            client.setSimulateOffline(false);
            stage = 1;
            client.refresh();
        } else if (stage == 1) {
            for (int i = 0; i < client.model()->rowCount(); ++i) {
                const QModelIndex index = client.model()->index(i);
                if (client.model()->data(index, ItemModel::NameRole).toString() == name)
                    id = client.model()->data(index, ItemModel::IdRole).toString();
            }
            if (!check(client.pendingCount() == 0 && !id.isEmpty() && id != temporary && quantity() == 7,
                       "единое обновление отправляет правки и заменяет временный id")) return;
            stage = 2;
            client.login("viewer", "viewer123");
        } else if (stage == 2) {
            client.setSimulateOffline(true);
            client.updateItem(id, name, 99, "Стенд", "good");
            client.setSimulateOffline(false);
            stage = 3;
            client.refresh();
        } else if (stage == 3) {
            if (!check(client.pendingCount() == 1 && quantity() == 99,
                       "после 403 и чтения сервера локальная правка остаётся в кэше и очереди")) return;
            stage = 4;
            client.refresh();
        } else if (stage == 4) {
            if (!check(client.pendingCount() == 1 && quantity() == 99,
                       "повторное обновление после 403 не теряет локальные изменения")) return;
            stage = 5;
            client.login("admin", "admin123");
        } else if (stage == 5) {
            stage = 6;
            client.refresh();
        } else if (stage == 6) {
            if (!check(client.pendingCount() == 0 && quantity() == 99,
                       "сохранённая после 403 операция отправлена после входа admin")) return;
            stage = 7;
            client.deleteItem(id);
        } else {
            if (!check(client.itemJson(id).isEmpty(), "удаление тестового предмета")) return;
            app.exit(0);
        }
    });
    QTimer::singleShot(45000, [&]() { std::cerr << "FAIL: timeout" << std::endl; app.exit(1); });
    client.login("admin", "admin123");
    timer.start();
    return app.exec();
}

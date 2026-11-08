#include "inventoryclient.h"
#include <QGuiApplication>
#include <QQmlContext>
#include <QQmlExpression>
#include <QQuickItem>
#include <QQuickView>
#include <QTimer>
#include <iostream>

// Проверяет обработчики настоящей страницы настроек, а не прямой вызов login().
int main(int argc, char **argv)
{
    QGuiApplication app(argc, argv);
    app.setOrganizationName("ru.mai");
    app.setApplicationName("settings-login-test");
    InventoryClient client;
    QQuickView view;
    view.rootContext()->setContextProperty("InventoryClient", &client);
    view.setSource(QUrl::fromLocalFile(app.arguments().value(2,
        "/usr/share/ru.mai.aurorainventory/qml/pages/SettingsPage.qml")));
    if (!view.rootObject()) {
        std::cerr << "FAIL: страница настроек не загружена" << std::endl;
        return 1;
    }
    view.show();
    QObject *root = view.rootObject();
    QObject *url = root->findChild<QObject *>("serverUrlField");
    QObject *user = root->findChild<QObject *>("loginUserField");
    QObject *password = root->findChild<QObject *>("loginPasswordField");
    QObject *login = root->findChild<QObject *>("settingsLoginButton");
    QObject *logout = root->findChild<QObject *>("settingsLogoutButton");
    if (!url || !user || !password || !login || !logout) {
        std::cerr << "FAIL: поля или кнопки страницы не найдены" << std::endl;
        return 1;
    }
    view.rootContext()->setContextProperty("TestLoginButton", login);
    view.rootContext()->setContextProperty("TestLogoutButton", logout);
    url->setProperty("text", app.arguments().value(1, "https://10.0.2.2:8443"));
    const QStringList users = { "admin", "user", "viewer" };
    int index = 0;
    int phase = 0;
    auto click = [&](const QString &expression) {
        QQmlExpression call(view.rootContext(), root, expression);
        call.evaluate();
        if (call.hasError()) {
            std::cerr << "FAIL: " << call.error().toString().toStdString() << std::endl;
            app.exit(1);
        }
    };
    QTimer timer;
    timer.setInterval(200);
    QObject::connect(&timer, &QTimer::timeout, [&]() {
        if (client.busy()) return;
        if (phase == 0) {
            user->setProperty("text", users.at(index));
            password->setProperty("text", users.at(index) + "123");
            phase = 1;
            click("TestLoginButton.clicked(null)");
        } else if (phase == 1) {
            if (!client.loggedIn() || client.username() != users.at(index) || client.role() != users.at(index)) {
                std::cerr << "FAIL: вход " << users.at(index).toStdString() << ": "
                          << client.statusMessage().toStdString() << std::endl;
                app.exit(1);
                return;
            }
            std::cout << "PASS: вход из настроек — " << users.at(index).toStdString() << std::endl;
            phase = 2;
            click("TestLogoutButton.clicked(null)");
        } else {
            if (client.loggedIn()) { app.exit(1); return; }
            if (++index == users.size()) {
                std::cout << "PASS: выход из настроек после каждой учётной записи" << std::endl;
                app.exit(0);
            } else {
                phase = 0;
            }
        }
    });
    QTimer::singleShot(45000, [&]() { std::cerr << "FAIL: timeout" << std::endl; app.exit(1); });
    timer.start();
    return app.exec();
}

#include <auroraapp.h>
#include <QtQuick>
#include <QTimer>

#include "inventoryclient.h"

/**
 * Точка входа приложения «Инвентарь» (ЛР №2, вариант 7).
 *
 *   ru.mai.aurorainventory          — обычный запуск (QML-интерфейс);
 *   ru.mai.aurorainventory --demo   — автоматическая демонстрация CRUD,
 *                                     offline-кэша и синхронизации.
 */
int main(int argc, char *argv[])
{
    QScopedPointer<QGuiApplication> application(Aurora::Application::application(argc, argv));
    application->setOrganizationName(QStringLiteral("ru.mai"));
    application->setOrganizationDomain(QStringLiteral("mai.ru"));
    application->setApplicationName(QStringLiteral("aurorainventory"));
    application->setApplicationVersion(QStringLiteral("1.0.0"));

    const bool demo = application->arguments().contains(QStringLiteral("--demo"));

    InventoryClient client;

    QScopedPointer<QQuickView> view(Aurora::Application::createView());
    view->rootContext()->setContextProperty(QStringLiteral("InventoryClient"), &client);
    view->setSource(Aurora::Application::pathTo(QStringLiteral("qml/aurorainventory.qml")));
    view->show();

    if (demo) {
        QTimer::singleShot(900, [&client]() { client.startDemo(); });
    }

    return application->exec();
}

#include <auroraapp.h>
#include <QtQuick>

#include "statclient.h"

int main(int argc, char *argv[])
{
    QScopedPointer<QGuiApplication> application(Aurora::Application::application(argc, argv));
    application->setOrganizationName(QStringLiteral("ru.mai"));
    application->setOrganizationDomain(QStringLiteral("mai.ru"));
    application->setApplicationName(QStringLiteral("aurorastat"));
    application->setApplicationVersion(QStringLiteral("1.0.0"));

    StatClient statClient;

    QScopedPointer<QQuickView> view(Aurora::Application::createView());
    view->rootContext()->setContextProperty(QStringLiteral("StatClient"), &statClient);
    view->setSource(Aurora::Application::pathTo(QStringLiteral("qml/aurorastat.qml")));
    view->show();

    return application->exec();
}

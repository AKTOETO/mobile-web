#include <auroraapp.h>
#include <QtQuick>
#include "deployclient.h"

int main(int argc, char *argv[])
{
    QScopedPointer<QGuiApplication> app(Aurora::Application::application(argc, argv));
    app->setOrganizationName("ru.mai");
    app->setApplicationName("auroradeploy");
    app->setApplicationVersion("1.0.0");
    DeployClient client;
    QScopedPointer<QQuickView> view(Aurora::Application::createView());
    view->rootContext()->setContextProperty("Client", &client);
    view->setSource(Aurora::Application::pathTo("qml/auroradeploy.qml"));
    view->showFullScreen();
    return app->exec();
}

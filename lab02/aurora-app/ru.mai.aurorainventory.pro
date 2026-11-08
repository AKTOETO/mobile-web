TARGET = ru.mai.aurorainventory

CONFIG += auroraapp

PKGCONFIG +=

QT += network sql

RESOURCES += resources.qrc

SOURCES += \
    src/main.cpp \
    src/itemmodel.cpp \
    src/localcache.cpp \
    src/inventoryclient.cpp

HEADERS += \
    src/itemmodel.h \
    src/localcache.h \
    src/inventoryclient.h

DISTFILES += \
    rpm/ru.mai.aurorainventory.spec \
    rpm/ru.mai.aurorainventory.changes.in \
    rpm/ru.mai.aurorainventory.changes.run.in

AURORAAPP_ICONS = 86x86 108x108 128x128 172x172

TARGET = ru.mai.aurorastat

CONFIG += auroraapp

PKGCONFIG +=

QT += websockets

SOURCES += \
    src/main.cpp \
    src/statclient.cpp

HEADERS += \
    src/statclient.h

DISTFILES += \
    rpm/ru.mai.aurorastat.spec \
    rpm/ru.mai.aurorastat.changes.in \
    rpm/ru.mai.aurorastat.changes.run.in

AURORAAPP_ICONS = 86x86 108x108 128x128 172x172

CONFIG += auroraapp_i18n

TRANSLATIONS += \
    translations/ru.mai.aurorastat.ts \
    translations/ru.mai.aurorastat-ru.ts

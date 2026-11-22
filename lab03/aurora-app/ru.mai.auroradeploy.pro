TARGET = ru.mai.auroradeploy
CONFIG += auroraapp c++11
QT += network websockets
SOURCES += src/main.cpp src/deployclient.cpp
HEADERS += src/deployclient.h
DISTFILES += rpm/ru.mai.auroradeploy.spec

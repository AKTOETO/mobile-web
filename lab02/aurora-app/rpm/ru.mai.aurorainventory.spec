Name:       ru.mai.aurorainventory
Summary:    Инвентарь — REST-клиент с offline-кэшем (Аврора ОС)
Version:    1.0.0
Release:    1
License:    BSD-3-Clause
URL:        https://auroraos.ru
Source0:    %{name}-%{version}.tar.bz2

Requires:   sailfishsilica-qt5 >= 0.10.9
Requires:   qt5-qtsql
BuildRequires:  pkgconfig(auroraapp)
BuildRequires:  pkgconfig(Qt5Core)
BuildRequires:  pkgconfig(Qt5Qml)
BuildRequires:  pkgconfig(Qt5Quick)
BuildRequires:  pkgconfig(Qt5Network)
BuildRequires:  pkgconfig(Qt5Sql)

%description
Клиент REST API инвентаря для Аврора ОС (лабораторная работа №2, вариант 7).
Асинхронные HTTP-запросы через QNetworkAccessManager, JSON через QJsonDocument,
JWT и cookie в QSettings/QNetworkCookieJar, SQLite-кэш и очередь отложенных
операций через QtSql, offline-режим и синхронизация, обработка 4xx/5xx и
таймаутов. Демонстрационный сценарий запускается с ключом --demo.

%prep
%autosetup

%build
%qmake5
%make_build

%install
%make_install

%files
%defattr(-,root,root,-)
%{_bindir}/%{name}
%defattr(644,root,root,-)
%{_datadir}/%{name}
%{_datadir}/applications/%{name}.desktop
%{_datadir}/icons/hicolor/*/apps/%{name}.png

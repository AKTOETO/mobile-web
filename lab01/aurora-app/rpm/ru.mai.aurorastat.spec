Name:       ru.mai.aurorastat
Summary:    Статистика сайта — клиент сервера (Аврора ОС)
Version:    1.0.0
Release:    1
License:    BSD-3-Clause
URL:        https://auroraos.ru
Source0:    %{name}-%{version}.tar.bz2

Requires:   sailfishsilica-qt5 >= 0.10.9
Requires:   qt5-qtwebsockets
BuildRequires:  pkgconfig(auroraapp)
BuildRequires:  pkgconfig(Qt5Core)
BuildRequires:  pkgconfig(Qt5Qml)
BuildRequires:  pkgconfig(Qt5Quick)
BuildRequires:  pkgconfig(Qt5Network)
BuildRequires:  pkgconfig(Qt5WebSockets)

%description
Клиент статистики аналитики сайта для Аврора ОС. Подключается к серверу
лабораторной работы по WebSocket (/ws) и показывает просмотры страниц,
уникальных посетителей, сессии и их длительность, устройства посетителей
и популярные страницы в виде графиков.

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

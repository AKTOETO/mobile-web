Name: ru.mai.auroradeploy
Summary: Монитор инвентаря: балансировка, push и blue-green
Version: 1.0.0
Release: 1
License: BSD-3-Clause
Source0: %{name}-%{version}.tar.bz2
Requires: sailfishsilica-qt5 >= 0.10.9
Requires: qt5-qtwebsockets
BuildRequires: pkgconfig(auroraapp)
BuildRequires: pkgconfig(Qt5Core)
BuildRequires: pkgconfig(Qt5Qml)
BuildRequires: pkgconfig(Qt5Quick)
BuildRequires: pkgconfig(Qt5Network)
BuildRequires: pkgconfig(Qt5WebSockets)

%description
Клиент лабораторной работы №3. Проверка REST, уведомления WebSocket,
повторы запросов и переподключение через nginx.

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

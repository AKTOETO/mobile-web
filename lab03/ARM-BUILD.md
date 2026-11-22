# Сборки Aurora для физических ARM-устройств

Собраны и подписаны пакеты версии **1.0.0-1** для Aurora OS 5.1.1.60:

| Архитектура | Локальный RPM |
|---|---|
| aarch64, 64-битная ARM | `build-aarch64/RPMS/ru.mai.auroradeploy-1.0.0-1.aarch64.rpm` |
| armv7hl, 32-битная ARM hard-float | `build-armv7hl/RPMS/ru.mai.auroradeploy-1.0.0-1.armv7hl.rpm` |

Для каждой архитектуры используется отдельная shadow build, поэтому объектные
файлы не смешиваются с x86_64 сборкой приложения для эмулятора. `sfdk build`
запускает rpmbuild, qmake и кросс-компилятор внутри Docker-движка SDK.

## Команды воспроизведения

Выполнять **из корня mobile-web**:

```bash
export PATH="$HOME/AuroraOS/bin:$PATH"

# Образ SDK хранится в Docker Desktop; серверы ЛР3 используют другой Engine.
systemctl --user start docker-desktop
sfdk tools list
sfdk engine status

mkdir -p lab03/build-aarch64 lab03/build-armv7hl

# -C задаёт рабочий каталог. ../aurora-app — исходники относительно него.
sfdk -C lab03/build-aarch64 \
  -c target=AuroraOS-5.1.1.60-base-aarch64 \
  -c no-fix-version build ../aurora-app

python3 lab03/infra/sign-rpm.py \
  lab03/build-aarch64/RPMS/ru.mai.auroradeploy-1.0.0-1.aarch64.rpm

sfdk -C lab03/build-armv7hl \
  -c target=AuroraOS-5.1.1.60-base-armv7hl \
  -c no-fix-version build ../aurora-app

python3 lab03/infra/sign-rpm.py \
  lab03/build-armv7hl/RPMS/ru.mai.auroradeploy-1.0.0-1.armv7hl.rpm
```

`-c target=...` выбирает архитектуру только для команды, не меняя глобальную
настройку SDK. `-c no-fix-version` сохраняет версию из spec, без добавления
суффикса ветки/коммита. Сценарий подписи применяет тестовый сертификат SDK,
проверяет подпись через rpmsign-external и удаляет временную копию ключа.

## Фактическая проверка

Метаданные RPM проверены в Docker-движке:

```text
ru.mai.auroradeploy 1.0.0-1 aarch64
ru.mai.auroradeploy 1.0.0-1 armv7hl
```

Команда проверки из корня проекта:

```bash
ssh aurora-build 'rpm -qp --qf "%{NAME} %{VERSION}-%{RELEASE} %{ARCH}\n" /home/bogdan/MAI/AURORA-SDK-PROJECTS/mobile-web/lab03/build-aarch64/RPMS/ru.mai.auroradeploy-1.0.0-1.aarch64.rpm /home/bogdan/MAI/AURORA-SDK-PROJECTS/mobile-web/lab03/build-armv7hl/RPMS/ru.mai.auroradeploy-1.0.0-1.armv7hl.rpm'
file lab03/build-aarch64/ru.mai.auroradeploy lab03/build-armv7hl/ru.mai.auroradeploy
```

ELF-проверка подтвердила ARM aarch64 (64-bit) и ARM EABI5 (32-bit).
Для обоих пакетов получено `Signatures successfully verified`.
На физическом телефоне эти сборки пока не запускались.

Журналы находятся в `report/logs/`:
- `sdk-build-aarch64.log`, `sdk-build-armv7hl.log`;
- `package-signature-aarch64.log`, `package-signature-armv7hl.log`;
- `rpm-arm-architectures.log`, `elf-arm-architectures.log`, `rpm-arm-sha256.log`.

Каталоги build-* и RPM остаются локальными артефактами согласно правилам
репозитория. В Git сохраняются исходники, команды сборки и журналы проверок.

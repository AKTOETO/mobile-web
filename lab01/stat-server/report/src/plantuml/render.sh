#!/usr/bin/env bash
# Рендер диаграмм отчёта из исходников PlantUML.
#
# Исходники:  report/src/plantuml/*.puml
# Результат:  report/images/*.png
#
# Требуется Java 17+ и plantuml.jar (скачать один раз):
#   mkdir -p ../../tools && curl -sL -o ../../tools/plantuml.jar \
#     https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/1.2024.6/plantuml-1.2024.6.jar
#
# Запуск из корня лабораторной работы:
#   bash report/src/plantuml/render.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
LAB_ROOT="$(cd "$HERE/../../.." && pwd)"
JAR="${PLANTUML_JAR:-$LAB_ROOT/tools/plantuml.jar}"
OUT="$LAB_ROOT/report/images"

if [ ! -f "$JAR" ]; then
  echo "plantuml.jar не найден: $JAR" >&2
  echo "Скачайте его командой из комментария выше или укажите PLANTUML_JAR=/path/to/plantuml.jar" >&2
  exit 1
fi

mkdir -p "$OUT"
java -jar "$JAR" -tpng -o "$OUT" "$HERE"/*.puml
echo "Диаграммы созданы в $OUT:"
ls -1 "$OUT"/*.png

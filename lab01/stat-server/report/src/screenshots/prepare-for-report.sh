#!/usr/bin/env bash
# Готовит скриншоты к встраиванию в отчёт: уменьшает ширину и обрезает
# слишком длинные полностраничные снимки, чтобы отчёт читался и в Markdown, и в DOCX.
#
# Использование:  bash report/src/screenshots/prepare-for-report.sh
# На выходе:      report/screenshots/report/<имя>.png
set -euo pipefail

SRC="$(cd "$(dirname "$0")/../.." && pwd)/screenshots"
OUT="$SRC/report"
mkdir -p "$OUT"

#Desktop: ширина 1000 px.
for name in 01-index-desktop 02-catalog-desktop 03-catalog-filtered 04-contact-validation \
            05-contact-sent 06-dashboard-desktop 07-dashboard-filter-7d-catalog 12-dashboard-devices-aurora; do
  convert "$SRC/$name.png" -resize 1000x "$OUT/$name.png"
done

#Мобильные снимки (Аврора): ширина 420 px.
for name in 08-index-aurora 09-index-aurora-menu 10-catalog-aurora; do
  convert "$SRC/$name.png" -resize 420x "$OUT/$name.png"
done

#Дашборд на телефоне очень длинный: берём верхние ~3200 px (KPI + графики).
convert "$SRC/11-dashboard-aurora.png" -crop 780x3200+0+0 +repage -resize 420x "$OUT/11-dashboard-aurora.png"

echo "готово: $OUT"
ls -1 "$OUT"

#!/usr/bin/env bash
# Собирает DOCX-версию отчёта: REPORT.md -> HTML (python-markdown) -> DOCX (LibreOffice).
# Pandoc в системе нет, поэтому конвертация идёт через LibreOffice.
#
# Использование:  bash report/src/build-docx.sh
# На выходе:      report/build/report.html, report/build/report.docx
set -euo pipefail

LAB_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="$LAB_ROOT/report/build"
mkdir -p "$BUILD"

if ! python3 -c "import markdown" 2>/dev/null; then
  echo "нужен модуль Python markdown:  pip install markdown" >&2
  exit 1
fi

python3 - "$LAB_ROOT" "$BUILD" <<'PY'
import pathlib, sys
import markdown

lab_root, build = map(pathlib.Path, sys.argv[1:3])
body = markdown.markdown(
    (lab_root / 'REPORT.md').read_text(encoding='utf-8'),
    extensions=['tables', 'fenced_code', 'sane_lists'],
)
page = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Отчёт по лабораторной работе №1 · вариант 7</title>
<style>
  body { font-family: "Liberation Serif", serif; font-size: 12pt; line-height: 1.45; }
  h1 { font-size: 20pt; } h2 { font-size: 15pt; } h3 { font-size: 13pt; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  th, td { border: 1px solid #999; padding: 4px 6px; font-size: 10.5pt; vertical-align: top; }
  th { background: #eef2f7; }
  pre { background: #f5f5f5; border: 1px solid #ddd; padding: 8px; font-size: 10pt; white-space: pre-wrap; }
  code { font-family: "Liberation Mono", monospace; }
  img { max-width: 100%; }
  blockquote { border-left: 3px solid #1f6feb; margin-left: 0; padding-left: 12px; color: #222; }
</style>
</head>
<body>
""" + body + """
</body>
</html>
"""
# Пути к картинкам в REPORT.md отсчитываются от корня лаборатории, а HTML лежит
# в report/build/ — поэтому «report/...» меняем на «../...».
page = page.replace('src="report/', 'src="../')
(build / 'report.html').write_text(page, encoding='utf-8')
print('HTML:', build / 'report.html')
PY

BROWSER="${LIBREOFFICE:-libreoffice}"
"$BROWSER" --headless --norestore --convert-to 'docx:MS Word 2007 XML' --outdir "$BUILD" "$BUILD/report.html"

# LibreOffice вставляет картинки внешними ссылками — встраиваем их в пакет DOCX.
python3 "$LAB_ROOT/report/src/docx-embed-images.py" "$BUILD/report.docx"

rm -f "$BUILD/report-abs.html"
echo "DOCX: $BUILD/report.docx"

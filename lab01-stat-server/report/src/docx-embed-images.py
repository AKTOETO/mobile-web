#!/usr/bin/env python3
"""
Встраивает картинки в DOCX, собранный LibreOffice из HTML.

LibreOffice при импорте HTML вставляет изображения как внешние ссылки
(r:link + TargetMode="External"), и в таком DOCX картинки видны только на том
компьютере, где лежат исходные PNG. Скрипт превращает ссылки во встроенные
изображения (r:embed + word/media/...) и уменьшает слишком широкие картинки,
чтобы они помещались на страницу A4.

Использование:
    python3 report/src/docx-embed-images.py report/build/report.docx
"""

import re
import sys
import zipfile
from pathlib import Path

MAX_WIDTH_EMU = 5_700_000  # ~15,8 см — рабочая ширина страницы A4
IMAGE_REL_RE = re.compile(
    r'<Relationship Id="(?P<id>[^"]+)" Type="[^"]*/image" '
    r'Target="(?P<target>file://[^"]+)"(?: TargetMode="External")?/>'
)

REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'


def main() -> int:
    if len(sys.argv) < 2:
        print('укажите путь к docx', file=sys.stderr)
        return 2

    docx = Path(sys.argv[1]).resolve()
    if not docx.exists():
        print(f'нет файла {docx}', file=sys.stderr)
        return 1

    with zipfile.ZipFile(docx) as archive:
        entries = {item.filename: archive.read(item.filename) for item in archive.infolist()}

    rels = entries['word/_rels/document.xml.rels'].decode('utf-8')
    document = entries['word/document.xml'].decode('utf-8')
    content_types = entries['[Content_Types].xml'].decode('utf-8')

    media = {}
    embedded = 0

    def replace_rel(match):
        nonlocal embedded
        source = Path(match.group('target').replace('file://', ''))
        if not source.is_file():
            print(f'пропущено, файл не найден: {source}', file=sys.stderr)
            return match.group(0)
        embedded += 1
        name = f'media/image{embedded}{source.suffix or ".png"}'
        media[match.group('id')] = (name, source.read_bytes())
        return f'<Relationship Id="{match.group("id")}" Type="{REL_TYPE}" Target="{name}"/>'

    rels = IMAGE_REL_RE.sub(replace_rel, rels)

    # Word должен брать картинку из пакета, а не с диска.
    for rid in media:
        document = document.replace(f'r:link="{rid}"', f'r:embed="{rid}"')

    # Широкие изображения — к масштабу (высота уменьшается пропорционально).
    def scale(match):
        cx, cy = int(match.group(1)), int(match.group(2))
        if cx == 0 or cx <= MAX_WIDTH_EMU:
            return match.group(0)
        factor = MAX_WIDTH_EMU / cx
        return f'cx="{int(cx * factor)}" cy="{max(1, int(cy * factor))}"'

    document = re.sub(r'cx="(\d+)" cy="(\d+)"', scale, document)

    extensions = {name.rsplit('.', 1)[-1] for name, _ in media.values()}
    for extension in sorted(extensions):
        marker = f'Extension="{extension}"'
        if marker not in content_types:
            content_type = {'png': 'image/png', 'jpg': 'image/jpeg', 'svg': 'image/svg+xml'}.get(
                extension, 'application/octet-stream'
            )
            content_types = content_types.replace(
                '</Types>', f'<Default Extension="{extension}" ContentType="{content_type}"/></Types>'
            )

    entries['word/_rels/document.xml.rels'] = rels.encode('utf-8')
    entries['word/document.xml'] = document.encode('utf-8')
    entries['[Content_Types].xml'] = content_types.encode('utf-8')

    tmp = docx.with_suffix('.tmp.docx')
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
        for name, data in entries.items():
            out.writestr(name, data)
        for name, data in (media[rid] for rid in media):
            out.writestr(f'word/{name}', data)

    tmp.replace(docx)
    print(f'встроено изображений: {embedded}; максимальная ширина '
          f'{MAX_WIDTH_EMU / 360000:.1f} см; файл: {docx}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

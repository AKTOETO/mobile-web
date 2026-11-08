#!/usr/bin/env python3
"""Обновляет полные листинги из исходников и собирает DOCX/PDF с проверкой."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
APPENDIX = '\n## Приложение А.'


def source_groups():
    server = ROOT / 'inventory-server'
    app = ROOT / 'aurora-app'
    server_files = sorted(server.glob('server/*.js'))
    server_files += sorted(p for p in (server / 'public').rglob('*')
                           if p.suffix in {'.html', '.js', '.css', '.svg'}
                           and 'vendor' not in p.relative_to(server).parts)
    server_files += [server / 'package.json', server / 'tools/gen-cert.sh', server / 'test/api-test.js']
    app_files = sorted(p for p in (app / 'src').iterdir() if p.suffix in {'.cpp', '.h'})
    app_files += sorted(app.glob('qml/**/*.qml'))
    app_files += [app / 'ru.mai.aurorainventory.pro', app / 'ru.mai.aurorainventory.desktop',
                  app / 'resources.qrc', app / 'certs/ca.crt']
    app_files += sorted((app / 'rpm').iterdir())
    app_files += sorted(p for p in (app / 'tests').iterdir()
                        if p.suffix in {'.cpp', '.pro'} and not p.name.startswith(('moc_', 'qrc_')))
    return [('А', 'Полный исходный код сервера и браузерной части', server_files),
            ('Б', 'Полный исходный код приложения Аврора', app_files)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources-only', action='store_true')
    args = parser.parse_args()
    markdown = ROOT / 'REPORT.md'
    body = markdown.read_text(encoding='utf-8').split(APPENDIX)[0]
    body = body.replace('<!-- SOURCE_LISTINGS -->', '').rstrip()
    chunks = [body, '\n\n']
    manifest = []
    for letter, title, files in source_groups():
        chunks.append(f'\n## Приложение {letter}. {title}\n\n')
        chunks.append('Приведены полные тексты файлов реализации и сборки без сокращений.\n\n')
        if letter == 'А':
            chunks.append('Сторонняя библиотека Swagger UI 3.52.5 поставляется в '
                          '`public/vendor/swagger-ui/` под лицензией Apache-2.0; '
                          'её готовые JS/CSS не относятся к разработанному коду и не '
                          'дублируются в печатных листингах. Ниже полностью приведён '
                          'код её подключения и настройки, а также весь код сервера '
                          'и собственной браузерной части.\n\n')
        for index, file in enumerate(files, 1):
            relative = file.relative_to(ROOT).as_posix()
            content = file.read_text(encoding='utf-8')
            chunks.append(f'### {letter}.{index} {file.name}\n\n')
            chunks.append(f'Файл: `{relative}`.\n\n```\n{content.rstrip()}\n```\n\n')
            manifest.append({'file': relative, 'lines': len(content.splitlines()),
                             'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
    markdown.write_text(''.join(chunks).rstrip() + '\n', encoding='utf-8')
    (ROOT / 'report/source-manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Включено файлов: {len(manifest)}, строк: {sum(item["lines"] for item in manifest)}', flush=True)
    if not args.sources_only:
        builder = Path.home() / '.agents/skills/gost-docx-report/scripts/build_report.py'
        subprocess.run([sys.executable, str(builder), '-c', 'report/report.yaml', '--check'],
                       cwd=ROOT, check=True)


if __name__ == '__main__':
    main()

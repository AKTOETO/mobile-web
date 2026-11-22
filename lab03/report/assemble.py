#!/usr/bin/env python3
"""Собрать Markdown отчёта из текста, настоящих журналов и полных листингов."""
import hashlib
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(Path.home() / '.agents/skills/gost-docx-report/scripts/diagrams'))
from svgkit import Drawing

images = HERE / 'images'
images.mkdir(exist_ok=True)
d = Drawing(1000, 620, 'Архитектура ЛР3: балансировка и blue-green', fonts={
    'title': 24, 'pkg': 20, 'box': 22, 'sub': 20, 'label': 20, 'state': 22, 'note': 20})
d.box(30, 90, 280, 110, ['Aurora OS · VirtualBox', 'C++ / Qt 5.6 / Silica', 'REST + WebSocket'], name='client')
d.box(30, 330, 280, 100, ['nginx · Docker', '0.0.0.0:9083', 'reverse proxy'], name='proxy')
d.box(590, 90, 380, 110, ['Blue · Docker · v1.0.0', 'blue1:3000 · blue2:3000', 'Мониторинг каталога'], name='blue')
d.box(590, 330, 380, 110, ['Green · Docker · v2.0.0', 'green1:3000 · green2:3000', 'Контроль дефицита'], name='green')
d.box(30, 510, 280, 80, ['monitor · Docker', 'localhost:9084'], name='monitor')
d.box(590, 510, 380, 80, ['Docker volumes', 'routing · logs · evidence'], name='volumes')
d.arrow([(170, 200), (170, 330)], name='client-proxy', bidir=True)
d.label(290, 263, ['10.0.2.2'])
d.arrow([(310, 355), (440, 355), (440, 145), (590, 145)], name='proxy-blue')
d.arrow([(310, 400), (590, 400)], name='proxy-green')
d.label(780, 270, ['выбор цвета через reload'])
d.arrow([(170, 510), (170, 430)], name='monitor-probes', bidir=True)
d.arrow([(310, 550), (590, 550)], name='monitor-volumes', bidir=True)
d.label(450, 510, ['конфиг и журнал'])
issues = d.check()
if issues:
    raise RuntimeError('\n'.join(issues))
(images / 'architecture.svg').write_text(d.svg())

body = (HERE / 'BODY.md').read_text()
body = re.sub(r'\{\{log:([^}]+)\}\}',
              lambda match: '```text\n' + (HERE / 'logs' / match[1]).read_text().rstrip() + '\n```', body)
groups = {
    'Сервер': ['server/Dockerfile', 'server/package.json', 'server/catalog.json', 'server/server.js',
                'server/release-v1.js', 'server/release-v2.js', 'server/websocket.js'],
    'Инфраструктура': ['lab', 'compose.yaml', 'infra/nginx/Dockerfile', 'infra/nginx/nginx.conf',
                       'infra/nginx/routing/active.conf', 'infra/nginx/routing/colour',
                       'infra/control.py', 'infra/sign-rpm.py'],
    'Панель мониторинга': ['monitor/Dockerfile', 'monitor/server.js', 'monitor/public/index.html',
                          'monitor/public/style.css', 'monitor/public/app.js'],
    'Клиент Aurora': ['aurora-app/ru.mai.auroradeploy.pro', 'aurora-app/ru.mai.auroradeploy.desktop',
                      'aurora-app/rpm/ru.mai.auroradeploy.spec', 'aurora-app/src/main.cpp',
                      'aurora-app/src/deployclient.h', 'aurora-app/src/deployclient.cpp',
                      'aurora-app/qml/auroradeploy.qml'],
    'Проверки': ['tests/infrastructure-test.js', 'tests/websocket-test.js', 'tests/emulator-demo.py',
                 'tests/browser-demo.js', 'tests/host-check.py'],
}
manifest = []
body += '\n\n## ПРИЛОЖЕНИЕ А. Полные листинги\n\n'
body += 'Приведены все авторские файлы сервиса, клиента, развёртывания и испытаний. '
body += 'Генерируемые файлы сборки и сторонние библиотеки не включены.\n\n'
for group, files in groups.items():
    body += f'### {group}\n\n'
    for relative in files:
        content = (ROOT / relative).read_text()
        manifest.append({'path': relative, 'sha256': hashlib.sha256(content.encode()).hexdigest(),
                         'lines': len(content.splitlines())})
        body += f'**{relative}**\n\n```text\n{content.rstrip()}\n```\n\n'
(HERE / 'REPORT.md').write_text(body)
(HERE / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'REPORT.md: {len(manifest)} файлов, {sum(item["lines"] for item in manifest)} строк исходников')

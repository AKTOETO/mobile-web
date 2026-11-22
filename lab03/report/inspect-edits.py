#!/usr/bin/env python3
"""Сохранить редактированный DOCX и сравнить его с генерацией из Markdown."""
from pathlib import Path
import collections
import difflib
import hashlib
import json
import shutil
import subprocess
import sys
import yaml
import zipfile
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
archive = HERE / 'editor'
archive.mkdir(exist_ok=True)
source = HERE / 'report.docx'
snapshot = archive / 'edited-original.docx'
if not snapshot.exists():
    shutil.copy2(source, snapshot)
scratch = Path('/tmp/opencode/report-baseline')
scratch.mkdir(exist_ok=True)
cfg = yaml.safe_load((HERE / 'report.yaml').read_text())
cfg['paths'].update(markdown=str(HERE / 'REPORT.md'), out_dir=str(scratch), assets_dir=str(HERE / 'assets'))
config = scratch / 'report.yaml'
config.write_text(yaml.safe_dump(cfg, allow_unicode=True))
subprocess.run([sys.executable, str(Path.home() / '.agents/skills/gost-docx-report/scripts/build_report.py'),
                '-c', str(config), '--no-pdf'], check=True)
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
def document(path):
    with zipfile.ZipFile(path) as file:
        return ET.fromstring(file.read('word/document.xml'))
before, after = document(scratch / 'report.docx'), document(snapshot)
def paragraphs(doc):
    texts = [''.join(t.text or '' for t in p.findall('.//w:t', NS)) for p in doc.findall('w:body/w:p', NS)]
    return [text for text in texts if text.strip() and not text.startswith('СОДЕРЖАНИЕ')]
a, b = paragraphs(before), paragraphs(after)
diff = '\n'.join(difflib.unified_diff(a, b, fromfile='Markdown baseline', tofile='Edited DOCX', lineterm=''))
(archive / 'text.diff').write_text(diff + '\n')
def formats(doc):
    return dict(collections.Counter(ET.tostring(r.find('w:rPr', NS), encoding='unicode')
        if r.find('w:rPr', NS) is not None else '(style)' for r in doc.findall('.//w:r', NS)
        if r.find('w:t', NS) is not None))
print(diff)
print('BEFORE FONTS', formats(before))
print('AFTER FONTS', formats(after))
changes = []
for tag, i, j, k, l in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
    if tag != 'equal':
        changes.append({'kind': tag, 'before': a[i:j], 'after': b[k:l]})
(archive / 'changes.json').write_text(json.dumps({'snapshot_sha256': hashlib.sha256(snapshot.read_bytes()).hexdigest(),
    'changes': changes}, ensure_ascii=False, indent=2) + '\n')

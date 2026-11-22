#!/usr/bin/env python3
"""Настоящий GUI-клиент в VirtualBox: push, отказ, green, общая недоступность."""
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
LOGS = ROOT / 'report/logs'
SHOTS = ROOT / 'report/screenshots'
CONTROL = ROOT / 'infra/control.py'

def ssh(command):
    return subprocess.check_output(['ssh', 'aurora-emu', command], text=True)

def control(*args):
    subprocess.run([sys.executable, str(CONTROL), *args], check=True)

def journal():
    return ssh(f'sudo journalctl _PID={pid} -o cat --no-pager')

def shot(name):
    subprocess.run(['VBoxManage', 'controlvm', 'AuroraOS-5.1.1.60-base',
                    'screenshotpng', str(SHOTS / name)], check=True)

def stage(name, offset, required, forbidden=()):
    text = journal()[offset:]
    (LOGS / (name + '.log')).write_text(text)
    for token in required:
        assert token in text, f'{name}: нет {token}'
    for token in forbidden:
        assert token not in text, f'{name}: неожиданно {token}'
    assert ssh('pidof ru.mai.auroradeploy').strip() == pid, 'Клиент был перезапущен'
    print('PASS', name, 'PID=' + pid, flush=True)

try:
    for instance in ('blue1', 'blue2', 'green1', 'green2'):
        control('start', instance)
    time.sleep(1)
    control('switch', 'blue')
    # Снимок каждого этапа делается без перезапуска GUI.
    pid = ssh('pidof ru.mai.auroradeploy').strip()
    assert pid and ' ' not in pid
    offset = len(journal())
    time.sleep(8)
    stage('01-blue-push', offset, ['REST OK blue', 'PUSH blue'], ['REST ERROR'])
    shot('01-blue-push.png')
    instance = re.findall(r'PUSH (blue[12])', journal())[-1]
    survivor = 'blue2' if instance == 'blue1' else 'blue1'
    offset = len(journal())
    control('stop', instance)
    time.sleep(9)
    stage('02-backend-failure', offset, ['WS отключён', 'REST OK ' + survivor,
                                       'PUSH ' + survivor], ['REST ERROR'])
    shot('02-backend-failure.png')
    control('start', instance)
    time.sleep(1)
    offset = len(journal())
    control('switch', 'green')
    time.sleep(11)
    stage('03-blue-green', offset, ['REST OK green', 'PUSH green', 'v2.0.0'], ['REST ERROR'])
    shot('03-blue-green.png')
    # Дополнительная проверка backoff при недоступности ВСЕХ активных backend.
    offset = len(journal())
    control('stop', 'green1'); control('stop', 'green2')
    time.sleep(12)
    stage('04-total-outage', offset, ['REST ERROR', 'retry=4000', 'WS отключён'])
    shot('04-total-outage.png')
    offset = len(journal())
    control('start', 'green1'); control('start', 'green2')
    time.sleep(18)
    stage('05-recovered', offset, ['REST OK green', 'PUSH green'])
    shot('05-recovered.png')
    (LOGS / 'aurora-client.log').write_text(journal())
    print('ИТОГО: 5 этапов пройдены; GUI PID не изменился', flush=True)
finally:
    for instance in ('blue1', 'blue2', 'green1', 'green2'):
        control('start', instance)

#!/usr/bin/env python3
"""Проверить миграцию: на хосте нет старых служб и открытых backend-портов."""
import subprocess

units = ['lab03-backend@' + name + '.service' for name in ('blue1', 'blue2', 'green1', 'green2')]
units.append('lab03-nginx.service')
for name in units:
    active = subprocess.run(['systemctl', '--user', 'is-active', name], capture_output=True, text=True)
    enabled = subprocess.run(['systemctl', '--user', 'is-enabled', name], capture_output=True, text=True)
    assert active.stdout.strip() == 'inactive', (name, active.stdout)
    assert enabled.stdout.strip() == 'disabled', (name, enabled.stdout)
    print('PASS host:', name, 'inactive / disabled')
listeners = subprocess.check_output(['ss', '-lntp'], text=True)
for port in (9311, 9312, 9321, 9322):
    assert ':' + str(port) + ' ' not in listeners, listeners
print('PASS на хосте отсутствуют слушающие backend-порты 9311/9312/9321/9322')
for query in ('is-active', 'is-enabled'):
    result = subprocess.run(['systemctl', query, 'docker'], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    print('PASS Docker daemon systemd:', query, result.stdout.strip(), flush=True)
subprocess.run(['docker', '--context', 'default', 'compose', '-f', 'lab03/compose.yaml', 'ps', '-a'], check=True)

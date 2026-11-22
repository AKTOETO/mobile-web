#!/usr/bin/env python3
"""Подпись штатным rpmsign-external из SDK 5.1, проверка до установки."""
from pathlib import Path
import shlex
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
rpm = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'aurora-app/RPMS/ru.mai.auroradeploy-1.0.0-1.x86_64.rpm'
certs = Path.home() / 'AuroraOS/package-signing'
remote = subprocess.check_output(['ssh', 'aurora-build', 'mktemp -d /tmp/lab03-sign.XXXXXX'], text=True).strip()
try:
    subprocess.run(['scp', str(certs / 'regular_key.pem'), str(certs / 'regular_cert.pem'),
                    'aurora-build:' + remote + '/'], check=True)
    key, cert, package = map(shlex.quote, [remote + '/regular_key.pem', remote + '/regular_cert.pem', str(rpm)])
    command = (f'chmod 600 {key} && rpmsign-external sign -k {key} -c {cert} {package}'
               f' && rpmsign-external verify {package} && rpmsign-external dump {package}')
    subprocess.run(['ssh', 'aurora-build', command], check=True)
finally:
    subprocess.run(['ssh', 'aurora-build', 'rm -rf -- ' + shlex.quote(remote)], check=True)

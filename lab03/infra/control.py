#!/usr/bin/env python3
"""Короткий CLI Docker Compose; серверных процессов на хосте не создаёт."""
import argparse
import json
from pathlib import Path
import subprocess
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

def compose(*args):
    subprocess.run(['docker', '--context', 'default', 'compose', '-f', str(ROOT / 'compose.yaml'), *args], check=True)

def action(name, target):
    payload = json.dumps({'action': name, 'target': target}).encode()
    req = urllib.request.Request('http://127.0.0.1:9084/api/action', data=payload,
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=45) as reply:
            print(reply.read().decode())
    except urllib.error.HTTPError as error:
        raise SystemExit(error.read().decode())

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['install', 'up', 'down', 'switch', 'start', 'stop', 'status', 'logs', 'test'])
    parser.add_argument('target', nargs='?')
    args = parser.parse_args()
    if args.action in ('install', 'up'):
        compose('up', '-d', '--build', '--wait')
    elif args.action == 'status':
        compose('ps', '-a')
    elif args.action == 'down':
        compose('down')
    elif args.action == 'logs':
        compose('logs', '--tail', '100', *([args.target] if args.target else []))
    elif args.action == 'test':
        compose('run', '--rm', 'tests')
    else:
        action(args.action, args.target)

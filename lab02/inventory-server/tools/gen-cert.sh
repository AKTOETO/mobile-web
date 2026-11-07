#!/usr/bin/env bash
# Самоподписанный CA + сертификат сервера для HTTPS (учебная работа).
#
# SAN включает localhost/127.0.0.1 (ПК), 10.0.2.2 (шлюз на хост из эмулятора
# VirtualBox) и все IPv4-адреса машины в локальной сети.
set -euo pipefail

cd "$(dirname "$0")/.."
DIR="${CERT_DIR:-certs}"
mkdir -p "$DIR"

SAN="DNS:localhost,IP:127.0.0.1,IP:10.0.2.2"
for ip in $(hostname -I 2>/dev/null || true); do
  case "$ip" in
    *:*) ;;                       # IPv6 в SAN не добавляем: SAN уже с IPv4
    *) SAN="$SAN,IP:$ip" ;;
  esac
done

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout "$DIR/ca.key" -out "$DIR/ca.crt" \
  -subj "/C=RU/ST=Moscow/O=MAI/OU=Laboratory/CN=MAI Lab02 Inventory CA" \
  >/dev/null 2>&1

openssl req -newkey rsa:2048 -nodes \
  -keyout "$DIR/server.key" -out "$DIR/server.csr" \
  -subj "/C=RU/ST=Moscow/O=MAI/OU=Laboratory/CN=inventory.local" \
  >/dev/null 2>&1

cat > "$DIR/server.ext" <<EOF
subjectAltName=$SAN
extendedKeyUsage=serverAuth
keyUsage=digitalSignature,keyEncipherment
EOF

openssl x509 -req -in "$DIR/server.csr" -CA "$DIR/ca.crt" -CAkey "$DIR/ca.key" \
  -CAcreateserial -out "$DIR/server.crt" -days 3650 -extfile "$DIR/server.ext" \
  >/dev/null 2>&1

rm -f "$DIR/server.csr" "$DIR/server.ext" "$DIR/ca.srl"

echo "Готово: $DIR/ca.crt, $DIR/server.crt, $DIR/server.key"
echo "SAN: $SAN"

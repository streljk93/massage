#!/usr/bin/env sh
# Настройка Nginx на хосте (вне Docker) + Let's Encrypt для домена.
# Использование:
#   sudo sh scripts/setup-host-nginx.sh --domain bukvu.com --email admin@bukvu.com
#
# Опции:
#   --domain            домен (обязательно), например bukvu.com
#   --email             email для Let's Encrypt (обязательно, если не --skip-certbot)
#   --client-upstream   upstream для frontend (по умолчанию http://127.0.0.1:3000)
#   --back-upstream     upstream для backend (по умолчанию http://127.0.0.1:3001)
#   --skip-certbot      только Nginx-конфиг, без выпуска сертификата
#   --keep-default-site не удалять /etc/nginx/sites-enabled/default
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_PATH="$ROOT/deploy/nginx/services-app.conf.template"

DOMAIN=""
EMAIL=""
CLIENT_UPSTREAM="http://127.0.0.1:3000"
BACK_UPSTREAM="http://127.0.0.1:3001"
SKIP_CERTBOT="0"
KEEP_DEFAULT_SITE="0"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --email)
      EMAIL="${2:-}"
      shift 2
      ;;
    --client-upstream)
      CLIENT_UPSTREAM="${2:-}"
      shift 2
      ;;
    --back-upstream)
      BACK_UPSTREAM="${2:-}"
      shift 2
      ;;
    --skip-certbot)
      SKIP_CERTBOT="1"
      shift 1
      ;;
    --keep-default-site)
      KEEP_DEFAULT_SITE="1"
      shift 1
      ;;
    *)
      echo "Неизвестный аргумент: $1" >&2
      exit 1
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root (через sudo)." >&2
  exit 1
fi

if [ -z "$DOMAIN" ]; then
  echo "Укажите --domain (например --domain bukvu.com)." >&2
  exit 1
fi

if [ "$SKIP_CERTBOT" != "1" ] && [ -z "$EMAIL" ]; then
  echo "Укажите --email для Let's Encrypt (или добавьте --skip-certbot)." >&2
  exit 1
fi

if [ ! -f "$TEMPLATE_PATH" ]; then
  echo "Не найден шаблон: $TEMPLATE_PATH" >&2
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nginx
fi

if [ "$SKIP_CERTBOT" != "1" ] && ! command -v certbot >/dev/null 2>&1; then
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow "Nginx Full" >/dev/null 2>&1 || true
fi

TARGET_PATH="/etc/nginx/sites-available/$DOMAIN.conf"
LINK_PATH="/etc/nginx/sites-enabled/$DOMAIN.conf"

esc() {
  printf "%s" "$1" | sed -e 's/[\/&]/\\&/g'
}

DOMAIN_ESC="$(esc "$DOMAIN")"
CLIENT_ESC="$(esc "$CLIENT_UPSTREAM")"
BACK_ESC="$(esc "$BACK_UPSTREAM")"

sed \
  -e "s/__DOMAIN__/$DOMAIN_ESC/g" \
  -e "s/__CLIENT_UPSTREAM__/$CLIENT_ESC/g" \
  -e "s/__BACK_UPSTREAM__/$BACK_ESC/g" \
  "$TEMPLATE_PATH" > "$TARGET_PATH"

ln -sfn "$TARGET_PATH" "$LINK_PATH"

if [ "$KEEP_DEFAULT_SITE" != "1" ]; then
  rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl reload nginx

if [ "$SKIP_CERTBOT" != "1" ]; then
  certbot --nginx \
    --non-interactive \
    --agree-tos \
    --redirect \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

  mkdir -p /etc/letsencrypt/renewal-hooks/deploy
  cat >/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'HOOK'
#!/usr/bin/env sh
set -eu
nginx -t
systemctl reload nginx
HOOK
  chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

  systemctl enable --now certbot.timer >/dev/null 2>&1 || true
fi

echo ""
echo "Готово."
echo "Домен: $DOMAIN"
echo "Frontend upstream: $CLIENT_UPSTREAM"
echo "Backend upstream:  $BACK_UPSTREAM"
if [ "$SKIP_CERTBOT" = "1" ]; then
  echo "Сертификат не выпускался (--skip-certbot)."
else
  echo "HTTPS настроен, автообновление через certbot.timer."
fi

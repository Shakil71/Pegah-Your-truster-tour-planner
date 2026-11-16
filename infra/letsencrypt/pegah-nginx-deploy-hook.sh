#!/bin/sh
# Pegah — certbot deploy hook. Installed (root, 0755) as
# /etc/letsencrypt/renewal-hooks/deploy/pegah-nginx.sh. certbot runs it after
# renewing any certificate; it reloads nginx only for pegah.com.bd, and only
# when the configuration still tests clean (nginx is shared with other sites).
[ "$RENEWED_LINEAGE" = /etc/letsencrypt/live/pegah.com.bd ] || exit 0
/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx

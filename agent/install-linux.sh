#!/usr/bin/env bash
set -euo pipefail

: "${CYBERGUARD_URL:?Set CYBERGUARD_URL before installation}"
: "${CYBERGUARD_ENROLLMENT_TOKEN:?Set CYBERGUARD_ENROLLMENT_TOKEN before installation}"
INSTALL_DIR="${INSTALL_DIR:-/opt/pngee-cyberguard-agent}"
SERVICE_USER="${SERVICE_USER:-cyberguard}"

command -v node >/dev/null || { echo 'Node.js 22+ is required'; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || { echo 'Node.js 22+ is required'; exit 1; }

install -d -m 0750 "$INSTALL_DIR"
cp agent/agent.ts agent/README.md "$INSTALL_DIR/"

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

install -d -m 0750 /etc/pngee-cyberguard
cat >/etc/pngee-cyberguard/agent.env <<EOF
CYBERGUARD_URL=$CYBERGUARD_URL
CYBERGUARD_ENROLLMENT_TOKEN=$CYBERGUARD_ENROLLMENT_TOKEN
CYBERGUARD_AGENT_STATE=$INSTALL_DIR/agent.json
EOF
chmod 0600 /etc/pngee-cyberguard/agent.env

cat >/etc/systemd/system/pngee-cyberguard-agent.service <<EOF
[Unit]
Description=PNGee CyberGuard Endpoint Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=/etc/pngee-cyberguard/agent.env
ExecStart=$(command -v node) $INSTALL_DIR/agent.ts
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$INSTALL_DIR

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now pngee-cyberguard-agent
systemctl --no-pager --full status pngee-cyberguard-agent

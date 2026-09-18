#!/bin/bash
# instalar_inicio_automatico.sh
# Configura el LaunchAgent en macOS para que el Dashboard arranque solo al encender el ordenador

PLIST_PATH="$HOME/Library/LaunchAgents/com.alertas.dashboard.plist"
SCRIPT_PATH="/Users/joseantoniocorralesortega/Documents/Alertas Alimentarias/scripts/auto_sync_and_serve.sh"

echo "Configurando servicio automático de inicio en macOS..."

# Si ya existía, descargarlo primero
if [ -f "$PLIST_PATH" ]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null
fi

cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.alertas.dashboard</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$SCRIPT_PATH</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/alertas_dashboard.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/alertas_dashboard_err.log</string>
</dict>
</plist>
EOF

launchctl load "$PLIST_PATH"

echo "================================================================"
echo "✅ SERVICIO CONFIGURADO CON ÉXITO"
echo "A partir de ahora, cada vez que enciendas tu Mac:"
echo "1. Se sincronizarán las alertas en segundo plano."
echo "2. El servidor estará siempre activo en http://localhost:8080."
echo "3. No necesitas abrir Antigravity ni el Terminal."
echo "================================================================"

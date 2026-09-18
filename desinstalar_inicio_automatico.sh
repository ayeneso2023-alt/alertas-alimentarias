#!/bin/bash
# desinstalar_inicio_automatico.sh
# Detiene y elimina el inicio automático del Dashboard en macOS

PLIST_PATH="$HOME/Library/LaunchAgents/com.alertas.dashboard.plist"

if [ -f "$PLIST_PATH" ]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null
    rm -f "$PLIST_PATH"
    echo "✅ Servicio de inicio automático eliminado correctamente."
else
    echo "El servicio no estaba instalado."
fi

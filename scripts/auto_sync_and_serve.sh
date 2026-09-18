#!/bin/bash
# auto_sync_and_serve.sh
# Ejecutado por launchd al iniciar sesión en el Mac

PROJECT_DIR="/Users/joseantoniocorralesortega/Documents/Alertas Alimentarias"
cd "$PROJECT_DIR" || exit 1

# Sincronización inicial de alertas mundiales al encender
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 scripts/fetch_alerts.py >> /tmp/alertas_sync.log 2>&1

# Iniciar servidor en primer plano para que launchd lo mantenga activo
exec /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 server.py

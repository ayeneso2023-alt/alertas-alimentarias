#!/bin/bash
# auto_sync_and_serve.sh
# Ejecutado por launchd al iniciar sesión en el Mac

PROJECT_DIR="/Users/joseantoniocorralesortega/Documents/Alertas Alimentarias"
cd "$PROJECT_DIR" || exit 1

# Sincronización inicial de alertas mundiales al encender
PYTHON_BIN="/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="$(command -v python3)"
fi

"$PYTHON_BIN" scripts/fetch_alerts.py >> /tmp/alertas_sync.log 2>&1

# Si hay nuevas alertas o metadatos, subirlos a GitHub automáticamente
git add data/alerts.json data/metadata.json static/data/alerts.json static/data/metadata.json static/js/alerts_data.js
if ! git diff --staged --quiet; then
    FECHA_HORA=$(date "+%d/%m/%Y %H:%M:%S")
    git commit -m "Auto-sync local: alertas y metadatos actualizados ($FECHA_HORA)" >> /tmp/alertas_push.log 2>&1
    git push origin main >> /tmp/alertas_push.log 2>&1
fi

# Iniciar servidor en primer plano para que launchd lo mantenga activo
exec /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 server.py

#!/bin/bash
# auto_sync_and_serve.sh
# Ejecutado por launchd al iniciar sesión en el Mac

PROJECT_DIR="/Users/joseantoniocorralesortega/Documents/Alertas Alimentarias"
cd "$PROJECT_DIR" || exit 1

# Sincronización inicial de alertas mundiales al encender
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 scripts/fetch_alerts.py >> /tmp/alertas_sync.log 2>&1

# Si hay nuevas alertas, subirlas a GitHub automáticamente
git add data/alerts.json static/data/alerts.json static/js/alerts_data.js
if ! git diff --staged --quiet; then
    git commit -m "Auto-sync local: nuevas alertas incorporadas" >> /tmp/alertas_push.log 2>&1
    git push origin main >> /tmp/alertas_push.log 2>&1
fi

# Iniciar servidor en primer plano para que launchd lo mantenga activo
exec /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 server.py

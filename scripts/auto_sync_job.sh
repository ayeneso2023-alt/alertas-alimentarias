#!/bin/bash
# scripts/auto_sync_job.sh
# Ejecución periódica (cada 2 horas o programada) para sincronizar alertas y subirlas a GitHub

PROJECT_DIR="/Users/joseantoniocorralesortega/Documents/Alertas Alimentarias"
cd "$PROJECT_DIR" || exit 1

LOG_FILE="/tmp/alertas_sync_cron.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔄 Iniciando auto-sync programado de alertas..." >> "$LOG_FILE"

PYTHON_BIN="/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="$(command -v python3)"
fi

"$PYTHON_BIN" scripts/fetch_alerts.py >> "$LOG_FILE" 2>&1

# Agregar datos y metadatos actualizados
git add data/alerts.json data/metadata.json static/data/alerts.json static/data/metadata.json static/js/alerts_data.js

if ! git diff --staged --quiet; then
    FECHA_HORA=$(date "+%d/%m/%Y %H:%M:%S")
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 Nuevas alertas detectadas. Realizando commit y push a GitHub..." >> "$LOG_FILE"
    git commit -m "Auto-sync periódico: alertas y fecha de sincronización actualizada ($FECHA_HORA)" >> "$LOG_FILE" 2>&1
    git push origin main >> "$LOG_FILE" 2>&1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Push a GitHub completado con éxito." >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️ No hay nuevas alertas en este ciclo. Todo al día." >> "$LOG_FILE"
fi

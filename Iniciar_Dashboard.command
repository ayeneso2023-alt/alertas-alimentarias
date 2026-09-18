#!/bin/bash
# Iniciar_Dashboard.command
# Doble clic en este archivo para sincronizar alertas y abrir el Dashboard en tu navegador

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "========================================================"
echo "🌍 ACTUALIZANDO ALERTAS ALIMENTARIAS Y FOOD FRAUD..."
echo "========================================================"

# 1. Ejecutar sincronización de nuevas alertas en la web
python3 scripts/fetch_alerts.py

# 2. Comprobar si el servidor ya está corriendo en el puerto 8080
if ! lsof -i :8080 > /dev/null 2>&1; then
    echo "Iniciando servidor local..."
    nohup python3 server.py > /dev/null 2>&1 &
    sleep 1.5
fi

# 3. Abrir el navegador en el dashboard
echo "Abriendo dashboard en tu navegador..."
open "http://localhost:8080"

echo "¡Listo! Puedes cerrar esta ventana."
sleep 2
exit 0

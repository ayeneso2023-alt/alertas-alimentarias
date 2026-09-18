#!/usr/bin/env python3
"""
scripts/test_dashboard.py
Test suite para verificar la integridad del modelo de datos, la API y las estadísticas del dashboard.
"""

import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
import server

def test_alerts_data():
    print("[TEST 1] Verificando data/alerts.json...")
    path = os.path.join(BASE_DIR, "data", "alerts.json")
    assert os.path.exists(path), f"No existe el archivo {path}"
    with open(path, "r", encoding="utf-8") as f:
        alerts = json.load(f)
    
    assert len(alerts) > 0, "La base de datos de alertas está vacía"
    print(f"  -> Total de alertas registradas: {len(alerts)}")

    # Validar campos obligatorios
    required_fields = [
        "id", "fecha_notificacion", "fuente_origen", "pais_notificador",
        "producto", "categoria_alimento", "tipo_alerta", "gravedad", "descripcion"
    ]
    for idx, a in enumerate(alerts):
        for field in required_fields:
            assert field in a, f"Alerta en índice {idx} ({a.get('id')}) carece del campo '{field}'"
    print("  -> Todos los registros cumplen con los campos requeridos del modelo unificado.")

    return alerts

def test_compute_stats(alerts):
    print("\n[TEST 2] Verificando cálculo de analíticas y estadísticas...")
    stats = server.compute_stats(alerts)
    
    assert stats["total_alerts"] == len(alerts), "Conteo total inconsistente"
    assert stats["fraud_count"] > 0, "No se contabilizaron alertas de Food Fraud"
    assert stats["microbio_count"] > 0, "No se contabilizaron alertas microbiológicas"
    assert len(stats["by_country_notif"]) > 0, "No hay países notificadores calculados"
    assert len(stats["by_month"]) > 0, "No hay desglose por meses calculado"

    print(f"  -> Total alertas: {stats['total_alerts']}")
    print(f"  -> Alertas de Food Fraud: {stats['fraud_count']} ({stats['fraud_pct']}%)")
    print(f"  -> Tipos de Fraude detectados: {list(stats['fraud_by_type'].keys())}")
    print(f"  -> Alertas Microbiológicas: {stats['microbio_count']}")
    print(f"  -> Alérgenos no declarados: {stats['allergen_count']}")
    print(f"  -> Países únicos: {stats['unique_countries']}")
    print(f"  -> Top 3 países notificadores: {list(stats['by_country_notif'].items())[:3]}")
    print(f"  -> Meses analizados: {list(stats['by_month'].keys())}")

def test_ui_files():
    print("\n[TEST 3] Verificando archivos de la interfaz web...")
    files = [
        "static/index.html",
        "static/css/styles.css",
        "static/js/app.js",
        "server.py",
        "scripts/fetch_alerts.py"
    ]
    for rel_path in files:
        full_path = os.path.join(BASE_DIR, rel_path)
        assert os.path.exists(full_path), f"Falta el archivo {rel_path}"
        assert os.path.getsize(full_path) > 0, f"El archivo {rel_path} está vacío"
        print(f"  -> Archivo OK: {rel_path} ({os.path.getsize(full_path)} bytes)")

if __name__ == "__main__":
    print("==================================================")
    print("INICIANDO SUITE DE PRUEBAS DEL DASHBOARD GLOBAL")
    print("==================================================")
    alerts = test_alerts_data()
    test_compute_stats(alerts)
    test_ui_files()
    print("\n[ÉXITO] Todas las pruebas han pasado satisfactoriamente.")

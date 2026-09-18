#!/usr/bin/env python3
"""
server.py
Servidor local para el Global Food Alert & Food Fraud Dashboard.
Sirve la interfaz web y expone la API REST para consultas, estadísticas y sincronización en vivo.
"""

import http.server
import socketserver
import json
import os
import urllib.parse
from datetime import datetime
import sys

# Añadir directorio scripts al path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts"))
try:
    import fetch_alerts
except ImportError:
    fetch_alerts = None

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "alerts.json")

def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[ERROR] Error leyendo {DATA_FILE}: {e}")
    return []

def compute_stats(alerts):
    total = len(alerts)
    fraud_count = 0
    microbio_count = 0
    allergen_count = 0
    chemical_count = 0
    physical_count = 0
    critical_count = 0

    fraud_by_type = {}
    by_category = {}
    by_country_notif = {}
    by_country_origin = {}
    by_month = {}
    by_type = {}
    by_severity = {}

    for a in alerts:
        tipo = a.get("tipo_alerta", "Otros")
        by_type[tipo] = by_type.get(tipo, 0) + 1

        if tipo == "Fraude / EMA":
            fraud_count += 1
            ft = a.get("tipo_fraude", "Otros")
            if ft and ft != "No Aplica":
                fraud_by_type[ft] = fraud_by_type.get(ft, 0) + 1
        elif tipo == "Microbiológico":
            microbio_count += 1
        elif tipo == "Alérgeno":
            allergen_count += 1
        elif tipo == "Químico":
            chemical_count += 1
        elif tipo == "Físico":
            physical_count += 1

        grav = a.get("gravedad", "Media")
        by_severity[grav] = by_severity.get(grav, 0) + 1
        if "Crítica" in grav or "Alta" in grav:
            critical_count += 1

        cat = a.get("categoria_alimento", "Otros")
        by_category[cat] = by_category.get(cat, 0) + 1

        p_notif = a.get("pais_notificador", "Desconocido")
        by_country_notif[p_notif] = by_country_notif.get(p_notif, 0) + 1

        p_orig = a.get("pais_origen", "Desconocido")
        by_country_origin[p_orig] = by_country_origin.get(p_orig, 0) + 1

        mes = a.get("mes_ano", "")
        if not mes and a.get("fecha_notificacion"):
            mes = a.get("fecha_notificacion")[:7]
        if mes:
            if mes not in by_month:
                by_month[mes] = {"total": 0, "fraude": 0, "microbiologico": 0, "alergeno": 0, "quimico": 0, "otros": 0}
            by_month[mes]["total"] += 1
            if tipo == "Fraude / EMA":
                by_month[mes]["fraude"] += 1
            elif tipo == "Microbiológico":
                by_month[mes]["microbiologico"] += 1
            elif tipo == "Alérgeno":
                by_month[mes]["alergeno"] += 1
            elif tipo == "Químico":
                by_month[mes]["quimico"] += 1
            else:
                by_month[mes]["otros"] += 1

    # Sort months chronologically
    sorted_months = dict(sorted(by_month.items()))

    # Sort countries by count
    sorted_notif = dict(sorted(by_country_notif.items(), key=lambda x: x[1], reverse=True))
    sorted_orig = dict(sorted(by_country_origin.items(), key=lambda x: x[1], reverse=True))
    sorted_cat = dict(sorted(by_category.items(), key=lambda x: x[1], reverse=True))

    unique_countries = len(set(list(by_country_notif.keys()) + list(by_country_origin.keys())))

    return {
        "total_alerts": total,
        "fraud_count": fraud_count,
        "fraud_pct": round((fraud_count / total * 100), 1) if total > 0 else 0,
        "microbio_count": microbio_count,
        "allergen_count": allergen_count,
        "chemical_count": chemical_count,
        "physical_count": physical_count,
        "critical_count": critical_count,
        "unique_countries": unique_countries,
        "fraud_by_type": fraud_by_type,
        "by_category": sorted_cat,
        "by_country_notif": sorted_notif,
        "by_country_origin": sorted_orig,
        "by_month": sorted_months,
        "by_type": by_type,
        "by_severity": by_severity,
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

class DashboardRequestHandler(http.server.SimpleHTTPRequestHandler):
    directory = BASE_DIR

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Prevent caching for API routes
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/alerts":
            query_params = urllib.parse.parse_qs(parsed.query)
            alerts = load_data()

            # Optional query filters
            category = query_params.get("category", [None])[0]
            alert_type = query_params.get("type", [None])[0]
            country = query_params.get("country", [None])[0]
            month = query_params.get("month", [None])[0]
            search = query_params.get("search", [None])[0]

            filtered = alerts
            if category and category != "all":
                filtered = [a for a in filtered if a.get("categoria_alimento") == category]
            if alert_type and alert_type != "all":
                filtered = [a for a in filtered if a.get("tipo_alerta") == alert_type]
            if country and country != "all":
                filtered = [a for a in filtered if a.get("pais_notificador") == country or a.get("pais_origen") == country]
            if month and month != "all":
                filtered = [a for a in filtered if a.get("mes_ano") == month or (a.get("fecha_notificacion") or "").startswith(month)]
            if search:
                s_lower = search.lower()
                filtered = [
                    a for a in filtered
                    if s_lower in a.get("producto", "").lower()
                    or s_lower in a.get("descripcion", "").lower()
                    or s_lower in a.get("empresa_responsable", "").lower()
                    or s_lower in a.get("subtipo_peligro", "").lower()
                    or s_lower in a.get("id", "").lower()
                ]

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(filtered, ensure_ascii=False).encode("utf-8"))
            return

        elif path == "/api/stats":
            alerts = load_data()
            stats = compute_stats(alerts)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(stats, ensure_ascii=False).encode("utf-8"))
            return

        elif path == "/" or path == "/index.html":
            self.path = "/index.html"
            return super().do_GET()

        # Rutas de conveniencia si se solicitan sin el prefijo /static/
        elif path.startswith("/css/") or path.startswith("/js/"):
            self.path = "/static" + path
            return super().do_GET()

        elif path == "/data/alerts.json":
            self.path = "/data/alerts.json"
            return super().do_GET()

        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/sync":
            result = {"status": "error", "message": "Módulo de sincronización no disponible"}
            if fetch_alerts:
                try:
                    result = fetch_alerts.run_sync()
                except Exception as e:
                    result = {"status": "error", "message": str(e)}
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

def run_server():
    os.chdir(BASE_DIR)
    handler = DashboardRequestHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"================================================================")
        print(f"🚀 GLOBAL FOOD ALERT & FOOD FRAUD DASHBOARD EN EJECUCIÓN")
        print(f"📡 Servidor activo en: http://localhost:{PORT}")
        print(f"🌍 Monitoreo mundial de alertas de seguridad y fraude alimentario")
        print(f"================================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[INFO] Servidor detenido por el usuario.")

if __name__ == "__main__":
    run_server()

#!/usr/bin/env python3
"""
scripts/verify_http.py
Verifica exhaustivamente que el servidor HTTP sirva todas las rutas, assets y APIs.
"""

import sys
import os
import io
import json
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
import server

class MockSocket:
    def __init__(self):
        self.output = io.BytesIO()
    def makefile(self, mode, *args, **kwargs):
        return self.output
    def sendall(self, data):
        self.output.write(data)

def test_handler_route(path, method="GET"):
    request_text = f"{method} {path} HTTP/1.1\r\nHost: localhost:8080\r\n\r\n"
    rfile = io.BytesIO(request_text.encode("utf-8"))
    wfile = io.BytesIO()

    # Create handler directly
    handler = server.DashboardRequestHandler
    # Instantiate without calling __init__
    req = handler.__new__(handler)
    req.rfile = rfile
    req.wfile = wfile
    req.path = path
    req.command = method
    req.request_version = "HTTP/1.1"
    req.requestline = f"{method} {path} HTTP/1.1"
    req.headers = {"Host": "localhost:8080"}
    req.server = None
    req.close_connection = True
    req.client_address = ("127.0.0.1", 54321)

    os.chdir(BASE_DIR)
    if method == "GET":
        req.do_GET()
    elif method == "POST":
        req.do_POST()

    wfile.seek(0)
    response_data = wfile.read()
    status_line = response_data.split(b"\r\n")[0].decode("utf-8", errors="ignore")
    return status_line, response_data

def run_tests():
    routes_to_test = [
        ("/", "HTTP/1.0 200 OK"),
        ("/index.html", "HTTP/1.0 200 OK"),
        ("/static/index.html", "HTTP/1.0 200 OK"),
        ("/static/css/styles.css", "HTTP/1.0 200 OK"),
        ("/css/styles.css", "HTTP/1.0 200 OK"),
        ("/static/js/alerts_data.js", "HTTP/1.0 200 OK"),
        ("/js/alerts_data.js", "HTTP/1.0 200 OK"),
        ("/static/js/app.js", "HTTP/1.0 200 OK"),
        ("/js/app.js", "HTTP/1.0 200 OK"),
        ("/api/alerts", "HTTP/1.0 200 OK"),
        ("/api/stats", "HTTP/1.0 200 OK"),
    ]

    print("==================================================")
    print("VERIFICANDO RESPUESTAS HTTP DEL SERVIDOR LOCAL")
    print("==================================================")
    all_ok = True
    for route, expected_status in routes_to_test:
        status, data = test_handler_route(route)
        is_ok = "200" in status
        symbol = "✅" if is_ok else "❌"
        print(f"{symbol} {route.ljust(26)} -> {status} (Bytes: {len(data)})")
        if not is_ok:
            all_ok = False

    # Test API alerts payload
    status, data = test_handler_route("/api/alerts")
    header_end = data.find(b"\r\n\r\n")
    body = data[header_end+4:]
    alerts_obj = json.loads(body.decode("utf-8"))
    print(f"\n[INFO] /api/alerts devolvió {len(alerts_obj)} alertas unificadas.")

    # Test API stats payload
    status, data = test_handler_route("/api/stats")
    header_end = data.find(b"\r\n\r\n")
    body = data[header_end+4:]
    stats_obj = json.loads(body.decode("utf-8"))
    print(f"[INFO] /api/stats devolvió {stats_obj['total_alerts']} total, {stats_obj['fraud_count']} fraudes, {stats_obj['unique_countries']} países.")

    if all_ok:
        print("\n🎉 TODAS LAS RUTAS Y ARCHIVOS RESPONDEN CORRECTAMENTE (HTTP 200).")
    else:
        print("\n⚠️ HUBO ERRORES EN ALGUNA RUTA.")

if __name__ == "__main__":
    run_tests()

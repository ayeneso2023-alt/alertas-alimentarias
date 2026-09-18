#!/usr/bin/env python3
"""
scripts/fetch_alerts.py
Motor de sincronización e ingesta de alertas alimentarias y casos de Food Fraud.
Consulta fuentes en vivo (openFDA, UK FSA Alerts) y unifica los datos en data/alerts.json.
"""

import json
import os
import re
import urllib.request
import urllib.error
from datetime import datetime

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "alerts.json")

def load_existing_alerts():
    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Error cargando {DATA_PATH}: {e}")
    return []

def save_alerts(alerts):
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(alerts, f, ensure_ascii=False, indent=2)
    
    # Also write to static/data/alerts.json
    static_data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "data", "alerts.json")
    os.makedirs(os.path.dirname(static_data_path), exist_ok=True)
    with open(static_data_path, "w", encoding="utf-8") as f:
        json.dump(alerts, f, ensure_ascii=False, indent=2)

    # Also write to static/js/alerts_data.js for offline and file:// compatibility
    static_js_data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "js", "alerts_data.js")
    with open(static_js_data_path, "w", encoding="utf-8") as f:
        f.write("window.INITIAL_ALERTS_DATA = " + json.dumps(alerts, ensure_ascii=False, indent=2) + ";\n")

    print(f"[INFO] Guardadas {len(alerts)} alertas en {DATA_PATH} y alerts_data.js")

def classify_food_category(description):
    desc_lower = description.lower()
    if any(k in desc_lower for k in ["aceite", "oil", "oliva", "grasa", "fat", "margarina"]):
        return "Aceites y Grasas"
    if any(k in desc_lower for k in ["miel", "honey", "jarabe", "sirope", "syrup"]):
        return "Miel y Endulzantes"
    if any(k in desc_lower for k in ["pescado", "fish", "tuna", "atún", "salmon", "salmón", "shrimp", "langostino", "seafood", "marisco", "prawn"]):
        return "Pescados y Mariscos"
    if any(k in desc_lower for k in ["carne", "meat", "beef", "pork", "cerdo", "pollo", "chicken", "turkey", "pavo", "embutido", "salchichón"]):
        return "Carnes y Derivados"
    if any(k in desc_lower for k in ["leche", "milk", "queso", "cheese", "yogurt", "yogur", "dairy", "lácteo", "nata", "butter", "mantequilla"]):
        return "Lácteos y Derivados"
    if any(k in desc_lower for k in ["fruta", "fruit", "verdura", "vegetable", "espinaca", "spinach", "fresa", "berry", "manzana", "apple", "naranja", "orange", "tomate"]):
        return "Frutas, Hortalizas y Verduras"
    if any(k in desc_lower for k in ["nuez", "nut", "almendra", "almond", "cacahuete", "peanut", "pistacho", "semilla", "seed", "higo"]):
        return "Frutos Secos y Semillas"
    if any(k in desc_lower for k in ["pan", "bread", "harina", "flour", "galleta", "cookie", "cake", "cereal", "pasta", "tarta"]):
        return "Cereales y Productos de Panadería"
    if any(k in desc_lower for k in ["especia", "spice", "pimienta", "pepper", "pimentón", "paprika", "cúrcuma", "turmeric", "sauce", "salsa", "mayonesa", "mayo"]):
        return "Especias y Condimentos"
    if any(k in desc_lower for k in ["bebida", "beverage", "vino", "wine", "vodka", "licor", "liquor", "cerveza", "beer", "juice", "zumo"]):
        return "Bebidas y Licores"
    if any(k in desc_lower for k in ["suplemento", "supplement", "cápsula", "capsule", "vitamin", "vigor"]):
        return "Complementos Alimenticios"
    return "Otros"

def classify_alert_type(reason, description=""):
    text = (reason + " " + description).lower()
    
    # Check for Food Fraud first
    if any(k in text for k in ["fraud", "fraude", "sustitución", "substitution", "dilution", "dilución", "adulterat", "adulteración", "mislabelling", "falsificación", "counterfeit", "metanol", "sildenafil", "sildenafilo", "unapproved enhancement"]):
        return "Fraude / EMA"
    if any(k in text for k in ["allergen", "alérgeno", "alergeno", "peanut", "milk", "gluten", "mustard", "mostaza", "trigo", "wheat", "egg", "huevo", "undeclared", "no declarado", "soya", "soy"]):
        return "Alérgeno"
    if any(k in text for k in ["listeria", "salmonella", "e. coli", "escherichia", "norovirus", "hepatitis", "clostridium", "bacteri", "patógeno", "pathogen"]):
        return "Microbiológico"
    if any(k in text for k in ["metal", "glass", "vidrio", "plastic", "plástico", "foreign material", "cuerpo extraño", "alambre", "fragment"]):
        return "Físico"
    if any(k in text for k in ["pesticid", "plaguicida", "aflatoxin", "aflatoxina", "lead", "plomo", "mercurio", "mercury", "antibiotic", "cloranfenicol", "chemical", "químico"]):
        return "Químico"
    return "Etiquetado / Regulatorio"

def fetch_fda_recalls():
    url = "https://api.fda.gov/food/enforcement.json?limit=25&sort=recall_initiation_date:desc"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                results = data.get("results", [])
                normalized = []
                for item in results:
                    raw_date = item.get("recall_initiation_date", "")
                    if raw_date and len(raw_date) == 8:
                        date_str = f"{raw_date[0:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
                    else:
                        date_str = datetime.now().strftime("%Y-%m-%d")
                    
                    product_desc = item.get("product_description", "Alimento no especificado")
                    reason = item.get("reason_for_recall", "")
                    recall_num = item.get("recall_number", f"FDA-{raw_date}")
                    classification = item.get("classification", "Class II")
                    
                    gravedad = "Crítica / Alta" if "Class I" in classification else ("Media" if "Class II" in classification else "Baja")
                    tipo_alerta = classify_alert_type(reason, product_desc)
                    tipo_fraude = "No Aplica"
                    if tipo_alerta == "Fraude / EMA":
                        tipo_fraude = "Sustitución" if "substitut" in reason.lower() else "Adición No Autorizada"

                    cat = classify_food_category(product_desc)

                    norm = {
                        "id": f"US-FDA-{recall_num.replace('/', '-')}",
                        "id_original": recall_num,
                        "fecha_notificacion": date_str,
                        "mes_ano": date_str[:7],
                        "fuente_origen": "US_FDA",
                        "pais_notificador": "Estados Unidos",
                        "pais_origen": item.get("country", "Estados Unidos"),
                        "empresa_responsable": item.get("recalling_firm", "Empresa no especificada"),
                        "producto": product_desc[:120] + ("..." if len(product_desc) > 120 else ""),
                        "marca": item.get("recalling_firm", "Varios"),
                        "categoria_alimento": cat,
                        "tipo_alerta": tipo_alerta,
                        "subtipo_peligro": reason[:90] + ("..." if len(reason) > 90 else ""),
                        "tipo_fraude": tipo_fraude,
                        "gravedad": gravedad,
                        "estado_accion": "Activa / En curso" if item.get("status") == "Ongoing" else "Finalizada / Resuelta",
                        "descripcion": reason,
                        "lotes_afectados": item.get("code_info", "No especificado"),
                        "distribucion_geografica": item.get("distribution_pattern", "Estados Unidos"),
                        "cantidad_afectada": item.get("product_quantity", "En evaluación"),
                        "fuente_url": "https://api.fda.gov/food/enforcement.json"
                    }
                    normalized.append(norm)
                print(f"[INFO] Obtenidas {len(normalized)} alertas de openFDA en vivo")
                return normalized
    except Exception as e:
        print(f"[WARN] No se pudo obtener datos de openFDA en vivo: {e}")
    return []

def fetch_uk_fsa_alerts():
    url = "https://data.food.gov.uk/food-alerts/id.json?_sort=-created&_limit=15"
    headers = {"User-Agent": "GlobalFoodSafetyDashboard/1.0", "Accept": "application/json"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                items = data.get("items", [])
                normalized = []
                for it in items:
                    notation = it.get("notation", f"UK-FSA-{it.get('created', '')[:10]}")
                    created = it.get("created", "")
                    date_str = created[:10] if len(created) >= 10 else datetime.now().strftime("%Y-%m-%d")
                    title = it.get("title", "Alerta alimentaria Reino Unido")
                    
                    problems = it.get("problem", [])
                    problem_desc = problems[0].get("riskStatement", title) if problems and isinstance(problems, list) else title
                    
                    tipo_alerta = classify_alert_type(problem_desc, title)
                    cat = classify_food_category(title)
                    
                    business = it.get("reportingBusiness", {})
                    firm = business.get("commonName", "Empresa británica") if isinstance(business, dict) else "Reino Unido"

                    norm = {
                        "id": f"UK-FSA-{notation.replace('/', '-')}",
                        "id_original": notation,
                        "fecha_notificacion": date_str,
                        "mes_ano": date_str[:7],
                        "fuente_origen": "UK_FSA",
                        "pais_notificador": "Reino Unido",
                        "pais_origen": "Reino Unido",
                        "empresa_responsable": firm,
                        "producto": title[:120],
                        "marca": firm,
                        "categoria_alimento": cat,
                        "tipo_alerta": tipo_alerta,
                        "subtipo_peligro": problem_desc[:90] + ("..." if len(problem_desc) > 90 else ""),
                        "tipo_fraude": "No Aplica",
                        "gravedad": "Crítica / Alta" if "PRIN" in notation else "Media",
                        "estado_accion": "Activa / En curso",
                        "descripcion": problem_desc,
                        "lotes_afectados": "Consulte boletín de aviso de cliente de FSA",
                        "distribucion_geografica": "Reino Unido",
                        "cantidad_afectada": "Distribución minorista",
                        "fuente_url": f"https://data.food.gov.uk/food-alerts/id/{notation}"
                    }
                    normalized.append(norm)
                print(f"[INFO] Obtenidas {len(normalized)} alertas de UK FSA en vivo")
                return normalized
    except Exception as e:
        print(f"[WARN] No se pudo obtener datos de UK FSA en vivo: {e}")
    return []

def run_sync():
    print("[SYNC] Iniciando sincronización de alertas alimentarias mundiales...")
    existing = load_existing_alerts()
    existing_ids = {a.get("id") for a in existing}
    
    new_alerts = []
    
    # 1. Fetch live openFDA
    fda_alerts = fetch_fda_recalls()
    for item in fda_alerts:
        if item["id"] not in existing_ids:
            new_alerts.append(item)
            existing_ids.add(item["id"])
            
    # 2. Fetch live UK FSA
    fsa_alerts = fetch_uk_fsa_alerts()
    for item in fsa_alerts:
        if item["id"] not in existing_ids:
            new_alerts.append(item)
            existing_ids.add(item["id"])

    # Combine: new alerts on top, preserving all existing alerts and Food Fraud cases
    total_alerts = new_alerts + existing
    
    # Sort by fecha_notificacion descending
    total_alerts.sort(key=lambda x: x.get("fecha_notificacion", ""), reverse=True)
    
    save_alerts(total_alerts)
    print(f"[SYNC] Sincronización completada. Nuevas alertas añadidas: {len(new_alerts)}. Total: {len(total_alerts)}")
    return {
        "status": "success",
        "new_count": len(new_alerts),
        "total_count": len(total_alerts),
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    run_sync()

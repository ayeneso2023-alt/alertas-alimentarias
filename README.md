# Global Food Alert & Food Fraud Intelligence Dashboard

Panel de control analítico e interactivo para la monitorización mundial de **Alertas Alimentarias** y **Fraude Alimentario** (*Economically Motivated Adulteration - EMA*).

Desarrollado con la colaboración de subagentes especializados en **investigación de datos de seguridad alimentaria** y **diseño de interfaces de usuario para centros de mando**.

---

## Características Principales

1. **Monitoreo Global en Vivo:**
   - Ingesta directa de APIs oficiales internacionales:
     - **US FDA** (Food Enforcement Recalls API).
     - **UK Food Standards Agency (FSA)** (Food Alerts API pública).
     - **EU RASFF** (Rapid Alert System for Food and Feed).
     - **Europol OPSON** (Operaciones internacionales de Food Fraud).
     - **AESAN** (España) y **CFIA** (Canadá).
   - Botón de **Sincronización en Vivo** (`Live Sync`) para actualizar los datos al instante.

2. **Filtros Avanzados en Tiempo Real:**
   - **Por Tipo de Alimento / Categoría:** Aceites y Grasas (AOVE), Miel y Endulzantes, Pescados y Mariscos, Carnes, Lácteos, Frutas y Verduras, Frutos Secos, Cereales, Especias, Bebidas y Licores, Complementos Alimenticios.
   - **Por Tipo de Alerta:** Fraude Alimentario (Food Fraud / EMA), Peligro Microbiológico (*Listeria*, *Salmonella*, *E. coli*), Alérgenos no declarados, Contaminantes Químicos (plaguicidas, fármacos ilícitos, toxinas), Cuerpos Extraños / Físicos.
   - **Por Tipo de Fraude (Taxonomía GFSI / UE):** Dilución, Sustitución de especie, Ocultamiento químico, Adición no autorizada, Falsificación de denominaciones de origen (DOP/IGP) y Falso etiquetado.
   - **Por País:** Filtrado cruzado por País Notificador (quién intercepta) y País de Origen (dónde se elaboró el alimento).
   - **Por Meses:** Desglose cronológico mes a mes (Enero 2026 - Septiembre 2026).
   - **Búsqueda Universal:** Texto predictivo sobre productos, marcas, códigos de lote y descripciones.

3. **Visualizaciones y Gráficos Interactivos (Chart.js):**
   - **Evolución Temporal por Meses:** Gráfico apilado que muestra el volumen mensual por cada tipo de riesgo o fraude.
   - **Distribución por Tipos de Alerta & Fraude:** Gráfico circular (Doughnut) interactivo con porcentajes.
   - **Alertas por País:** Comparativa horizontal entre Países Notificadores y Países de Origen.
   - **Resumen Ejecutivo de Cantidades:** Métricas de volumen (litros de aceite adulterado, toneladas de pescado sustituido, unidades de producto incautadas).

4. **Tabla de Auditoría y Ficha Técnica en Modal:**
   - Tabla interactiva con badges de severidad codificados por color (Crítica, Media, Informativa).
   - Banderas y rutas de distribución: `Notificador ➔ Origen`.
   - Modal de inspección técnica con número de lote, caducidad, evaluación toxicológica y enlace oficial a la autoridad sanitaria correspondiente.
   - Exportación de los datos filtrados a **CSV (Excel)** y **JSON**.

---

## Cómo Iniciar el Dashboard

Para ejecutar el servidor local y abrir el dashboard en tu navegador:

```bash
# 1. Iniciar el servidor local en Python
python3 server.py
```

Abre tu navegador web y visita:
👉 **[http://localhost:8080](http://localhost:8080)**

Si deseas abrir el panel sin servidor, también puedes abrir directamente el archivo `static/index.html` en cualquier navegador web.

---

## Sincronización Manual desde Terminal

Para forzar una sincronización y descargar nuevas alertas de las APIs internacionales:

```bash
python3 scripts/fetch_alerts.py
```

Para ejecutar la suite de pruebas automatizadas:

```bash
python3 scripts/test_dashboard.py
```

---

## Estructura del Proyecto

```
Alertas Alimentarias/
├── data/
│   └── alerts.json            # Base de datos local unificada de incidentes mundiales
├── scripts/
│   ├── fetch_alerts.py        # Adaptador de APIs (openFDA, UK FSA, etc.)
│   └── test_dashboard.py      # Suite de pruebas automatizadas
├── static/
│   ├── index.html             # Interfaz de usuario del dashboard
│   ├── css/
│   │   └── styles.css         # Estilos y variables de severidad
│   ├── js/
│   │   └── app.js             # Lógica reactiva, gráficos y exportación
│   └── data/
│       └── alerts.json        # Espejo de datos estático
├── server.py                  # Servidor HTTP y API REST (/api/alerts, /api/stats, /api/sync)
└── README.md                  # Documentación del proyecto
```

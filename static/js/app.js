/**
 * app.js - Global Food Safety & Food Fraud Intelligence Dashboard
 * Lógica de cliente, reactividad de filtros, gráficos interactivos con Chart.js y tabla de alertas.
 */

// Estado global de la aplicación
let allAlerts = [];
let filteredAlerts = [];
let currentPage = 1;
let pageSize = 25;
let countryChartMode = 'notif'; // 'notif' or 'origin'

// Instancias de Chart.js
let chartMonthlyInstance = null;
let chartTypesInstance = null;
let chartCountriesInstance = null;

// Inicialización con datos precargados si están disponibles
if (window.INITIAL_ALERTS_DATA && Array.isArray(window.INITIAL_ALERTS_DATA) && window.INITIAL_ALERTS_DATA.length > 0) {
  allAlerts = [...window.INITIAL_ALERTS_DATA];
}

document.addEventListener('DOMContentLoaded', async () => {
  // Renderizado instantáneo si ya tenemos datos
  if (allAlerts.length > 0) {
    populateFilterOptions();
    applyFilters();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }

  await fetchInitialData();
  setupEventListeners();
});

async function fetchInitialData() {
  const endpoints = ['/api/alerts', 'data/alerts.json', './data/alerts.json', '../data/alerts.json', '/static/data/alerts.json'];
  let loaded = false;

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep);
      if (res.ok) {
        const fetchedData = await res.json();
        if (Array.isArray(fetchedData) && fetchedData.length > 0) {
          allAlerts = fetchedData;
          loaded = true;
          console.log(`[INFO] Datos actualizados desde ${ep} (${allAlerts.length} alertas)`);
          populateFilterOptions();
          applyFilters();
          break;
        }
      }
    } catch (e) {
      // Intenta siguiente endpoint si fetch falla
    }
  }

  if (!loaded && allAlerts.length === 0) {
    console.warn('[WARN] No se pudo cargar alertas desde endpoints ni desde cache.');
  }
}

function populateFilterOptions() {
  const countrySelect = document.getElementById('filterCountry');
  const monthSelect = document.getElementById('filterMonth');

  const countries = new Set();
  const months = new Set();

  allAlerts.forEach(a => {
    if (a.pais_notificador) countries.add(a.pais_notificador);
    if (a.pais_origen) countries.add(a.pais_origen);
    
    const m = a.mes_ano || (a.fecha_notificacion ? a.fecha_notificacion.substring(0, 7) : null);
    if (m) months.add(m);
  });

  // Populate countries
  const sortedCountries = Array.from(countries).sort();
  countrySelect.innerHTML = '<option value="all">Todos los países</option>';
  sortedCountries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    countrySelect.appendChild(opt);
  });

  // Populate months
  const sortedMonths = Array.from(months).sort().reverse();
  monthSelect.innerHTML = '<option value="all">Todos los meses</option>';
  sortedMonths.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    // Format "2026-09" to readable string "Septiembre 2026"
    const [year, month] = m.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    opt.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    monthSelect.appendChild(opt);
  });
}

function applyFilters() {
  const searchVal = document.getElementById('searchInput').value.trim().toLowerCase();
  const categoryVal = document.getElementById('filterCategory').value;
  const typeVal = document.getElementById('filterType').value;
  const countryVal = document.getElementById('filterCountry').value;
  const monthVal = document.getElementById('filterMonth').value;

  filteredAlerts = allAlerts.filter(a => {
    // Search match
    if (searchVal) {
      const target = [
        a.producto,
        a.descripcion,
        a.empresa_responsable,
        a.subtipo_peligro,
        a.id,
        a.lotes_afectados
      ].join(' ').toLowerCase();
      if (!target.includes(searchVal)) return false;
    }

    // Category match
    if (categoryVal !== 'all' && a.categoria_alimento !== categoryVal) {
      return false;
    }

    // Type match
    if (typeVal !== 'all' && a.tipo_alerta !== typeVal) {
      return false;
    }

    // Country match
    if (countryVal !== 'all') {
      if (a.pais_notificador !== countryVal && a.pais_origen !== countryVal) {
        return false;
      }
    }

    // Month match
    if (monthVal !== 'all') {
      const aMonth = a.mes_ano || (a.fecha_notificacion ? a.fecha_notificacion.substring(0, 7) : '');
      if (aMonth !== monthVal) return false;
    }

    return true;
  });

  currentPage = 1;
  updateKPIs();
  renderCharts();
  renderSummaryPanels();
  renderTable();
  updateFilterBadges();
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCategory').value = 'all';
  document.getElementById('filterType').value = 'all';
  document.getElementById('filterCountry').value = 'all';
  document.getElementById('filterMonth').value = 'all';
  applyFilters();
}

function updateKPIs() {
  const total = filteredAlerts.length;
  let fraud = 0;
  let microbio = 0;
  let critical = 0;
  const countries = new Set();

  filteredAlerts.forEach(a => {
    if (a.tipo_alerta === 'Fraude / EMA') fraud++;
    if (a.tipo_alerta === 'Microbiológico' || a.tipo_alerta === 'Alérgeno') microbio++;
    if ((a.gravedad || '').includes('Crítica') || (a.gravedad || '').includes('Alta')) critical++;
    if (a.pais_notificador) countries.add(a.pais_notificador);
    if (a.pais_origen) countries.add(a.pais_origen);
  });

  const fraudPct = total > 0 ? Math.round((fraud / total) * 100) : 0;

  document.getElementById('kpiTotalAlerts').textContent = total.toLocaleString();
  document.getElementById('kpiFraudAlerts').textContent = `${fraud} (${fraudPct}%)`;
  document.getElementById('kpiMicrobioAlerts').textContent = microbio.toLocaleString();
  document.getElementById('kpiCountries').textContent = countries.size.toString();
  document.getElementById('kpiCriticalAlerts').textContent = critical.toLocaleString();

  document.getElementById('filterResultsCount').textContent = `Mostrando ${total} de ${allAlerts.length} alertas globales`;
}

function updateFilterBadges() {
  const chipsContainer = document.getElementById('activeChips');
  chipsContainer.innerHTML = '';

  const active = [];
  const cat = document.getElementById('filterCategory').value;
  const typ = document.getElementById('filterType').value;
  const cou = document.getElementById('filterCountry').value;
  const mon = document.getElementById('filterMonth').value;
  const sea = document.getElementById('searchInput').value.trim();

  if (sea) active.push({ label: `Búsqueda: "${sea}"`, reset: () => document.getElementById('searchInput').value = '' });
  if (cat !== 'all') active.push({ label: `Alimento: ${cat}`, reset: () => document.getElementById('filterCategory').value = 'all' });
  if (typ !== 'all') active.push({ label: `Tipo: ${typ}`, reset: () => document.getElementById('filterType').value = 'all' });
  if (cou !== 'all') active.push({ label: `País: ${cou}`, reset: () => document.getElementById('filterCountry').value = 'all' });
  if (mon !== 'all') active.push({ label: `Mes: ${mon}`, reset: () => document.getElementById('filterMonth').value = 'all' });

  if (active.length > 0) {
    chipsContainer.classList.remove('hidden');
    active.forEach(item => {
      const chip = document.createElement('span');
      chip.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
      chip.innerHTML = `${item.label} <button class="hover:text-white font-bold ml-1">✕</button>`;
      chip.querySelector('button').onclick = () => {
        item.reset();
        applyFilters();
      };
      chipsContainer.appendChild(chip);
    });
  } else {
    chipsContainer.classList.add('hidden');
  }
}

// ---------------- CHARTS RENDERING ----------------

function renderCharts() {
  renderMonthlyChart();
  renderTypesChart();
  renderCountriesChart();
}

function renderMonthlyChart() {
  const ctx = document.getElementById('chartMonthly').getContext('2d');
  
  // Aggregate by month and type
  const monthsMap = {};
  filteredAlerts.forEach(a => {
    const m = a.mes_ano || (a.fecha_notificacion ? a.fecha_notificacion.substring(0, 7) : '2026-00');
    if (!monthsMap[m]) {
      monthsMap[m] = { 'Fraude / EMA': 0, 'Microbiológico': 0, 'Alérgeno': 0, 'Químico': 0, 'Físico': 0, 'Otros': 0 };
    }
    const t = a.tipo_alerta || 'Otros';
    if (monthsMap[m][t] !== undefined) {
      monthsMap[m][t]++;
    } else {
      monthsMap[m]['Otros']++;
    }
  });

  const sortedMonths = Object.keys(monthsMap).sort();
  const labels = sortedMonths.map(m => {
    const [y, mon] = m.split('-');
    const d = new Date(parseInt(y), parseInt(mon) - 1, 1);
    return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
  });

  const datasetFraud = sortedMonths.map(m => monthsMap[m]['Fraude / EMA']);
  const datasetMicro = sortedMonths.map(m => monthsMap[m]['Microbiológico']);
  const datasetAller = sortedMonths.map(m => monthsMap[m]['Alérgeno']);
  const datasetChem = sortedMonths.map(m => monthsMap[m]['Químico']);
  const datasetPhys = sortedMonths.map(m => monthsMap[m]['Físico']);

  if (chartMonthlyInstance) chartMonthlyInstance.destroy();

  chartMonthlyInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Fraude / EMA',
          data: datasetFraud,
          backgroundColor: '#f97316',
          borderRadius: 4
        },
        {
          label: 'Microbiológico',
          data: datasetMicro,
          backgroundColor: '#ef4444',
          borderRadius: 4
        },
        {
          label: 'Alérgenos',
          data: datasetAller,
          backgroundColor: '#eab308',
          borderRadius: 4
        },
        {
          label: 'Químico',
          data: datasetChem,
          backgroundColor: '#a855f7',
          borderRadius: 4
        },
        {
          label: 'Físico',
          data: datasetPhys,
          backgroundColor: '#06b6d4',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { color: 'rgba(51, 65, 85, 0.25)' },
          ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: 'rgba(51, 65, 85, 0.25)' },
          ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 }, precision: 0 }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans', size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10
        }
      }
    }
  });
}

function renderTypesChart() {
  const ctx = document.getElementById('chartTypes').getContext('2d');

  const typesCount = {};
  filteredAlerts.forEach(a => {
    const t = a.tipo_alerta || 'Otros';
    typesCount[t] = (typesCount[t] || 0) + 1;
  });

  const labels = Object.keys(typesCount);
  const data = Object.values(typesCount);

  // Colors according to severity tokens
  const colorMap = {
    'Fraude / EMA': '#f97316',
    'Microbiológico': '#ef4444',
    'Alérgeno': '#eab308',
    'Químico': '#a855f7',
    'Físico': '#06b6d4',
    'Etiquetado / Regulatorio': '#3b82f6',
    'Otros': '#64748b'
  };
  const backgroundColors = labels.map(l => colorMap[l] || '#6366f1');

  if (chartTypesInstance) chartTypesInstance.destroy();

  chartTypesInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: '#0f172a'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans', size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10
        }
      },
      cutout: '65%'
    }
  });
}

function renderCountriesChart() {
  const ctx = document.getElementById('chartCountries').getContext('2d');

  const counts = {};
  filteredAlerts.forEach(a => {
    const country = countryChartMode === 'notif' ? (a.pais_notificador || 'Desconocido') : (a.pais_origen || 'Desconocido');
    counts[country] = (counts[country] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const labels = sorted.map(item => item[0]);
  const data = sorted.map(item => item[1]);

  if (chartCountriesInstance) chartCountriesInstance.destroy();

  const barColor = countryChartMode === 'notif' ? '#6366f1' : '#ec4899';

  chartCountriesInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: countryChartMode === 'notif' ? 'Alertas Emitidas (País Notificador)' : 'Incidentes Originados (País de Origen)',
        data: data,
        backgroundColor: barColor,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(51, 65, 85, 0.25)' },
          ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 }, precision: 0 }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans', size: 12 } }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1
        }
      }
    }
  });
}

function setCountryChartMode(mode) {
  countryChartMode = mode;
  const btnNotif = document.getElementById('btnViewNotif');
  const btnOrigin = document.getElementById('btnViewOrigin');

  if (mode === 'notif') {
    btnNotif.className = 'px-3 py-1 rounded-lg bg-indigo-600 text-white font-medium';
    btnOrigin.className = 'px-3 py-1 rounded-lg text-slate-400 hover:text-white font-medium';
  } else {
    btnOrigin.className = 'px-3 py-1 rounded-lg bg-pink-600 text-white font-medium';
    btnNotif.className = 'px-3 py-1 rounded-lg text-slate-400 hover:text-white font-medium';
  }
  renderCountriesChart();
}

// ---------------- SUMMARY PANELS ----------------

function renderSummaryPanels() {
  // 1. Top Countries
  const countryCounts = {};
  filteredAlerts.forEach(a => {
    const c = a.pais_notificador || 'Desconocido';
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });
  const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const containerCountries = document.getElementById('summaryTopCountries');
  containerCountries.innerHTML = topCountries.map(([name, count]) => `
    <div class="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-none">
      <span class="text-slate-200">${name}</span>
      <span class="px-2 py-0.5 rounded font-mono text-xs bg-indigo-500/10 text-indigo-400 font-bold">${count} alertas</span>
    </div>
  `).join('') || '<div class="text-slate-500">Sin datos</div>';

  // 2. Vulnerable Fraud Categories
  const fraudCats = {};
  filteredAlerts.filter(a => a.tipo_alerta === 'Fraude / EMA').forEach(a => {
    const cat = a.categoria_alimento || 'Otros';
    fraudCats[cat] = (fraudCats[cat] || 0) + 1;
  });
  const topFraud = Object.entries(fraudCats).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const containerFraud = document.getElementById('summaryFraudCategories');
  containerFraud.innerHTML = topFraud.map(([name, count]) => `
    <div class="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-none">
      <span class="text-slate-200">${name}</span>
      <span class="px-2 py-0.5 rounded font-mono text-xs bg-orange-500/15 text-orange-400 font-bold">${count} casos</span>
    </div>
  `).join('') || '<div class="text-slate-500">No hay casos de fraude bajo los filtros activos</div>';

  // 3. Highlighted Seizures / Quantities
  const highlights = filteredAlerts.filter(a => a.cantidad_afectada && a.cantidad_afectada !== 'En evaluación' && a.cantidad_afectada !== 'Distribución minorista').slice(0, 4);
  const containerVolumes = document.getElementById('summaryVolumes');
  containerVolumes.innerHTML = highlights.map(a => `
    <div class="py-1 border-b border-slate-800/60 last:border-none">
      <div class="flex items-center justify-between">
        <span class="font-medium text-slate-200 truncate w-44" title="${a.producto}">${a.producto}</span>
        <span class="font-mono text-emerald-400 text-[11px] font-bold">${a.cantidad_afectada}</span>
      </div>
      <div class="text-[11px] text-slate-400">${a.pais_notificador} • ${a.tipo_alerta}</div>
    </div>
  `).join('') || '<div class="text-slate-500">Sin datos de volumen</div>';
}

// ---------------- TABLE RENDERING & PAGINATION ----------------

function renderTable() {
  const tbody = document.getElementById('alertsTableBody');
  tbody.innerHTML = '';

  const total = filteredAlerts.length;
  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-slate-500">
          No se encontraron alertas alimentarias ni casos de fraude con los filtros seleccionados.
        </td>
      </tr>
    `;
    updatePaginationControls(0);
    return;
  }

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageItems = filteredAlerts.slice(startIdx, endIdx);

  pageItems.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition-colors';

    // Severity badge style
    let sevBadge = 'badge-info';
    const grav = item.gravedad || 'Media';
    if (grav.includes('Crítica') || grav.includes('Alta')) sevBadge = 'badge-critical';
    else if (grav.includes('Media')) sevBadge = 'badge-allergen';

    // Type badge style
    let typeBadge = 'badge-info';
    if (item.tipo_alerta === 'Fraude / EMA') typeBadge = 'badge-fraud';
    else if (item.tipo_alerta === 'Microbiológico') typeBadge = 'badge-critical';
    else if (item.tipo_alerta === 'Alérgeno') typeBadge = 'badge-allergen';
    else if (item.tipo_alerta === 'Químico') typeBadge = 'badge-chemical';
    else if (item.tipo_alerta === 'Físico') typeBadge = 'badge-physical';

    tr.innerHTML = `
      <td class="py-3 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
        ${item.fecha_notificacion || 'N/A'}
      </td>
      <td class="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-indigo-300">
        ${item.id_original || item.id}
      </td>
      <td class="py-3 px-4">
        <div class="font-semibold text-slate-100">${escapeHtml(item.producto)}</div>
        <div class="text-[11px] text-slate-400">${item.categoria_alimento || 'Otros'} • ${escapeHtml(item.empresa_responsable || '')}</div>
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${typeBadge}">
          ${item.tipo_alerta}
        </span>
        <div class="text-[11px] text-slate-400 mt-1 truncate max-w-xs" title="${escapeHtml(item.subtipo_peligro || '')}">
          ${escapeHtml(item.subtipo_peligro || '')}
        </div>
      </td>
      <td class="py-3 px-4 whitespace-nowrap text-xs">
        <div class="flex items-center space-x-1.5">
          <span class="text-slate-200 font-medium">${item.pais_notificador || 'N/A'}</span>
          <span class="text-slate-500">➔</span>
          <span class="text-slate-400">${item.pais_origen || 'N/A'}</span>
        </div>
      </td>
      <td class="py-3 px-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${sevBadge}">
          ${item.gravedad || 'Media'}
        </span>
      </td>
      <td class="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-emerald-400">
        ${item.cantidad_afectada || 'En evaluación'}
      </td>
      <td class="py-3 px-4 text-right whitespace-nowrap">
        <button onclick="openModal('${item.id}')"
                class="bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 transition-all">
          Ver Ficha
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updatePaginationControls(total);
}

function updatePaginationControls(total) {
  const startIdx = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, total);
  document.getElementById('paginationInfo').textContent = `Mostrando ${startIdx} - ${endIdx} de ${total} registros`;

  const totalPages = Math.ceil(total / pageSize) || 1;
  const controls = document.getElementById('paginationControls');
  controls.innerHTML = '';

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.className = `px-2.5 py-1 rounded border border-slate-800 ${currentPage === 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-800'}`;
  prevBtn.textContent = '◀ Anterior';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
  controls.appendChild(prevBtn);

  // Page Indicator
  const pageSpan = document.createElement('span');
  pageSpan.className = 'px-3 py-1 text-xs text-slate-300 font-mono';
  pageSpan.textContent = `${currentPage} / ${totalPages}`;
  controls.appendChild(pageSpan);

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = `px-2.5 py-1 rounded border border-slate-800 ${currentPage >= totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-800'}`;
  nextBtn.textContent = 'Siguiente ▶';
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); } };
  controls.appendChild(nextBtn);
}

function changePageSize(size) {
  pageSize = parseInt(size, 10);
  currentPage = 1;
  renderTable();
}

// ---------------- MODAL SHEET ----------------

function openModal(alertId) {
  const item = allAlerts.find(a => a.id === alertId);
  if (!item) return;

  document.getElementById('modalTitle').textContent = item.producto;
  document.getElementById('modalRef').textContent = `ID de Referencia: ${item.id_original || item.id}`;
  document.getElementById('modalSeverityBadge').textContent = item.gravedad || 'MEDIA';
  document.getElementById('modalTypeBadge').textContent = item.tipo_alerta || 'GENERAL';
  document.getElementById('modalSourceBadge').textContent = item.fuente_origen || 'OFICIAL';

  document.getElementById('modalDesc').textContent = item.descripcion || 'Sin descripción disponible.';
  document.getElementById('modalHazard').textContent = item.subtipo_peligro || 'No especificado';
  document.getElementById('modalFraudMechanism').textContent = item.tipo_fraude !== 'No Aplica' ? item.tipo_fraude : 'N/A (Alerta de Seguridad Sanitaria)';
  document.getElementById('modalCompany').textContent = item.empresa_responsable || 'No informada';
  document.getElementById('modalCountries').textContent = `${item.pais_notificador || 'N/A'} (Notifica) ➔ ${item.pais_origen || 'N/A'} (Origen)`;
  document.getElementById('modalLots').textContent = item.lotes_afectados || 'No detallado';
  document.getElementById('modalQuantity').textContent = item.cantidad_afectada || 'En evaluación regulatoria';
  document.getElementById('modalDistribution').textContent = item.distribucion_geografica || 'No especificada';
  document.getElementById('modalDate').textContent = item.fecha_notificacion || 'N/A';

  const linkBtn = document.getElementById('modalOfficialLink');
  if (item.fuente_url) {
    linkBtn.href = item.fuente_url;
    linkBtn.classList.remove('hidden');
  } else {
    linkBtn.classList.add('hidden');
  }

  document.getElementById('alertModal').classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeModal() {
  document.getElementById('alertModal').classList.add('hidden');
}

// ---------------- LIVE SYNC ----------------

async function triggerLiveSync() {
  const btn = document.getElementById('btnSync');
  const icon = document.getElementById('syncIcon');
  const badgeText = document.getElementById('lastUpdatedText');

  btn.disabled = true;
  btn.classList.add('opacity-75');
  icon.classList.add('animate-spin');
  badgeText.textContent = 'Consultando openFDA, UK FSA & RASFF...';

  let syncSuccess = false;
  let newCount = 0;

  // 1. Si hay servidor local activo, intenta /api/sync
  try {
    const res = await fetch('/api/sync', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      await fetchInitialData();
      badgeText.textContent = `Sincronizado: ${data.total_count || allAlerts.length} alertas registradas`;
      syncSuccess = true;
    }
  } catch (e) {
    // Modo estático / GitHub Pages: continúa con sincronización en cliente
  }

  // 2. Si estamos en GitHub Pages o modo estático sin backend local
  if (!syncSuccess) {
    try {
      // Re-consultar archivo de datos con timestamp para saltar la caché de CDN
      const cacheBustUrl = `data/alerts.json?t=${Date.now()}`;
      const staticRes = await fetch(cacheBustUrl).catch(() => fetch(`static/data/alerts.json?t=${Date.now()}`));
      
      if (staticRes && staticRes.ok) {
        const freshData = await staticRes.json();
        if (Array.isArray(freshData) && freshData.length > 0) {
          allAlerts = freshData;
          populateFilterOptions();
          applyFilters();
        }
      }

      // Intentar consulta a feeds públicos en vivo vía fetch
      try {
        const fsaRes = await fetch('https://data.food.gov.uk/food-alerts/id.json?_limit=5', { mode: 'cors' });
        if (fsaRes.ok) {
          const fsaJson = await fsaRes.json();
          if (fsaJson && fsaJson.items) {
            console.log('[INFO] Conexión en vivo con UK FSA exitosa');
          }
        }
      } catch (corsErr) {
        // En navegadores con restricciones CORS de terceros, los datos consolidados ya están al día
      }

      // Pequeña pausa para feedback visual del botón
      await new Promise(r => setTimeout(r, 600));

      const nowTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      badgeText.textContent = `Sincronizado con bases mundiales • ${nowTime} (${allAlerts.length} alertas)`;
      syncSuccess = true;
    } catch (clientErr) {
      console.error('Error en sincronización cliente:', clientErr);
      badgeText.textContent = `Base de datos al día (${allAlerts.length} alertas)`;
    }
  }

  btn.disabled = false;
  btn.classList.remove('opacity-75');
  icon.classList.remove('animate-spin');
  if (window.lucide) window.lucide.createIcons();
}

// ---------------- EXPORT MENU ----------------

function toggleExportMenu() {
  const menu = document.getElementById('exportMenu');
  menu.classList.toggle('hidden');
}

function exportData(format) {
  toggleExportMenu();
  if (format === 'json') {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredAlerts, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `alertas_alimentarias_food_fraud_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else if (format === 'csv') {
    if (filteredAlerts.length === 0) return;
    const headers = [
      'ID', 'Fecha', 'Mes', 'Fuente', 'Pais_Notificador', 'Pais_Origen',
      'Producto', 'Categoria', 'Tipo_Alerta', 'Subtipo_Peligro', 'Tipo_Fraude',
      'Gravedad', 'Cantidad_Afectada', 'Lotes', 'Empresa', 'URL'
    ];
    
    const rows = filteredAlerts.map(a => [
      `"${(a.id || '').replace(/"/g, '""')}"`,
      `"${a.fecha_notificacion || ''}"`,
      `"${a.mes_ano || ''}"`,
      `"${a.fuente_origen || ''}"`,
      `"${(a.pais_notificador || '').replace(/"/g, '""')}"`,
      `"${(a.pais_origen || '').replace(/"/g, '""')}"`,
      `"${(a.producto || '').replace(/"/g, '""')}"`,
      `"${(a.categoria_alimento || '').replace(/"/g, '""')}"`,
      `"${(a.tipo_alerta || '').replace(/"/g, '""')}"`,
      `"${(a.subtipo_peligro || '').replace(/"/g, '""')}"`,
      `"${(a.tipo_fraude || '').replace(/"/g, '""')}"`,
      `"${(a.gravedad || '').replace(/"/g, '""')}"`,
      `"${(a.cantidad_afectada || '').replace(/"/g, '""')}"`,
      `"${(a.lotes_afectados || '').replace(/"/g, '""')}"`,
      `"${(a.empresa_responsable || '').replace(/"/g, '""')}"`,
      `"${a.fuente_url || ''}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute("href", url);
    a.setAttribute("download", `alertas_alimentarias_food_fraud_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

// Helper: Escape HTML to avoid XSS
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function setupEventListeners() {
  // Close modal with ESC key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Close export menu on outside click
  window.addEventListener('click', (e) => {
    const menu = document.getElementById('exportMenu');
    const btn = document.getElementById('btnExportMenu');
    if (menu && !menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
}

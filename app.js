// Global State
let hourlyData = null; // Contains metadata and raw orders list
let selectedCoordinadores = new Set();
let selectedSupervisores = new Set();
let selectedAntiguedades = new Set();
let selectedHours = new Set();
let selectedDate = ""; // Stores currently selected HOY date
let relativeDates = { hoy: "", d1: "", d7: "", d14: "", d21: "" }; // Stores dynamic relative dates

// Date parser helper (Spanish date string -> Date object)
function parseSpanishDateJS(dateStr) {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim().toLowerCase();
  const months = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
  };
  const parts = cleanStr.replace(/[-/]/g, ' ').split(/\s+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].substring(0, 3);
    const month = months[monthStr];
    if (month === undefined) return null;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }
  return null;
}

// Date formatter helper (Date object -> Spanish date string)
function formatSpanishDateJS(date) {
  const day = date.getDate();
  const year = date.getFullYear();
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const month = monthNames[date.getMonth()];
  return `${day} ${month} ${year}`;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupDropdownDismiss();
});

// Close dropdowns when clicking outside
function setupDropdownDismiss() {
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".multiselect-dropdown")) {
      document.querySelectorAll(".options-container").forEach(el => {
        el.classList.add("hidden");
        el.parentElement.classList.remove("active");
      });
    }
  });
}

// Fetch data from processed JSON file
async function loadData() {
  try {
    const cb = Date.now();
    const res = await fetch(`data/hourly_metrics.json?v=${cb}`);
    hourlyData = await res.json();
    
    initializeFilters();
    renderHourlyDashboard();
  } catch (error) {
    console.error("Error loading JSON data:", error);
    const badge = document.getElementById("last-update-time");
    if (badge) {
      badge.textContent = "Error al cargar datos localmente.";
      badge.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
      badge.style.color = "var(--danger)";
    }
  }
}

// Toggle options display
window.toggleDropdown = function(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  const container = dropdown.querySelector(".options-container");
  const isHidden = container.classList.contains("hidden");
  
  // Close all other dropdowns
  document.querySelectorAll(".options-container").forEach(el => {
    el.classList.add("hidden");
    el.parentElement.classList.remove("active");
  });
  
  if (isHidden) {
    container.classList.remove("hidden");
    dropdown.classList.add("active");
  }
};

// Populate single-select date dropdown
function populateDateDropdownOptions(dateStrings, activeDateStr) {
  const container = document.getElementById("date-options");
  const label = document.getElementById("date-selected-label");
  if (!container || !label) return;
  
  container.innerHTML = "";
  label.textContent = activeDateStr;
  
  dateStrings.forEach(dStr => {
    const item = document.createElement("div");
    item.className = `option-item ${dStr === activeDateStr ? 'active' : ''}`;
    item.style.padding = "8px 12px";
    item.style.cursor = "pointer";
    item.style.color = "var(--text-main)";
    item.style.fontWeight = dStr === activeDateStr ? "700" : "500";
    item.style.backgroundColor = dStr === activeDateStr ? "rgba(8, 145, 178, 0.08)" : "transparent";
    item.textContent = dStr;
    
    item.onclick = () => {
      selectedDate = dStr;
      label.textContent = dStr;
      updateRelativeDates(dStr);
      
      container.querySelectorAll(".option-item").forEach(child => {
        child.style.backgroundColor = "transparent";
        child.style.fontWeight = "500";
      });
      item.style.backgroundColor = "rgba(8, 145, 178, 0.08)";
      item.style.fontWeight = "700";
      
      reinitializeHoursForNewDate();
      renderHourlyDashboard();
      
      container.classList.add("hidden");
      container.parentElement.classList.remove("active");
    };
    
    container.appendChild(item);
  });
}

function updateRelativeDates(dateStr) {
  const dt = parseSpanishDateJS(dateStr);
  if (!dt) return;
  
  const d1 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - 1);
  const d7 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - 7);
  const d14 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - 14);
  const d21 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - 21);
  
  relativeDates.hoy = dateStr;
  relativeDates.d1 = formatSpanishDateJS(d1);
  relativeDates.d7 = formatSpanishDateJS(d7);
  relativeDates.d14 = formatSpanishDateJS(d14);
  relativeDates.d21 = formatSpanishDateJS(d21);
}

function reinitializeHoursForNewDate() {
  const orders = hourlyData.orders;
  const hoyOrders = orders.filter(o => o.Fecha_Creacion === selectedDate);
  let latestHour = 13;
  if (hoyOrders.length > 0) {
    const maxHourInHoy = Math.max(...hoyOrders.map(o => o.Hora));
    if (maxHourInHoy >= 0 && maxHourInHoy <= 23) {
      const latestHourOrdersCount = hoyOrders.filter(o => o.Hora === maxHourInHoy).length;
      if (latestHourOrdersCount < 50 && maxHourInHoy > 0) {
        latestHour = maxHourInHoy - 1;
      } else {
        latestHour = maxHourInHoy;
      }
    }
  }
  
  const availableHours = [...new Set(orders.map(o => o.Hora))].filter(h => h >= 0 && h <= 23).sort((a,b) => a-b);
  selectedHours = new Set();
  availableHours.forEach(h => {
    if (h <= latestHour) {
      selectedHours.add(h);
    }
  });
  
  populateDropdownOptions("hour", availableHours, selectedHours, updateHourSelection, h => `${h.toString().padStart(2, '0')}:00 hrs`);
}

// Populate multiselect filters dynamically from raw orders list
function initializeFilters() {
  if (!hourlyData || !hourlyData.orders) return;
  
  const orders = hourlyData.orders;
  const campaignCoords = ['EVER MALCA', 'JOSÉ SOLORZANO', 'PIERO MEDINA'];
  const campaignOrders = orders.filter(o => campaignCoords.includes(o.COORDINADOR));
  
  // 0. Unique Dates (Filtered to last 30 days of max date)
  const allDates = [...new Set(orders.map(o => o.Fecha_Creacion))];
  const parsedDates = allDates.map(dStr => ({ str: dStr, date: parseSpanishDateJS(dStr) })).filter(d => d.date !== null);
  parsedDates.sort((a, b) => b.date - a.date); // Latest first
  
  if (parsedDates.length > 0) {
    const maxDate = parsedDates[0].date;
    const thirtyDaysAgo = new Date(maxDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const allowedDates = parsedDates.filter(d => d.date >= thirtyDaysAgo);
    
    selectedDate = allowedDates[0].str;
    populateDateDropdownOptions(allowedDates.map(d => d.str), selectedDate);
    updateRelativeDates(selectedDate);
  }
  
  // 1. Unique Coordinadores
  const coords = [...new Set(campaignOrders.map(o => o.COORDINADOR))].filter(Boolean).sort();
  selectedCoordinadores = new Set(coords);
  populateDropdownOptions("coord", coords, selectedCoordinadores, updateCoordinadorSelection);
  
  // 2. Unique Supervisores
  const sups = [...new Set(campaignOrders.map(o => o.SUPERVISOR))].filter(Boolean).sort();
  selectedSupervisores = new Set(sups);
  populateDropdownOptions("supervisor", sups, selectedSupervisores, updateSupervisorSelection);
  
  // 3. Unique Antigüedades
  const ants = [...new Set(campaignOrders.map(o => o.ANTIGÜEDAD))].filter(Boolean).sort();
  selectedAntiguedades = new Set(ants);
  populateDropdownOptions("antiguedad", ants, selectedAntiguedades, updateAntiguedadSelection);
  
  // 4. Hours (0 to 23 as options)
  const availableHours = [...new Set(orders.map(o => o.Hora))].filter(h => h >= 0 && h <= 23).sort((a,b) => a-b);
  
  // Determine default selected hours: by default, check all hours up to the latest hour with data in HOY
  let latestHour = 13; // default fallback
  const hoyOrders = orders.filter(o => o.Fecha_Creacion === selectedDate);
  if (hoyOrders.length > 0) {
    const maxHourInHoy = Math.max(...hoyOrders.map(o => o.Hora));
    if (maxHourInHoy >= 0 && maxHourInHoy <= 23) {
      // Check if this latest hour is ongoing (very few orders, e.g. < 50)
      const latestHourOrdersCount = hoyOrders.filter(o => o.Hora === maxHourInHoy).length;
      if (latestHourOrdersCount < 50 && maxHourInHoy > 0) {
        latestHour = maxHourInHoy - 1;
      } else {
        latestHour = maxHourInHoy;
      }
    }
  }
  
  // Check hours up to the latestHour by default
  selectedHours = new Set();
  availableHours.forEach(h => {
    if (h <= latestHour) {
      selectedHours.add(h);
    }
  });
  
  populateDropdownOptions("hour", availableHours, selectedHours, updateHourSelection, h => `${h.toString().padStart(2, '0')}:00 hrs`);
}

// Generate checkbox elements inside option container
function populateDropdownOptions(type, items, selectedSet, callback, labelFormatter = (val) => val) {
  const container = document.getElementById(`${type}-options`);
  if (!container) return;
  
  container.innerHTML = "";
  
  // "Seleccionar Todos" option
  const allItem = document.createElement("div");
  allItem.className = "option-item";
  const allChecked = selectedSet.size === items.length;
  allItem.innerHTML = `
    <input type="checkbox" id="all-${type}" ${allChecked ? 'checked' : ''}>
    <label for="all-${type}"><em>Seleccionar Todos</em></label>
  `;
  allItem.querySelector("input").addEventListener("change", (e) => {
    const checked = e.target.checked;
    if (checked) {
      items.forEach(item => selectedSet.add(item));
    } else {
      selectedSet.clear();
    }
    
    // Update individual checkboxes
    container.querySelectorAll(".individual-option").forEach(chk => {
      chk.checked = checked;
      if (checked) {
        chk.closest(".option-item").classList.add("selected");
      } else {
        chk.closest(".option-item").classList.remove("selected");
      }
    });
    
    callback();
  });
  container.appendChild(allItem);
  
  // Individual options
  items.forEach(item => {
    const isSelected = selectedSet.has(item);
    const optionDiv = document.createElement("div");
    optionDiv.className = `option-item ${isSelected ? 'selected' : ''}`;
    
    const optionId = `opt-${type}-${item.toString().replace(/\s+/g, '_')}`;
    optionDiv.innerHTML = `
      <input type="checkbox" class="individual-option" id="${optionId}" value="${item}" ${isSelected ? 'checked' : ''}>
      <label for="${optionId}">${labelFormatter(item)}</label>
    `;
    
    optionDiv.querySelector("input").addEventListener("change", (e) => {
      const val = e.target.value;
      // Convert to number if it's hour type
      const parsedVal = type === "hour" ? parseInt(val) : val;
      
      if (e.target.checked) {
        selectedSet.add(parsedVal);
        optionDiv.classList.add("selected");
      } else {
        selectedSet.delete(parsedVal);
        optionDiv.classList.remove("selected");
      }
      
      // Update the "Seleccionar Todos" checkbox
      const allChk = container.querySelector(`#all-${type}`);
      if (allChk) {
        allChk.checked = selectedSet.size === items.length;
      }
      
      callback();
    });
    
    container.appendChild(optionDiv);
  });
  
  updateDropdownLabel(type, selectedSet, items.length);
}

// Update the label text displayed on the closed select boxes
function updateDropdownLabel(type, selectedSet, totalCount) {
  const label = document.getElementById(`${type}-selected-label`);
  if (!label) return;
  
  if (selectedSet.size === 0) {
    label.textContent = "Ninguno seleccionado";
    label.style.color = "var(--danger)";
  } else if (selectedSet.size === totalCount) {
    if (type === "coord") label.textContent = "Todos los Líderes";
    else if (type === "hour") label.textContent = "Todas las Horas";
    else if (type === "supervisor") label.textContent = "Todos los Supervisores";
    else if (type === "antiguedad") label.textContent = "Todas las Antigüedades";
    label.style.color = "var(--text-main)";
  } else {
    let suffix = "seleccionado(s)";
    if (type === "coord") suffix = "Líder(es)";
    else if (type === "hour") suffix = "Hora(s)";
    else if (type === "supervisor") suffix = "Sup(s)";
    else if (type === "antiguedad") suffix = "Antig.";
    
    label.textContent = `${selectedSet.size} ${suffix}`;
    label.style.color = "var(--accent-cyan)";
  }
}

// Callback functions for selection changes
function updateCoordinadorSelection() {
  updateDropdownLabel("coord", selectedCoordinadores, [...new Set(hourlyData.orders.map(o => o.COORDINADOR))].filter(Boolean).length);
  renderHourlyDashboard();
}

function updateSupervisorSelection() {
  updateDropdownLabel("supervisor", selectedSupervisores, [...new Set(hourlyData.orders.map(o => o.SUPERVISOR))].filter(Boolean).length);
  renderHourlyDashboard();
}

function updateAntiguedadSelection() {
  updateDropdownLabel("antiguedad", selectedAntiguedades, [...new Set(hourlyData.orders.map(o => o.ANTIGÜEDAD))].filter(Boolean).length);
  renderHourlyDashboard();
}

function updateHourSelection() {
  const allHours = [...new Set(hourlyData.orders.map(o => o.Hora))].filter(h => h >= 9 && h <= 23);
  updateDropdownLabel("hour", selectedHours, allHours.length);
  renderHourlyDashboard();
}

// Trend formatting helpers
function formatVariation(hoy, prev) {
  if (prev === 0) {
    if (hoy === 0) {
      return `<div class="trend-container"><span class="trend-dot flat"></span><span class="trend-pct flat">0%</span></div>`;
    } else {
      return `<div class="trend-container"><span class="trend-dot up"></span><span class="trend-pct up">+100%</span></div>`;
    }
  }
  const diff = hoy - prev;
  const pct = (diff / prev) * 100;
  const sign = pct > 0 ? "+" : "";
  const colorClass = pct > 0 ? "up" : (pct < 0 ? "down" : "flat");
  const dotHtml = `<span class="trend-dot ${colorClass}"></span>`;
  return `<div class="trend-container">${dotHtml}<span class="trend-pct ${colorClass}">${sign}${pct.toFixed(0)}%</span></div>`;
}

function formatPercent(val, total) {
  if (total === 0) return "0.00%";
  const pct = (val / total) * 100;
  return `${pct.toFixed(2)}%`;
}

// Filter and Aggregate Data dynamically
function renderHourlyDashboard() {
  if (!hourlyData || !hourlyData.orders) return;
  
  const orders = hourlyData.orders;
  const meta = {
    ...hourlyData.metadata,
    hoy_date: relativeDates.hoy,
    d1_date: relativeDates.d1,
    d7_date: relativeDates.d7,
    d14_date: relativeDates.d14,
    d21_date: relativeDates.d21
  };
  
  // 1. Get current filter parameters
  // If hours is empty, we show 0. To make it cumulative, we filter where Hora <= max(selectedHours)
  const maxSelectedHour = selectedHours.size > 0 ? Math.max(...selectedHours) : -1;
  
  // Update Last Update Badge (shows maxSelectedHour + 1 to display the end of the hour range, e.g. 17:00 for hour 16)
  const updateBadge = document.getElementById("last-update-time");
  if (updateBadge) {
    const displayHour = maxSelectedHour >= 0 ? maxSelectedHour + 1 : -1;
    updateBadge.textContent = displayHour >= 0 ? `Corte Acumulado: ${displayHour.toString().padStart(2, '0')}:00 hrs | Actualizado: ${meta.last_update}` : "Ninguna hora de corte seleccionada";
  }
  
  // 2. Perform Filtering
  const filteredOrders = orders.filter(o => {
    // Cumulative hours filter
    if (o.Hora > maxSelectedHour) return false;
    
    // Coordinador filter
    if (!selectedCoordinadores.has(o.COORDINADOR)) return false;
    
    // Supervisor filter
    if (!selectedSupervisores.has(o.SUPERVISOR)) return false;
    
    // Antigüedad filter
    if (!selectedAntiguedades.has(o.ANTIGÜEDAD)) return false;
    
    return true;
  });
  
  // 3. Compute KPI Summary Cards (based on ALL orders in CSV up to the selected hour)
  const kpis = { hoy: 0, d1: 0, d7: 0, d14: 0, d21: 0 };
  let multipedidoHoy = 0;
  let expressHoy = 0;
  let pickupHoy = 0;
  
  orders.forEach(o => {
    if (o.Hora > maxSelectedHour) return;
    if (o.Fecha_Creacion === meta.hoy_date) {
      kpis.hoy++;
      if (o.Multilinea === 'SI') multipedidoHoy++;
      if (o.Tipo_Despacho_Detalle === 'EXPRES' || o.Tipo_Despacho_Detalle === 'EXPRESS') expressHoy++;
      if (o.Tipo_Despacho_Detalle === 'RETIRO EN TIENDA') pickupHoy++;
    }
    else if (o.Fecha_Creacion === meta.d1_date) kpis.d1++;
    else if (o.Fecha_Creacion === meta.d7_date) kpis.d7++;
    else if (o.Fecha_Creacion === meta.d14_date) kpis.d14++;
    else if (o.Fecha_Creacion === meta.d21_date) kpis.d21++;
  });
  
  // Compute Table Totals (the campaign coordinators subtotal)
  const tableTotals = { hoy: 0, d1: 0, d7: 0, d14: 0, d21: 0 };
  filteredOrders.forEach(o => {
    if (o.Fecha_Creacion === meta.hoy_date) tableTotals.hoy++;
    else if (o.Fecha_Creacion === meta.d1_date) tableTotals.d1++;
    else if (o.Fecha_Creacion === meta.d7_date) tableTotals.d7++;
    else if (o.Fecha_Creacion === meta.d14_date) tableTotals.d14++;
    else if (o.Fecha_Creacion === meta.d21_date) tableTotals.d21++;
  });
  
  // Projection formula: during work hours (9am to 5pm, <= 9 hrs), extrapolate to 9 hrs.
  // After 17:00 hrs (when 9 work hours completed), projection equals actual Hoy volume.
  let proyeccHoy = kpis.hoy;
  if (maxSelectedHour >= 9 && maxSelectedHour < 17) {
    const horasTrabajadas = Math.max(1, maxSelectedHour - 9 + 1);
    proyeccHoy = Math.round((kpis.hoy / horasTrabajadas) * 9);
  }
  
  // Update Hoy main & mini grid values
  document.getElementById("kpi-hoy").textContent = kpis.hoy.toLocaleString();
  document.getElementById("kpi-date-hoy").textContent = `Fecha: ${meta.hoy_date}`;
  
  document.getElementById("mini-multipedido-pct").textContent = formatPercent(multipedidoHoy, kpis.hoy);
  document.getElementById("mini-multipedido-val").textContent = multipedidoHoy.toLocaleString() + " u.";
  
  document.getElementById("mini-express-pct").textContent = formatPercent(expressHoy, kpis.hoy);
  document.getElementById("mini-express-val").textContent = expressHoy.toLocaleString() + " u.";
  
  document.getElementById("mini-pickup-pct").textContent = formatPercent(pickupHoy, kpis.hoy);
  document.getElementById("mini-pickup-val").textContent = pickupHoy.toLocaleString() + " u.";
  
  document.getElementById("mini-proyecc-val").textContent = proyeccHoy.toLocaleString();
  
  // Update Historical D-x cards
  document.getElementById("kpi-d1").textContent = kpis.d1.toLocaleString();
  document.getElementById("kpi-var-d1").innerHTML = formatVariation(kpis.hoy, kpis.d1);
  document.getElementById("kpi-date-d1").textContent = meta.d1_date;
  
  document.getElementById("kpi-d7").textContent = kpis.d7.toLocaleString();
  document.getElementById("kpi-var-d7").innerHTML = formatVariation(kpis.hoy, kpis.d7);
  document.getElementById("kpi-date-d7").textContent = meta.d7_date;
  
  document.getElementById("kpi-d14").textContent = kpis.d14.toLocaleString();
  document.getElementById("kpi-var-d14").innerHTML = formatVariation(kpis.hoy, kpis.d14);
  document.getElementById("kpi-date-d14").textContent = meta.d14_date;
  
  document.getElementById("kpi-d21").textContent = kpis.d21.toLocaleString();
  document.getElementById("kpi-var-d21").innerHTML = formatVariation(kpis.hoy, kpis.d21);
  document.getElementById("kpi-date-d21").textContent = meta.d21_date;
  
  // Campaign Month-to-date (MTD) Metrics calculation
  // Find current selected date ISO
  const sampleHoyOrder = orders.find(o => o.Fecha_Creacion === meta.hoy_date);
  let cmpEfect = 0;
  let cmpActiv = 0;
  let cmpExpress = 0;
  let cmpPickup = 0;
  
  if (sampleHoyOrder && sampleHoyOrder.Fecha_Creacion_ISO) {
    const hoyIso = sampleHoyOrder.Fecha_Creacion_ISO; // e.g. "2026-07-20"
    const monthPrefix = hoyIso.substring(0, 8); // e.g. "2026-07-"
    
    // Compute D-1 ISO
    const parts = hoyIso.split('-');
    const parsedHoy = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const parsedD1 = new Date(parsedHoy.getFullYear(), parsedHoy.getMonth(), parsedHoy.getDate() - 1);
    const d1Iso = parsedD1.getFullYear() + "-" + 
                  (parsedD1.getMonth() + 1).toString().padStart(2, '0') + "-" + 
                  parsedD1.getDate().toString().padStart(2, '0');
                  
    // Subset 1: Campaign metrics up to D-1 (Outbound only, pactada <= D-1, creacion <= D-1)
    let subsetD1Total = 0;
    let subsetD1Entregado = 0;
    let subsetD1Cerradas = 0;
    
    // Subset 2: Monthly dispatch share up to selected hour of Hoy (Outbound only)
    let cmpTotalShare = 0;
    let cmpExpressShare = 0;
    let cmpPickupShare = 0;
    
    orders.forEach(o => {
      if (o.Grupo_Canal !== 'Outbound') return;
      if (!o.Fecha_Creacion_ISO || !o.Fecha_Creacion_ISO.startsWith(monthPrefix)) return;
      
      // Calculate dispatch share up to current selected hour of Hoy
      const isBeforeHoy = o.Fecha_Creacion_ISO < hoyIso;
      const isHoyAtOrBeforeHour = (o.Fecha_Creacion_ISO === hoyIso && o.Hora <= maxSelectedHour);
      if (isBeforeHoy || isHoyAtOrBeforeHour) {
        cmpTotalShare++;
        if (o.Tipo_Despacho_Detalle === 'EXPRES' || o.Tipo_Despacho_Detalle === 'EXPRESS') cmpExpressShare++;
        if (o.Tipo_Despacho_Detalle === 'RETIRO EN TIENDA') cmpPickupShare++;
      }
      
      // Calculate Campaign MTD Delivery and Actives ratios up to D-1
      if (o.Fecha_Creacion_ISO <= d1Iso && o.Fecha_Pactada_ISO && o.Fecha_Pactada_ISO <= d1Iso) {
        subsetD1Total++;
        if (o.Estado_T === 'Entregado') {
          subsetD1Entregado++;
          if (o.EOC_Estado === 'CERRADAS') {
            subsetD1Cerradas++;
          }
        }
      }
    });
    
    cmpEfect = subsetD1Total > 0 ? (subsetD1Entregado / subsetD1Total) * 100 : 0;
    cmpActiv = subsetD1Entregado > 0 ? (subsetD1Cerradas / subsetD1Entregado) * 100 : 0;
    cmpExpress = cmpTotalShare > 0 ? (cmpExpressShare / cmpTotalShare) * 100 : 0;
    cmpPickup = cmpTotalShare > 0 ? (cmpPickupShare / cmpTotalShare) * 100 : 0;
  }
  
  // Render Campaign Metrics
  document.getElementById("camp-efect-val").textContent = cmpEfect.toFixed(2) + "%";
  document.getElementById("camp-efect-bar").style.width = cmpEfect.toFixed(2) + "%";
  
  document.getElementById("camp-activ-val").textContent = cmpActiv.toFixed(2) + "%";
  document.getElementById("camp-activ-bar").style.width = cmpActiv.toFixed(2) + "%";
  
  document.getElementById("camp-express-val").textContent = cmpExpress.toFixed(2) + "%";
  document.getElementById("camp-express-bar").style.width = cmpExpress.toFixed(2) + "%";
  
  document.getElementById("camp-pickup-val").textContent = cmpPickup.toFixed(2) + "%";
  document.getElementById("camp-pickup-bar").style.width = cmpPickup.toFixed(2) + "%";
  
  // 4. Render Table 1: Cuartil
  const ccTbody = document.getElementById("hourly-cuartil-table-body");
  ccTbody.innerHTML = "";
  
  // Extract visible coordinators in selection
  const coordinatorsList = [...selectedCoordinadores].sort();
  
  coordinatorsList.forEach(coord => {
    const coordOrders = filteredOrders.filter(o => o.COORDINADOR === coord);
    if (coordOrders.length === 0 && selectedCoordinadores.size > 1) return; // skip if no data and showing all
    
    // Aggregates for bold row
    const coordSums = { hoy: 0, d1: 0, d7: 0, d14: 0, d21: 0 };
    coordOrders.forEach(o => {
      if (o.Fecha_Creacion === meta.hoy_date) coordSums.hoy++;
      else if (o.Fecha_Creacion === meta.d1_date) coordSums.d1++;
      else if (o.Fecha_Creacion === meta.d7_date) coordSums.d7++;
      else if (o.Fecha_Creacion === meta.d14_date) coordSums.d14++;
      else if (o.Fecha_Creacion === meta.d21_date) coordSums.d21++;
    });
    
    const groupId = `group-cc-${coord.replace(/\s+/g, '_')}`;
    const boldRow = document.createElement("tr");
    boldRow.className = "bold-row";
    boldRow.setAttribute("onclick", `toggleTableGroup('${groupId}', event)`);
    boldRow.innerHTML = `
      <td><span class="toggle-icon">▼</span>${coord}</td>
      <td>${coordSums.hoy}</td>
      <td style="color:var(--text-muted);">${coordSums.d1}</td>
      <td>${formatVariation(coordSums.hoy, coordSums.d1)}</td>
      <td style="color:var(--text-muted);">${coordSums.d7}</td>
      <td>${formatVariation(coordSums.hoy, coordSums.d7)}</td>
      <td style="color:var(--text-muted);">${coordSums.d14}</td>
      <td>${formatVariation(coordSums.hoy, coordSums.d14)}</td>
      <td style="color:var(--text-muted);">${coordSums.d21}</td>
      <td>${formatVariation(coordSums.hoy, coordSums.d21)}</td>
    `;
    ccTbody.appendChild(boldRow);
    
    // Sub-quartiles
    const quartils = ['Q1', 'Q2', 'Q3', 'Q4'];
    quartils.forEach(q => {
      const qOrders = coordOrders.filter(o => o.CUARTIL === q);
      const qSums = { hoy: 0, d1: 0, d7: 0, d14: 0, d21: 0 };
      qOrders.forEach(o => {
        if (o.Fecha_Creacion === meta.hoy_date) qSums.hoy++;
        else if (o.Fecha_Creacion === meta.d1_date) qSums.d1++;
        else if (o.Fecha_Creacion === meta.d7_date) qSums.d7++;
        else if (o.Fecha_Creacion === meta.d14_date) qSums.d14++;
        else if (o.Fecha_Creacion === meta.d21_date) qSums.d21++;
      });
      
      const subRow = document.createElement("tr");
      subRow.className = groupId;
      subRow.innerHTML = `
        <td style="padding-left: 2rem;">${q}</td>
        <td>${qSums.hoy}</td>
        <td style="color:var(--text-muted);">${qSums.d1}</td>
        <td>${formatVariation(qSums.hoy, qSums.d1)}</td>
        <td style="color:var(--text-muted);">${qSums.d7}</td>
        <td>${formatVariation(qSums.hoy, qSums.d7)}</td>
        <td style="color:var(--text-muted);">${qSums.d14}</td>
        <td>${formatVariation(qSums.hoy, qSums.d14)}</td>
        <td style="color:var(--text-muted);">${qSums.d21}</td>
        <td>${formatVariation(qSums.hoy, qSums.d21)}</td>
      `;
      ccTbody.appendChild(subRow);
    });
  });
  
  // Append TOTAL OPERACIÓN row for Table 1
  const ccTotalRow = document.createElement("tr");
  ccTotalRow.className = "bold-row";
  ccTotalRow.style.borderTop = "2px solid var(--text-main)";
  ccTotalRow.style.backgroundColor = "rgba(8, 145, 178, 0.08)";
  ccTotalRow.innerHTML = `
    <td>TOTAL OPERACIÓN</td>
    <td>${tableTotals.hoy}</td>
    <td style="color:var(--text-muted);">${tableTotals.d1}</td>
    <td>${formatVariation(tableTotals.hoy, tableTotals.d1)}</td>
    <td style="color:var(--text-muted);">${tableTotals.d7}</td>
    <td>${formatVariation(tableTotals.hoy, tableTotals.d7)}</td>
    <td style="color:var(--text-muted);">${tableTotals.d14}</td>
    <td>${formatVariation(tableTotals.hoy, tableTotals.d14)}</td>
    <td style="color:var(--text-muted);">${tableTotals.d21}</td>
    <td>${formatVariation(tableTotals.hoy, tableTotals.d21)}</td>
  `;
  ccTbody.appendChild(ccTotalRow);
  
  // 5. Render Table 2: Supervisor
  const csTbody = document.getElementById("hourly-supervisor-table-body");
  csTbody.innerHTML = "";
  
  coordinatorsList.forEach(coord => {
    const coordOrders = filteredOrders.filter(o => o.COORDINADOR === coord);
    if (coordOrders.length === 0 && selectedCoordinadores.size > 1) return;
    
    // Aggregates for bold row
    const coordSums = { hoy: 0, d1: 0, d7: 0, d14: 0, d21: 0 };
    coordOrders.forEach(o => {
      if (o.Fecha_Creacion === meta.hoy_date) coordSums.hoy++;
      else if (o.Fecha_Creacion === meta.d1_date) coordSums.d1++;
      else if (o.Fecha_Creacion === meta.d7_date) coordSums.d7++;
      else if (o.Fecha_Creacion === meta.d14_date) coordSums.d14++;
      else if (o.Fecha_Creacion === meta.d21_date) coordSums.d21++;
    });
    
    const groupId = `group-cs-${coord.replace(/\s+/g, '_')}`;
    const boldRow = document.createElement("tr");
    boldRow.className = "bold-row";
    boldRow.setAttribute("onclick", `toggleTableGroup('${groupId}', event)`);
    boldRow.innerHTML = `
      <td><span class="toggle-icon">▼</span>${coord}</td>
      <td>${coordSums.hoy}</td>
      <td style="color:var(--text-muted);">${coordSums.d1}</td>
      <td>${formatVariation(coordSums.hoy, coordSums.d1)}</td>
      <td style="color:var(--text-muted);">${coordSums.d7}</td>
      <td>${formatVariation(coordSums.hoy, coordSums.d7)}</td>
      <td style="color:var(--text-muted);">${coordSums.d14}</td>
      <td>${formatVariation(coordSums.hoy, coordSums.d14)}</td>
      <td style="color:var(--text-muted);">${coordSums.d21}</td>
      <td>${formatVariation(coordSums.hoy, coordSums.d21)}</td>
    `;
    csTbody.appendChild(boldRow);
    
    // Get supervisors for this coordinator that are checked
    const supsInCoord = [...new Set(coordOrders.map(o => o.SUPERVISOR))].filter(s => selectedSupervisores.has(s)).sort();
    
    // Calculate and sort supervisors by HOY DESC
    const supRows = supsInCoord.map(sup => {
      const supOrders = coordOrders.filter(o => o.SUPERVISOR === sup);
      const supSums = { hoy: 0, d1: 0, d7: 0, d14: 0, d21: 0 };
      supOrders.forEach(o => {
        if (o.Fecha_Creacion === meta.hoy_date) supSums.hoy++;
        else if (o.Fecha_Creacion === meta.d1_date) supSums.d1++;
        else if (o.Fecha_Creacion === meta.d7_date) supSums.d7++;
        else if (o.Fecha_Creacion === meta.d14_date) supSums.d14++;
        else if (o.Fecha_Creacion === meta.d21_date) supSums.d21++;
      });
      return { sup, ...supSums };
    }).sort((a, b) => b.hoy - a.hoy || a.sup.localeCompare(b.sup));
    
    supRows.forEach(item => {
      const subRow = document.createElement("tr");
      subRow.className = groupId;
      subRow.innerHTML = `
        <td style="padding-left: 2rem;">${item.sup}</td>
        <td>${item.hoy}</td>
        <td style="color:var(--text-muted);">${item.d1}</td>
        <td>${formatVariation(item.hoy, item.d1)}</td>
        <td style="color:var(--text-muted);">${item.d7}</td>
        <td>${formatVariation(item.hoy, item.d7)}</td>
        <td style="color:var(--text-muted);">${item.d14}</td>
        <td>${formatVariation(item.hoy, item.d14)}</td>
        <td style="color:var(--text-muted);">${item.d21}</td>
        <td>${formatVariation(item.hoy, item.d21)}</td>
      `;
      csTbody.appendChild(subRow);
    });
  });
  
  // Append TOTAL OPERACIÓN row for Table 2
  const csTotalRow = document.createElement("tr");
  csTotalRow.className = "bold-row";
  csTotalRow.style.borderTop = "2px solid var(--text-main)";
  csTotalRow.style.backgroundColor = "rgba(8, 145, 178, 0.08)";
  csTotalRow.innerHTML = `
    <td>TOTAL OPERACIÓN</td>
    <td>${tableTotals.hoy}</td>
    <td style="color:var(--text-muted);">${tableTotals.d1}</td>
    <td>${formatVariation(tableTotals.hoy, tableTotals.d1)}</td>
    <td style="color:var(--text-muted);">${tableTotals.d7}</td>
    <td>${formatVariation(tableTotals.hoy, tableTotals.d7)}</td>
    <td style="color:var(--text-muted);">${tableTotals.d14}</td>
    <td>${formatVariation(tableTotals.hoy, tableTotals.d14)}</td>
    <td style="color:var(--text-muted);">${tableTotals.d21}</td>
    <td>${formatVariation(tableTotals.hoy, tableTotals.d21)}</td>
  `;
  csTbody.appendChild(csTotalRow);
  
  // 6. Render Table 3: Participation (Hoy)
  const partTbody = document.getElementById("hourly-participation-table-body");
  partTbody.innerHTML = "";
  
  // Compute overall campaign averages for Hoy for semaphoring
  let overallExpress = 0, overallProg = 0, overallRetiro = 0;
  filteredOrders.forEach(o => {
    if (o.Fecha_Creacion === meta.hoy_date) {
      const type = (o.Tipo_Despacho_Detalle || "").toUpperCase();
      if (type === 'EXPRESS') overallExpress++;
      else if (type === 'PROGRAMADO') overallProg++;
      else if (type === 'RETIRO EN TIENDA') overallRetiro++;
    }
  });
  const overallTotal = overallExpress + overallProg + overallRetiro;
  const overallExpressAvg = overallTotal > 0 ? (overallExpress / overallTotal) * 100 : 0;

  // Semaphoring function for EXPRESS (arrows)
  function getExpressArrow(expressCount, totalCount) {
    if (totalCount === 0) return "";
    const pct = (expressCount / totalCount) * 100;
    if (pct > overallExpressAvg + 1.5) {
      return `<span style="color:var(--success); font-weight:bold; margin-right:6px; font-size:0.95rem; display:inline-block; width:12px;">▲</span>`;
    } else if (pct < overallExpressAvg - 1.5) {
      return `<span style="color:var(--danger); font-weight:bold; margin-right:6px; font-size:0.95rem; display:inline-block; width:12px;">▼</span>`;
    } else {
      return `<span style="color:var(--warning); font-weight:bold; margin-right:6px; font-size:0.95rem; display:inline-block; width:12px;">▶</span>`;
    }
  }

  // Heatmap function for RETIRO EN TIENDA (red shading)
  function getRetiroStyle(retiroCount, totalCount) {
    if (totalCount === 0) return 'style="text-align:center;"';
    const pct = (retiroCount / totalCount) * 100;
    if (pct > 0) {
      const opacity = Math.min(0.32, (pct / 35) * 0.32);
      return `style="text-align:center; background-color: rgba(220, 38, 38, ${opacity.toFixed(2)}); font-weight: 600; color: var(--text-main);"`;
    }
    return 'style="text-align:center;"';
  }
  
  coordinatorsList.forEach(coord => {
    // Only compile participation for HOY orders
    const coordHoyOrders = filteredOrders.filter(o => o.COORDINADOR === coord && o.Fecha_Creacion === meta.hoy_date);
    if (coordHoyOrders.length === 0 && selectedCoordinadores.size > 1) return;
    
    // Aggregates for coordinator
    let cExpress = 0, cProg = 0, cRetiro = 0;
    coordHoyOrders.forEach(o => {
      const type = (o.Tipo_Despacho_Detalle || "").toUpperCase();
      if (type === 'EXPRESS') cExpress++;
      else if (type === 'PROGRAMADO') cProg++;
      else if (type === 'RETIRO EN TIENDA') cRetiro++;
    });
    const cTotal = cExpress + cProg + cRetiro;
    
    const groupId = `group-part-${coord.replace(/\s+/g, '_')}`;
    const boldRow = document.createElement("tr");
    boldRow.className = "bold-row";
    boldRow.setAttribute("onclick", `toggleTableGroup('${groupId}', event)`);
    boldRow.innerHTML = `
      <td><span class="toggle-icon">▼</span>${coord}</td>
      <td style="text-align:center;">${formatPercent(cExpress, cTotal)}</td>
      <td style="text-align:center;">${formatPercent(cProg, cTotal)}</td>
      <td ${getRetiroStyle(cRetiro, cTotal)}>${formatPercent(cRetiro, cTotal)}</td>
    `;
    partTbody.appendChild(boldRow);
    
    // Supervisors participation
    const supsInCoord = [...new Set(coordHoyOrders.map(o => o.SUPERVISOR))].filter(s => selectedSupervisores.has(s)).sort();
    
    const supPartRows = supsInCoord.map(sup => {
      const supHoyOrders = coordHoyOrders.filter(o => o.SUPERVISOR === sup);
      let express = 0, programado = 0, retiro = 0;
      supHoyOrders.forEach(o => {
        const type = (o.Tipo_Despacho_Detalle || "").toUpperCase();
        if (type === 'EXPRESS') express++;
        else if (type === 'PROGRAMADO') programado++;
        else if (type === 'RETIRO EN TIENDA') retiro++;
      });
      const total = express + programado + retiro;
      return { sup, express, programado, retiro, total };
    }).sort((a, b) => b.total - a.total || a.sup.localeCompare(b.sup));
    
    supPartRows.forEach(item => {
      const subRow = document.createElement("tr");
      subRow.className = groupId;
      const arrow = getExpressArrow(item.express, item.total);
      subRow.innerHTML = `
        <td style="padding-left: 2rem; white-space: nowrap;">${item.sup}</td>
        <td style="text-align:center; white-space:nowrap;">${arrow} ${formatPercent(item.express, item.total)}</td>
        <td style="text-align:center;">${formatPercent(item.programado, item.total)}</td>
        <td ${getRetiroStyle(item.retiro, item.total)}>${formatPercent(item.retiro, item.total)}</td>
      `;
      partTbody.appendChild(subRow);
    });
  });

  // Append TOTAL OPERACIÓN row for Table 3
  const tTotalRow = document.createElement("tr");
  tTotalRow.className = "bold-row";
  tTotalRow.style.borderTop = "2px solid var(--text-main)";
  tTotalRow.style.backgroundColor = "rgba(8, 145, 178, 0.08)";
  
  let tExpress = 0, tProg = 0, tRetiro = 0;
  filteredOrders.forEach(o => {
    if (o.Fecha_Creacion === meta.hoy_date) {
      const type = (o.Tipo_Despacho_Detalle || "").toUpperCase();
      if (type === 'EXPRESS') tExpress++;
      else if (type === 'PROGRAMADO') tProg++;
      else if (type === 'RETIRO EN TIENDA') tRetiro++;
    }
  });
  const tTotal = tExpress + tProg + tRetiro;
  
  tTotalRow.innerHTML = `
    <td>TOTAL OPERACIÓN</td>
    <td style="text-align:center;">${formatPercent(tExpress, tTotal)}</td>
    <td style="text-align:center;">${formatPercent(tProg, tTotal)}</td>
    <td ${getRetiroStyle(tRetiro, tTotal)}>${formatPercent(tRetiro, tTotal)}</td>
  `;
  partTbody.appendChild(tTotalRow);

  // 7. Render Table 4: Avance por Cuartil (Solo Cuartiles)
  const quartilsList = ['Q1', 'Q2', 'Q3', 'Q4'];
  const qTbody = document.getElementById("hourly-only-cuartiles-table-body");
  if (qTbody) {
    qTbody.innerHTML = "";
    const table4Totals = { hoy: 0, d1: 0, d7: 0, d14: 0, d21: 0 };
    
    // Q1 to Q4 rows
    quartilsList.forEach(q => {
      const qOrders = orders.filter(o => o.Hora <= maxSelectedHour && o.CUARTIL === q);
      const qSums = { hoy: 0, d1: 0, d7: 0, d14: 0, d21: 0 };
      qOrders.forEach(o => {
        if (o.Fecha_Creacion === meta.hoy_date) qSums.hoy++;
        else if (o.Fecha_Creacion === meta.d1_date) qSums.d1++;
        else if (o.Fecha_Creacion === meta.d7_date) qSums.d7++;
        else if (o.Fecha_Creacion === meta.d14_date) qSums.d14++;
        else if (o.Fecha_Creacion === meta.d21_date) qSums.d21++;
      });
      
      table4Totals.hoy += qSums.hoy;
      table4Totals.d1 += qSums.d1;
      table4Totals.d7 += qSums.d7;
      table4Totals.d14 += qSums.d14;
      table4Totals.d21 += qSums.d21;
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-weight: 600; padding-left: 1rem;">${q}</td>
        <td>${qSums.hoy}</td>
        <td style="color:var(--text-muted);">${qSums.d1}</td>
        <td>${formatVariation(qSums.hoy, qSums.d1)}</td>
        <td style="color:var(--text-muted);">${qSums.d7}</td>
        <td>${formatVariation(qSums.hoy, qSums.d7)}</td>
        <td style="color:var(--text-muted);">${qSums.d14}</td>
        <td>${formatVariation(qSums.hoy, qSums.d14)}</td>
        <td style="color:var(--text-muted);">${qSums.d21}</td>
        <td>${formatVariation(qSums.hoy, qSums.d21)}</td>
      `;
      qTbody.appendChild(row);
    });
    
    // PLATAFORMA row (for orders that are not in Q1, Q2, Q3, Q4)
    const platOrders = orders.filter(o => o.Hora <= maxSelectedHour && !quartilsList.includes(o.CUARTIL));
    const platSums = { hoy: 0, d1: 0, d7: 0, d14: 0, d21: 0 };
    platOrders.forEach(o => {
      if (o.Fecha_Creacion === meta.hoy_date) platSums.hoy++;
      else if (o.Fecha_Creacion === meta.d1_date) platSums.d1++;
      else if (o.Fecha_Creacion === meta.d7_date) platSums.d7++;
      else if (o.Fecha_Creacion === meta.d14_date) platSums.d14++;
      else if (o.Fecha_Creacion === meta.d21_date) platSums.d21++;
    });
    
    table4Totals.hoy += platSums.hoy;
    table4Totals.d1 += platSums.d1;
    table4Totals.d7 += platSums.d7;
    table4Totals.d14 += platSums.d14;
    table4Totals.d21 += platSums.d21;
    
    const platRow = document.createElement("tr");
    platRow.innerHTML = `
      <td style="font-weight: 600; padding-left: 1rem;">PLATAFORMA</td>
      <td>${platSums.hoy}</td>
      <td style="color:var(--text-muted);">${platSums.d1}</td>
      <td>${formatVariation(platSums.hoy, platSums.d1)}</td>
      <td style="color:var(--text-muted);">${platSums.d7}</td>
      <td>${formatVariation(platSums.hoy, platSums.d7)}</td>
      <td style="color:var(--text-muted);">${platSums.d14}</td>
      <td>${formatVariation(platSums.hoy, platSums.d14)}</td>
      <td style="color:var(--text-muted);">${platSums.d21}</td>
      <td>${formatVariation(platSums.hoy, platSums.d21)}</td>
    `;
    qTbody.appendChild(platRow);
    
    // Append TOTAL GLOBAL row for Table 4 (matching global card totals)
    const qTotalRow = document.createElement("tr");
    qTotalRow.className = "bold-row";
    qTotalRow.style.borderTop = "2px solid var(--text-main)";
    qTotalRow.style.backgroundColor = "rgba(8, 145, 178, 0.08)";
    qTotalRow.innerHTML = `
      <td>TOTAL GLOBAL</td>
      <td>${table4Totals.hoy}</td>
      <td style="color:var(--text-muted);">${table4Totals.d1}</td>
      <td>${formatVariation(table4Totals.hoy, table4Totals.d1)}</td>
      <td style="color:var(--text-muted);">${table4Totals.d7}</td>
      <td>${formatVariation(table4Totals.hoy, table4Totals.d7)}</td>
      <td style="color:var(--text-muted);">${table4Totals.d14}</td>
      <td>${formatVariation(table4Totals.hoy, table4Totals.d14)}</td>
      <td style="color:var(--text-muted);">${table4Totals.d21}</td>
      <td>${formatVariation(table4Totals.hoy, table4Totals.d21)}</td>
    `;
    qTbody.appendChild(qTotalRow);
  }

  // 8. Render Table 5: Ingreso por Hora (Detalle)
  const ingTbody = document.getElementById("hourly-ingresos-table-body");
  if (ingTbody) {
    ingTbody.innerHTML = "";
    
    // Group definitions:
    // - 00:00 - 08:00 hrs
    // - 09:00 to 20:00 (individual)
    // - 21:00 - 23:00 hrs
    const rowsConfig = [
      { label: "00:00 - 08:00 hrs", hours: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
      { label: "09:00 hrs", hours: [9] },
      { label: "10:00 hrs", hours: [10] },
      { label: "11:00 hrs", hours: [11] },
      { label: "12:00 hrs", hours: [12] },
      { label: "13:00 hrs", hours: [13] },
      { label: "14:00 hrs", hours: [14] },
      { label: "15:00 hrs", hours: [15] },
      { label: "16:00 hrs", hours: [16] },
      { label: "17:00 hrs", hours: [17] },
      { label: "18:00 hrs", hours: [18] },
      { label: "19:00 hrs", hours: [19] },
      { label: "20:00 hrs", hours: [20] },
      { label: "21:00 - 23:00 hrs", hours: [21, 22, 23] }
    ];
    
    const globalTotals = { hoy: 0, d1: 0, d7: 0, d14: 0, d21: 0 };
    
    rowsConfig.forEach(rowConf => {
      // Filter hours by current checkbox selection
      const activeHours = rowConf.hours.filter(h => selectedHours.has(h));
      if (activeHours.length === 0) return; // Hide row if not selected in filter
      
      const rSums = { hoy: 0, d1: 0, d7: 0, d14: 0, d21: 0 };
      
      if (activeHours.length > 0) {
        // Use orders (unfiltered global orders) instead of filteredOrders
        const hOrders = orders.filter(o => activeHours.includes(o.Hora));
        hOrders.forEach(o => {
          if (o.Fecha_Creacion === meta.hoy_date) rSums.hoy++;
          else if (o.Fecha_Creacion === meta.d1_date) rSums.d1++;
          else if (o.Fecha_Creacion === meta.d7_date) rSums.d7++;
          else if (o.Fecha_Creacion === meta.d14_date) rSums.d14++;
          else if (o.Fecha_Creacion === meta.d21_date) rSums.d21++;
        });
      }
      
      // Accumulate totals
      globalTotals.hoy += rSums.hoy;
      globalTotals.d1 += rSums.d1;
      globalTotals.d7 += rSums.d7;
      globalTotals.d14 += rSums.d14;
      globalTotals.d21 += rSums.d21;
      
      // Render row
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 600; padding-left: 1rem;">${rowConf.label}</td>
        <td>${rSums.hoy}</td>
        <td style="color:var(--text-muted);">${rSums.d1}</td>
        <td>${formatVariation(rSums.hoy, rSums.d1)}</td>
        <td style="color:var(--text-muted);">${rSums.d7}</td>
        <td>${formatVariation(rSums.hoy, rSums.d7)}</td>
        <td style="color:var(--text-muted);">${rSums.d14}</td>
        <td>${formatVariation(rSums.hoy, rSums.d14)}</td>
        <td style="color:var(--text-muted);">${rSums.d21}</td>
        <td>${formatVariation(rSums.hoy, rSums.d21)}</td>
      `;
      ingTbody.appendChild(tr);
    });
    
    // Append TOTAL GLOBAL row for Table 5
    const globalTotalRow = document.createElement("tr");
    globalTotalRow.className = "bold-row";
    globalTotalRow.style.borderTop = "2px solid var(--text-main)";
    globalTotalRow.style.backgroundColor = "rgba(8, 145, 178, 0.08)";
    globalTotalRow.innerHTML = `
      <td>TOTAL GLOBAL</td>
      <td>${globalTotals.hoy}</td>
      <td style="color:var(--text-muted);">${globalTotals.d1}</td>
      <td>${formatVariation(globalTotals.hoy, globalTotals.d1)}</td>
      <td style="color:var(--text-muted);">${globalTotals.d7}</td>
      <td>${formatVariation(globalTotals.hoy, globalTotals.d7)}</td>
      <td style="color:var(--text-muted);">${globalTotals.d14}</td>
      <td>${formatVariation(globalTotals.hoy, globalTotals.d14)}</td>
      <td style="color:var(--text-muted);">${globalTotals.d21}</td>
      <td>${formatVariation(globalTotals.hoy, globalTotals.d21)}</td>
    `;
    ingTbody.appendChild(globalTotalRow);
  }
}

// Collapsible groups function
window.toggleTableGroup = function(groupId, event) {
  const boldRow = event.currentTarget;
  const isCollapsed = boldRow.classList.contains("collapsed");
  const subRows = document.querySelectorAll(`.${groupId}`);
  
  if (isCollapsed) {
    boldRow.classList.remove("collapsed");
    subRows.forEach(row => row.classList.remove("hidden-row"));
    boldRow.querySelector(".toggle-icon").textContent = "▼";
  } else {
    boldRow.classList.add("collapsed");
    subRows.forEach(row => row.classList.add("hidden-row"));
    boldRow.querySelector(".toggle-icon").textContent = "▶";
  }
};


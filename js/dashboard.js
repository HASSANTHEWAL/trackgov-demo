// dashboard.js
// The dashboard: a summary of the fleet today. Everything is calculated from the same data
// as the other pages: the simulation (positions, status, alerts) and the fuel report numbers.
// The status numbers, the small map and the "most driven" list update every few seconds.

const DASHBOARD_UPDATE_SECONDS = 5;

let miniMap = null;
const miniMarkers = []; // one marker per trip, same order as TRIPS

// ---------- greeting ----------

// "Thursday 29 October 2026" and "Good morning / afternoon / evening".
function fillGreeting() {
  const now = new Date();
  document.querySelector("#today-date").textContent = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  let greeting = "Good evening";
  if (now.getHours() < 12) {
    greeting = "Good morning";
  } else if (now.getHours() < 18) {
    greeting = "Good afternoon";
  }
  document.querySelector("#greeting").textContent = greeting;
}

// ---------- stat cards ----------

function buildCard(label, value, note, extraClass) {
  return `<div class="stat-card ${extraClass}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}

// The cards along the top. Called again on every update (the status numbers change).
function renderStats(counts, report, refuels) {
  let boughtLiters = 0;
  let spent = 0;
  report.forEach((row) => (boughtLiters += row.boughtLiters));
  refuels.forEach((refuel) => (spent += refuel.totalPrice));
  const alertCount = getAlertStops().length;
  const overCount = report.filter(isOverLimit).length;

  document.querySelector("#dashboard-stats").innerHTML =
    buildCard("Vehicles", VEHICLES.length, "in the pilot", "") +
    buildCard("Moving", counts.moving, "on the road now", "") +
    buildCard("Parked", counts.parked + counts.alert, "at a stop now", "") +
    buildCard("Offline", counts.offline, "before or after their trip", "") +
    buildCard("Alerts today", alertCount, "too long at a non-official place", alertCount > 0 ? "is-alert" : "") +
    buildCard("Fuel today", formatTwoDecimals(boughtLiters) + " L", formatRupiah(spent), "") +
    buildCard("Fuel over 5%", overCount, "vehicles bought too much", overCount > 0 ? "is-alert" : "");
}

// ---------- small map ----------

// The small dark map of Jogja with one dot per car (the same tiles and colors as the live map).
function createMiniMap() {
  miniMap = L.map("mini-map", { scrollWheelZoom: false }).setView([-7.795, 110.375], 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
      'routes by <a href="https://project-osrm.org">OSRM</a>',
  }).addTo(miniMap);
  TRIPS.forEach(function (trip) {
    const marker = L.circleMarker(PLACES[trip.placeKeys[0]], { radius: 6, weight: 2, color: "#050b14", fillOpacity: 1 });
    marker.bindTooltip(trip.plate, { direction: "top", offset: [0, -6] });
    marker.addTo(miniMap);
    miniMarkers.push(marker);
  });
  window.addEventListener("load", () => miniMap.invalidateSize());
}

// Moves the dots and colors them by status. The legend shows the counts.
function updateMiniMap(statuses, demoMinute, counts) {
  TRIPS.forEach(function (trip, index) {
    const time = Math.min(trip.totalTime, Math.max(0, getTripTimeAt(trip, demoMinute)));
    miniMarkers[index].setLatLng(getTripLatLng(trip, time));
    miniMarkers[index].setStyle({ fillColor: STATUS_COLORS[statuses[index]] });
  });
  let legend = "";
  Object.keys(counts).forEach(function (status) {
    legend += `<span><i class="status-dot status-${status}"></i>${counts[status]} ${STATUS_LABELS[status]}</span>`;
  });
  document.querySelector("#mini-legend").innerHTML = legend;
}

// ---------- latest alerts ----------

// One alert: when it started, which car, where and for how long.
function buildAlertItem(alert) {
  const trip = alert.trip;
  const stop = alert.stop;
  const minutes = Math.round((stop.leaveTime - stop.arriveTime) / 60);
  const place = escapeHtml(PLACES[stop.placeKey].name);
  return `<li>
    <span class="alert-time">${formatClock(getAlertStartMinute(trip, stop))}</span>
    <div>
      <strong>${trip.plate} · parked ${minutes} min</strong>
      <small>${place}, not an official location · ${escapeHtml(trip.driver)}, ${escapeHtml(trip.agency)}</small>
      <a href="trips.html?plate=${encodeURIComponent(trip.plate)}">View trip →</a>
    </div>
  </li>`;
}

// The alerts of today, the latest first.
function renderAlerts() {
  const alerts = getAlertStops();
  alerts.sort((alertA, alertB) => getAlertStartMinute(alertB.trip, alertB.stop) - getAlertStartMinute(alertA.trip, alertA.stop));
  let html = alerts.map(buildAlertItem).join("");
  if (alerts.length === 0) {
    html = "<li>No alerts today.</li>";
  }
  document.querySelector("#alert-list").innerHTML = html;
  document.querySelector("#alert-count").textContent = `${alerts.length} today`;
}

// ---------- fuel per agency (getFuelPerAgency is in js/fuel-data.js) ----------

// One bar: a colored part as wide as this value compared with the biggest value.
function buildBar(liters, biggestLiters, colorClass) {
  const widthPercent = (liters / biggestLiters) * 100;
  return `<div class="bar-row"><div class="bar-track"><div class="bar-fill ${colorClass}" style="width: ${widthPercent.toFixed(1)}%"></div></div><span class="bar-value">${formatTwoDecimals(liters)} L</span></div>`;
}

// Two bars per agency: expected (blue) and bought (teal, or red if over 5%).
function renderFuelPerAgency(report) {
  const agencies = getFuelPerAgency(report);
  let biggestLiters = 0;
  agencies.forEach(function (item) {
    biggestLiters = Math.max(biggestLiters, item.expectedLiters, item.boughtLiters);
  });
  let html = "";
  agencies.forEach(function (item) {
    const mismatch = getMismatchPercent(item.boughtLiters, item.expectedLiters);
    let boughtClass = "bar-bought";
    let mismatchClass = "";
    if (mismatch > MISMATCH_LIMIT_PERCENT) {
      boughtClass = "bar-over";
      mismatchClass = "is-over";
    }
    html += `<div>
      <div class="agency-name">${escapeHtml(item.agency)}<small class="${mismatchClass}">${formatPercent(mismatch)}</small></div>
      ${buildBar(item.expectedLiters, biggestLiters, "bar-expected")}
      ${buildBar(item.boughtLiters, biggestLiters, boughtClass)}
    </div>`;
  });
  document.querySelector("#agency-bars").innerHTML = html;
}

// ---------- most driven today ----------

// The 5 trips with the most km today, with their status right now.
function renderMostDriven(statuses) {
  const longestFirst = TRIPS.slice().sort((tripA, tripB) => tripB.totalDistance - tripA.totalDistance);
  let html = "";
  longestFirst.slice(0, 5).forEach(function (trip, rank) {
    const status = statuses[trip.index];
    html += `<li>
      <span class="active-rank">${rank + 1}</span>
      <div class="active-text"><strong>${trip.plate}</strong><small>${escapeHtml(trip.agency)} · ${escapeHtml(trip.model)}</small></div>
      <span class="status-pill status-${status}">${STATUS_LABELS[status]}</span>
      <span class="active-km">${formatOneDecimal(trip.totalDistance / 1000)} km</span>
    </li>`;
  });
  document.querySelector("#active-list").innerHTML = html;
}

// ---------- updating ----------

// The parts that change with the demo time: status numbers, the map and the list.
function updateDashboard() {
  const demoMinute = getDemoMinute();
  const statuses = getAllStatuses(demoMinute);
  const counts = countStatuses(statuses);
  const refuels = getTodaysRefuels();
  const report = buildFuelReport(refuels);
  document.querySelector("#demo-clock").textContent = formatClockWithSeconds(demoMinute);
  renderStats(counts, report, refuels);
  updateMiniMap(statuses, demoMinute, counts);
  renderMostDriven(statuses);
}

fillGreeting();
createMiniMap();
renderAlerts();
renderFuelPerAgency(buildFuelReport(getTodaysRefuels()));
updateDashboard();
setInterval(updateDashboard, DASHBOARD_UPDATE_SECONDS * 1000);

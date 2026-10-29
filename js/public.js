// public.js
// The public portal: no login, read-only, and NO driver names anywhere on this page
// (the charter: citizens may see what the fleet does, not who drives).
// The numbers come from the same simulation and fuel data as the staff pages.

const PUBLIC_UPDATE_SECONDS = 5;

let publicMap = null;
const publicMarkers = []; // one marker per trip, same order as TRIPS

// ---------- numbers along the top ----------

function buildPublicCard(label, value, note) {
  return `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}

// Total km of all trips today.
function getTotalKm() {
  let totalMeters = 0;
  TRIPS.forEach((trip) => (totalMeters += trip.totalDistance));
  return totalMeters / 1000;
}

function renderPublicStats(counts, report, refuels) {
  let boughtLiters = 0;
  let spent = 0;
  report.forEach((row) => (boughtLiters += row.boughtLiters));
  refuels.forEach((refuel) => (spent += refuel.totalPrice));
  const overCount = report.filter(isOverLimit).length;
  document.querySelector("#public-stats").innerHTML =
    buildPublicCard("Vehicles", VEHICLES.length, "in the pilot") +
    buildPublicCard("On the road", counts.moving + counts.parked + counts.alert, "driving or at a stop now") +
    buildPublicCard("Km driven", formatOneDecimal(getTotalKm()), "today, measured by GPS") +
    buildPublicCard("Fuel bought", formatTwoDecimals(boughtLiters) + " L", "today") +
    buildPublicCard("Fuel spending", formatRupiah(spent), "today") +
    buildPublicCard("Fuel checks", `${overCount} of ${report.length}`, "cars bought over 5% too much");
}

// ---------- the map (plate and agency only) ----------

function createPublicMap() {
  publicMap = L.map("public-map", { scrollWheelZoom: false }).setView([-7.795, 110.375], 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
      'routes by <a href="https://project-osrm.org">OSRM</a>',
  }).addTo(publicMap);
  TRIPS.forEach(function (trip) {
    const marker = L.circleMarker(PLACES[trip.placeKeys[0]], { radius: 6, weight: 2, color: "#050b14", fillOpacity: 1 });
    // Plate and agency only: the driver's name is never shown on the public page.
    marker.bindTooltip(`${trip.plate} · ${trip.agency}`, { direction: "top", offset: [0, -6] });
    marker.addTo(publicMap);
    publicMarkers.push(marker);
  });
  window.addEventListener("load", () => publicMap.invalidateSize());
}

function updatePublicMap(statuses, demoMinute, counts) {
  TRIPS.forEach(function (trip, index) {
    const time = Math.min(trip.totalTime, Math.max(0, getTripTimeAt(trip, demoMinute)));
    publicMarkers[index].setLatLng(getTripLatLng(trip, time));
    publicMarkers[index].setStyle({ fillColor: STATUS_COLORS[statuses[index]] });
  });
  let legend = "";
  Object.keys(counts).forEach(function (status) {
    legend += `<span><i class="status-dot status-${status}"></i>${counts[status]} ${STATUS_LABELS[status]}</span>`;
  });
  document.querySelector("#public-legend").innerHTML = legend;
}

// ---------- the agency table ----------

// Rupiah spent today per agency, from the refuels (each refuel has a plate; the plate gives the agency).
function getSpendPerAgency(refuels) {
  const spend = {};
  refuels.forEach(function (refuel) {
    const vehicle = VEHICLES.find((item) => item.plate === refuel.plate);
    if (vehicle) {
      spend[vehicle.agency] = (spend[vehicle.agency] || 0) + refuel.totalPrice;
    }
  });
  return spend;
}

// One row per agency: how many cars, km, fuel, money and how many cars are over 5%.
function renderAgencyTable(report, refuels) {
  const spend = getSpendPerAgency(refuels);
  let html = "";
  getFuelPerAgency(report).forEach(function (item) {
    const rows = report.filter((row) => row.agency === item.agency);
    let km = 0;
    rows.forEach((row) => (km += row.kmDriven));
    const overCount = rows.filter(isOverLimit).length;
    let check = `<span class="check-ok">OK</span>`;
    if (overCount > 0) {
      check = `<span class="check-over">${overCount} car(s) being checked</span>`;
    }
    html += `<tr>
      <td><strong>${escapeHtml(item.agency)}</strong></td>
      <td class="number">${rows.length}</td>
      <td class="number">${formatOneDecimal(km)} km</td>
      <td class="number">${formatTwoDecimals(item.boughtLiters)} L</td>
      <td class="number">${formatRupiah(spend[item.agency] || 0)}</td>
      <td>${check}</td>
    </tr>`;
  });
  document.querySelector("#agency-rows").innerHTML = html;
}

// ---------- updating ----------

function updatePublicPage() {
  const demoMinute = getDemoMinute();
  const statuses = getAllStatuses(demoMinute);
  const counts = countStatuses(statuses);
  const refuels = getTodaysRefuels();
  const report = buildFuelReport(refuels);
  document.querySelector("#demo-clock").textContent = formatClockWithSeconds(demoMinute);
  renderPublicStats(counts, report, refuels);
  updatePublicMap(statuses, demoMinute, counts);
}

createPublicMap();
renderAgencyTable(buildFuelReport(getTodaysRefuels()), getTodaysRefuels());
updatePublicPage();
setInterval(updatePublicPage, PUBLIC_UPDATE_SECONDS * 1000);

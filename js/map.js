// map.js
// The live map page: every car on a Leaflet map of Jogja, moving along its road route.
// Every few seconds we ask the simulation where each car is at the demo time
// (js/simulation.js) and move its marker. The list on the left can be searched and
// filtered by status. Clicking a car shows its details.

// How often the positions update. The project goal is "at least every 30 seconds".
const UPDATE_SECONDS = 5;

let liveMap = null;
const vehicleMarkers = []; // one Leaflet marker per trip, same order as TRIPS
let snapshots = []; // the latest status of every car, same order as TRIPS
let selectedTripIndex = -1; // -1 means no car is chosen
let selectedRouteLine = null; // the route of the chosen car, drawn on the map
let activeFilter = "all";
let lastUpdateMinute = 0;

// ---------- describing each car (getVehicleStatus is in js/simulation.js) ----------

// The next place the car is driving to: its next stop, or its office at the end.
function getNextPlaceName(trip, time) {
  const nextStop = trip.stops.find((stop) => stop.arriveTime > time);
  if (nextStop) {
    return PLACES[nextStop.placeKey].name;
  }
  return PLACES[trip.placeKeys[trip.placeKeys.length - 1]].name;
}

// One sentence about where the car is, for the details card.
function describeWhere(trip, time, status) {
  if (time <= 0) {
    return `At ${PLACES[trip.placeKeys[0]].name}. Leaves at ${formatClock(trip.startMinute)}.`;
  }
  if (time >= trip.totalTime) {
    const lastPlace = PLACES[trip.placeKeys[trip.placeKeys.length - 1]].name;
    return `Back at ${lastPlace} since ${formatClock(trip.startMinute + trip.totalTime / 60)}.`;
  }
  if (status === "moving") {
    return `Driving to ${getNextPlaceName(trip, time)}.`;
  }
  const stop = getStopAt(trip, time);
  const minutes = Math.round((time - stop.arriveTime) / 60);
  let where = `Parked at ${PLACES[stop.placeKey].name} for ${minutes} min`;
  if (!stop.official) {
    where += " (not an official location)";
  }
  return where + ".";
}

// Everything we show about one car at a demo time.
function getSnapshot(trip, demoMinute) {
  // Keep the time inside the trip, so a car that has not left yet is at its start point.
  const time = getTripTimeAt(trip, demoMinute);
  const timeInTrip = Math.min(trip.totalTime, Math.max(0, time));
  const state = getTripState(trip, timeInTrip);
  const status = getVehicleStatus(trip, time);
  let speed = 0;
  if (status === "moving") {
    speed = state.speed;
  }
  return {
    status: status,
    latLng: getTripLatLng(trip, timeInTrip),
    speed: speed,
    distanceKm: state.distance / 1000,
    fuelLiters: state.distance / 1000 / MODELS[trip.model].kmPerLiter,
    where: describeWhere(trip, time, status),
  };
}

// ---------- the map ----------

// Makes the Leaflet map, centered on Yogyakarta.
// We use the normal OpenStreetMap tiles (free, no API key) and make them dark
// with a CSS filter in css/map.css, so the map matches the navy look of the site.
function createMap() {
  liveMap = L.map("live-map").setView([-7.795, 110.375], 13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
      'routes by <a href="https://project-osrm.org">OSRM</a>',
  }).addTo(liveMap);
  // Leaflet measures the map box when it is made. Measure again once everything
  // (fonts, images) has loaded, in case the box changed size.
  window.addEventListener("load", () => liveMap.invalidateSize());
}

// One round marker per car. The tooltip shows the plate when you point at it.
function createMarkers() {
  TRIPS.forEach(function (trip, index) {
    const marker = L.circleMarker(PLACES[trip.placeKeys[0]], {
      radius: 7,
      weight: 2,
      color: "#050b14",
      fillOpacity: 1,
    });
    marker.bindTooltip(trip.plate, { direction: "top", offset: [0, -8] });
    marker.on("click", () => selectVehicle(index));
    marker.addTo(liveMap);
    vehicleMarkers.push(marker);
  });
}

// Moves each marker and gives it the color of its status. The chosen car is bigger, with a white ring.
function updateMarkers() {
  snapshots.forEach(function (snapshot, index) {
    const marker = vehicleMarkers[index];
    const isSelected = index === selectedTripIndex;
    marker.setLatLng(snapshot.latLng);
    marker.setStyle({
      fillColor: STATUS_COLORS[snapshot.status],
      radius: isSelected ? 10 : 7,
      color: isSelected ? "#ffffff" : "#050b14",
    });
    if (isSelected) {
      marker.bringToFront();
    }
  });
}

// Draws today's whole route of the chosen car as a faint teal line.
function showSelectedRoute() {
  if (selectedRouteLine) {
    selectedRouteLine.remove();
    selectedRouteLine = null;
  }
  if (selectedTripIndex === -1) {
    return;
  }
  const trip = TRIPS[selectedTripIndex];
  selectedRouteLine = L.polyline(trip.points, { color: "#16b8a6", weight: 3, opacity: 0.45 });
  selectedRouteLine.addTo(liveMap);
}

// ---------- the vehicle list ----------

// Makes one row per car. The rows are made once and then only updated,
// so the list does not jump or lose keyboard focus every few seconds.
function buildVehicleList() {
  let html = "";
  TRIPS.forEach(function (trip, index) {
    html += `<button class="vehicle-row" data-trip="${index}">
      <span class="status-dot"></span>
      <span class="vehicle-row-text"><strong>${trip.plate}</strong><small>${escapeHtml(trip.agency)} · ${escapeHtml(trip.driver)}</small></span>
      <span class="status-pill"></span>
    </button>`;
  });
  const list = document.querySelector("#vehicle-list");
  list.innerHTML = html;
  list.addEventListener("click", function (event) {
    const row = event.target.closest(".vehicle-row");
    if (row) {
      selectVehicle(Number(row.dataset.trip));
    }
  });
}

// True if the car matches the search text (plate, agency or driver) and the chosen status filter.
function matchesSearchAndFilter(trip, snapshot) {
  const searchText = document.querySelector("#vehicle-search").value.trim().toLowerCase();
  const carText = `${trip.plate} ${trip.agency} ${trip.driver}`.toLowerCase();
  const matchesSearch = carText.includes(searchText);
  const matchesFilter = activeFilter === "all" || snapshot.status === activeFilter;
  return matchesSearch && matchesFilter;
}

// Updates the status of each row, hides rows that do not match, and shows the counts.
function updateVehicleList() {
  const counts = { all: 0, moving: 0, parked: 0, alert: 0, offline: 0 };
  let shownRows = 0;
  document.querySelectorAll(".vehicle-row").forEach(function (row) {
    const index = Number(row.dataset.trip);
    const snapshot = snapshots[index];
    const statusClass = "status-" + snapshot.status;
    row.querySelector(".status-dot").className = "status-dot " + statusClass;
    const pill = row.querySelector(".status-pill");
    pill.className = "status-pill " + statusClass;
    pill.textContent = STATUS_LABELS[snapshot.status];
    row.classList.toggle("is-selected", index === selectedTripIndex);

    const visible = matchesSearchAndFilter(TRIPS[index], snapshot);
    row.hidden = !visible;
    if (visible) {
      shownRows++;
    }
    counts.all++;
    counts[snapshot.status]++;
  });
  Object.keys(counts).forEach(function (status) {
    document.querySelector("#count-" + status).textContent = counts[status];
  });
  document.querySelector("#no-results").hidden = shownRows > 0;
}

// The status filter buttons: All, Moving, Parked, Alert, Offline.
function setUpFilters() {
  const buttons = document.querySelectorAll(".filter-chip");
  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      activeFilter = button.dataset.status;
      buttons.forEach((other) => other.classList.toggle("is-active", other === button));
      updateVehicleList();
    });
  });
  document.querySelector("#vehicle-search").addEventListener("input", updateVehicleList);
}

// ---------- the details card ----------

// Builds the card of the chosen car (or hides it when no car is chosen).
// The card is built once per car. updateVehicleInfo() then only changes the values that move,
// so the buttons and the link keep working and keep keyboard focus between updates.
function buildVehicleInfo() {
  const card = document.querySelector("#vehicle-info");
  if (selectedTripIndex === -1) {
    card.hidden = true;
    return;
  }
  const trip = TRIPS[selectedTripIndex];
  card.innerHTML = `
    <div class="info-top">
      <div><strong>${trip.plate}</strong><span>${escapeHtml(trip.model)}</span></div>
      <span class="status-pill" id="info-status"></span>
      <button class="info-close" id="info-close" aria-label="Close details">×</button>
    </div>
    <p class="info-where" id="info-where"></p>
    <dl class="info-details">
      <div><dt>Agency</dt><dd>${escapeHtml(trip.agency)}</dd></div>
      <div><dt>Driver</dt><dd>${escapeHtml(trip.driver)}</dd></div>
      <div><dt>Speed</dt><dd id="info-speed"></dd></div>
      <div><dt>Last update</dt><dd id="info-updated"></dd></div>
      <div><dt>Driven today</dt><dd id="info-distance"></dd></div>
      <div><dt>Fuel used today</dt><dd id="info-fuel"></dd></div>
    </dl>
    <p class="info-note">Fuel is estimated from the distance (${MODELS[trip.model].kmPerLiter} km/L for this model).</p>
    <a class="info-link" href="trips.html?plate=${encodeURIComponent(trip.plate)}">View today's trip →</a>`;
  card.hidden = false;
  document.querySelector("#info-close").addEventListener("click", () => selectVehicle(-1));
  updateVehicleInfo();
}

// Puts the latest status, place, speed, time, distance and fuel into the card.
function updateVehicleInfo() {
  if (selectedTripIndex === -1) {
    return;
  }
  const snapshot = snapshots[selectedTripIndex];
  const statusPill = document.querySelector("#info-status");
  statusPill.className = "status-pill status-" + snapshot.status;
  statusPill.textContent = STATUS_LABELS[snapshot.status];
  document.querySelector("#info-where").textContent = snapshot.where;
  document.querySelector("#info-speed").textContent = Math.round(snapshot.speed) + " km/h";
  document.querySelector("#info-updated").textContent = formatClockWithSeconds(lastUpdateMinute);
  document.querySelector("#info-distance").textContent = formatOneDecimal(snapshot.distanceKm) + " km";
  document.querySelector("#info-fuel").textContent = formatOneDecimal(snapshot.fuelLiters) + " L";
}

// Chooses a car (or no car, with -1): highlights it, shows its route and details,
// and moves the map to it.
function selectVehicle(tripIndex) {
  selectedTripIndex = tripIndex;
  showSelectedRoute();
  updateMarkers();
  updateVehicleList();
  buildVehicleInfo();
  if (tripIndex !== -1) {
    liveMap.panTo(snapshots[tripIndex].latLng);
  }
}

// ---------- updating everything ----------

// Asks the simulation where every car is now, then updates the map, list and card.
function updateVehicles() {
  lastUpdateMinute = getDemoMinute();
  snapshots = TRIPS.map((trip) => getSnapshot(trip, lastUpdateMinute));
  document.querySelector("#demo-clock").textContent = formatClockWithSeconds(lastUpdateMinute);
  updateMarkers();
  updateVehicleList();
  updateVehicleInfo();
}

// ---------- start ----------

createMap();
createMarkers();
buildVehicleList();
setUpFilters();
updateVehicles();
setInterval(updateVehicles, UPDATE_SECONDS * 1000);

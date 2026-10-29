// landing.js
// Fills in every number on the landing page from the demo data, so they always match
// the other pages: the hero counters and chips, the "Fleet overview" cards, and the
// "Fleet intelligence" panels (fuel per agency, latest trips, fuel check).
// Needs js/simulation.js and js/fuel-data.js. Must load before the hero counters start
// counting up, because main.js reads data-to when the loading screen ends.
// The landing page uses only the demo refuels (js/data/refuels.js), not refuels typed
// into this browser, so every visitor sees the same numbers.

// ---------- hero and Fleet overview ----------

// How many cars are out on their trip at a demo time.
function countActiveVehicles(demoMinute) {
  const activeTrips = TRIPS.filter((trip) => isOnTheRoad(trip, demoMinute));
  return activeTrips.length;
}

// The hero numbers count up from 0. main.js counts up to the number in data-to.
// We also set the text, because with "reduce motion" on, main.js shows the
// numbers straight away, before this file has run.
function setCounter(id, number) {
  const counter = document.querySelector(id);
  counter.dataset.to = number;
  counter.textContent = number;
}

// Puts the calculated numbers into the hero and the Fleet overview cards.
function fillLandingNumbers(demoMinute) {
  const vehicleCount = VEHICLES.length;
  const activeCount = countActiveVehicles(demoMinute);
  const tripCount = TRIPS.length; // one trip per vehicle today
  const alertCount = getAlertStops().length;

  setCounter("#hero-vehicles", vehicleCount);
  setCounter("#hero-active", activeCount);
  setCounter("#hero-alerts", alertCount);
  document.querySelector("#hero-alerts-chip").textContent = alertCount;

  document.querySelector("#fleet-vehicles").textContent = vehicleCount;
  document.querySelector("#fleet-active").textContent = activeCount;
  document.querySelector("#fleet-trips").textContent = tripCount;
  document.querySelector("#fleet-alerts").textContent = alertCount;
}

// The hero chip about one car: a car that is driving right now, with its speed.
// If no car is driving, it says how many are parked or back at their office.
function fillHeroCarChip(demoMinute) {
  const chip = document.querySelector("#hero-car-chip");
  const movingTrip = TRIPS.find((trip) => getVehicleStatus(trip, getTripTimeAt(trip, demoMinute)) === "moving");
  if (movingTrip) {
    const speed = getTripState(movingTrip, getTripTimeAt(movingTrip, demoMinute)).speed;
    chip.innerHTML = `${movingTrip.plate} · En route · <b>${Math.round(speed)} km/h</b>`;
    return;
  }
  const parkedCount = countActiveVehicles(demoMinute);
  chip.innerHTML = `No car driving · <b>${parkedCount} parked</b>`;
}

// ---------- Fleet intelligence ----------

// The tallest bar uses this much of the chart's height. Each bar shares its column with a label
// of up to 3 lines (a long agency name wraps), and if bar + label do not fit, the browser squeezes
// the bar and the heights stop matching the numbers. 65% leaves room for the label every time.
const TALLEST_BAR_PERCENT = 65;

// One bar per agency: liters of fuel bought today. The tallest bar is the agency that bought most.
// main.js grows each bar to its --h height when the panel scrolls into view.
function fillFuelBars(report) {
  const agencies = getFuelPerAgency(report);
  let biggestLiters = 0;
  agencies.forEach((item) => (biggestLiters = Math.max(biggestLiters, item.boughtLiters)));
  let html = "";
  const descriptions = [];
  agencies.forEach(function (item) {
    const heightPercent = (item.boughtLiters / biggestLiters) * TALLEST_BAR_PERCENT;
    html += `<div><i style="--h: ${heightPercent.toFixed(1)}%"></i>${escapeHtml(item.agency)}<br />${formatOneDecimal(item.boughtLiters)} L</div>`;
    descriptions.push(`${item.agency} ${formatOneDecimal(item.boughtLiters)} liters`);
  });
  const bars = document.querySelector("#fuel-bars");
  bars.innerHTML = html;
  bars.setAttribute("aria-label", "Fuel bought today per agency: " + descriptions.join(", "));
}

// The status cell of a trip in the "Latest trips" table.
function buildTripStatusCell(trip, demoMinute) {
  if (trip.stops.some(isAlertStop)) {
    return `<td class="warn">Flagged stop</td>`;
  }
  const time = getTripTimeAt(trip, demoMinute);
  if (time <= 0) {
    return `<td class="tag">Leaves ${formatClock(trip.startMinute)}</td>`;
  }
  if (time < trip.totalTime) {
    return `<td class="tag">On the road</td>`;
  }
  return `<td class="tag">Completed</td>`;
}

// The 3 trips that started most recently (or, early in the morning, the first 3 of the day).
function fillRecentTrips(demoMinute) {
  let trips = TRIPS.filter((trip) => trip.startMinute <= demoMinute);
  trips.sort((tripA, tripB) => tripB.startMinute - tripA.startMinute);
  if (trips.length === 0) {
    trips = TRIPS.slice().sort((tripA, tripB) => tripA.startMinute - tripB.startMinute);
  }
  let html = "";
  trips.slice(0, 3).forEach(function (trip) {
    const from = PLACES[trip.placeKeys[0]].name;
    const to = PLACES[trip.placeKeys[1]].name;
    html += `<tr><td>${trip.plate}</td><td>${escapeHtml(from)} → ${escapeHtml(to)}</td>${buildTripStatusCell(trip, demoMinute)}</tr>`;
  });
  document.querySelector("#recent-trips").innerHTML = html;
}

// The share of cars whose fuel bought is within 5% of what their GPS distance needs.
function fillFuelCheck(report) {
  const withinLimit = report.filter((row) => !isOverLimit(row)).length;
  const percent = Math.round((withinLimit / report.length) * 100);
  document.querySelector("#fuel-check-percent").textContent = percent + "%";
  document.querySelector("#fuel-check-bar").style.width = percent + "%";
  document.querySelector("#fuel-check-text").textContent =
    `Fuel check today: ${withinLimit} of ${report.length} cars bought no more than 5% extra fuel`;
  document.querySelector("#fuel-check-meter").setAttribute("aria-label", `${percent} percent of cars passed the fuel check`);
  document.querySelector("#hero-fuel-chip").textContent = getTotalBoughtLiters(report) + " L";
}

// All liters bought today, as text with one decimal.
function getTotalBoughtLiters(report) {
  let liters = 0;
  report.forEach((row) => (liters += row.boughtLiters));
  return formatOneDecimal(liters);
}

// ---------- start ----------

const landingDemoMinute = getDemoMinute();
// Only the demo refuels, so every visitor sees the same numbers (see the top of this file).
const landingFuelReport = buildFuelReport(REFUELS);
fillLandingNumbers(landingDemoMinute);
fillHeroCarChip(landingDemoMinute);
fillFuelBars(landingFuelReport);
fillRecentTrips(landingDemoMinute);
fillFuelCheck(landingFuelReport);

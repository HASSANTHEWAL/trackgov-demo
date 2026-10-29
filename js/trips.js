// trips.js
// The trip history page: the list of today's trips under the 3D trip track.
// The track itself is js/track.js (the same one as on the landing page).
// Clicking a trip in the list replays it in the track. Opening
// trips.html?plate=AB%201012%20XY starts on that car's trip (the live map links here).

// The route as place names: "Kantor Dinas PU → Kawasan Prambanan → Kantor Dinas PU".
function getRouteText(trip) {
  const names = trip.placeKeys.map((key) => PLACES[key].name);
  return names.join(" → ");
}

// True if the trip has a stop that breaks business rule 4.
function hasFlaggedStop(trip) {
  return trip.stops.some(isAlertStop);
}

// One row of the trip table.
function buildTripRow(trip) {
  let check = `<span class="status-pill status-moving">OK</span>`;
  let rowClass = "trip-row";
  if (hasFlaggedStop(trip)) {
    check = `<span class="status-pill status-alert">Flagged stop</span>`;
    rowClass += " is-flagged";
  }
  if (trip.index === currentTripIndex) {
    rowClass += " is-selected";
  }
  const leftClock = formatClock(trip.startMinute);
  const backClock = formatClock(trip.startMinute + trip.totalTime / 60);
  return `<tr class="${rowClass}" data-trip="${trip.index}" tabindex="0">
    <td><strong>${trip.plate}</strong><small>${escapeHtml(trip.agency)}</small></td>
    <td class="route-cell">${escapeHtml(getRouteText(trip))}</td>
    <td class="number">${leftClock}</td>
    <td class="number">${backClock}</td>
    <td class="number">${formatOneDecimal(trip.totalDistance / 1000)} km</td>
    <td class="number">${formatDuration(trip.totalTime)}</td>
    <td class="number">${trip.stops.length}</td>
    <td>${check}</td>
  </tr>`;
}

// True if the trip matches the search text and the "Only flagged stops" box.
function tripIsShown(trip) {
  const searchText = document.querySelector("#trip-search").value.trim().toLowerCase();
  const onlyFlagged = document.querySelector("#only-flagged").checked;
  const tripText = `${trip.plate} ${trip.agency} ${getRouteText(trip)}`.toLowerCase();
  if (onlyFlagged && !hasFlaggedStop(trip)) {
    return false;
  }
  return tripText.includes(searchText);
}

// Draws the table with the trips that match.
function renderTripTable() {
  const shownTrips = TRIPS.filter(tripIsShown);
  let html = shownTrips.map(buildTripRow).join("");
  if (shownTrips.length === 0) {
    html = `<tr><td colspan="8">No trips match.</td></tr>`;
  }
  document.querySelector("#trip-rows").innerHTML = html;
}

// Replays a trip from the list and scrolls up to the track.
function openTrip(row) {
  selectTrip(Number(row.dataset.trip), true);
  document.querySelector("#tg").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Rows can be opened with a click, or with Enter when the row has keyboard focus.
function setUpTripTable() {
  const rows = document.querySelector("#trip-rows");
  rows.addEventListener("click", function (event) {
    const row = event.target.closest(".trip-row");
    if (row) {
      openTrip(row);
    }
  });
  rows.addEventListener("keydown", function (event) {
    const row = event.target.closest(".trip-row");
    if (row && event.key === "Enter") {
      openTrip(row);
    }
  });
  document.querySelector("#trip-search").addEventListener("input", renderTripTable);
  document.querySelector("#only-flagged").addEventListener("change", renderTripTable);
  // When the trip changes in the track (chips, arrows), highlight it in the list too.
  document.addEventListener("tg-trip-change", renderTripTable);
}

// If the address has ?plate=..., start on that car's trip.
function openTripFromAddress() {
  const plate = new URLSearchParams(location.search).get("plate");
  const trip = TRIPS.find((item) => item.plate === plate);
  if (trip) {
    selectTrip(trip.index, false);
  }
}

setUpTripTable();
openTripFromAddress();
renderTripTable();

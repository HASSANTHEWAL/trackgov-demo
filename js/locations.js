// locations.js
// The official locations page (Admin only; js/common.js sends Supervisors away).
// Shows every place on a map as a circle: official (teal), added by an Admin (light teal)
// and not official (red, dashed). An Admin can add an official location. A stop inside its
// circle then counts as official on every page, so that stop no longer creates an alert.

let locationsMap = null;
let placeLayer = null; // all the circles, redrawn after every change
let previewCircle = null; // the circle of the location being typed in the form

// ---------- the map ----------

function createLocationsMap() {
  locationsMap = L.map("locations-map").setView([-7.795, 110.375], 13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(locationsMap);
  placeLayer = L.layerGroup().addTo(locationsMap);
  // Clicking the map puts that spot in the form.
  locationsMap.on("click", function (event) {
    document.querySelector("#location-lat").value = event.latlng.lat.toFixed(5);
    document.querySelector("#location-lng").value = event.latlng.lng.toFixed(5);
    updatePreview();
  });
  window.addEventListener("load", () => locationsMap.invalidateSize());
}

// One circle on the map with the place name when you point at it.
function addCircle(lat, lng, radiusMeters, style, tooltip) {
  const circle = L.circle([lat, lng], Object.assign({ radius: radiusMeters, weight: 2 }, style));
  circle.bindTooltip(tooltip);
  circle.addTo(placeLayer);
}

// Draws every place from places.js and every added location.
function drawPlaces() {
  placeLayer.clearLayers();
  Object.keys(PLACES).forEach(function (key) {
    const place = PLACES[key];
    if (place.official) {
      addCircle(place.lat, place.lng, OFFICIAL_RADIUS_METERS, { color: "#16b8a6", fillOpacity: 0.2 }, place.name);
    } else {
      addCircle(place.lat, place.lng, OFFICIAL_RADIUS_METERS, { color: "#f26363", dashArray: "6 6", fillOpacity: 0.05 }, `${place.name} (not official)`);
    }
  });
  getSavedLocations().forEach(function (location) {
    addCircle(location.lat, location.lng, location.radiusMeters, { color: "#7ff3e4", fillOpacity: 0.35 }, `${location.name} (added by Admin)`);
  });
}

// Shows the circle of the location being typed in the form, before it is saved.
function updatePreview() {
  const lat = Number(document.querySelector("#location-lat").value);
  const lng = Number(document.querySelector("#location-lng").value);
  const radius = Number(document.querySelector("#location-radius").value);
  if (previewCircle) {
    previewCircle.remove();
    previewCircle = null;
  }
  if (lat && lng && radius > 0) {
    previewCircle = L.circle([lat, lng], { radius: radius, color: "#ffffff", weight: 2, dashArray: "4 4", fillOpacity: 0.1 });
    previewCircle.addTo(locationsMap);
  }
}

// ---------- the lists ----------

// One row of a list: the name, a small note, and an optional button.
function buildLocationRow(name, note, button) {
  return `<li><span>${escapeHtml(name)}<small>${note}</small></span>${button}</li>`;
}

// The added locations (with Delete), the official places from places.js, and the
// non-official places (with "Make official", which fills the form).
function renderLists() {
  let addedRows = "";
  getSavedLocations().forEach(function (location) {
    // Only Admins can open this page, so every added location was added by an Admin.
    const note = `${location.radiusMeters} m radius · added by Admin`;
    addedRows += buildLocationRow(location.name, note, `<button class="link-button delete-button" data-delete="${location.id}">Delete</button>`);
  });
  if (addedRows === "") {
    addedRows = `<li><small>None yet. Add one with the form above.</small></li>`;
  }
  let officialRows = "";
  let unofficialRows = "";
  Object.keys(PLACES).forEach(function (key) {
    const place = PLACES[key];
    if (place.official) {
      officialRows += buildLocationRow(place.name, "From js/data/places.js", "");
    } else {
      unofficialRows += buildLocationRow(place.name, "Not official", `<button class="link-button" data-fill="${key}">Make official</button>`);
    }
  });
  document.querySelector("#location-lists").innerHTML = `
    <div class="location-group"><h3>Added by Admin</h3><ul class="location-list">${addedRows}</ul></div>
    <div class="location-group"><h3>Not official</h3><ul class="location-list">${unofficialRows}</ul></div>
    <div class="location-group"><h3>Official (from the data file)</h3><ul class="location-list">${officialRows}</ul></div>`;
}

// ---------- what a change does to the alerts ----------

// The ids of today's alerts right now.
function getAlertIds() {
  return getAlertStops().map((alert) => getAlertId(alert.trip, alert.stop));
}

// An alert id like "AB 1083 FD @ amplaz" as words: "AB 1083 FD at Ambarrukmo Plaza".
function describeAlertId(alertId) {
  const parts = alertId.split(" @ ");
  return parts[0] + " at " + PLACES[parts[1]].name;
}

// Turns "alerts before" and "alerts after" into a sentence, like
// "1 alert(s) no longer counted: AB 1083 FD at Ambarrukmo Plaza."
function describeAlertChange(before, after) {
  const removed = before.filter((id) => !after.includes(id));
  const added = after.filter((id) => !before.includes(id));
  if (removed.length > 0) {
    return ` ${removed.length} alert(s) no longer counted: ${removed.map(describeAlertId).join(", ")}.`;
  }
  if (added.length > 0) {
    return ` ${added.length} alert(s) are back: ${added.map(describeAlertId).join(", ")}.`;
  }
  return " No alert changed.";
}

// Applies the saved locations to all trips again, then redraws the map, lists and menu badge.
// Returns the sentence about what changed in the alerts.
function refreshAfterChange(alertsBefore) {
  applyOfficialLocations(getSavedLocations());
  drawPlaces();
  renderLists();
  updateAlertBadges();
  return describeAlertChange(alertsBefore, getAlertIds());
}

// ---------- the form ----------

// Shows a message under the form, green for success or red for an error.
function showLocationMessage(text, isError) {
  const message = document.querySelector("#location-message");
  message.textContent = text;
  message.classList.toggle("is-error", isError);
  message.classList.toggle("is-success", !isError);
}

// Reads the form. Returns a location, or a text with the problem.
function readLocationForm() {
  const name = document.querySelector("#location-name").value.trim();
  const lat = Number(document.querySelector("#location-lat").value);
  const lng = Number(document.querySelector("#location-lng").value);
  const radiusMeters = Number(document.querySelector("#location-radius").value);
  if (name === "") {
    return "Please give the location a name.";
  }
  // Number("") is 0, and 0,0 is in the ocean near Africa, so empty fields are caught here too.
  if (!(lat >= -90 && lat <= 90 && lat !== 0) || !(lng >= -180 && lng <= 180 && lng !== 0)) {
    return "Please pick the spot on the map, or type a latitude and longitude.";
  }
  if (!(radiusMeters >= 50 && radiusMeters <= 2000)) {
    return "The radius must be between 50 and 2000 meters.";
  }
  return { name: name, lat: lat, lng: lng, radiusMeters: radiusMeters, addedBy: getCurrentRole(), addedAt: new Date().toISOString() };
}

// Saves the new location, then shows what it did to the alerts.
function handleLocationSubmit(event) {
  event.preventDefault(); // stay on this page instead of reloading it
  const location = readLocationForm();
  if (typeof location === "string") {
    showLocationMessage(location, true);
    return;
  }
  const alertsBefore = getAlertIds();
  if (!saveLocation(location)) {
    showLocationMessage("This browser would not let us save. Try a normal (not private) window.", true);
    return;
  }
  const change = refreshAfterChange(alertsBefore);
  showLocationMessage(`Saved "${location.name}".${change}`, false);
  document.querySelector("#location-form").reset();
  updatePreview();
}

// "Make official" on a non-official place: put its name and spot in the form, and show it on the map.
function fillFormFromPlace(placeKey) {
  const place = PLACES[placeKey];
  document.querySelector("#location-name").value = place.name;
  document.querySelector("#location-lat").value = place.lat;
  document.querySelector("#location-lng").value = place.lng;
  document.querySelector("#location-radius").value = 200;
  updatePreview();
  locationsMap.setView([place.lat, place.lng], 15);
  showLocationMessage(`Check the circle on the map, then press "Add official location".`, false);
  document.querySelector("#location-name").focus();
}

// The Delete and Make official buttons in the lists.
function handleListClick(event) {
  const deleteButton = event.target.closest("[data-delete]");
  const fillButton = event.target.closest("[data-fill]");
  if (deleteButton) {
    const alertsBefore = getAlertIds();
    deleteSavedLocation(Number(deleteButton.dataset.delete));
    showLocationMessage("Location deleted." + refreshAfterChange(alertsBefore), false);
  }
  if (fillButton) {
    fillFormFromPlace(fillButton.dataset.fill);
  }
}

function setUpLocationForm() {
  document.querySelector("#location-form").addEventListener("submit", handleLocationSubmit);
  ["#location-lat", "#location-lng", "#location-radius"].forEach(function (selector) {
    document.querySelector(selector).addEventListener("input", updatePreview);
  });
  document.querySelector("#location-lists").addEventListener("click", handleListClick);
}

// ---------- start ----------

createLocationsMap();
drawPlaces();
renderLists();
setUpLocationForm();

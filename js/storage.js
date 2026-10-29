// storage.js
// The ONLY file that reads and writes localStorage (things users enter in the demo).
// When the backend is ready, only this file changes: each function will use fetch()
// to talk to the server instead, and the pages that call these functions stay the same.

// The names under which we save each list in localStorage.
const STORAGE_KEYS = {
  refuels: "trackgov.refuels",
  role: "trackgov.role",
  alertDecisions: "trackgov.alertDecisions",
  locations: "trackgov.officialLocations",
  vehicles: "trackgov.vehicles",
};

// Reads a saved list. Returns an empty list if nothing is saved yet,
// or if the browser blocks storage (for example in some private windows).
function readList(key) {
  try {
    const text = localStorage.getItem(key);
    if (!text) {
      return [];
    }
    return JSON.parse(text);
  } catch (error) {
    return [];
  }
}

// Saves a list. Returns false if the browser would not let us save.
function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch (error) {
    return false;
  }
}

// ---------- the logged-in role (demo login, no passwords) ----------

// "admin", "supervisor", or "" when nobody is logged in.
function getCurrentRole() {
  try {
    return localStorage.getItem(STORAGE_KEYS.role) || "";
  } catch (error) {
    return "";
  }
}

// Remembers the role chosen on the login page. Returns false if it could not be saved.
function saveCurrentRole(role) {
  try {
    localStorage.setItem(STORAGE_KEYS.role, role);
    return true;
  } catch (error) {
    return false;
  }
}

// Logs out.
function clearCurrentRole() {
  try {
    localStorage.removeItem(STORAGE_KEYS.role);
  } catch (error) {
    // Nothing to do: if storage is blocked, nobody was saved as logged in.
  }
}

// ---------- alert decisions (Mark reviewed / Dismiss) ----------

// All saved decisions as a list of { alertId, decision, decidedBy, decidedAt }.
// decision is "reviewed" or "dismissed". An alert without a decision is "new".
function getAlertDecisions() {
  return readList(STORAGE_KEYS.alertDecisions);
}

// The saved decision for one alert, or undefined if it is still new.
function getAlertDecision(alertId) {
  return getAlertDecisions().find((item) => item.alertId === alertId);
}

// Saves a decision for one alert (replacing an older one). Returns false if it could not be saved.
function saveAlertDecision(alertId, decision, decidedBy) {
  const decisions = getAlertDecisions().filter((item) => item.alertId !== alertId);
  decisions.push({ alertId: alertId, decision: decision, decidedBy: decidedBy, decidedAt: new Date().toISOString() });
  return writeList(STORAGE_KEYS.alertDecisions, decisions);
}

// Removes the decision, so the alert is new again.
function deleteAlertDecision(alertId) {
  const decisions = getAlertDecisions().filter((item) => item.alertId !== alertId);
  writeList(STORAGE_KEYS.alertDecisions, decisions);
}

// ---------- official locations added by an Admin ----------

// All added locations: { id, name, lat, lng, radiusMeters, addedBy, addedAt }.
function getSavedLocations() {
  return readList(STORAGE_KEYS.locations);
}

// Adds one official location. Returns false if it could not be saved.
function saveLocation(location) {
  const locations = getSavedLocations();
  location.id = Date.now();
  locations.push(location);
  return writeList(STORAGE_KEYS.locations, locations);
}

// Removes an added location by its id.
function deleteSavedLocation(id) {
  const locations = getSavedLocations().filter((location) => location.id !== id);
  writeList(STORAGE_KEYS.locations, locations);
}

// ---------- vehicles added by an Admin ----------

// All added vehicles: { id, plate, model, agency, driver, addedAt }.
// They have no GPS trip yet, so only the vehicles page shows them.
function getSavedVehicles() {
  return readList(STORAGE_KEYS.vehicles);
}

// Adds one vehicle. Returns false if it could not be saved.
function saveVehicle(vehicle) {
  const vehicles = getSavedVehicles();
  vehicle.id = Date.now();
  vehicles.push(vehicle);
  return writeList(STORAGE_KEYS.vehicles, vehicles);
}

// Removes an added vehicle by its id.
function deleteSavedVehicle(id) {
  const vehicles = getSavedVehicles().filter((vehicle) => vehicle.id !== id);
  writeList(STORAGE_KEYS.vehicles, vehicles);
}

// ---------- refuels ----------

// All refuels that users added with the refuel form.
function getSavedRefuels() {
  return readList(STORAGE_KEYS.refuels);
}

// Adds one refuel. Gives it an id (the time it was saved, in milliseconds) so it can be removed later.
// Returns false if it could not be saved.
function saveRefuel(refuel) {
  const refuels = getSavedRefuels();
  refuel.id = Date.now();
  refuels.push(refuel);
  return writeList(STORAGE_KEYS.refuels, refuels);
}

// Removes one refuel that a user added, by its id.
function deleteSavedRefuel(id) {
  const refuels = getSavedRefuels().filter((refuel) => refuel.id !== id);
  writeList(STORAGE_KEYS.refuels, refuels);
}

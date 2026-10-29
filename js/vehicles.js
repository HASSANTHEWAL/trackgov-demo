// vehicles.js
// The vehicles page: every vehicle of the pilot with its status right now (from the simulation),
// filters by agency and status, and (Admin only) a form to add a vehicle.
// Added vehicles are saved by js/storage.js. They have no GPS trip yet, so they show "No GPS yet".

const VEHICLES_UPDATE_SECONDS = 5;
const NO_GPS = "none"; // the status of an added vehicle without a tracker

// ---------- the list of rows ----------

// The pilot vehicles (with a trip) and the added ones (without), as one list.
// tripIndex is -1 for added vehicles, savedId is null for pilot vehicles.
function getAllVehicleRows() {
  const rows = TRIPS.map(function (trip) {
    return { plate: trip.plate, model: trip.model, agency: trip.agency, driver: trip.driver, tripIndex: trip.index, savedId: null };
  });
  getSavedVehicles().forEach(function (vehicle) {
    rows.push({ plate: vehicle.plate, model: vehicle.model, agency: vehicle.agency, driver: vehicle.driver, tripIndex: -1, savedId: vehicle.id });
  });
  return rows;
}

// The status of a vehicle right now: moving, parked, alert, offline, or "none" (no GPS yet).
// tripIndex is -1 for an added vehicle, which has no trip.
function getRowStatus(tripIndex, demoMinute) {
  if (tripIndex === -1) {
    return NO_GPS;
  }
  const trip = TRIPS[tripIndex];
  return getVehicleStatus(trip, getTripTimeAt(trip, demoMinute));
}

// The text on the status label.
function getStatusLabel(status) {
  if (status === NO_GPS) {
    return "No GPS yet";
  }
  return STATUS_LABELS[status];
}

// ---------- the table ----------

// The last cell: a link to today's trip, or Delete for an added vehicle (Admins only).
function buildRowActions(row) {
  if (row.tripIndex !== -1) {
    return `<a href="trips.html?plate=${encodeURIComponent(row.plate)}">Trip →</a>`;
  }
  if (isAdmin()) {
    return `<button class="link-button delete-button" data-delete="${row.savedId}">Delete</button>`;
  }
  return "";
}

// One table row. The status label is filled by updateStatuses().
function buildVehicleRow(row) {
  let km = "–";
  const kmPerLiter = MODELS[row.model].kmPerLiter;
  if (row.tripIndex !== -1) {
    km = formatOneDecimal(TRIPS[row.tripIndex].totalDistance / 1000) + " km";
  }
  return `<tr data-plate="${row.plate}" data-agency="${escapeHtml(row.agency)}" data-driver="${escapeHtml(row.driver)}" data-trip="${row.tripIndex}">
    <td><strong>${row.plate}</strong><small>${escapeHtml(row.model)}</small></td>
    <td>${escapeHtml(row.agency)}</td>
    <td>${escapeHtml(row.driver)}</td>
    <td><span class="status-pill"></span></td>
    <td class="number">${km}</td>
    <td class="number">${kmPerLiter}</td>
    <td class="row-actions">${buildRowActions(row)}</td>
  </tr>`;
}

// Builds all rows. Called when the page opens and after a vehicle is added or deleted.
function renderVehicleTable() {
  document.querySelector("#vehicle-rows").innerHTML = getAllVehicleRows().map(buildVehicleRow).join("");
  updateStatuses();
}

// Puts the status of right now on every row, then shows only the rows that match the filters.
// Called every few seconds, so the rows (and their buttons) are not rebuilt.
function updateStatuses() {
  const demoMinute = getDemoMinute();
  document.querySelectorAll("#vehicle-rows tr").forEach(function (tableRow) {
    const status = getRowStatus(Number(tableRow.dataset.trip), demoMinute);
    tableRow.dataset.status = status;
    const pill = tableRow.querySelector(".status-pill");
    pill.className = "status-pill status-" + status;
    pill.textContent = getStatusLabel(status);
  });
  applyFilters();
}

// ---------- filters ----------

// Fills the agency and status filter lists.
function fillFilterOptions() {
  let agencyOptions = `<option value="all">All agencies</option>`;
  getAgencies().forEach((agency) => (agencyOptions += `<option>${escapeHtml(agency)}</option>`));
  document.querySelector("#agency-filter").innerHTML = agencyOptions;

  let statusOptions = `<option value="all">All statuses</option>`;
  Object.keys(STATUS_LABELS).forEach((status) => (statusOptions += `<option value="${status}">${STATUS_LABELS[status]}</option>`));
  statusOptions += `<option value="${NO_GPS}">No GPS yet</option>`;
  document.querySelector("#status-filter").innerHTML = statusOptions;
}

// Hides the rows that do not match the search text, agency and status, and shows the count.
function applyFilters() {
  const searchText = document.querySelector("#vehicle-search").value.trim().toLowerCase();
  const agency = document.querySelector("#agency-filter").value;
  const status = document.querySelector("#status-filter").value;
  let shown = 0;
  const tableRows = document.querySelectorAll("#vehicle-rows tr");
  tableRows.forEach(function (tableRow) {
    const rowText = `${tableRow.dataset.plate} ${tableRow.dataset.driver}`.toLowerCase();
    const matches =
      rowText.includes(searchText) &&
      (agency === "all" || tableRow.dataset.agency === agency) &&
      (status === "all" || tableRow.dataset.status === status);
    tableRow.hidden = !matches;
    if (matches) {
      shown++;
    }
  });
  document.querySelector("#vehicle-count").textContent = `· ${shown} of ${tableRows.length}`;
}

// ---------- adding a vehicle (Admin only) ----------

// True if every character of the text is a capital letter A to Z.
function isCapitalLetters(text) {
  if (text.length === 0) {
    return false;
  }
  for (let i = 0; i < text.length; i++) {
    if (text[i] < "A" || text[i] > "Z") {
      return false;
    }
  }
  return true;
}

// True if every character of the text is a digit 0 to 9.
function isDigits(text) {
  if (text.length === 0) {
    return false;
  }
  for (let i = 0; i < text.length; i++) {
    if (text[i] < "0" || text[i] > "9") {
      return false;
    }
  }
  return true;
}

// Indonesian plates look like "AB 1234 XY": 1–2 letters (region), 1–4 digits, 1–3 letters.
function isValidPlate(plate) {
  const parts = plate.split(" ");
  if (parts.length !== 3) {
    return false;
  }
  const regionOk = isCapitalLetters(parts[0]) && parts[0].length <= 2;
  const numberOk = isDigits(parts[1]) && parts[1].length <= 4;
  const lettersOk = isCapitalLetters(parts[2]) && parts[2].length <= 3;
  return regionOk && numberOk && lettersOk;
}

// Shows a message in the form, green for success or red for an error.
function showVehicleMessage(text, isError) {
  const message = document.querySelector("#vehicle-message");
  message.textContent = text;
  message.classList.toggle("is-error", isError);
  message.classList.toggle("is-success", !isError);
}

// Writes a typed plate the standard way: capital letters, one space between the parts.
// So "ab  1234 xy" becomes "AB 1234 XY".
function normalizePlate(typedPlate) {
  const capitals = typedPlate.trim().toUpperCase();
  const parts = capitals.split(" ").filter((part) => part !== "");
  return parts.join(" ");
}

// Reads the form. Returns a vehicle, or a text with the problem.
function readVehicleForm() {
  const plate = normalizePlate(document.querySelector("#vehicle-plate").value);
  const driver = document.querySelector("#vehicle-driver").value.trim();
  if (!isValidPlate(plate)) {
    return "The plate should look like AB 1234 XY.";
  }
  const plateTaken = getAllVehicleRows().some((row) => row.plate === plate);
  if (plateTaken) {
    return `${plate} is already in the list.`;
  }
  if (driver === "") {
    return "Please enter the driver's name.";
  }
  return {
    plate: plate,
    model: document.querySelector("#vehicle-model").value,
    agency: document.querySelector("#vehicle-agency").value,
    driver: driver,
    addedAt: new Date().toISOString(),
  };
}

function handleVehicleSubmit(event) {
  event.preventDefault(); // stay on this page instead of reloading it
  const vehicle = readVehicleForm();
  if (typeof vehicle === "string") {
    showVehicleMessage(vehicle, true);
    return;
  }
  if (!saveVehicle(vehicle)) {
    showVehicleMessage("This browser would not let us save. Try a normal (not private) window.", true);
    return;
  }
  renderVehicleTable();
  document.querySelector("#vehicle-form").reset();
  showVehicleMessage(`Saved ${vehicle.plate}. It shows "No GPS yet" until its tracker is connected.`, false);
}

// Opens or closes the add form.
function showAddForm(open) {
  document.querySelector("#add-vehicle-panel").hidden = !open;
  if (open) {
    showVehicleMessage("", false);
    document.querySelector("#vehicle-plate").focus();
  }
}

// The form is only set up for Admins. Supervisors never see the button.
function setUpAddVehicle() {
  if (!isAdmin()) {
    return;
  }
  const modelOptions = Object.keys(MODELS).map((model) => `<option>${escapeHtml(model)}</option>`);
  document.querySelector("#vehicle-model").innerHTML = modelOptions.join("");
  const agencyOptions = getAgencies().map((agency) => `<option>${escapeHtml(agency)}</option>`);
  document.querySelector("#vehicle-agency").innerHTML = agencyOptions.join("");
  const addButton = document.querySelector("#add-vehicle-button");
  addButton.hidden = false;
  addButton.addEventListener("click", () => showAddForm(true));
  document.querySelector("#cancel-vehicle").addEventListener("click", () => showAddForm(false));
  document.querySelector("#vehicle-form").addEventListener("submit", handleVehicleSubmit);
}

// Delete buttons on added vehicles (only Admins get them).
function handleTableClick(event) {
  const button = event.target.closest("[data-delete]");
  if (button && isAdmin()) {
    deleteSavedVehicle(Number(button.dataset.delete));
    renderVehicleTable();
  }
}

// ---------- start ----------

fillFilterOptions();
setUpAddVehicle();
document.querySelector("#vehicle-search").addEventListener("input", applyFilters);
document.querySelector("#agency-filter").addEventListener("change", applyFilters);
document.querySelector("#status-filter").addEventListener("change", applyFilters);
document.querySelector("#vehicle-rows").addEventListener("click", handleTableClick);
renderVehicleTable();
setInterval(updateStatuses, VEHICLES_UPDATE_SECONDS * 1000);

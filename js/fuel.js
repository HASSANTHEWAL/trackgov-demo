// fuel.js
// The fuel report page (business rule 3):
//   expectedLiters  = km driven (GPS) / normal km per liter of the model
//   mismatchPercent = (litersBought - expectedLiters) / expectedLiters * 100
// More than 5% extra shows in red. Liters bought come from the dummy refuels
// (js/data/refuels.js) plus the refuels users add with the form (saved by js/storage.js).
// The calculations are in js/fuel-data.js, so the dashboard can use them too.

// ---------- showing the report ----------

// One summary card. extraClass "is-alert" makes it red.
function buildStatCard(label, value, note, extraClass) {
  return `<div class="stat-card ${extraClass}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}

// The summary cards above the table.
function renderStats(report, refuels) {
  let totalBought = 0;
  let totalExpected = 0;
  let totalKm = 0;
  let totalPrice = 0;
  report.forEach(function (row) {
    totalBought += row.boughtLiters;
    totalExpected += row.expectedLiters;
    totalKm += row.kmDriven;
  });
  refuels.forEach((refuel) => (totalPrice += refuel.totalPrice));
  const overCount = report.filter(isOverLimit).length;
  let overClass = "";
  if (overCount > 0) {
    overClass = "is-alert";
  }

  document.querySelector("#fuel-stats").innerHTML =
    buildStatCard("Fuel bought", formatTwoDecimals(totalBought) + " L", `${refuels.length} refuels today`, "") +
    buildStatCard("Expected from GPS", formatTwoDecimals(totalExpected) + " L", `${formatOneDecimal(totalKm)} km driven`, "") +
    buildStatCard("Fleet km/L", formatOneDecimal(totalKm / totalBought), "km driven ÷ fuel bought", "") +
    buildStatCard("Spent today", formatRupiah(totalPrice), `Pertalite, ${formatRupiah(FUEL_PRICE_PER_LITER)}/L`, "") +
    buildStatCard("Over 5%", `${overCount} vehicles`, "Bought too much for the distance", overClass);
}

// The mismatch label of one row: green, red (over 5%) or "No refuel".
function buildMismatchLabel(row) {
  if (row.mismatchPercent === null) {
    return `<span class="mismatch is-missing">No refuel</span>`;
  }
  let overClass = "";
  if (isOverLimit(row)) {
    overClass = "is-over";
  }
  return `<span class="mismatch ${overClass}">${formatPercent(row.mismatchPercent)}</span>`;
}

// One table row.
function buildTableRow(row) {
  let rowClass = "";
  if (isOverLimit(row)) {
    rowClass = "is-over";
  }
  let actualKmPerLiter = "–";
  if (row.actualKmPerLiter !== null) {
    actualKmPerLiter = formatOneDecimal(row.actualKmPerLiter);
  }
  return `<tr class="${rowClass}">
    <td><strong>${row.plate}</strong><small>${escapeHtml(row.model)}</small></td>
    <td>${escapeHtml(row.agency)}</td>
    <td class="number">${formatOneDecimal(row.kmDriven)} km</td>
    <td class="number">${row.normalKmPerLiter}</td>
    <td class="number">${formatTwoDecimals(row.expectedLiters)} L</td>
    <td class="number">${formatTwoDecimals(row.boughtLiters)} L</td>
    <td class="number">${actualKmPerLiter}</td>
    <td class="number">${buildMismatchLabel(row)}</td>
  </tr>`;
}

// True if the row matches the search text and the "Only over 5%" box.
function rowIsShown(row) {
  const searchText = document.querySelector("#report-search").value.trim().toLowerCase();
  const onlyOver = document.querySelector("#only-over").checked;
  const rowText = `${row.plate} ${row.agency}`.toLowerCase();
  if (onlyOver && !isOverLimit(row)) {
    return false;
  }
  return rowText.includes(searchText);
}

// The table, with only the rows that match the search and filter.
function renderReportTable(report) {
  const shownRows = report.filter(rowIsShown);
  let html = shownRows.map(buildTableRow).join("");
  if (shownRows.length === 0) {
    html = `<tr><td colspan="8">No vehicles match.</td></tr>`;
  }
  document.querySelector("#report-rows").innerHTML = html;
}

// ---------- the refuel log ----------

// One refuel in the log. Refuels a user added have a Remove button.
function buildLogItem(refuel) {
  let itemClass = "";
  let removeButton = "";
  let station = refuel.station || "Station not given";
  if (refuel.isNew) {
    itemClass = "is-new";
    removeButton = `<button class="remove-button" data-id="${refuel.id}">Remove</button>`;
    station = "Added by you · " + station;
  }
  let receipt = "";
  if (refuel.receiptFile) {
    receipt = ` · Receipt: ${escapeHtml(refuel.receiptFile)}`;
  }
  return `<li class="${itemClass}">
    <div>
      <strong>${refuel.plate} · ${refuel.time}</strong>
      <small>${escapeHtml(station)} · Odometer ${refuel.odometerKm.toLocaleString("en-GB")} km${receipt}</small>
    </div>
    <div class="log-amount">
      <strong>${formatTwoDecimals(refuel.liters)} L</strong>
      <small>${formatRupiah(refuel.totalPrice)}</small>
      ${removeButton}
    </div>
  </li>`;
}

// The list of today's refuels, the latest first.
function renderRefuelLog(refuels) {
  const latestFirst = refuels.slice().sort((refuelA, refuelB) => refuelB.time.localeCompare(refuelA.time));
  document.querySelector("#refuel-log").innerHTML = latestFirst.map(buildLogItem).join("");
  const addedCount = refuels.filter((refuel) => refuel.isNew).length;
  document.querySelector("#log-summary").textContent =
    `${refuels.length} refuels today, ${addedCount} added with the form. Demo refuels come from js/data/refuels.js.`;
}

// ---------- redrawing the page ----------

// The latest report, kept so the search box and the CSV export can use it.
let currentReport = [];

// Recalculates everything (for example after a new refuel) and redraws the page.
function refreshPage() {
  const refuels = getTodaysRefuels();
  currentReport = buildFuelReport(refuels);
  renderStats(currentReport, refuels);
  renderReportTable(currentReport);
  renderRefuelLog(refuels);
}

// ---------- the refuel form ----------

// Fills the vehicle list of the form, and sets the time to now.
function setUpFormDefaults() {
  const options = VEHICLES.map((vehicle) => `<option value="${vehicle.plate}">${vehicle.plate} · ${escapeHtml(vehicle.model)}</option>`);
  document.querySelector("#refuel-plate").innerHTML = options.join("");
  const now = new Date();
  document.querySelector("#refuel-time").value = twoDigits(now.getHours()) + ":" + twoDigits(now.getMinutes());
}

// Shows a message under the form, green for success or red for an error.
function showFormMessage(text, isError) {
  const message = document.querySelector("#form-message");
  message.textContent = text;
  message.classList.toggle("is-error", isError);
  message.classList.toggle("is-success", !isError);
}

// Checks the required fields. Returns a text with the first problem, or "" if all is fine.
// (!(x > 0) is also true when the field is empty, because Number("") gives 0.)
function findFormProblem(time, liters, totalPrice, odometerKm) {
  if (!time) {
    return "Please enter the time of the refuel.";
  }
  if (!(liters > 0)) {
    return "Please enter how many liters were bought.";
  }
  if (!(totalPrice > 0)) {
    return "Please enter the total price from the receipt.";
  }
  if (!(odometerKm > 0)) {
    return "Please enter the odometer reading.";
  }
  return "";
}

// Reads the form into a refuel. Returns a text with the problem instead, if something is missing.
function readRefuelForm() {
  const liters = Number(document.querySelector("#refuel-liters").value);
  const totalPrice = Number(document.querySelector("#refuel-price").value);
  const odometerKm = Number(document.querySelector("#refuel-odometer").value);
  const time = document.querySelector("#refuel-time").value;
  const problem = findFormProblem(time, liters, totalPrice, odometerKm);
  if (problem) {
    return problem;
  }
  // We only keep the file name of the photo (see the note under the field).
  const receiptInput = document.querySelector("#refuel-receipt");
  let receiptFile = "";
  if (receiptInput.files.length > 0) {
    receiptFile = receiptInput.files[0].name;
  }
  return {
    plate: document.querySelector("#refuel-plate").value,
    date: getTodayDate(),
    time: time,
    liters: liters,
    totalPrice: totalPrice,
    odometerKm: odometerKm,
    station: document.querySelector("#refuel-station").value.trim(),
    receiptFile: receiptFile,
  };
}

// Saves the refuel when the form is sent, then redraws the report.
function handleRefuelSubmit(event) {
  event.preventDefault(); // stay on this page instead of reloading it
  const refuel = readRefuelForm();
  if (typeof refuel === "string") {
    showFormMessage(refuel, true);
    return;
  }
  if (!saveRefuel(refuel)) {
    showFormMessage("This browser would not let us save. Try a normal (not private) window.", true);
    return;
  }
  refreshPage();
  const row = currentReport.find((reportRow) => reportRow.plate === refuel.plate);
  showFormMessage(`Saved. ${refuel.plate} has now bought ${formatTwoDecimals(row.boughtLiters)} L today (${formatPercent(row.mismatchPercent)}).`, false);
  document.querySelector("#refuel-form").reset();
  setUpFormDefaults();
}

// When liters are typed and the price is still empty, suggest the price at the demo fuel price.
function suggestPrice() {
  const liters = Number(document.querySelector("#refuel-liters").value);
  const priceInput = document.querySelector("#refuel-price");
  if (liters > 0 && priceInput.dataset.typed !== "yes") {
    priceInput.value = Math.round(liters * FUEL_PRICE_PER_LITER);
  }
}

function setUpRefuelForm() {
  setUpFormDefaults();
  const form = document.querySelector("#refuel-form");
  form.addEventListener("submit", handleRefuelSubmit);
  document.querySelector("#refuel-liters").addEventListener("input", suggestPrice);
  // Once someone types a price themselves, stop suggesting one.
  const priceInput = document.querySelector("#refuel-price");
  priceInput.addEventListener("input", () => (priceInput.dataset.typed = "yes"));
  form.addEventListener("reset", () => (priceInput.dataset.typed = "no"));
}

// ---------- CSV export ----------

// One CSV cell. Text with a comma or a quote must be put in quotes, with quotes doubled.
function csvCell(value) {
  const text = String(value);
  if (text.includes(",") || text.includes('"')) {
    return '"' + text.replaceAll('"', '""') + '"';
  }
  return text;
}

// The report as CSV text: a header line, then one line per vehicle.
function buildCsv(report) {
  const lines = ["Plate,Model,Agency,Km driven,Normal km/L,Expected liters,Bought liters,Actual km/L,Mismatch %,Over 5%"];
  report.forEach(function (row) {
    let actualKmPerLiter = "";
    let mismatch = "";
    if (row.mismatchPercent !== null) {
      actualKmPerLiter = row.actualKmPerLiter.toFixed(2);
      mismatch = row.mismatchPercent.toFixed(1);
    }
    let over = "no";
    if (isOverLimit(row)) {
      over = "yes";
    }
    const cells = [row.plate, row.model, row.agency, row.kmDriven.toFixed(2), row.normalKmPerLiter, row.expectedLiters.toFixed(2), row.boughtLiters.toFixed(2), actualKmPerLiter, mismatch, over];
    lines.push(cells.map(csvCell).join(","));
  });
  return lines.join("\n");
}

// Downloads the report as a .csv file (opens in Excel or Google Sheets).
// We make the file in the browser and click a hidden download link.
function exportCsv() {
  const file = new Blob([buildCsv(currentReport)], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = `trackgov-fuel-report-${getTodayDate()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ---------- start ----------

// Remove buttons in the log (only on refuels a user added).
document.querySelector("#refuel-log").addEventListener("click", function (event) {
  const button = event.target.closest(".remove-button");
  if (button) {
    deleteSavedRefuel(Number(button.dataset.id));
    refreshPage();
  }
});
document.querySelector("#report-search").addEventListener("input", () => renderReportTable(currentReport));
document.querySelector("#only-over").addEventListener("change", () => renderReportTable(currentReport));
document.querySelector("#export-csv").addEventListener("click", exportCsv);
setUpRefuelForm();
refreshPage();

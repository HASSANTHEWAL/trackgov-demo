// fuel-data.js
// The fuel report calculations (business rule 3), used by the fuel page and the dashboard:
//   expectedLiters  = km driven (GPS) / normal km per liter of the model
//   mismatchPercent = (litersBought - expectedLiters) / expectedLiters * 100
// Needs js/data/refuels.js, js/simulation.js and js/storage.js.

// Business rule 3: more than this much extra fuel is a mismatch.
const MISMATCH_LIMIT_PERCENT = 5;

// ---------- collecting the refuels of the demo day ----------

// Today's date as text, like "2026-10-29" (the "en-CA" format writes dates this way).
function getTodayDate() {
  return new Date().toLocaleDateString("en-CA");
}

// All refuels of the demo day: the dummy ones, then the ones users added today.
// isNew marks the refuels a user added, so they can be shown and removed.
function getTodaysRefuels() {
  const refuels = REFUELS.map((refuel) => ({ ...refuel, isNew: false }));
  const today = getTodayDate();
  getSavedRefuels().forEach(function (refuel) {
    if (refuel.date === today) {
      refuels.push({ ...refuel, isNew: true });
    }
  });
  return refuels;
}

// ---------- the report numbers ----------

// How much more (or less) fuel was bought than the distance needs, in percent.
function getMismatchPercent(boughtLiters, expectedLiters) {
  return ((boughtLiters - expectedLiters) / expectedLiters) * 100;
}

// One report row per vehicle, calculated from its trip and its refuels.
function buildReportRow(trip, refuels) {
  const kmDriven = trip.totalDistance / 1000;
  const normalKmPerLiter = MODELS[trip.model].kmPerLiter;
  const expectedLiters = kmDriven / normalKmPerLiter;
  let boughtLiters = 0;
  refuels.forEach(function (refuel) {
    if (refuel.plate === trip.plate) {
      boughtLiters += refuel.liters;
    }
  });
  // A car without any refuel today has no km/L and no mismatch to show.
  let actualKmPerLiter = null;
  let mismatchPercent = null;
  if (boughtLiters > 0) {
    actualKmPerLiter = kmDriven / boughtLiters;
    mismatchPercent = getMismatchPercent(boughtLiters, expectedLiters);
  }
  return {
    plate: trip.plate,
    model: trip.model,
    agency: trip.agency,
    kmDriven: kmDriven,
    normalKmPerLiter: normalKmPerLiter,
    expectedLiters: expectedLiters,
    boughtLiters: boughtLiters,
    actualKmPerLiter: actualKmPerLiter,
    mismatchPercent: mismatchPercent,
  };
}

// True if this vehicle bought more than 5% too much fuel.
function isOverLimit(row) {
  return row.mismatchPercent !== null && row.mismatchPercent > MISMATCH_LIMIT_PERCENT;
}

// The whole report, with the biggest mismatch first (cars without a refuel at the end).
function buildFuelReport(refuels) {
  const report = TRIPS.map((trip) => buildReportRow(trip, refuels));
  report.sort(function (rowA, rowB) {
    let mismatchA = rowA.mismatchPercent;
    let mismatchB = rowB.mismatchPercent;
    if (mismatchA === null) {
      mismatchA = -Infinity;
    }
    if (mismatchB === null) {
      mismatchB = -Infinity;
    }
    return mismatchB - mismatchA;
  });
  return report;
}

// ---------- fuel per agency (used by the dashboard and the public portal) ----------
// (getAgencies is in js/simulation.js)

// Expected and bought liters added up for each agency.
function getFuelPerAgency(report) {
  return getAgencies().map(function (agency) {
    let expectedLiters = 0;
    let boughtLiters = 0;
    report.forEach(function (row) {
      if (row.agency === agency) {
        expectedLiters += row.expectedLiters;
        boughtLiters += row.boughtLiters;
      }
    });
    return { agency: agency, expectedLiters: expectedLiters, boughtLiters: boughtLiters };
  });
}

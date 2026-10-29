// alerts.js
// The alerts page (business rule 4): every stop of more than 30 minutes at a place that is
// not an official location. The alerts are calculated from the simulation (getAlertStops in
// js/simulation.js). What the Department Head decides (Mark reviewed / Dismiss) is saved by
// js/storage.js, so it is still there after a reload.

let activeTab = "new"; // "new", "reviewed" or "all"

// ---------- the alert list ----------

// Every alert of today with its saved decision, the latest first.
// state is "new", "reviewed" or "dismissed".
function getAlertsWithState() {
  const alerts = getAlertStops().map(function (alert) {
    const alertId = getAlertId(alert.trip, alert.stop);
    const decision = getAlertDecision(alertId);
    let state = "new";
    if (decision) {
      state = decision.decision;
    }
    return { id: alertId, trip: alert.trip, stop: alert.stop, decision: decision, state: state };
  });
  alerts.sort((alertA, alertB) => getAlertStartMinute(alertB.trip, alertB.stop) - getAlertStartMinute(alertA.trip, alertA.stop));
  return alerts;
}

// True if the alert belongs in the chosen tab. Dismissed alerts only show under "All".
function isInTab(alert, tab) {
  if (tab === "all") {
    return true;
  }
  return alert.state === tab;
}

// ---------- one alert card ----------

// The facts of the stop: when the car arrived and left, how long, and the car.
function buildAlertFacts(trip, stop) {
  const arrived = formatClock(trip.startMinute + stop.arriveTime / 60);
  const left = formatClock(trip.startMinute + stop.leaveTime / 60);
  return `<ul class="alert-facts">
      <li><span>Parked</span> ${arrived} – ${left}</li>
      <li><span>Car</span> ${escapeHtml(trip.model)}</li>
      <li><span>Driver</span> ${escapeHtml(trip.driver)}</li>
      <li><span>Agency</span> ${escapeHtml(trip.agency)}</li>
    </ul>`;
}

// "Reviewed by Supervisor at 14:32", or nothing for a new alert.
function buildDecisionText(alert) {
  if (!alert.decision) {
    return "";
  }
  const decidedAt = new Date(alert.decision.decidedAt);
  const clock = twoDigits(decidedAt.getHours()) + ":" + twoDigits(decidedAt.getMinutes());
  let roleName = alert.decision.decidedBy;
  if (ROLES[roleName]) {
    roleName = ROLES[roleName].label;
  }
  let word = "Reviewed";
  if (alert.state === "dismissed") {
    word = "Dismissed";
  }
  return `<p class="alert-decision">${word} by ${roleName} at ${clock}.</p>`;
}

// The buttons: Mark reviewed and Dismiss for a new alert, "Move back to New" otherwise.
function buildAlertActions(alert) {
  let buttons = `<button class="button button-secondary" data-action="undo" data-id="${alert.id}">Move back to New</button>`;
  if (alert.state === "new") {
    buttons = `<button class="button" data-action="reviewed" data-id="${alert.id}">Mark reviewed</button>
      <button class="button button-secondary" data-action="dismissed" data-id="${alert.id}">Dismiss</button>`;
  }
  const tripLink = `<a href="trips.html?plate=${encodeURIComponent(alert.trip.plate)}">View trip →</a>`;
  return `<div class="alert-actions">${buttons}${tripLink}</div>`;
}

// One alert card.
function buildAlertCard(alert) {
  const trip = alert.trip;
  const stop = alert.stop;
  const minutes = Math.round((stop.leaveTime - stop.arriveTime) / 60);
  const place = escapeHtml(PLACES[stop.placeKey].name);
  return `<article class="alert-card is-${alert.state}">
    <div class="alert-when"><strong>${formatClock(getAlertStartMinute(trip, stop))}</strong><small>alert started</small></div>
    <div class="alert-body">
      <h2>${trip.plate} parked ${minutes} min at ${place}</h2>
      <p>${place} is not an official location. The limit is ${ALERT_PARK_MINUTES} minutes.</p>
      ${buildAlertFacts(trip, stop)}
      ${buildDecisionText(alert)}
    </div>
    ${buildAlertActions(alert)}
  </article>`;
}

// ---------- drawing the page ----------

// The text shown when a tab has no alerts.
function getEmptyText(tab) {
  if (tab === "new") {
    return "No new alerts. Everything has been checked.";
  }
  if (tab === "reviewed") {
    return "No reviewed alerts yet.";
  }
  return "No alerts today.";
}

// Draws the cards of the chosen tab and the counts on the tabs.
function renderAlerts() {
  const alerts = getAlertsWithState();
  const shown = alerts.filter((alert) => isInTab(alert, activeTab));
  let html = shown.map(buildAlertCard).join("");
  if (shown.length === 0) {
    html = `<p class="alert-empty">${getEmptyText(activeTab)}</p>`;
  }
  document.querySelector("#alert-cards").innerHTML = html;
  document.querySelector("#tab-count-new").textContent = alerts.filter((alert) => alert.state === "new").length;
  document.querySelector("#tab-count-reviewed").textContent = alerts.filter((alert) => alert.state === "reviewed").length;
  document.querySelector("#tab-count-all").textContent = alerts.length;
  updateAlertBadges();
}

// ---------- buttons ----------

// Mark reviewed, Dismiss and Move back to New.
function handleAlertButton(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.action;
  if (action === "undo") {
    deleteAlertDecision(button.dataset.id);
  } else {
    saveAlertDecision(button.dataset.id, action, getCurrentRole());
  }
  renderAlerts();
}

// Switching between the New, Reviewed and All tabs.
function setUpTabs() {
  const tabs = document.querySelectorAll(".alert-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      activeTab = tab.dataset.tab;
      tabs.forEach(function (other) {
        other.classList.toggle("is-active", other === tab);
        other.setAttribute("aria-selected", String(other === tab));
      });
      renderAlerts();
    });
  });
}

setUpTabs();
document.querySelector("#alert-cards").addEventListener("click", handleAlertButton);
renderAlerts();

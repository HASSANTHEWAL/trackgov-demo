// common.js
// Shared code for the app pages (map, fuel, alerts...):
// - checks that someone is logged in (demo login on login.html, no passwords),
// - builds the sidebar menu on desktop and the bottom menu on phones,
// - hides Admin-only pages from Supervisors, and lets you log out.
// Each app page sets <body class="app" data-page="map.html"> so we know which page it is.
// Needs js/storage.js (for the saved role).

// The two roles you can log in as. (The public portal needs no login.)
const ROLES = {
  admin: { label: "Admin", description: "General Affairs fleet admin. Full access, including official locations." },
  supervisor: { label: "Supervisor", description: "Department Head. Sees the map, reports and alerts." },
};

// Every app page. ready: false means the page is not built yet, so the link is
// shown greyed out with "Soon". Set it to true when the page is finished.
// onPhone: true puts the page in the bottom menu on phones (there is room for 4).
// adminOnly: true hides the page from Supervisors.
const NAV_ITEMS = [
  { href: "dashboard.html", label: "Dashboard", shortLabel: "Home", ready: true, onPhone: true, adminOnly: false },
  { href: "map.html", label: "Live map", shortLabel: "Map", ready: true, onPhone: true, adminOnly: false },
  { href: "trips.html", label: "Trip history", shortLabel: "Trips", ready: true, onPhone: false, adminOnly: false },
  { href: "fuel.html", label: "Fuel report", shortLabel: "Fuel", ready: true, onPhone: true, adminOnly: false },
  { href: "alerts.html", label: "Alerts", shortLabel: "Alerts", ready: true, onPhone: true, adminOnly: false },
  { href: "vehicles.html", label: "Vehicles", shortLabel: "Vehicles", ready: true, onPhone: false, adminOnly: false },
  { href: "locations.html", label: "Official locations", shortLabel: "Places", ready: true, onPhone: false, adminOnly: true },
];

// ---------- who is logged in ----------

// True if the logged-in person is an Admin. Pages use this to show Admin-only buttons.
function isAdmin() {
  return getCurrentRole() === "admin";
}

// True if the current role may open this menu item.
function canOpen(item) {
  return !item.adminOnly || isAdmin();
}

// Sends people who are not logged in to the login page (it brings them back here after),
// and Supervisors away from Admin-only pages. Returns false if the page is being left.
function checkAccess() {
  const page = document.body.dataset.page;
  if (!ROLES[getCurrentRole()]) {
    location.replace("login.html?next=" + encodeURIComponent(page));
    return false;
  }
  const item = NAV_ITEMS.find((navItem) => navItem.href === page);
  if (item && !canOpen(item)) {
    location.replace("dashboard.html");
    return false;
  }
  return true;
}

// Logs out and goes back to the login page.
function logOut() {
  clearCurrentRole();
  location.href = "login.html";
}

// ---------- the menus ----------

// How many of today's alerts nobody has reviewed or dismissed yet.
function countNewAlerts() {
  const newAlerts = getAlertStops().filter((alert) => !getAlertDecision(getAlertId(alert.trip, alert.stop)));
  return newAlerts.length;
}

// Puts the number of new alerts on the Alerts links, and hides the red badge when there are none.
// The alerts page calls this again after every Mark reviewed or Dismiss.
function updateAlertBadges() {
  const count = countNewAlerts();
  document.querySelectorAll(".nav-badge").forEach(function (badge) {
    badge.textContent = count;
    badge.hidden = count === 0;
  });
}

// One menu link. Pages that are not ready yet become plain text, not a link.
function buildNavLink(item, labelText) {
  const isCurrent = document.body.dataset.page === item.href;
  let badge = "";
  // The alerts link gets a red badge with the number of new alerts (filled by updateAlertBadges).
  if (item.href === "alerts.html") {
    badge = `<b class="nav-badge"></b>`;
  }
  if (!item.ready) {
    return `<span class="nav-link is-soon">${labelText}<small>Soon</small></span>`;
  }
  if (isCurrent) {
    return `<a class="nav-link is-current" href="${item.href}" aria-current="page">${labelText}${badge}</a>`;
  }
  return `<a class="nav-link" href="${item.href}">${labelText}${badge}</a>`;
}

// Who is logged in, with a button to switch role (log out and pick again).
function buildAccountBox() {
  const role = ROLES[getCurrentRole()];
  return `<div class="side-account">
      <span>Signed in as</span>
      <strong>${role.label}</strong>
      <button class="link-button" data-action="log-out">Switch role</button>
    </div>`;
}

// The sidebar for desktop: logo, the pages this role may open, the public portal,
// who is logged in, and a link back to the website.
function buildSidebar() {
  let links = "";
  NAV_ITEMS.filter(canOpen).forEach(function (item) {
    links += buildNavLink(item, item.label);
  });
  const publicLink = buildNavLink({ href: "public.html", ready: true }, "Public portal");
  document.querySelector("#app-sidebar").innerHTML = `
    <a class="side-logo" href="index.html"><img src="assets/img/logo-wordmark.png" alt="TrackGov" width="602" height="69" /></a>
    <nav class="side-nav" aria-label="App pages">
      <span class="side-label">Main menu</span>
      ${links}
      <span class="side-label">Public access</span>
      ${publicLink}
    </nav>
    <div class="side-foot">
      ${buildAccountBox()}
      <span class="demo">Simulated data</span>
      <a href="index.html">← Back to the website</a>
    </div>`;
}

// The bottom menu for phones, with the 4 most used pages.
function buildBottomNav() {
  let links = "";
  NAV_ITEMS.forEach(function (item) {
    if (item.onPhone && canOpen(item)) {
      links += buildNavLink(item, item.shortLabel);
    }
  });
  document.querySelector("#app-bottom-nav").innerHTML = links;
}

// On phones the sidebar is hidden, so a small bar at the top shows the role and a log-out button.
function buildPhoneAccountBar() {
  const role = ROLES[getCurrentRole()];
  const bar = document.createElement("div");
  bar.className = "phone-account";
  bar.innerHTML = `<span>Signed in as <strong>${role.label}</strong></span><button class="link-button" data-action="log-out">Switch role</button>`;
  document.querySelector(".app-main").prepend(bar);
}

// Every "Switch role" button logs out.
function setUpLogOutButtons() {
  document.querySelectorAll('[data-action="log-out"]').forEach(function (button) {
    button.addEventListener("click", logOut);
  });
}

// ---------- status colors and names, used by the map and the dashboard ----------

// Marker colors for each status (the same colors as css/app.css).
const STATUS_COLORS = { moving: "#16b8a6", parked: "#f5a524", offline: "#6b7a90", alert: "#f26363" };
const STATUS_LABELS = { moving: "Moving", parked: "Parked", offline: "Offline", alert: "Alert" };

// ---------- start ----------

// Official locations added by an Admin change which stops are official (and so the alerts).
// This runs before the page's own script, so every page uses the same answer.
applyOfficialLocations(getSavedLocations());

// Only app pages get the menus. The login page also loads this file (for ROLES and NAV_ITEMS),
// but has no sidebar, so nothing happens there.
if (document.body.classList.contains("app") && checkAccess()) {
  buildSidebar();
  buildBottomNav();
  buildPhoneAccountBar();
  setUpLogOutButtons();
  updateAlertBadges();
}

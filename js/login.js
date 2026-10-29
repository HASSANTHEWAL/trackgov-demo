// login.js
// The demo login page: you choose a role (Admin or Supervisor) and continue.
// There is no password. The role is saved by js/storage.js, and every app page
// checks it (js/common.js). With a real backend, this becomes a real login.

// Where to go after logging in: the page in "?next=" (set by the page that sent you here)
// if it is one of our app pages, otherwise the dashboard. Only our own pages are allowed,
// so a link cannot send people to another website after they log in.
function getNextPage() {
  const next = new URLSearchParams(location.search).get("next");
  const item = NAV_ITEMS.find((navItem) => navItem.href === next && navItem.ready);
  if (item) {
    return item.href;
  }
  return "dashboard.html";
}

// One card per role. The role you used last time is chosen already (Admin the first time).
function buildRoleOptions() {
  let chosenRole = getCurrentRole();
  if (!ROLES[chosenRole]) {
    chosenRole = "admin";
  }
  let html = "";
  Object.keys(ROLES).forEach(function (roleKey) {
    const role = ROLES[roleKey];
    let checked = "";
    if (roleKey === chosenRole) {
      checked = "checked";
    }
    html += `<label class="role-option">
      <input type="radio" name="role" value="${roleKey}" ${checked} />
      <span><strong>${role.label}</strong><small>${role.description}</small></span>
    </label>`;
  });
  document.querySelector("#role-options").insertAdjacentHTML("beforeend", html);
}

// Saves the chosen role and opens the next page.
function handleLogin(event) {
  event.preventDefault(); // we go to the next page ourselves
  const chosen = document.querySelector('input[name="role"]:checked');
  if (!chosen) {
    document.querySelector("#login-message").textContent = "Please choose a role.";
    return;
  }
  if (!saveCurrentRole(chosen.value)) {
    document.querySelector("#login-message").textContent =
      "This browser would not let us save your role. Try a normal (not private) window.";
    return;
  }
  location.href = getNextPage();
}

buildRoleOptions();
document.querySelector("#login-form").addEventListener("submit", handleLogin);

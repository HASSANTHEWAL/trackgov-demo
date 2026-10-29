// format.js
// Small helpers that turn numbers into text, shared by every page
// (the trip track, the live map, and later the fuel and alert pages).

// 12.345 -> "12.3"
function formatOneDecimal(number) {
  return number.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// 2.5 -> "2.50"
function formatTwoDecimals(number) {
  return number.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 21500 -> "IDR 21,500"
function formatRupiah(amount) {
  return "IDR " + Math.round(amount).toLocaleString("en-GB");
}

// 17.04 -> "+17.0%", -2.2 -> "−2.2%"
function formatPercent(number) {
  let sign = "+";
  if (number < 0) {
    sign = "−";
  }
  return sign + formatOneDecimal(Math.abs(number)) + "%";
}

// 7 -> "07"
function twoDigits(number) {
  return String(number).padStart(2, "0");
}

// Minutes after midnight -> "HH:MM"
function formatClock(minutes) {
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60) % 24;
  return twoDigits(hours) + ":" + twoDigits(roundedMinutes % 60);
}

// Minutes after midnight -> "HH:MM:SS", for "last update" times.
function formatClockWithSeconds(minutes) {
  const totalSeconds = Math.floor(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutesPart = Math.floor(totalSeconds / 60) % 60;
  return twoDigits(hours) + ":" + twoDigits(minutesPart) + ":" + twoDigits(totalSeconds % 60);
}

// Seconds -> "45 min" or "1 h 05 min"
function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return minutes + " min";
  }
  return Math.floor(minutes / 60) + " h " + twoDigits(minutes % 60) + " min";
}

// Text we put inside HTML must not be read as HTML code, so "&" and "<" are replaced.
function escapeHtml(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}

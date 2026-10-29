// track.js
// The "race track" trip replay in the landing page's Live tracking section (#tg).
// It draws one vehicle's route as a glowing, tilted 3D track with numbered stop pins,
// a speed chart under it, and plays the trip back like a video.
// The trips themselves come from js/simulation.js (TRIPS, getTripState, getStopAt).
// Text helpers like formatClock come from js/format.js.
// Every id and class starts with "tg-" so nothing clashes with the landing page's code.

// ---------- settings and current state ----------

const TRACK_FONT = "Helvetica Neue,Inter,system-ui,sans-serif";
// People who turn on "reduce motion" in their system settings do not get autoplay.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const trackSvg = document.querySelector("#tg-track");
const profileSvg = document.querySelector("#tg-prof");

let currentTripIndex = 0;
let replayTime = 0; // seconds since the start of the trip
let isPlaying = false;
let playbackSpeed = 90; // 90 means 90 seconds of the trip play in 1 real second
let lastFrameTime = 0;
let projection = null; // made by makeProjection(), turns [lat, lng] into track coordinates

// Sizes of the speed chart (the "profile") under the track.
const PROFILE_HEIGHT = 104;
const PROFILE_LEFT = 30; // room for the km/h numbers
const PROFILE_RIGHT = 8;
const PROFILE_TOP = 20;
const PROFILE_BOTTOM = PROFILE_HEIGHT - 20; // room for the clock times
let profileWidth = 0;
let profileMaxSpeed = 60; // the km/h at the top of the chart

// ---------- small helpers ----------
// (formatClock, formatOneDecimal, twoDigits, formatDuration and escapeHtml are in js/format.js)

// A list of [x, y] points -> the "d" text of an SVG path line ("M x y L x y L ...").
function svgPath(points) {
  const parts = points.map((point) => point[0].toFixed(1) + " " + point[1].toFixed(1));
  return "M" + parts.join("L");
}

// ---------- projection: turning map points into a tilted 3D view ----------
// The steps are: [lat, lng] -> meters -> turn the route so it lies left to right
// -> tilt it away from the viewer -> scale it to fit the drawing.

// The middle of the route: the average lat and lng of all its points.
function getRouteCenter(points) {
  let latSum = 0;
  let lngSum = 0;
  for (let i = 0; i < points.length; i++) {
    latSum += points[i][0];
    lngSum += points[i][1];
  }
  return [latSum / points.length, lngSum / points.length];
}

// [lat, lng] -> [x, y] in meters from the route center (x to the east, y to the south, like the screen).
// One degree of latitude is about 110,574 m. One degree of longitude gets shorter away from the equator.
function toMeters(latLng, center) {
  const metersPerLng = 111320 * Math.cos((center[0] * Math.PI) / 180);
  const metersPerLat = 110574;
  return [(latLng[1] - center[1]) * metersPerLng, -(latLng[0] - center[0]) * metersPerLat];
}

// Turns a point around the center by an angle (in radians).
function rotatePoint(point, angle) {
  const x = point[0] * Math.cos(angle) + point[1] * Math.sin(angle);
  const y = -point[0] * Math.sin(angle) + point[1] * Math.cos(angle);
  return [x, y];
}

// The direction in which the route is longest (the line that fits all the points best).
// Turning the route by this angle makes it lie left to right, so it fills the wide drawing.
function getLongestDirection(meterPoints) {
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  meterPoints.forEach(function (point) {
    sumXX += point[0] * point[0];
    sumYY += point[1] * point[1];
    sumXY += point[0] * point[1];
  });
  return 0.5 * Math.atan2(2 * sumXY, sumXX - sumYY);
}

// Works out how to turn and tilt this trip's route. Used by toTiltedPoint().
function getViewSettings(trip) {
  const center = getRouteCenter(trip.points);
  const meterPoints = trip.points.map((point) => toMeters(point, center));
  let angle = getLongestDirection(meterPoints);
  // Turn it half a circle more if needed, so the start is always on the left.
  if (rotatePoint(meterPoints[0], angle)[0] > 0) {
    angle += Math.PI;
  }
  // How far the route reaches from the center, used to place the "camera".
  let reach = 0;
  meterPoints.forEach(function (point) {
    const turned = rotatePoint(point, angle);
    reach = Math.max(reach, Math.abs(turned[0]), Math.abs(turned[1]));
  });
  if (reach === 0) {
    reach = 1;
  }
  return { center: center, angle: angle, cameraDistance: reach * 3.4 };
}

// [lat, lng] -> the point on the tilted ground, before it is scaled to the drawing.
// The ground is tilted 58 degrees away from us. Far points (top of the screen) are
// drawn smaller and closer together, which gives the 3D look.
function toTiltedPoint(latLng, view) {
  const turned = rotatePoint(toMeters(latLng, view.center), view.angle);
  const tilt = (58 * Math.PI) / 180;
  const perspective = view.cameraDistance / (view.cameraDistance - turned[1] * Math.sin(tilt));
  return [turned[0] * perspective, turned[1] * Math.cos(tilt) * perspective];
}

// Smallest and largest x and y of a list of points.
function getBounds(points) {
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  points.forEach(function (point) {
    bounds.minX = Math.min(bounds.minX, point[0]);
    bounds.maxX = Math.max(bounds.maxX, point[0]);
    bounds.minY = Math.min(bounds.minY, point[1]);
    bounds.maxY = Math.max(bounds.maxY, point[1]);
  });
  return bounds;
}

// Finds the scale and offset that make the tilted route fit nicely in the drawing.
function fitToStage(tiltedPoints, width, height) {
  const bounds = getBounds(tiltedPoints);
  const routeWidth = bounds.maxX - bounds.minX || 1;
  const routeDepth = bounds.maxY - bounds.minY || 1;
  const narrow = width < 800;
  const boxWidth = narrow ? width - 70 : width - 150;
  const boxHeight = narrow ? height * 0.42 : height * 0.46;
  const scaleX = Math.min(boxWidth / routeWidth, boxHeight / routeDepth);
  // Flat routes get their depth stretched (up to 3.5 times) so the track keeps some shape.
  const stretch = Math.min(3.5, Math.max(1, (boxHeight * 0.55) / (routeDepth * scaleX)));
  const scaleY = scaleX * stretch;
  // Put the middle of the route a bit below the middle of the drawing.
  const offsetX = width / 2 - ((bounds.minX + bounds.maxX) / 2) * scaleX;
  const offsetY = height * 0.6 - ((bounds.minY + bounds.maxY) / 2) * scaleY;
  return { scaleX: scaleX, scaleY: scaleY, offsetX: offsetX, offsetY: offsetY };
}

// Makes the projection for a trip: a toScreen() function, the route already turned into
// screen points, and the direction of north on the screen (for the compass).
function makeProjection(trip, width, height) {
  const view = getViewSettings(trip);
  const tiltedPoints = trip.points.map((point) => toTiltedPoint(point, view));
  const fit = fitToStage(tiltedPoints, width, height);

  function toScreen(latLng) {
    const tilted = toTiltedPoint(latLng, view);
    return [fit.offsetX + tilted[0] * fit.scaleX, fit.offsetY + tilted[1] * fit.scaleY];
  }

  // North is the direction from the center to a point a little further north.
  const centerOnScreen = toScreen(view.center);
  const northOnScreen = toScreen([view.center[0] + 0.01, view.center[1]]);
  const northAngle = Math.atan2(northOnScreen[1] - centerOnScreen[1], northOnScreen[0] - centerOnScreen[0]);
  return { toScreen: toScreen, points: trip.points.map(toScreen), northAngle: northAngle };
}

// ---------- drawing the 3D track ----------
// Each build... function returns a piece of SVG code as text.
// drawTrack() joins them and puts them in the <svg id="tg-track">.

// Glow and blur filters, and the soft teal "floor" under the track.
function buildTrackBackground(width, height) {
  return `<defs>
    <filter id="tg-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="tg-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
    <radialGradient id="tg-floor" cx="50%" cy="60%" r="55%"><stop offset="0" stop-color="#16b8a6" stop-opacity=".13"/><stop offset="1" stop-color="#16b8a6" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="${width / 2}" cy="${height * 0.62}" rx="${width * 0.48}" ry="${height * 0.26}" fill="url(#tg-floor)"/>`;
}

// Names like "MALIOBORO" on the ground, so people can see where the route is.
// Landmarks that fall outside the drawing are skipped.
function buildLandmarkLabels(width, height, narrow) {
  let html = "";
  LANDMARKS.forEach(function (landmark) {
    const [x, y] = projection.toScreen([landmark.lat, landmark.lng]);
    const insideDrawing = x > 20 && x < width - 60 && y > height * 0.22 && y < height - 24;
    if (insideDrawing) {
      html += `<g opacity=".55"><circle cx="${x}" cy="${y}" r="2.2" fill="#8fa3bf"/><text x="${x + 7}" y="${y + 4}" font-size="${narrow ? 13 : 11}" fill="#8fa3bf" letter-spacing="1.5" font-family="${TRACK_FONT}">${landmark.name.toUpperCase()}</text></g>`;
    }
  });
  return html;
}

// The road itself: a glow pool under it, the side walls, the glowing top,
// and an empty "progress" line that update functions fill in as the car drives.
function buildRoad(pathData, wallHeight, roadWidth) {
  let html = `<path d="${pathData}" transform="translate(0 ${wallHeight + 6})" fill="none" stroke="#16b8a6" stroke-opacity=".35" stroke-width="${roadWidth + 16}" stroke-linejoin="round" stroke-linecap="round" filter="url(#tg-soft)"/>`;
  // The walls are many copies of the line, each moved down a little.
  // The lowest copy is the darkest, so the wall looks lit from above.
  for (let shift = wallHeight; shift >= 1; shift -= 1.5) {
    const lightness = 1 - shift / wallHeight; // 0 at the bottom, almost 1 at the top
    const red = Math.round(9 + 14 * lightness);
    const green = Math.round(52 + 70 * lightness);
    const blue = Math.round(50 + 64 * lightness);
    html += `<path d="${pathData}" transform="translate(0 ${shift.toFixed(1)})" fill="none" stroke="rgb(${red},${green},${blue})" stroke-width="${roadWidth + 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  html += `<path d="${pathData}" fill="none" stroke="#16b8a6" stroke-width="${roadWidth + 2.6}" stroke-linejoin="round" stroke-linecap="round" filter="url(#tg-glow)"/>`;
  html += `<path d="${pathData}" fill="none" stroke="#0a2a2c" stroke-width="${roadWidth - 1.4}" stroke-linejoin="round" stroke-linecap="round"/>`;
  html += `<path id="tg-prog" d="" fill="none" stroke="#7ff3e4" stroke-width="${roadWidth - 1.4}" stroke-linejoin="round" stroke-linecap="round" filter="url(#tg-glow)"/>`;
  return html;
}

// One "5 KM" style marker, at a point between two screen points.
function buildKmMarker(fromPoint, toPoint, fraction, km, narrow) {
  const x = fromPoint[0] + (toPoint[0] - fromPoint[0]) * fraction;
  const y = fromPoint[1] + (toPoint[1] - fromPoint[1]) * fraction;
  return `<g opacity=".8"><line x1="${x}" y1="${y}" x2="${x}" y2="${y - 16}" stroke="#16b8a6" stroke-width="1"/><text x="${x}" y="${y - 20}" text-anchor="middle" font-size="${narrow ? 14 : 11}" fill="#16b8a6" font-family="${TRACK_FONT}" font-weight="600">${km} KM</text></g>`;
}

// A marker every 5 km (every 10 km on trips longer than 30 km), but none in the last 1.5 km.
function buildKmMarkers(trip, screenPoints, narrow) {
  const stepMeters = trip.totalDistance > 30000 ? 10000 : 5000;
  let nextMarker = stepMeters;
  let html = "";
  for (let i = 1; i < trip.timeline.length; i++) {
    const before = trip.timeline[i - 1];
    const after = trip.timeline[i];
    // Skip stops: the car does not move between these two entries.
    if (after.pointIndex === before.pointIndex) {
      continue;
    }
    while (after.distance >= nextMarker && nextMarker < trip.totalDistance - 1500) {
      // How far along this piece of road the marker is (0 to 1).
      const fraction = (nextMarker - before.distance) / (after.distance - before.distance || 1);
      const fromPoint = screenPoints[before.pointIndex];
      const toPoint = screenPoints[after.pointIndex];
      html += buildKmMarker(fromPoint, toPoint, fraction, nextMarker / 1000, narrow);
      nextMarker += stepMeters;
    }
  }
  return html;
}

// A pin standing on the track: a thin line up from the point, a big label and the place name.
// alignLeft puts the text on the left side, for pins near the right edge.
// On narrow screens the place name is left out to save room.
function buildPin(x, y, pinHeight, label, placeName, color, alignLeft, narrow) {
  const height = Math.min(pinHeight, y - 26); // keep the label inside the drawing
  const textX = alignLeft ? x - 8 : x + 8;
  const anchor = alignLeft ? "end" : "start";
  let nameText = "";
  if (!narrow) {
    nameText = `<text x="${textX}" y="${y - height + 22}" text-anchor="${anchor}" font-size="11.5" fill="#e8eef7" font-family="${TRACK_FONT}">${escapeHtml(placeName)}</text>`;
  }
  return `<g><line x1="${x}" y1="${y}" x2="${x}" y2="${y - height}" stroke="${color}" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="3.6" fill="${color}"/><circle cx="${x}" cy="${y - height}" r="2" fill="${color}"/><text x="${textX}" y="${y - height + 6}" text-anchor="${anchor}" font-family="${TRACK_FONT}" font-weight="700" font-size="${narrow ? 24 : 21}" fill="${color}">${label}</text>${nameText}</g>`;
}

// The START pin and one numbered pin per stop. Unofficial stops are red and get a "!".
function buildStopPins(trip, screenPoints, width, narrow) {
  const start = screenPoints[0];
  const startName = PLACES[trip.placeKeys[0]].name;
  let html = buildPin(start[0], start[1], 58, "START", startName, "#e8eef7", start[0] > width - 200, narrow);
  // Pins get different heights in turn, so labels of stops close together do not overlap.
  const pinHeights = [96, 72, 118, 84];
  trip.stops.forEach(function (stop, stopIndex) {
    const [x, y] = screenPoints[stop.pointIndex];
    let color = "#16b8a6";
    let label = twoDigits(stopIndex + 1);
    if (!stop.official) {
      color = "#f26363";
      label += " !";
    }
    const placeName = PLACES[stop.placeKey].name;
    html += buildPin(x, y, pinHeights[stopIndex % 4], label, placeName, color, x > width - 200, narrow);
  });
  return html;
}

// A blue "MAX 62 KM/H" label in the middle of the fastest piece of road.
function buildMaxSpeedLabel(trip, screenPoints, narrow) {
  const fromPoint = screenPoints[trip.maxSpeedPointIndex];
  const toPoint = screenPoints[trip.maxSpeedPointIndex + 1];
  const x = (fromPoint[0] + toPoint[0]) / 2;
  const y = (fromPoint[1] + toPoint[1]) / 2;
  return `<g><line x1="${x}" y1="${y}" x2="${x}" y2="${y - 38}" stroke="#3b82f6" stroke-width="1"/><circle cx="${x}" cy="${y}" r="3" fill="#3b82f6"/><text x="${x + 6}" y="${y - 30}" font-family="${TRACK_FONT}" font-weight="600" font-size="${narrow ? 15 : 12}" fill="#3b82f6">MAX ${Math.round(trip.maxSpeed)} KM/H</text></g>`;
}

// The point at a distance (radius) and direction (angle) from a center point.
function pointOnCircle(centerX, centerY, angle, radius) {
  return [centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius];
}

// A small compass in the bottom right corner. The arrow points to north on the tilted track.
function buildCompass(width, height) {
  const centerX = width - 34;
  const centerY = height - 34;
  const north = projection.northAngle;
  // The arrow is a triangle: a tip towards north and two back corners.
  const tip = pointOnCircle(centerX, centerY, north, 13);
  const backLeft = pointOnCircle(centerX, centerY, north + 2.6, 7);
  const backRight = pointOnCircle(centerX, centerY, north - 2.6, 7);
  const letter = pointOnCircle(centerX, centerY, north, 27);
  return `<g opacity=".8"><circle cx="${centerX}" cy="${centerY}" r="17" fill="none" stroke="rgba(232,238,247,.25)"/><path d="M${tip[0]} ${tip[1]}L${backLeft[0]} ${backLeft[1]}L${backRight[0]} ${backRight[1]}Z" fill="#16b8a6"/><text x="${letter[0]}" y="${letter[1] + 4}" text-anchor="middle" font-size="11" fill="#8fa3bf" font-family="${TRACK_FONT}" font-weight="700">N</text></g>`;
}

// The car: a white dot with a teal ring. updateReplay() moves it along the track.
function buildCar() {
  return `<g id="tg-car"><circle class="tg-halo" r="8" fill="none" stroke="#7ff3e4" stroke-width="2"/><circle r="9" fill="#16b8a6" fill-opacity=".35"/><circle r="5" fill="#fff"/></g>`;
}

// Draws the whole 3D track for the current trip.
// Small screens use a smaller drawing size, so the text stays big enough to read.
function drawTrack() {
  const trip = TRIPS[currentTripIndex];
  const narrow = trackSvg.clientWidth < 700;
  const width = narrow ? 600 : 1000;
  const height = narrow ? 470 : 540;
  const wallHeight = narrow ? 12 : 16;
  const roadWidth = narrow ? 7 : 8;
  trackSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  projection = makeProjection(trip, width, height);
  const screenPoints = projection.points;

  let html = buildTrackBackground(width, height);
  html += buildLandmarkLabels(width, height, narrow);
  html += buildRoad(svgPath(screenPoints), wallHeight, roadWidth);
  html += buildKmMarkers(trip, screenPoints, narrow);
  html += buildStopPins(trip, screenPoints, width, narrow);
  html += buildMaxSpeedLabel(trip, screenPoints, narrow);
  html += buildCompass(width, height);
  html += buildCar();
  trackSvg.innerHTML = html;

  // A text description of the route for screen readers.
  const placeNames = trip.placeKeys.map((key) => PLACES[key].name);
  const distanceText = formatOneDecimal(trip.totalDistance / 1000);
  trackSvg.setAttribute("aria-label", `Route ${trip.plate}: ${placeNames.join(" to ")}, ${distanceText} km`);
}

// ---------- drawing the speed chart ----------
// x = time of the trip, y = speed. Like the speed chart in a running or cycling app.

// Trip time (seconds) -> x position on the chart.
function timeToChartX(time) {
  const trip = TRIPS[currentTripIndex];
  return PROFILE_LEFT + (time / trip.totalTime) * (profileWidth - PROFILE_LEFT - PROFILE_RIGHT);
}

// Speed (km/h) -> y position on the chart.
function speedToChartY(speed) {
  return PROFILE_BOTTOM - (speed / profileMaxSpeed) * (PROFILE_BOTTOM - PROFILE_TOP);
}

// The average speed of the road pieces around one timeline entry (3 before and 3 after),
// counting longer pieces more. This makes the speed line smooth instead of spiky.
function getSmoothSpeed(timeline, entryIndex) {
  let totalSeconds = 0;
  let speedTimesSeconds = 0;
  const first = Math.max(1, entryIndex - 3);
  const last = Math.min(timeline.length - 1, entryIndex + 3);
  for (let j = first; j <= last; j++) {
    // Skip stops (the car does not move between these two entries).
    if (timeline[j].pointIndex === timeline[j - 1].pointIndex) {
      continue;
    }
    const seconds = timeline[j].time - timeline[j - 1].time;
    totalSeconds += seconds;
    speedTimesSeconds += seconds * timeline[j].speed;
  }
  return speedTimesSeconds / totalSeconds;
}

// A list of [time, speed] points for the chart line. Stops are drawn as 0 km/h.
function buildSpeedSeries(trip) {
  const timeline = trip.timeline;
  const series = [[0, 0]];
  for (let i = 1; i < timeline.length; i++) {
    const before = timeline[i - 1];
    const after = timeline[i];
    if (after.pointIndex === before.pointIndex) {
      series.push([before.time, 0], [after.time, 0]);
    } else {
      series.push([(before.time + after.time) / 2, getSmoothSpeed(timeline, i)]);
    }
  }
  series.push([trip.totalTime, 0]);
  return series;
}

// Light horizontal lines with the km/h number every 20 km/h.
function buildChartGrid() {
  let html = "";
  for (let speed = 20; speed <= profileMaxSpeed; speed += 20) {
    const y = speedToChartY(speed);
    html += `<line x1="${PROFILE_LEFT}" x2="${profileWidth - PROFILE_RIGHT}" y1="${y}" y2="${y}" stroke="rgba(232,238,247,.08)"/><text x="${PROFILE_LEFT - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#8fa3bf">${speed}</text>`;
  }
  return html;
}

// A colored band for each stop, from arriving to leaving. Unofficial stops are red.
function buildChartStops(trip) {
  let html = "";
  trip.stops.forEach(function (stop, stopIndex) {
    const color = stop.official ? "#16b8a6" : "#f26363";
    const opacity = stop.official ? 0.08 : 0.18;
    const x = timeToChartX(stop.arriveTime);
    const bandWidth = Math.max(2, timeToChartX(stop.leaveTime) - x);
    html += `<rect x="${x}" y="${PROFILE_TOP}" width="${bandWidth}" height="${PROFILE_BOTTOM - PROFILE_TOP}" fill="${color}" fill-opacity="${opacity}"/><text x="${x + 4}" y="${PROFILE_TOP + 12}" font-size="11" font-weight="700" fill="${color}" font-family="${TRACK_FONT}">${twoDigits(stopIndex + 1)}</text>`;
  });
  return html;
}

// The speed line, with a teal fade filled in under it.
function buildChartLine(trip) {
  const series = buildSpeedSeries(trip);
  const parts = series.map((item) => `${timeToChartX(item[0]).toFixed(1)} ${speedToChartY(item[1]).toFixed(1)}`);
  const line = parts.join("L");
  const endX = timeToChartX(trip.totalTime);
  const startX = timeToChartX(0);
  let html = `<path d="M${line}L${endX} ${PROFILE_BOTTOM}L${startX} ${PROFILE_BOTTOM}Z" fill="url(#tg-pf)"/><path d="M${line}" fill="none" stroke="#16b8a6" stroke-width="1.6" stroke-linejoin="round"/>`;
  html += `<line x1="${PROFILE_LEFT}" x2="${profileWidth - PROFILE_RIGHT}" y1="${PROFILE_BOTTOM}" y2="${PROFILE_BOTTOM}" stroke="rgba(232,238,247,.2)"/>`;
  return html;
}

// Clock times along the bottom: every 15 minutes, or every 30 minutes on trips over 1.5 hours.
function buildChartTimes(trip) {
  const stepSeconds = trip.totalTime > 5400 ? 1800 : 900;
  let html = "";
  for (let seconds = 0; seconds <= trip.totalTime; seconds += stepSeconds) {
    const anchor = seconds === 0 ? "start" : "middle";
    const clock = formatClock(trip.startMinute + seconds / 60);
    html += `<text x="${timeToChartX(seconds)}" y="${PROFILE_HEIGHT - 4}" text-anchor="${anchor}" font-size="10" fill="#8fa3bf">${clock}</text>`;
  }
  return html;
}

// Draws the whole speed chart for the current trip.
function drawProfile() {
  const trip = TRIPS[currentTripIndex];
  profileWidth = Math.max(280, profileSvg.clientWidth);
  profileSvg.setAttribute("viewBox", `0 0 ${profileWidth} ${PROFILE_HEIGHT}`);
  // Round the top speed up to the next 20 km/h, and show at least 40 km/h.
  profileMaxSpeed = Math.max(40, Math.ceil(trip.maxSpeed / 20) * 20);

  let html = `<defs><linearGradient id="tg-pf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16b8a6" stop-opacity=".55"/><stop offset="1" stop-color="#16b8a6" stop-opacity=".02"/></linearGradient></defs>`;
  html += buildChartGrid();
  html += buildChartStops(trip);
  html += buildChartLine(trip);
  html += buildChartTimes(trip);
  html += `<text x="2" y="9" font-size="9" fill="#8fa3bf" letter-spacing="1">KM/H</text>`;
  // The cursor that shows "now" on the chart. updateReplay() moves it.
  html += `<line id="tg-cur" y1="${PROFILE_TOP - 2}" y2="${PROFILE_BOTTOM}" stroke="#e8eef7" stroke-width="1.2"/><circle id="tg-curDot" r="4" fill="#fff" stroke="#16b8a6" stroke-width="2"/>`;
  profileSvg.innerHTML = html;
}

// ---------- updating the replay at the current time ----------

// Moves the car dot and grows the bright "progress" line behind it.
function moveCar(state) {
  const screenPoints = projection.points;
  let carPoint = screenPoints[state.pointIndex];
  if (state.moving) {
    const from = screenPoints[state.pointIndex];
    const to = screenPoints[state.nextPointIndex];
    carPoint = [from[0] + (to[0] - from[0]) * state.fraction, from[1] + (to[1] - from[1]) * state.fraction];
  }
  const carTransform = `translate(${carPoint[0].toFixed(1)} ${carPoint[1].toFixed(1)})`;
  document.querySelector("#tg-car").setAttribute("transform", carTransform);

  const donePoints = screenPoints.slice(0, state.pointIndex + 1);
  if (state.moving) {
    donePoints.push(carPoint);
  }
  let progressPath = "";
  if (donePoints.length > 1) {
    progressPath = svgPath(donePoints);
  }
  document.querySelector("#tg-prog").setAttribute("d", progressPath);
}

// The word shown under "Status": Ready, Moving, Stopped, Unofficial stop or Arrived.
function getStatusText(trip, time, stop) {
  if (time >= trip.totalTime) {
    return "Arrived";
  }
  if (stop && stop.official) {
    return "Stopped";
  }
  if (stop) {
    return "Unofficial stop";
  }
  if (time === 0) {
    return "Ready";
  }
  return "Moving";
}

// Updates the Time, Speed, Covered and Status numbers under the track.
function updateReadouts(trip, state) {
  const stop = getStopAt(trip, replayTime);
  document.querySelector("#tg-rClock").textContent = formatClock(trip.startMinute + replayTime / 60);
  document.querySelector("#tg-rSpeed").textContent = Math.round(state.speed) + " km/h";
  document.querySelector("#tg-rDist").textContent = formatOneDecimal(state.distance / 1000) + " km";

  const statusElement = document.querySelector("#tg-rState");
  statusElement.textContent = getStatusText(trip, replayTime, stop);
  // Unofficial stops are shown in the alert red.
  if (stop && !stop.official) {
    statusElement.style.color = "var(--tg-alert)";
  } else {
    statusElement.style.color = "";
  }
}

// Moves the "now" line and dot on the speed chart.
function moveChartCursor(state) {
  const x = timeToChartX(replayTime);
  const cursorLine = document.querySelector("#tg-cur");
  cursorLine.setAttribute("x1", x);
  cursorLine.setAttribute("x2", x);
  const cursorDot = document.querySelector("#tg-curDot");
  cursorDot.setAttribute("cx", x);
  cursorDot.setAttribute("cy", speedToChartY(state.speed));
}

// Highlights the current row in the trip schedule and greys out the rows still to come.
// Each row has data-a (arrive time) and data-b (leave time), in seconds.
function highlightSchedule() {
  document.querySelectorAll("#tg-sched li").forEach(function (row) {
    const arriveTime = Number(row.dataset.a);
    const leaveTime = Number(row.dataset.b);
    const isFirstRowAtStart = arriveTime === 0 && leaveTime === 0 && replayTime === 0;
    const isNow = replayTime >= arriveTime && replayTime <= leaveTime && !isFirstRowAtStart;
    row.classList.toggle("tg-now", isNow);
    row.classList.toggle("tg-todo", replayTime < arriveTime);
  });
}

// Shows everything for the current replayTime: the car, numbers, chart cursor and schedule.
function updateReplay() {
  const trip = TRIPS[currentTripIndex];
  const state = getTripState(trip, replayTime);
  moveCar(state);
  updateReadouts(trip, state);
  moveChartCursor(state);
  highlightSchedule();
}

// ---------- filling the side panels for a trip ----------

// Today's date (in Jogja time), like "28" and "OCT".
function fillDate() {
  const now = new Date();
  const day = now.toLocaleDateString("en-GB", { day: "numeric", timeZone: "Asia/Jakarta" });
  let month = now.toLocaleDateString("en-GB", { month: "short", timeZone: "Asia/Jakarta" });
  month = month.replace(".", "").toUpperCase();
  document.querySelector("#tg-sDate").innerHTML = `${day}<small>${month}</small>`;
}

// The big numbers along the top: distance, moving time, average speed and stops.
function fillStats(trip) {
  const averageSpeed = Math.round((trip.totalDistance / trip.movingTime) * 3.6);
  document.querySelector("#tg-sDist").innerHTML = `${formatOneDecimal(trip.totalDistance / 1000)}<small>KM</small>`;
  document.querySelector("#tg-sMove").innerHTML = `${Math.round(trip.movingTime / 60)}<small>MIN</small>`;
  document.querySelector("#tg-sAvg").innerHTML = `${averageSpeed}<small>KM/H</small>`;
  document.querySelector("#tg-sStops").textContent = twoDigits(trip.stops.length);
}

// The red "Needs review" box, shown only when the trip has an unofficial stop.
function fillFlag(trip) {
  const flag = document.querySelector("#tg-flag");
  if (trip.unofficialStops.length === 0) {
    flag.classList.remove("tg-on");
    return;
  }
  const stop = trip.unofficialStops[0];
  const minutes = Math.round((stop.leaveTime - stop.arriveTime) / 60);
  const placeName = escapeHtml(PLACES[stop.placeKey].name);
  document.querySelector("#tg-flagText").innerHTML =
    `<span><b>Needs review.</b> Parked ${minutes} min at ${placeName}, which is not an official location.</span>`;
  flag.classList.add("tg-on");
}

// One row of the trip schedule.
function buildScheduleRow(rowClass, arriveTime, leaveTime, number, placeName, details, clock) {
  return `<li class="${rowClass}" data-a="${arriveTime}" data-b="${leaveTime}"><span class="tg-n">${number}</span><span class="tg-p">${escapeHtml(placeName)}<em>${details}</em></span><span class="tg-tm">${clock}</span></li>`;
}

// The trip schedule: where the car started, each stop, and where it arrived.
function fillSchedule(trip) {
  const firstPlace = PLACES[trip.placeKeys[0]].name;
  const lastPlace = PLACES[trip.placeKeys[trip.placeKeys.length - 1]].name;
  let html = buildScheduleRow("", 0, 0, "—", firstPlace, "Departed", formatClock(trip.startMinute));

  trip.stops.forEach(function (stop, stopIndex) {
    let rowClass = "";
    let details = "Official location";
    if (!stop.official) {
      rowClass = "tg-off";
      details = "Unofficial location";
    }
    details += ` · ${Math.round((stop.leaveTime - stop.arriveTime) / 60)} min`;
    const clock = formatClock(trip.startMinute + stop.arriveTime / 60);
    html += buildScheduleRow(rowClass, stop.arriveTime, stop.leaveTime, twoDigits(stopIndex + 1), PLACES[stop.placeKey].name, details, clock);
  });

  const arriveDetails = `Arrived · total ${formatDuration(trip.totalTime)}`;
  const arriveClock = formatClock(trip.startMinute + trip.totalTime / 60);
  html += buildScheduleRow("", trip.totalTime, trip.totalTime, "—", lastPlace, arriveDetails, arriveClock);
  document.querySelector("#tg-sched").innerHTML = html;
}

// Fills all the text around the track for the current trip.
function fillTripPanels() {
  const trip = TRIPS[currentTripIndex];
  document.querySelector("#tg-plate").textContent = trip.plate;
  document.querySelector("#tg-agency").textContent = trip.agency;
  fillDate();
  fillStats(trip);
  document.querySelector("#tg-vName").textContent = trip.model;
  document.querySelector("#tg-vMeta").textContent = `${trip.driver} · ${trip.agency}`;
  fillFlag(trip);
  fillSchedule(trip);
  const kmPerLiter = MODELS[trip.model].kmPerLiter;
  document.querySelector("#tg-fuel").textContent =
    `Estimated fuel used: ${formatOneDecimal(trip.fuelLiters)} L (${kmPerLiter} km/L for a ${trip.model}).`;
  // Mark the chosen vehicle's button as pressed.
  document.querySelectorAll("#tg-chips .tg-chip").forEach(function (chip) {
    chip.setAttribute("aria-pressed", String(Number(chip.dataset.trip) === currentTripIndex));
  });
}

// ---------- choosing a trip and playing it ----------

// Shows another trip from the start. autoplay = true starts playing it straight away.
function selectTrip(tripIndex, autoplay) {
  // Wrap around, so "next" after the last trip goes back to the first one.
  currentTripIndex = (tripIndex + TRIPS.length) % TRIPS.length;
  replayTime = 0;
  fillTripPanels();
  drawTrack();
  drawProfile();
  updateReplay();
  setPlaying(autoplay && !reduceMotion);
  // Tell other code on the page (like the trip list in js/trips.js) that the trip changed.
  document.dispatchEvent(new CustomEvent("tg-trip-change"));
}

// Starts or pauses the replay, and switches the button between play and pause icons.
function setPlaying(playing) {
  isPlaying = playing;
  // Pressing play at the end of the trip starts it again.
  if (isPlaying && replayTime >= TRIPS[currentTripIndex].totalTime) {
    replayTime = 0;
  }
  const pauseIcon = '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>';
  const playIcon = '<path d="M7 4l13 8-13 8z" fill="currentColor"/>';
  document.querySelector("#tg-playIcon").innerHTML = isPlaying ? pauseIcon : playIcon;
  document.querySelector("#tg-play").setAttribute("aria-label", isPlaying ? "Pause" : "Play replay");
  lastFrameTime = performance.now();
}

// Runs on every screen frame (about 60 times a second) and moves the replay forward.
function animationLoop(now) {
  if (isPlaying) {
    const realSeconds = (now - lastFrameTime) / 1000;
    replayTime += realSeconds * playbackSpeed;
    const totalTime = TRIPS[currentTripIndex].totalTime;
    if (replayTime >= totalTime) {
      replayTime = totalTime;
      setPlaying(false);
    }
    updateReplay();
  }
  lastFrameTime = now;
  requestAnimationFrame(animationLoop);
}

// ---------- buttons and controls ----------

// One button per vehicle under the track. A small red dot marks trips with an unofficial stop.
function buildVehicleButtons() {
  const buttons = TRIPS.map(function (trip) {
    let redDot = "";
    if (trip.unofficialStops.length > 0) {
      redDot = '<i title="Flagged stop"></i>';
    }
    return `<button class="tg-chip" data-trip="${trip.index}" aria-pressed="false">${redDot}${trip.plate}</button>`;
  });
  const chipList = document.querySelector("#tg-chips");
  chipList.innerHTML = buttons.join("");
  // One listener on the whole list instead of one per button.
  chipList.addEventListener("click", function (event) {
    const chip = event.target.closest(".tg-chip");
    if (chip) {
      selectTrip(Number(chip.dataset.trip), true);
    }
  });
}

// The 30x / 90x / 300x buttons. data-r in index.html is the playback speed.
function setUpSpeedButtons() {
  const speedButtons = document.querySelectorAll(".tg-rate");
  speedButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      playbackSpeed = Number(button.dataset.r);
      speedButtons.forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    });
  });
}

// Jumps the replay to the time under the mouse or finger on the speed chart.
function seekToPointer(event) {
  const box = profileSvg.getBoundingClientRect();
  // The chart is scaled to fit the page, so turn screen pixels back into chart units.
  const chartX = ((event.clientX - box.left) / box.width) * profileWidth;
  const totalTime = TRIPS[currentTripIndex].totalTime;
  const time = ((chartX - PROFILE_LEFT) / (profileWidth - PROFILE_LEFT - PROFILE_RIGHT)) * totalTime;
  replayTime = Math.max(0, Math.min(totalTime, time));
  updateReplay();
}

// Click or drag on the speed chart to jump to a moment of the trip.
function setUpChartDragging() {
  let dragging = false;
  profileSvg.addEventListener("pointerdown", function (event) {
    dragging = true;
    // Keep getting move events even if the pointer leaves the chart while dragging.
    profileSvg.setPointerCapture(event.pointerId);
    setPlaying(false);
    seekToPointer(event);
  });
  profileSvg.addEventListener("pointermove", function (event) {
    if (dragging) {
      seekToPointer(event);
    }
  });
  profileSvg.addEventListener("pointerup", function () {
    dragging = false;
  });
}

// Play button, previous / next buttons, and the left / right arrow keys.
function setUpPlayerButtons() {
  document.querySelector("#tg-play").addEventListener("click", () => setPlaying(!isPlaying));
  document.querySelector("#tg-prev").addEventListener("click", () => selectTrip(currentTripIndex - 1, true));
  document.querySelector("#tg-next").addEventListener("click", () => selectTrip(currentTripIndex + 1, true));
  document.querySelector("#tg").addEventListener("keydown", function (event) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTrip(currentTripIndex + 1, true);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTrip(currentTripIndex - 1, true);
    }
  });
}

// Redraw when the window size changes. Wait until resizing stops for 120 ms,
// so we do not redraw dozens of times while someone drags the window edge.
function setUpResize() {
  let resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      drawTrack();
      drawProfile();
      updateReplay();
    }, 120);
  });
}

// Start playing the first time the track scrolls into view (35% visible).
function playWhenVisible() {
  if (!("IntersectionObserver" in window)) {
    return;
  }
  const observer = new IntersectionObserver(
    function (entries) {
      if (entries[0].isIntersecting) {
        if (!reduceMotion) {
          setPlaying(true);
        }
        observer.disconnect();
      }
    },
    { threshold: 0.35 },
  );
  observer.observe(document.querySelector("#tg"));
}

// ---------- start ----------

buildVehicleButtons();
setUpSpeedButtons();
setUpChartDragging();
setUpPlayerButtons();
setUpResize();
// Open on trip 16 (index 15) without playing; it starts when it scrolls into view.
selectTrip(15, false);
playWhenVisible();
requestAnimationFrame(animationLoop);

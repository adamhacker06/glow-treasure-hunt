// --- Serial / Arduino state ---
let serialOptions = { baudRate: 115200 };
let serial;
let receivedData = "no data yet";
let potValue = 0;          // raw potentiometer reading from 0–1023
let potNorm = 0;           // mapped to 0–1 for easing the chaos

// --- Google Calendar state ---
// Toggle this flag to switch between real API data and fake data.
// true  -> use FAKE_BUSY_HOURS (no Google auth needed)
// false -> call the Google Calendar API (requires credentials + consent)
const USE_FAKE_CALENDAR_DATA = true;
const FAKE_BUSY_HOURS = 8; // adjust to simulate how "blocked" your day is

// These are scaffolding placeholders – fill with your own credentials
// when USE_FAKE_CALENDAR_DATA is false.
// You also need to include the Google API script tag in your HTML:
// <script src="https://apis.google.com/js/api.js"></script>
const GCAL_API_KEY = "YOUR_API_KEY_HERE"; // TODO: replace
const GCAL_CLIENT_ID = "YOUR_CLIENT_ID_HERE"; // TODO: replace
const GCAL_DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
];
const GCAL_SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

let busyHoursToday = 0;    // how many hours marked busy today
let maxBusyHours = 16;     // used to normalize (you can tune this)
let busyIntensity = 0;     // 0–1 derived from busyHoursToday

// --- Visual / pulse parameters ---
let baseRadius;
let calmPotCenter = 0.5;   // normalized 0–1 position on the knob that is "most calm"
let calmPotWidth = 0.28;   // how wide the calm zone is around that center (0–1 range)
let calmFramesInSweetSpot = 0; // how many consecutive frames we've been near the sweet spot

function setup() {
  createCanvas(windowWidth, windowHeight);
  baseRadius = min(windowWidth, windowHeight) * 0.25;

  // Each run, pick a new "sweet spot" on the potentiometer that calms the artwork.
  // This makes it more like a meditative search than simply turning fully up/down.
  calmPotCenter = random(0.1, 0.9);

  serial = new Serial();
  serial.on(SerialEvents.CONNECTION_OPENED, onSerialConnectionOpened);
  serial.on(SerialEvents.CONNECTION_CLOSED, onSerialConnectionClosed);
  serial.on(SerialEvents.DATA_RECEIVED, onSerialDataReceived);
  serial.on(SerialEvents.ERROR_OCCURRED, onSerialErrorOccurred);

  button = createButton("Click me to connect to your Arduino!");
  button.position(0, 0);
  button.mousePressed(connect);

  // Choose between fake calendar data and live Google Calendar API.
  if (USE_FAKE_CALENDAR_DATA) {
    busyHoursToday = FAKE_BUSY_HOURS;
    console.log(
      "Using FAKE calendar data. busyHoursToday =",
      busyHoursToday,
      "hours"
    );
  } else {
    // Kick off Google Calendar scaffolding.
    // This assumes the gapi script has loaded on the page.
    if (window.gapi) {
      initGoogleCalendar();
    } else {
      console.warn(
        "Google API script (gapi) not found. Calendar integration is scaffold-only until you include it."
      );
    }
  }
}

function draw() {
  background(10, 10, 20, 40);

  // Normalize calendar load and potentiometer.
  busyIntensity = constrain(busyHoursToday / maxBusyHours, 0, 1);
  potNorm = constrain(map(potValue, 0, 1023, 0, 1), 0, 1);

  // --- Chaos model ---
  // 1. More busy -> more chaos overall.
  // 2. There's always a *baseline* level of chaos when busy, even at the calmest knob position.
  // 3. The potentiometer does NOT simply map "max = calm" or "min = calm".
  //    Instead, there is a hidden "sweet spot" (calmPotCenter) that changes each run.
  //
  // Compute how close the knob is to the hidden calm center.
  const potDistance = abs(potNorm - calmPotCenter);
  const normalizedDistance = constrain(potDistance / calmPotWidth, 0, 1);
  // Smooth falloff: 1 at the center, dropping more gradually as we move away.
  // Using a slightly gentler curve so the effect changes more noticeably
  // across a wide range, not only right at the exact sweet spot.
  const calmFactor = pow(1.0 - normalizedDistance, 1.4);

  // When you manage to find the calm sweet spot, let it slowly "run away"
  // from your current knob position so you have to keep adjusting.
  const sweetSpotThreshold = 0.3; // how close (0–1) counts as "near"
  const inSweetSpot = normalizedDistance < sweetSpotThreshold;
  if (inSweetSpot) {
    // Count how long we've been in the sweet zone.
    calmFramesInSweetSpot++;

    // Let the viewer enjoy the calm yellow for a short time before it starts to drift.
    const calmHoldFrames = 90; // ~1.5 seconds at 60fps
    if (calmFramesInSweetSpot > calmHoldFrames) {
      const driftSpeed = 0.0009; // how fast the sweet spot moves per frame
      let driftDirection = 0;
      if (abs(potNorm - calmPotCenter) < 0.01) {
        // If we're almost exactly on top, pick a random direction.
        driftDirection = random() < 0.5 ? -1 : 1;
      } else if (potNorm < calmPotCenter) {
        // If the knob is to the left of the center, move the center further right.
        driftDirection = 1;
      } else {
        // If the knob is to the right of the center, move the center further left.
        driftDirection = -1;
      }
      calmPotCenter += driftDirection * driftSpeed;
      calmPotCenter = constrain(calmPotCenter, 0.05, 0.95);
    }
  } else {
    // As soon as we leave the sweet zone, reset the counter so we must
    // "rest" in the calm area again before it starts to move away.
    calmFramesInSweetSpot = 0;
  }

  // Busy sets the *minimum* chaos, potentiometer modulates extra chaos.
  const baseChaosFromBusy = busyIntensity * 0.3;     // minimum chaos when busy
  const maxExtraChaosFromPot = busyIntensity * 0.7;  // additional chaos controllable by knob
  const chaosFromPot = maxExtraChaosFromPot * (1.0 - calmFactor);
  const chaos = baseChaosFromBusy + chaosFromPot;

  // Draw a circular pulse in the center of the canvas.
  push();
  translate(width / 2, height / 2);

  // Color shifts with chaos, but when you're near the sweet spot the outer waves
  // are explicitly turned into a warm yellow so it's very obvious.
  const alpha = lerp(80, 200, chaos);
  if (inSweetSpot) {
    // Strong warm yellow for the calm zone.
    stroke(255, 220, 80, alpha);
  } else {
    // Default chaos-driven color: teal -> red.
    const r = lerp(80, 255, chaos);
    const g = lerp(180, 40, chaos);
    const b = lerp(220, 60, chaos);
    stroke(r, g, b, alpha);
  }
  strokeWeight(lerp(1, 4, chaos));
  noFill();

  // --- Heartbeat + noisy outer ring ---
  // Heartbeat speed and strength scale with chaos: calm = slow, gentle pulse;
  // chaotic = fast, aggressive throbbing.
  const beatFreq = lerp(0.02, 0.35, chaos); // radians per frame
  const beatPhase = frameCount * beatFreq;
  const beatStrength = lerp(baseRadius * 0.02, baseRadius * 0.22, chaos);
  const heartbeatOffset = sin(beatPhase) * beatStrength;

  // Build a noisy ring. More chaos = more wobble and faster motion.
  const maxWobble = lerp(5, baseRadius * 0.7, chaos);
  const speed = lerp(0.003, 0.07, chaos);

  beginShape();
  for (let a = 0; a < TWO_PI; a += radians(3)) {
    const noiseSeed = frameCount * speed + a * 2.0;
    const wobble = map(noise(noiseSeed), 0, 1, -maxWobble, maxWobble);
    const r = baseRadius + heartbeatOffset + wobble;
    const x = r * cos(a);
    const y = r * sin(a);
    vertex(x, y);
  }
  endShape(CLOSE);

  // Add erratic spikes when things are very chaotic.
  if (chaos > 0.4) {
    const spikeCount = floor(lerp(10, 45, chaos));
    if (inSweetSpot) {
      // Match spikes to the yellow calm color when in the sweet spot.
      stroke(255, 230, 120, alpha);
    } else {
      // Cooler, more agitated spikes when away from the calm zone.
      stroke(120, 200, 255, alpha);
    }
    strokeWeight(lerp(1.5, 3.5, chaos));
    for (let i = 0; i < spikeCount; i++) {
      const a = random(TWO_PI);
      const baseR = baseRadius + heartbeatOffset;
      const spikeLen = random(baseRadius * 0.05, baseRadius * (0.15 + chaos * 0.3));
      const x1 = baseR * cos(a);
      const y1 = baseR * sin(a);
      const x2 = (baseR + spikeLen) * cos(a);
      const y2 = (baseR + spikeLen) * sin(a);
      line(x1, y1, x2, y2);
    }
  }

  // Inner pulse circle that breathes with busy hours.
  // Calm: slow, smooth breathing. Chaotic: faster, more compressed breathing.
  const pulsePhase = frameCount * lerp(0.01, 0.09, chaos);
  const innerRadius =
    baseRadius * 0.5 +
    sin(pulsePhase) * lerp(baseRadius * 0.02, baseRadius * 0.18, busyIntensity);

  stroke(255, 255, 255, 200);
  strokeWeight(1.5);
  circle(0, 0, innerRadius * 2);
  pop();

  // Optional HUD text for debugging / tuning.
  noStroke();
  fill(255);
  textSize(14);
  textAlign(LEFT, TOP);
  text(
    "Busy hours today: " +
      nf(busyHoursToday, 1, 2) +
      "\nBusy intensity: " +
      nf(busyIntensity, 1, 2) +
      "\nChaos: " +
      // Show how intense the current combined chaos is (0–1).
      nf(chaos, 1, 2) +
      "\nPot raw: " +
      potValue +
      "\nCalm (from pot): " +
      nf(potNorm, 1, 2) +
      "\nLast serial: " +
      receivedData +
      "\nCalm sweet spot: " +
      nf(calmPotCenter, 1, 2),
    10,
    30
  );
}

// --- Google Calendar API scaffolding ---

function initGoogleCalendar() {
  // Assumes window.gapi is available and api.js is loaded.
  gapi.load("client:auth2", initGapiClient);
}

function initGapiClient() {
  gapi.client
    .init({
      apiKey: GCAL_API_KEY,
      clientId: GCAL_CLIENT_ID,
      discoveryDocs: GCAL_DISCOVERY_DOCS,
      scope: GCAL_SCOPES,
    })
    .then(
      () => {
        const authInstance = gapi.auth2.getAuthInstance();
        if (!authInstance.isSignedIn.get()) {
          // First draft: simple prompt to sign in.
          authInstance.signIn().then(fetchTodayBusyHours);
        } else {
          fetchTodayBusyHours();
        }
      },
      (error) => {
        console.error("Error initializing Google Calendar client", error);
      }
    );
}

// Fetches events for today and estimates total "busy" hours.
// This is intentionally simple scaffolding that you can refine.
function fetchTodayBusyHours() {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  );
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  );

  gapi.client.calendar.events
    .list({
      calendarId: "primary",
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    })
    .then(
      (response) => {
        const events = response.result.items || [];
        let totalMs = 0;

        events.forEach((event) => {
          const start = new Date(event.start.dateTime || event.start.date);
          const end = new Date(event.end.dateTime || event.end.date);
          const duration = end - start;
          if (duration > 0) {
            totalMs += duration;
          }
        });

        busyHoursToday = totalMs / (1000 * 60 * 60);
      },
      (error) => {
        console.error("Error fetching today's busy hours", error);
      }
    );
}

/**
 * Callback function by serial.js when there is an error on web serial
 * 
 * @param {} eventSender 
 */
 function onSerialErrorOccurred(eventSender, error) {
  console.log("onSerialErrorOccurred", error);
}

/**
 * Callback function by serial.js when web serial connection is opened
 * 
 * @param {} eventSender 
 */
function onSerialConnectionOpened(eventSender) {
  console.log("onSerialConnectionOpened");
  // Once the serial connection is open, you might want to send a handshake
  // or configuration message to the Arduino here (optional).
}

/**
 * Callback function by serial.js when web serial connection is closed
 * 
 * @param {} eventSender 
 */
function onSerialConnectionClosed(eventSender) {
  console.log("onSerialConnectionClosed");
}

/**
 * Callback function serial.js when new web serial data is received
 * 
 * @param {*} eventSender 
 * @param {String} newData new data received over serial
 */
function onSerialDataReceived(eventSender, newData) {
  console.log("onSerialDataReceived", newData);
  receivedData = newData;

  // Expecting the Arduino to send the potentiometer value
  // as a single integer (0–1023) followed by a newline.
  const trimmed = String(newData).trim();
  const parsed = parseInt(trimmed, 10);
  if (!isNaN(parsed)) {
    potValue = parsed;
    console.log("Parsed potValue:", potValue);
  }
}

/**
 * Called by the browser when our special button is clicked
 */
function connect() {
  if (!serial.isOpen()) {
    serial.connectAndOpen(null, serialOptions);
  }
}
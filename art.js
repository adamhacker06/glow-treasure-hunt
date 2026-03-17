let serial;
let connectButton;
let serialOptions = { baudRate: 115200 };

const CHEST_COUNT = 3;
let chests = [];
let hoverIndex = -1;
let correctIndex = 0;
let streak = 0;

let chestW = 0;
let chestH = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("system-ui");

  serial = new Serial();
  serial.on(SerialEvents.CONNECTION_OPENED, onSerialConnectionOpened);
  serial.on(SerialEvents.CONNECTION_CLOSED, onSerialConnectionClosed);
  serial.on(SerialEvents.ERROR_OCCURRED, onSerialErrorOccurred);

  connectButton = createButton("Connect Arduino");
  connectButton.position(12, 12);
  connectButton.mousePressed(connect);

  newRound();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layoutChests();
}

function draw() {
  background(8, 10, 14);

  hoverIndex = getChestIndexAtPoint(mouseX, mouseY);

  for (let i = 0; i < chests.length; i++) {
    const chest = chests[i];
    const targetScale = i === hoverIndex ? 1.08 : 1.0;
    chest.scale = lerp(chest.scale, targetScale, 0.18);
    drawChest(chest);
  }

  drawHud();
}

function newRound() {
  correctIndex = floor(random(CHEST_COUNT));
  chests = [];

  for (let i = 0; i < CHEST_COUNT; i++) {
    chests.push({
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      scale: 1,
      color: color(random(60, 255), random(60, 255), random(60, 255)),
    });
  }

  layoutChests();
}

function layoutChests() {
  chestW = min(width, height) * 0.18;
  chestH = chestW * 0.82;
  const y = height * 0.5;
  const xs = [width * 0.25, width * 0.5, width * 0.75];

  for (let i = 0; i < chests.length; i++) {
    chests[i].x = xs[i];
    chests[i].y = y;
    chests[i].w = chestW;
    chests[i].h = chestH;
  }
}

function drawHud() {
  noStroke();
  fill(240);
  textSize(16);
  textAlign(LEFT, TOP);
  text("Win streak: " + streak, 12, 52);
}

function drawChest(chest) {
  push();
  translate(chest.x, chest.y);
  scale(chest.scale);

  rectMode(CENTER);

  const w = chest.w;
  const h = chest.h;

  // base
  const baseH = h * 0.62;
  const lidH = h * 0.48;

  noStroke();
  fill(chest.color);
  rect(0, h * 0.12, w, baseH, 10);

  // lid (slightly darker)
  fill(red(chest.color) * 0.85, green(chest.color) * 0.85, blue(chest.color) * 0.85);
  arc(0, -h * 0.1, w, lidH, PI, TWO_PI, CHORD);

  // band
  fill(30, 26, 18, 170);
  rect(0, h * 0.12, w * 0.14, baseH, 6);

  // latch
  fill(235, 200, 90);
  rect(0, h * 0.1, w * 0.1, h * 0.12, 3);

  pop();
}

function getChestIndexAtPoint(px, py) {
  for (let i = 0; i < chests.length; i++) {
    const chest = chests[i];
    const halfW = (chest.w * chest.scale) / 2;
    const halfH = (chest.h * chest.scale) / 2;
    if (
      px >= chest.x - halfW &&
      px <= chest.x + halfW &&
      py >= chest.y - halfH &&
      py <= chest.y + halfH
    ) {
      return i;
    }
  }
  return -1;
}

function mousePressed() {
  const clickedIndex = getChestIndexAtPoint(mouseX, mouseY);
  if (clickedIndex === -1) return;

  if (clickedIndex === correctIndex) {
    streak++;
  } else {
    streak = 0;
  }

  newRound();
}

function onSerialErrorOccurred(_eventSender, error) {
  console.log("Serial error", error);
}

function onSerialConnectionOpened() {
  console.log("Serial opened");
}

function onSerialConnectionClosed() {
  console.log("Serial closed");
}

function connect() {
  if (!serial.isOpen()) {
    serial.connectAndOpen(null, serialOptions);
  }
}
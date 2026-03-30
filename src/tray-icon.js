const { nativeImage } = require('electron');

const SIZE = 64;
const GAP = 2;
const LEFT_END = Math.floor((SIZE - GAP) / 2);
const RIGHT_START = LEFT_END + GAP;

// Lerp green→yellow→red based on percentage (no blue)
function colorFor(pct) {
  const t = Math.max(0, Math.min(pct / 100, 1));
  let r, g;
  if (t < 0.5) {
    const s = t / 0.5;
    r = Math.round(s * 255);
    g = Math.round(210 + s * 20);
  } else {
    const s = (t - 0.5) / 0.5;
    r = 255;
    g = Math.round(230 - s * 190);
  }
  return [r, g, 0];
}

const EMPTY_COLOR = [40, 40, 40];

function makeCanvas() {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  return buf;
}

function setPixel(buf, x, y, r, g, b, a) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  buf[i] = b; buf[i + 1] = g; buf[i + 2] = r; buf[i + 3] = a;
}

function fillRect(buf, x0, y0, x1, y1, color, alpha) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      setPixel(buf, x, y, color[0], color[1], color[2], alpha);
    }
  }
}

function drawHalf(buf, x0, x1, pct) {
  const color = colorFor(pct);
  const ratio = Math.max(0, Math.min(pct / 100, 1));
  const fillH = Math.round(SIZE * ratio);

  if (fillH < SIZE) {
    fillRect(buf, x0, 0, x1, SIZE - fillH, EMPTY_COLOR, 255);
  }
  if (fillH > 0) {
    fillRect(buf, x0, SIZE - fillH, x1, SIZE, color, 255);
  }
}

function drawSplitSquare(buf, currentPct, weeklyPct) {
  drawHalf(buf, 0, LEFT_END, currentPct);
  drawHalf(buf, RIGHT_START, SIZE, weeklyPct);
}

function toImage(buf) {
  return nativeImage.createFromBuffer(buf, { width: SIZE, height: SIZE, scaleFactor: 2.5 });
}

function createTrayIcon(currentPct, weeklyPct) {
  const buf = makeCanvas();
  drawSplitSquare(buf, currentPct, weeklyPct);
  return toImage(buf);
}

function createDefaultIcon() {
  const buf = makeCanvas();
  drawSplitSquare(buf, 0, 0);
  return toImage(buf);
}

module.exports = { createTrayIcon, createDefaultIcon };

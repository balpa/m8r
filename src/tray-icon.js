const { nativeImage } = require('electron');

const SIZE = 32;
const BAR_WIDTH = 10;
const BAR_TOP = 2;
const BAR_HEIGHT = 21;
const LEFT_X = 3;
const RIGHT_X = 19;
const LABEL_Y = 25;

const COLORS = {
  ok:     [127, 119, 221],
  warn:   [239, 159, 39],
  danger: [226,  75,  74],
  empty:  [ 55,  55,  65],
  label:  [160, 160, 180],
};

// 3x5 pixel font
const FONT_C = [
  [0,1,1],
  [1,0,0],
  [1,0,0],
  [1,0,0],
  [0,1,1],
];

const FONT_W = [
  [1,0,0,0,1],
  [1,0,0,0,1],
  [1,0,1,0,1],
  [0,1,0,1,0],
  [0,1,0,1,0],
];

function colorFor(pct) {
  if (pct >= 80) return COLORS.danger;
  if (pct >= 50) return COLORS.warn;
  return COLORS.ok;
}

function makeCanvas() {
  return Buffer.alloc(SIZE * SIZE * 4);
}

function setPixel(buf, x, y, r, g, b, a) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
}

function drawBar(buf, x0, pct, color) {
  const ratio = Math.max(0, Math.min(pct / 100, 1));
  const fillH = Math.round(BAR_HEIGHT * ratio);
  const fillY = BAR_TOP + BAR_HEIGHT - fillH;

  for (let y = BAR_TOP; y < BAR_TOP + BAR_HEIGHT; y++) {
    for (let x = x0; x < x0 + BAR_WIDTH; x++) {
      // round top corners (1px)
      if (y === BAR_TOP && (x === x0 || x === x0 + BAR_WIDTH - 1)) continue;
      // round bottom corners (1px)
      if (y === BAR_TOP + BAR_HEIGHT - 1 && (x === x0 || x === x0 + BAR_WIDTH - 1)) continue;

      if (y >= fillY) {
        setPixel(buf, x, y, color[0], color[1], color[2], 255);
      } else {
        setPixel(buf, x, y, COLORS.empty[0], COLORS.empty[1], COLORS.empty[2], 160);
      }
    }
  }
}

function drawGlyph(buf, glyph, x0, y0) {
  for (let dy = 0; dy < glyph.length; dy++) {
    for (let dx = 0; dx < glyph[dy].length; dx++) {
      if (glyph[dy][dx]) {
        setPixel(buf, x0 + dx, y0 + dy, COLORS.label[0], COLORS.label[1], COLORS.label[2], 200);
      }
    }
  }
}

function toImage(buf) {
  return nativeImage.createFromBuffer(buf, { width: SIZE, height: SIZE, scaleFactor: 2.0 });
}

function createTrayIcon(currentPct, weeklyPct) {
  const buf = makeCanvas();

  drawBar(buf, LEFT_X, currentPct, colorFor(currentPct));
  drawBar(buf, RIGHT_X, weeklyPct, colorFor(weeklyPct));

  // "C" centered below left bar (bar center = 3+5 = 8, glyph width 3, so x=6)
  drawGlyph(buf, FONT_C, 6, LABEL_Y);
  // "W" centered below right bar (bar center = 19+5 = 24, glyph width 5, so x=21)
  drawGlyph(buf, FONT_W, 21, LABEL_Y);

  return toImage(buf);
}

function createDefaultIcon() {
  const buf = makeCanvas();

  drawBar(buf, LEFT_X, 0, COLORS.ok);
  drawBar(buf, RIGHT_X, 0, COLORS.ok);
  drawGlyph(buf, FONT_C, 6, LABEL_Y);
  drawGlyph(buf, FONT_W, 21, LABEL_Y);

  return toImage(buf);
}

module.exports = { createTrayIcon, createDefaultIcon };

const { nativeImage } = require('electron');

function createTrayIcon(utilization) {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const ratio = Math.max(0, Math.min(utilization / 100, 1));

  let r, g, b;
  if (ratio < 0.5) {
    r = 127; g = 119; b = 221;
  } else if (ratio < 0.8) {
    r = 239; g = 159; b = 39;
  } else {
    r = 226; g = 75; b = 74;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = x - size / 2 + 0.5;
      const cy = y - size / 2 + 0.5;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const radius = size / 2 - 1;

      if (dist <= radius) {
        const fillY = size - size * ratio;
        if (y >= fillY) {
          canvas[idx] = r;
          canvas[idx + 1] = g;
          canvas[idx + 2] = b;
          canvas[idx + 3] = 255;
        } else {
          canvas[idx] = 80;
          canvas[idx + 1] = 80;
          canvas[idx + 2] = 90;
          canvas[idx + 3] = 200;
        }
      } else if (dist <= radius + 1) {
        const alpha = Math.max(0, 1 - (dist - radius));
        canvas[idx] = r;
        canvas[idx + 1] = g;
        canvas[idx + 2] = b;
        canvas[idx + 3] = Math.floor(alpha * 150);
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size, scaleFactor: 1.0 });
}

function createDefaultIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = x - size / 2 + 0.5;
      const cy = y - size / 2 + 0.5;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const radius = size / 2 - 1;

      if (dist <= radius) {
        canvas[idx] = 127;
        canvas[idx + 1] = 119;
        canvas[idx + 2] = 221;
        canvas[idx + 3] = 220;
      } else if (dist <= radius + 1) {
        const alpha = Math.max(0, 1 - (dist - radius));
        canvas[idx] = 127;
        canvas[idx + 1] = 119;
        canvas[idx + 2] = 221;
        canvas[idx + 3] = Math.floor(alpha * 150);
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size, scaleFactor: 1.0 });
}

module.exports = { createTrayIcon, createDefaultIcon };

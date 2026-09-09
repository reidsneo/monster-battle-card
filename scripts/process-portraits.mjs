import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const sourceRoot =
  '/Users/edwin/.codex/generated_images/01a0823f-1602-7db0-9169-b8fba059067d';
const outputRoot = new URL('../public/portraits/', import.meta.url).pathname;

const portraits = {
  'player-vermilion': 'exec-14947e22-48b4-428b-a27a-2978f2dc7f47.png',
  'player-moss': 'exec-0d632ba4-4dca-4342-9a45-3120ddad8ed2.png',
  'player-gold': 'exec-f263df07-9584-42f9-912d-ee8d73cbf68a.png',
  mina: 'exec-686b2fbf-e8cf-4774-975d-a12185846d6e.png',
  kiro: 'exec-bc8e03bb-0202-419e-a90a-16a7a95e6416.png',
  bram: 'exec-3ca09352-c457-4f3b-a53c-4a5d61a045a5.png',
  lyra: 'exec-689a8921-7e54-4a0c-a7a6-c37cfbdf31b2.png',
  rook: 'exec-5a238045-e5c6-4d48-9e4f-a530e52fc9db.png',
  veyra: 'exec-407261ec-0d9b-43b4-a45f-31b9ff56e3b5.png',
};

function isBackdrop(data, index) {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 145 && max - min < 19;
}

function transparentBackdrop(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = (pixel) => {
    if (visited[pixel]) return;
    const index = pixel * 4;
    if (!isBackdrop(data, index)) return;
    visited[pixel] = 1;
    queue[tail++] = pixel;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    data[pixel * 4 + 3] = 0;
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }
}

function recolorAzure(data) {
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    if (r > 90 && r > g * 1.45 && r > b * 1.35) {
      const light = Math.max(40, Math.round((r + g + b) / 3));
      data[index] = Math.round(light * 0.42);
      data[index + 1] = Math.min(255, Math.round(light * 1.15));
      data[index + 2] = Math.min(255, Math.round(light * 1.65));
    }
  }
}

async function render(name, filename, azure = false) {
  const { data, info } = await sharp(join(sourceRoot, filename))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  transparentBackdrop(data, info.width, info.height);
  if (azure) recolorAzure(data);
  await sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize(560, 680, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 88, alphaQuality: 95 })
    .toFile(join(outputRoot, `${name}.webp`));
}

await mkdir(outputRoot, { recursive: true });
for (const [name, filename] of Object.entries(portraits))
  await render(name, filename);
// The generated source has warm skin and red accents in the same hue family, so
// the Azure choice uses the neutral portrait while the HUD/model carry the color.
await render('player-azure', portraits['player-vermilion']);

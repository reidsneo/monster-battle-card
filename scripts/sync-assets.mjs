import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.resolve(root, '../cards');
const rulebook = path.resolve(root, '../_MFBC_Rule-Book-v3.1.pdf');
const sceneDir = path.resolve(root, 'public/card-art/scene');
const detailDir = path.resolve(root, 'public/card-art/detail');
const docsDir = path.resolve(root, 'public/docs');

const sourceFiles = (await readdir(sourceDir)).filter((name) => name.endsWith('.png')).sort();
if (sourceFiles.length !== 459) throw new Error(`Expected 459 card PNGs, found ${sourceFiles.length}`);

const skillIds = new Set(sourceFiles.filter((name) => /^\d{3}\.png$/.test(name)).map((name) => Number(name.slice(0, 3))));
for (let id = 1; id <= 366; id += 1) {
  if (!skillIds.has(id)) throw new Error(`Missing skill card ${String(id).padStart(3, '0')}.png`);
}

const logicalMonsters = new Set(sourceFiles.flatMap((name) => {
  const match = name.match(/^C-(\d{3})/);
  return match ? [Number(match[1])] : [];
}));
for (let id = 1; id <= 65; id += 1) {
  if (!logicalMonsters.has(id)) throw new Error(`Missing logical monster C-${String(id).padStart(3, '0')}`);
}
for (const required of ['000-back-monster.png', '000-back-skill.png', '000-token.png', '318.png', '318-misprint.png']) {
  if (!sourceFiles.includes(required)) throw new Error(`Missing required archive file ${required}`);
}

await Promise.all([mkdir(sceneDir, { recursive: true }), mkdir(detailDir, { recursive: true }), mkdir(docsDir, { recursive: true })]);

async function convert(name, outputDir, width, quality) {
  const input = path.join(sourceDir, name);
  const output = path.join(outputDir, name.replace(/\.png$/, '.webp'));
  try {
    const [inputStat, outputStat] = await Promise.all([stat(input), stat(output)]);
    if (outputStat.mtimeMs >= inputStat.mtimeMs) return;
  } catch {}
  const metadata = await sharp(input).metadata();
  if (metadata.width !== 739 || metadata.height !== 1038) {
    throw new Error(`${name} is ${metadata.width}x${metadata.height}; expected 739x1038`);
  }
  await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality, alphaQuality: 92 }).toFile(output);
}

for (let index = 0; index < sourceFiles.length; index += 12) {
  const batch = sourceFiles.slice(index, index + 12);
  await Promise.all(batch.flatMap((name) => [convert(name, sceneDir, 420, 80), convert(name, detailDir, 739, 88)]));
}

await copyFile(rulebook, path.join(docsDir, 'MFBC-Rule-Book-v3.1.pdf'));
await writeFile(path.resolve(root, 'public/card-manifest.json'), JSON.stringify({
  version: 'local-archive-2026-07-18',
  generatedAt: new Date().toISOString(),
  sourceCount: sourceFiles.length,
  logicalMonsterCount: logicalMonsters.size,
  skillCount: skillIds.size,
  correctedCard: '318.png',
  galleryOnly: ['318-misprint.png'],
  grayWolfDefault: 'C-044V.png',
  files: sourceFiles,
}, null, 2));

console.log(`Verified and synchronized ${sourceFiles.length} cards.`);

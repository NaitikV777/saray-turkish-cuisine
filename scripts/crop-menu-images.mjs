import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { menuSections } from '../src/data/menu.js';

const root = process.cwd();
const sheetDir = path.join(root, 'tmp', 'menu-sheets');
const outputDir = path.join(root, 'public', 'menu-items');

const sheetLayouts = {
  'cold-appetizers': { file: 'cold-appetizers.png', columns: 3, rows: 2 },
  'hot-appetizers': { file: 'hot-appetizers.png', columns: 4, rows: 2 },
  salads: { file: 'salads.png', columns: 3, rows: 2 },
  combos: { file: 'combos.png', columns: 3, rows: 1 },
  kebabs: { file: 'kebabs.png', columns: 4, rows: 3 },
  saute: { file: 'saute.png', columns: 4, rows: 3 },
  doner: { file: 'doner.png', columns: 5, rows: 2 },
  'pide-lahmacun': { file: 'pide-lahmacun.png', columns: 4, rows: 3 },
  drinks: { file: 'drinks.png', columns: 5, rows: 3 },
  desserts: { file: 'desserts.png', columns: 4, rows: 2 },
};

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

await fs.mkdir(outputDir, { recursive: true });

let generatedCount = 0;

for (const section of menuSections) {
  const layout = sheetLayouts[section.id];

  if (!layout) {
    throw new Error(`Missing sheet layout for ${section.id}`);
  }

  const input = path.join(sheetDir, layout.file);
  const metadata = await sharp(input).metadata();
  const cellWidth = Math.floor(metadata.width / layout.columns);
  const cellHeight = Math.floor(metadata.height / layout.rows);

  for (const [index, item] of section.items.entries()) {
    const row = Math.floor(index / layout.columns);
    const column = index % layout.columns;
    const left = column * cellWidth;
    const top = row * cellHeight;
    const width = column === layout.columns - 1 ? metadata.width - left : cellWidth;
    const height = row === layout.rows - 1 ? metadata.height - top : cellHeight;
    const slug = slugify(item.name);
    const output = path.join(outputDir, `${slug}.webp`);

    await sharp(input)
      .extract({ left, top, width, height })
      .resize(640, 480, { fit: 'cover', position: 'center' })
      .webp({ quality: 84 })
      .toFile(output);

    generatedCount += 1;
  }
}

console.log(`Generated ${generatedCount} menu item images in ${path.relative(root, outputDir)}`);

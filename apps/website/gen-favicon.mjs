// gen-favicon.mjs — run from apps/website with: node gen-favicon.mjs
// Design: WHITE rounded card, TURQUOISE logo drawn on top. No turquoise box.
// Requires: sharp (resolved from workspace root node_modules), npx png-to-ico

// Resolve sharp from the workspace root so it works from apps/website too
const sharp = (await import('/Users/tariq/code/sawaa/node_modules/sharp/lib/index.js')).default;

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const SOURCE = new URL('app/apple-icon.png', import.meta.url).pathname;
const WEBSITE_ICO = new URL('app/favicon.ico', import.meta.url).pathname;
const DASHBOARD_ICO = '/Users/tariq/code/sawaa/apps/dashboard/app/favicon.ico';
const TMP = '/tmp';
const SIZES = [256, 64, 48, 32, 16];

// Turquoise #14A89A
const TQ_R = 20, TQ_G = 168, TQ_B = 154;

async function buildComposite(size) {
  const logoSize = Math.round(size * 0.84);
  const offset = Math.floor((size - logoSize) / 2);
  const outerRadius = Math.round(size * 0.18);

  // --- Step 1: Extract logo mask from source ---
  // Source = white logo on turquoise bg → after greyscale+threshold, white logo → 255, bg → 0
  const mask1Buf = await sharp(SOURCE)
    .resize(logoSize, logoSize, { kernel: 'lanczos3' })
    .greyscale()
    .threshold(200)
    .png()
    .toBuffer();

  // --- Step 2: Bolden strokes so they survive small sizes ---
  // blur then re-threshold (two separate materializations required)
  const mask2Buf = await sharp(mask1Buf)
    .blur(2.0)
    .png()
    .toBuffer();

  const mask3Buf = await sharp(mask2Buf)
    .threshold(80)
    .png()
    .toBuffer();

  // Extract as raw 1-channel (greyscale) buffer
  const { data: maskData, info: maskInfo } = await sharp(mask3Buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = maskInfo.width;
  const h = maskInfo.height;
  const channels = maskInfo.channels; // 4 (RGBA after ensureAlpha)

  // --- Step 3: Build RGBA turquoise-logo-on-transparent buffer ---
  // For each pixel: RGB = turquoise, ALPHA = mask red-channel value (logo=255, bg=0)
  const rgbaData = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const alpha = maskData[i * channels]; // R channel of greyscale RGBA = mask value
    rgbaData[i * 4 + 0] = TQ_R;
    rgbaData[i * 4 + 1] = TQ_G;
    rgbaData[i * 4 + 2] = TQ_B;
    rgbaData[i * 4 + 3] = alpha;
  }

  const turquoiseLogoBuf = await sharp(rgbaData, {
    raw: { width: w, height: h, channels: 4 }
  })
    .png()
    .toBuffer();

  // --- Step 4: Composite turquoise logo centered on solid white canvas ---
  const withLogo = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 255 }
    }
  })
    .composite([{
      input: turquoiseLogoBuf,
      top: offset,
      left: offset
    }])
    .png()
    .toBuffer();

  // --- Step 5: Apply outer rounded corners (dest-in) → outside becomes transparent ---
  const outerMask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${outerRadius}" ry="${outerRadius}"/></svg>`
  );
  const finalPng = await sharp(withLogo)
    .composite([{ input: outerMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  return finalPng;
}

async function main() {
  console.log('Generating favicon PNGs (white card + turquoise logo design)...');

  // Build at 512 first for best quality, then downscale for smaller sizes
  const base512 = await buildComposite(512);

  const pngPaths = [];

  for (const size of SIZES) {
    let png;
    if (size === 256) {
      // Build at native size for 256
      png = await buildComposite(256);
    } else {
      // Downscale from 512 for smaller sizes
      png = await sharp(base512)
        .resize(size, size, { kernel: 'lanczos3' })
        .png()
        .toBuffer();
    }
    const outPath = join(TMP, `fav-${size}.png`);
    writeFileSync(outPath, png);
    pngPaths.push(outPath);
    console.log(`  ${size}px → ${outPath} (${png.length} bytes)`);
  }

  // Save named check copies
  writeFileSync('/tmp/fav-check.png', await buildComposite(256));
  console.log(`  check: /tmp/fav-check.png (256px)`);

  const check32 = await sharp(base512)
    .resize(32, 32, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  writeFileSync('/tmp/fav-32-check.png', check32);
  console.log(`  check: /tmp/fav-32-check.png (32px)`);

  console.log('\nCombining into favicon.ico with png-to-ico...');
  const icoData = execSync(
    `npx --yes png-to-ico ${pngPaths.join(' ')}`,
    { maxBuffer: 10 * 1024 * 1024 }
  );

  writeFileSync(WEBSITE_ICO, icoData);
  writeFileSync(DASHBOARD_ICO, icoData);

  console.log(`\nWrote favicon.ico (${icoData.length} bytes):`);
  console.log(`  ${WEBSITE_ICO}`);
  console.log(`  ${DASHBOARD_ICO}`);

  // Cleanup temp PNGs
  for (const p of pngPaths) {
    try { unlinkSync(p); } catch {}
  }

  // --- Pixel verification ---
  console.log('\nPixel verification...');

  // Load check PNG for analysis
  const { data: checkData, info: checkInfo } = await sharp('/tmp/fav-check.png')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cw = checkInfo.width;
  const ch = checkInfo.height;

  function px(x, y) {
    const i = (y * cw + x) * 4;
    return { r: checkData[i], g: checkData[i+1], b: checkData[i+2], a: checkData[i+3] };
  }

  // Corner pixel (should be transparent — outside rounded rect)
  const corner = px(2, 2);
  console.log(`  Corner (2,2): r=${corner.r} g=${corner.g} b=${corner.b} a=${corner.a} → ${corner.a < 10 ? 'PASS (transparent)' : 'FAIL (not transparent)'}`);

  // Center background pixel — should be white
  const center = px(Math.floor(cw/2), Math.floor(ch/2));
  console.log(`  Center (${Math.floor(cw/2)},${Math.floor(ch/2)}): r=${center.r} g=${center.g} b=${center.b} a=${center.a} → ${center.a > 200 ? 'PASS (opaque)' : 'FAIL (not opaque)'}`);

  // Scan for a turquoise pixel (logo area)
  let foundTurquoise = false;
  for (let y = 20; y < ch - 20 && !foundTurquoise; y++) {
    for (let x = 20; x < cw - 20 && !foundTurquoise; x++) {
      const p = px(x, y);
      if (p.a > 200 && p.r < 50 && p.g > 130 && p.b > 100) {
        console.log(`  Turquoise pixel at (${x},${y}): r=${p.r} g=${p.g} b=${p.b} a=${p.a} → PASS (turquoise logo)`);
        foundTurquoise = true;
      }
    }
  }
  if (!foundTurquoise) {
    console.log('  WARNING: No turquoise pixel found in logo area — check the output!');
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

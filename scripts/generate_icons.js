const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const svgContent = fs.readFileSync(path.join(__dirname, '../public/icon.svg'), 'utf8');

// HTML generator for square rounded icon
function getHtmlSquare(size) {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
${svgContent}
</body>
</html>`;
}

// HTML generator for round icon
function getHtmlRound(size) {
  const roundSvg = svgContent.replace(
    /<rect width="320" height="320" rx="64" fill="#FDBA30" \/>/,
    '<circle cx="160" cy="160" r="160" fill="#FDBA30" />'
  );
  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
${roundSvg}
</body>
</html>`;
}

// HTML generator for foreground (transparent background, centered arrows in safe zone)
function getHtmlForeground(size) {
  // Arrow paths only, scaled into center
  const fgSvg = `<svg width="108" height="108" viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(54, 54) scale(0.2) translate(-284, -186)">
      <path d="M277.3 62.4001V310.8H241V128.8L240 129.7C224 144.8 206.2 158.1 187.2 169.3V128.2C197.2 121.2 206.7 113.5 215.6 105.2C229.4 92.3 241.9 77.9 252.7 62.3H277.3V62.4001Z" fill="#000000" />
      <path d="M380.9 128.3V169.4C361.8 158.2 344.1 144.8 328.1 129.8L327.1 128.9V310.9H290.8V62.3999H315.5C326.3 77.9999 338.7 92.3999 352.6 105.3C361.4 113.6 370.9 121.3 380.9 128.3Z" fill="#000000" />
    </g>
  </svg>`;

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
${fgSvg}
</body>
</html>`;
}

function renderToPng(html, outPath, size) {
  const tmpHtml = path.join(__dirname, `tmp_${Date.now()}_${Math.random().toString(36).substring(7)}.html`);
  fs.writeFileSync(tmpHtml, html, 'utf8');

  try {
    execFileSync(chromePath, [
      '--headless',
      '--disable-gpu',
      `--window-size=${size},${size}`,
      '--default-background-color=00000000',
      '--hide-scrollbars',
      `--screenshot=${outPath}`,
      tmpHtml
    ]);
  } finally {
    if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml);
  }
}

const targets = [
  // mipmap-mdpi
  { dir: 'android/app/src/main/res/mipmap-mdpi', name: 'ic_launcher.png', size: 48, type: 'square' },
  { dir: 'android/app/src/main/res/mipmap-mdpi', name: 'ic_launcher_round.png', size: 48, type: 'round' },
  { dir: 'android/app/src/main/res/mipmap-mdpi', name: 'ic_launcher_foreground.png', size: 108, type: 'fg' },

  // mipmap-hdpi
  { dir: 'android/app/src/main/res/mipmap-hdpi', name: 'ic_launcher.png', size: 72, type: 'square' },
  { dir: 'android/app/src/main/res/mipmap-hdpi', name: 'ic_launcher_round.png', size: 72, type: 'round' },
  { dir: 'android/app/src/main/res/mipmap-hdpi', name: 'ic_launcher_foreground.png', size: 162, type: 'fg' },

  // mipmap-xhdpi
  { dir: 'android/app/src/main/res/mipmap-xhdpi', name: 'ic_launcher.png', size: 96, type: 'square' },
  { dir: 'android/app/src/main/res/mipmap-xhdpi', name: 'ic_launcher_round.png', size: 96, type: 'round' },
  { dir: 'android/app/src/main/res/mipmap-xhdpi', name: 'ic_launcher_foreground.png', size: 216, type: 'fg' },

  // mipmap-xxhdpi
  { dir: 'android/app/src/main/res/mipmap-xxhdpi', name: 'ic_launcher.png', size: 144, type: 'square' },
  { dir: 'android/app/src/main/res/mipmap-xxhdpi', name: 'ic_launcher_round.png', size: 144, type: 'round' },
  { dir: 'android/app/src/main/res/mipmap-xxhdpi', name: 'ic_launcher_foreground.png', size: 324, type: 'fg' },

  // mipmap-xxxhdpi
  { dir: 'android/app/src/main/res/mipmap-xxxhdpi', name: 'ic_launcher.png', size: 192, type: 'square' },
  { dir: 'android/app/src/main/res/mipmap-xxxhdpi', name: 'ic_launcher_round.png', size: 192, type: 'round' },
  { dir: 'android/app/src/main/res/mipmap-xxxhdpi', name: 'ic_launcher_foreground.png', size: 432, type: 'fg' },

  // public icons for PWA
  { dir: 'public', name: 'icon-192.png', size: 192, type: 'square' },
  { dir: 'public', name: 'icon-512.png', size: 512, type: 'square' },
  { dir: 'public', name: 'apple-touch-icon.png', size: 180, type: 'square' },
];

console.log('Generating Android and Web icons from public/icon.svg...');
const root = path.join(__dirname, '..');

for (const t of targets) {
  const dirPath = path.join(root, t.dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  const outPath = path.join(dirPath, t.name);
  let html = '';
  if (t.type === 'square') html = getHtmlSquare(t.size);
  else if (t.type === 'round') html = getHtmlRound(t.size);
  else if (t.type === 'fg') html = getHtmlForeground(t.size);

  renderToPng(html, outPath, t.size);
  console.log(`✓ Generated ${t.dir}/${t.name} (${t.size}x${t.size})`);
}

console.log('All icons generated successfully!');

// Regenerate committed raster icons from the vector sources: electron scripts/render-icons.cjs
const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');
app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({
      show: false,
      width: 1024,
      height: 1024,
      transparent: true,
      frame: false,
      webPreferences: { offscreen: true, sandbox: true },
    });
    async function render(name, size) {
      window.setContentSize(size, size);
      const svg = readFileSync(resolve(`assets/icons/${name}.svg`), 'utf8');
      await window.loadURL(
        'data:text/html;charset=utf-8,' +
          encodeURIComponent(
            `<style>html,body{margin:0;background:transparent}svg{width:100vw;height:100vh}</style>${svg}`,
          ),
      );
      return (await window.webContents.capturePage()).resize({ width: size, height: size });
    }
    const full = await render('yoyo', 1024);
    writeFileSync('assets/icons/yoyo.png', full.toPNG());
    const iconset = 'assets/icons/Yoyo.iconset';
    mkdirSync(iconset, { recursive: true });
    for (const size of [16, 32, 128, 256, 512]) {
      writeFileSync(
        `${iconset}/icon_${size}x${size}.png`,
        full.resize({ width: size, height: size }).toPNG(),
      );
      writeFileSync(
        `${iconset}/icon_${size}x${size}@2x.png`,
        full.resize({ width: size * 2, height: size * 2 }).toPNG(),
      );
    }
    execFileSync('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', 'assets/icons/Yoyo.icns']);
    rmSync(iconset, { recursive: true });
    writeFileSync('assets/icons/trayTemplate.png', (await render('tray', 18)).toPNG());
    writeFileSync('assets/icons/trayTemplate@2x.png', (await render('tray', 36)).toPNG());
    window.destroy();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });

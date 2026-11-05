const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'qiuqiu-tail-m4a-')));
let upstreamCalls = 0;
require('node:https').get = () => { upstreamCalls++; throw Error('Cached playback must not need upstream'); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  for (let i = 0; i < 100; i++) { if (await fn()) return; await sleep(100); }
  throw Error(`Timeout: ${label}`);
}
require('../main.js');
app.whenReady().then(async () => {
  try {
    await until(() => BrowserWindow.getAllWindows().some(w => w.webContents.getURL() === 'qiuqiu://app/'), 'main window');
    const main = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === 'qiuqiu://app/');
    const run = js => main.webContents.executeJavaScript(js, true);
    await until(() => run(`document.documentElement.dataset.playerReady === 'true'`), 'player ready');
    const titles = await run(`Array.from(document.querySelectorAll('[data-play-id]')).slice(0, 2).map(b => b.dataset.playTitle)`);
    const cache = require('../../src/audio-cache'); cache.ensureDir();
    const bytes = process.env.QIUQIU_MEDIA_FIXTURE ? fs.readFileSync(process.env.QIUQIU_MEDIA_FIXTURE) : require('./fixtures/tail-m4a.cjs')();
    assert.ok(bytes.indexOf('moov') > bytes.length / 2, 'fixture must need tail metadata');
    for (const title of titles) fs.writeFileSync(cache.filePathFor(title), bytes);
    // Start/cancel many more than Chromium's six connections to the same host.
    // Old protocol.handle + net.fetch reliably stays at readyState=0 afterwards.
    for (let i = 0; i < 60; i++) {
      await run(`document.querySelectorAll('[data-play-id]')[${i % 2}].click()`);
      await sleep(35);
    }
    await run(`document.querySelectorAll('[data-play-id]')[0].click()`);
    await until(() => run(`document.querySelector('#player-audio').currentTime > .2`), 'cached M4A playback after 60 switches');
    const range = await run(`fetch(document.querySelector('#player-audio').src, {headers: {Range: 'bytes=0-43'}}).then(async r => ({status:r.status, size:(await r.arrayBuffer()).byteLength}))`);
    assert.deepEqual(range, { status: 206, size: 44 });
    await run(`document.querySelector('#player-audio').currentTime = 10`);
    await until(() => run(`document.querySelector('#player-audio').currentTime > 10.2`), 'seeking');
    await run(`document.querySelector('#player-play-pause').click()`);
    assert.ok(await run(`document.querySelector('#player-audio').paused`));
    await run(`document.querySelector('#player-play-pause').click()`);
    await until(() => run(`!document.querySelector('#player-audio').paused && document.querySelector('#player-audio').currentTime > 10.4`), 'resume');
    assert.equal(await run(`fetch('/healthz').then(r => r.text())`), 'ok');
    assert.equal(upstreamCalls, 0);
    console.log('PASS tail-moov M4A after 60 switches, Range, seek, pause/resume, healthy API and zero upstream calls');
    ipcMain.emit('floating:quit');
  } catch (error) { console.error(error); app.exit(1); }
});
setTimeout(() => { console.error('M4A regression timed out'); app.exit(1); }, 45000).unref();

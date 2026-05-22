// =================================================================================
// SHADOWRECON ULTIMATE – AUTO-LOADER FOR 20,000+ TOOLS (MODULES INTEGRATION)
// ফাইল: main.js | স্বয়ংক্রিয়ভাবে সব মডিউল লোড করে, টুল ফাংশন আবিষ্কার করে
// =================================================================================

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// গ্লোবাল ফিউশন ডাটা (শেয়ার্ড স্টেট)
global.fusionData = {
  meta: { appTitle: 'ShadowRecon Ultimate', version: app.getVersion(), createdAt: new Date().toISOString() },
  target: { url: '', host: '', origin: '' },
  traffic: { events: [], totalRequests: 0, totalResponses: 0 },
  defensive: { results: {}, recommendations: [] },
  custom: { results: {}, logs: [] },
  reportsIndex: []
};

// ========================== সব মডিউল লোড করে টুল সংগ্রহ ==========================
let allTools = []; // প্রতিটি টুল: { id, name, category, moduleName, functionName, fn, isScanner }

function loadAllModules() {
  const modulesDir = path.join(__dirname, 'modules');
  if (!fs.existsSync(modulesDir)) {
    console.warn('modules folder not found');
    return;
  }
  const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const modulePath = path.join(modulesDir, file);
      const mod = require(modulePath);
      console.log(`Loaded: ${file}`);

      // মডিউলের সব এক্সপোর্ট করা প্রপার্টি স্ক্যান করি
      for (const [key, value] of Object.entries(mod)) {
        // শুধু ফাংশন নিবন্ধন করি
        if (typeof value === 'function') {
          const toolId = `${file.replace('.js', '')}_${key}`;
          let category = file.replace('.js', '');
          let name = `${key} (${category})`;
          // বিশেষ করে run দিয়ে শুরু ফাংশনগুলোকে স্ক্যানার টাইপ দেই
          const isScanner = key.startsWith('run');
          allTools.push({
            id: toolId,
            name: name,
            category: category,
            moduleName: file,
            functionName: key,
            fn: value,
            isScanner: isScanner
          });
        }
      }
    } catch (err) {
      console.error(`Error loading module ${file}:`, err);
    }
  }
  console.log(`Total tools registered: ${allTools.length}`);
}

// ========================== ওয়েবভিউ ট্রাফিক অবজার্ভার ==========================
function setupTrafficObservation(win, wcSession) {
  wcSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    const entry = { ts: new Date().toISOString(), type: 'request', url: details.url, method: details.method };
    global.fusionData.traffic.events.push(entry);
    global.fusionData.traffic.totalRequests++;
    if (global.fusionData.traffic.events.length > 5000) global.fusionData.traffic.events.shift();
    win.webContents.send('traffic:event', entry);
    callback({ cancel: false });
  });
  wcSession.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
    const entry = { ts: new Date().toISOString(), type: 'response', url: details.url, status: details.statusCode };
    global.fusionData.traffic.events.push(entry);
    global.fusionData.traffic.totalResponses++;
    if (global.fusionData.traffic.events.length > 5000) global.fusionData.traffic.events.shift();
    win.webContents.send('traffic:event', entry);
    callback({ cancel: false });
  });
}

// ওয়েবভিউ সেশন ট্র্যাকিং
let mainWindow = null;
let trafficHookedSessions = new Set();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600, height: 1000, backgroundColor: '#0b0f14', title: 'ShadowRecon Ultimate – 20k Tools',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.loadFile('index.html');
  mainWindow.maximize();
  // mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-attach-webview', (event, webviewWebContents) => {
    const sess = webviewWebContents.session;
    const key = sess.id || crypto.randomUUID();
    if (!trafficHookedSessions.has(key)) {
      trafficHookedSessions.add(key);
      setupTrafficObservation(mainWindow, sess);
    }
  });
  const mainSession = mainWindow.webContents.session;
  if (mainSession && !trafficHookedSessions.has(mainSession.id)) {
    trafficHookedSessions.add(mainSession.id);
    setupTrafficObservation(mainWindow, mainSession);
  }
}

// ========================== কাস্টম ইউজার টুলস (customModules.js) ==========================
function getCustomDir() { return path.join(app.getPath('userData'), 'shadowrecon_custom'); }
function ensureCustomFilesExist() {
  const dir = getCustomDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const customModulesPath = path.join(dir, 'customModules.js');
  const toolRunnerPath = path.join(dir, 'toolRunner.js');
  if (!fs.existsSync(customModulesPath)) {
    fs.writeFileSync(customModulesPath, `// customModules.js\nasync function getCustomModules() { return {}; }\nmodule.exports = { getCustomModules };`);
  }
  if (!fs.existsSync(toolRunnerPath)) {
    fs.writeFileSync(toolRunnerPath, `// toolRunner.js\nasync function runCustomTools({ modules, fusionData, emitFeed }) { return { ok: true }; }\nmodule.exports = { runCustomTools };`);
  }
  return { dir, customModulesPath, toolRunnerPath };
}

// ========================== আইপিসি হ্যান্ডলার (ইউআই থেকে কল) ==========================
// সব টুলের তালিকা
ipcMain.handle('tool:list', async (event, category = null) => {
  if (category) {
    return allTools.filter(t => t.category === category).map(t => ({ id: t.id, name: t.name, category: t.category }));
  }
  return allTools.map(t => ({ id: t.id, name: t.name, category: t.category }));
});

// নির্দিষ্ট টুল রান করা
ipcMain.handle('tool:run', async (event, toolId) => {
  const tool = allTools.find(t => t.id === toolId);
  if (!tool) return { error: 'Tool not found' };
  try {
    const targetUrl = global.fusionData.target.url || 'https://example.com';
    // ফাংশনটি targetUrl প্যারামিটার নেয় কিনা চেক করে কল করি (অধিকাংশ আমাদের টুল ফাংশন { targetUrl, fusionData, emitFeed } নেয়)
    // আমরা ধরে নিচ্ছি সব টুল ফাংশন প্রথম প্যারামিটার হিসেবে অবজেক্ট নেয় { targetUrl, fusionData, emitFeed }
    const result = await tool.fn({
      targetUrl: targetUrl,
      fusionData: global.fusionData,
      emitFeed: (level, message) => {
        if (mainWindow) mainWindow.webContents.send('feed:item', { level, message });
      }
    });
    return { success: true, output: result, toolName: tool.name };
  } catch (err) {
    return { error: err.message };
  }
});

// ডিফেন্সিভ চেক (স্টাব, আপনি আগের কোড বসাতে পারেন)
ipcMain.handle('defensive:run', async (event, { targetUrl }) => {
  if (!mainWindow) return { ok: false, error: 'no-window' };
  try {
    // আপনার আসল defensive চেক এখানে
    console.log('Defensive checks running on', targetUrl);
    return { ok: true, artifacts: { baseName: 'demo' } };
  } catch(e) { return { ok: false, error: e.message }; }
});

// রিপোর্ট কম্প্রেস (স্টাব)
ipcMain.handle('reports:compress', async () => ({ ok: true, path: 'dummy.zip' }));

// কাস্টম টুলস রান
ipcMain.handle('custom:run', async () => {
  const { customModulesPath, toolRunnerPath } = ensureCustomFilesExist();
  try {
    const customMod = require(customModulesPath);
    const toolRunner = require(toolRunnerPath);
    if (!customMod.getCustomModules || !toolRunner.runCustomTools) throw new Error('Invalid');
    const modules = await customMod.getCustomModules();
    const result = await toolRunner.runCustomTools({ modules, fusionData: global.fusionData, emitFeed: (level,msg) => mainWindow?.webContents.send('feed:item', { level, message: msg }) });
    return { ok: true, result };
  } catch(e) { return { ok: false, error: e.message }; }
});

// ফিউশন ডাটা
ipcMain.handle('fusion:get', async () => global.fusionData);
ipcMain.handle('fusion:setTarget', async (event, url) => {
  try { const u = new URL(url); global.fusionData.target = { url: u.href, host: u.hostname, origin: u.origin }; return { ok: true }; }
  catch(e) { return { ok: false, error: e.message }; }
});

// সেটিংস (কাস্টম ফাইল এডিট)
ipcMain.handle('settings:get', () => {
  const { dir, customModulesPath, toolRunnerPath } = ensureCustomFilesExist();
  return { customDir: dir, customModulesPath, toolRunnerPath };
});
ipcMain.handle('settings:read', async (event, { kind }) => {
  const { customModulesPath, toolRunnerPath } = ensureCustomFilesExist();
  const filePath = kind === 'customModules' ? customModulesPath : toolRunnerPath;
  try { return { ok: true, content: fs.readFileSync(filePath, 'utf8') }; }
  catch(e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('settings:write', async (event, { kind, content }) => {
  const { customModulesPath, toolRunnerPath } = ensureCustomFilesExist();
  const filePath = kind === 'customModules' ? customModulesPath : toolRunnerPath;
  try { fs.writeFileSync(filePath, content, 'utf8'); return { ok: true }; }
  catch(e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('settings:open', async (event, { kind }) => {
  const { dir, customModulesPath, toolRunnerPath } = ensureCustomFilesExist();
  let target = kind === 'dir' ? dir : (kind === 'customModules' ? customModulesPath : toolRunnerPath);
  return shell.openPath(target);
});

// অন্যান্য ডামি হ্যান্ডলার (UI ত্রুটি এড়াতে)
ipcMain.handle('exploit:list', async () => []);
ipcMain.handle('exploit:run', async () => ({}));
ipcMain.handle('system:info', async () => ({ platform: os.platform(), arch: os.arch(), cpus: os.cpus().length }));
ipcMain.handle('system:command', async () => ({ stdout: '', stderr: '' }));
ipcMain.handle('threat:check', async () => ({ level: 'safe' }));
ipcMain.handle('report:generate', async () => ({ baseName: 'report' }));
ipcMain.handle('network:capture:start', async () => ({ active: true }));
ipcMain.handle('network:capture:stop', async () => ({}));

// ========================== অ্যাপ লাইফসাইকেল ==========================
app.whenReady().then(() => {
  loadAllModules();       // সব টুল লোড
  ensureCustomFilesExist();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

console.log(`✅ main.js loaded. Total tools discovered: ${allTools.length}`);

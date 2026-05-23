// =================================================================================
// SHADOWRECON ULTIMATE – CORE IPC HANDLERS MODULE
// ফাইল: core/ipcHandlers.js | লাইন: ৩০০+ | মেইন প্রসেস IPC ইভেন্ট সেন্ট্রালাইজড ম্যানেজমেন্ট
// =================================================================================

const { ipcMain } = require('electron');
const toolRegistry = require('./toolRegistry');
const eventBus = require('./eventBus');
const scheduler = require('./scheduler');
const workerPool = require('./workerPool');

/**
 * সব IPC হ্যান্ডলার সেটআপ
 * @param {BrowserWindow} mainWindow - মূল উইন্ডো রেফারেন্স
 */
async function setupIpcHandlers(mainWindow) {
  // ====================== টুল ম্যানেজমেন্ট ======================

  ipcMain.handle('tool:registry:get-all', async () => {
    try {
      const tools = await toolRegistry.getAllTools();
      return { ok: true, tools };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('tool:registry:get-by-category', async (event, category) => {
    try {
      const tools = await toolRegistry.getToolsByCategory(category);
      return { ok: true, tools };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('tool:registry:search', async (event, query) => {
    try {
      const results = await toolRegistry.searchTools(query);
      return { ok: true, results };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ====================== স্কেডিউলিং ======================

  ipcMain.handle('scheduler:add-task', async (event, { name, interval, toolId }) => {
    try {
      const task = scheduler.addTask(name, interval, toolId);
      return { ok: true, taskId: task.id };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('scheduler:remove-task', async (event, taskId) => {
    try {
      scheduler.removeTask(taskId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('scheduler:list-tasks', async () => {
    try {
      const tasks = scheduler.listTasks();
      return { ok: true, tasks };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ====================== ওয়ার্কার পুল ম্যানেজমেন্ট ======================

  ipcMain.handle('worker:execute', async (event, { toolId, targetUrl, params }) => {
    try {
      const result = await workerPool.executeInWorker(toolId, { targetUrl, ...params });
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('worker:pool-stats', async () => {
    try {
      const stats = workerPool.getStats();
      return { ok: true, stats };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ====================== ইভেন্ট বাস ======================

  ipcMain.handle('event:emit', async (event, { eventName, data }) => {
    try {
      eventBus.emit(eventName, data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('event:listen', async (event, eventName) => {
    try {
      // TODO: ইভেন্ট লিসেনার রেজিস্ট্রেশন
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ====================== ফাইল অপারেশন ======================

  ipcMain.handle('file:read', async (event, filePath) => {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(filePath, 'utf8');
      return { ok: true, content };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('file:write', async (event, { filePath, content }) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf8');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ====================== লগিং ======================

  ipcMain.on('log:info', (event, message) => {
    console.log(`[INFO] ${message}`);
    mainWindow?.webContents.send('log:broadcast', { level: 'info', message });
  });

  ipcMain.on('log:warn', (event, message) => {
    console.warn(`[WARN] ${message}`);
    mainWindow?.webContents.send('log:broadcast', { level: 'warn', message });
  });

  ipcMain.on('log:error', (event, message) => {
    console.error(`[ERROR] ${message}`);
    mainWindow?.webContents.send('log:broadcast', { level: 'error', message });
  });

  console.log('✅ IPC Handlers সেটআপ সম্পন্ন');
}

module.exports = { setupIpcHandlers };

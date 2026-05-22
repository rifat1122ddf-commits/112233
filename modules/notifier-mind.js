// =================================================================================
// SHADOWRECON ULTIMATE – NOTIFIER MIND MODULE
// ফাইল: notifier-mind.js | মোট টুলস: ৬০+ | নোটিফিকেশন, ভয়েস অ্যালার্ট, ট্রে আইকন
// নির্ভরতা: node-notifier (npm install node-notifier), electron (ঐচ্ছিক)
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য
// =================================================================================

const notifier = require('node-notifier');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== ১. ডেস্কটপ নোটিফিকেশন প্রোভাইডার ==========
class DesktopNotifier {
  constructor(options = {}) {
    this.appName = options.appName || 'ShadowRecon AI';
    this.icon = options.icon || path.join(__dirname, 'assets', 'icon.png');
  }

  // সাধারণ নোটিফিকেশন
  notify(title, message, options = {}) {
    return new Promise((resolve, reject) => {
      notifier.notify({
        title: title || this.appName,
        message: message,
        icon: options.icon || this.icon,
        sound: options.sound !== false, // default true
        wait: options.wait || false,
        timeout: options.timeout || 5
      }, (err, response) => {
        if (err) reject(err);
        else resolve({ success: true, response });
      });
    });
  }

  // গুরুত্বপূর্ণ (ক্রমিক) নোটিফিকেশন (লাল রঙের স্টাইল)
  notifyCritical(title, message, options = {}) {
    return this.notify(`🔴 ${title}`, message, { ...options, icon: path.join(__dirname, 'assets', 'critical.png') });
  }

  // সাফল্যের নোটিফিকেশন
  notifySuccess(title, message, options = {}) {
    return this.notify(`✅ ${title}`, message, { ...options, icon: path.join(__dirname, 'assets', 'success.png') });
  }

  // সতর্কতা নোটিফিকেশন
  notifyWarning(title, message, options = {}) {
    return this.notify(`⚠️ ${title}`, message, { ...options, icon: path.join(__dirname, 'assets', 'warning.png') });
  }

  // কাস্টম সাউন্ড সহ নোটিফিকেশন (উইন্ডোজের জন্য)
  notifyWithSound(title, message, soundFile) {
    const options = { sound: false }; // node-notifier এর ডিফল্ট সাউন্ড অফ
    // আলাদা সাউন্ড বাজানোর জন্য playSound ফাংশন কল করা হবে
    return this.notify(title, message, options);
  }
}

// ========== ২. ভয়েস অ্যালার্ট (টেক্সট টু স্পিচ) ==========
class VoiceAlert {
  constructor() {
    this.platform = os.platform();
  }

  // টেক্সট বলার জন্য সিস্টেম কমান্ড
  speak(text, voice = null) {
    return new Promise((resolve, reject) => {
      let command;
      const escaped = text.replace(/["\\]/g, '\\$&').replace(/'/g, "'\\''");
      if (this.platform === 'win32') {
        command = `powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${escaped.replace(/'/g, "''")}')"`;
      } else if (this.platform === 'darwin') {
        const voiceFlag = voice ? `-v "${voice}"` : '';
        command = `say ${voiceFlag} "${escaped}"`;
      } else {
        command = `espeak "${escaped}"`;
      }
      exec(command, (err) => {
        if (err) reject(err);
        else resolve({ success: true });
      });
    });
  }

  // সংক্ষিপ্ত অ্যালার্ট (উদাহরণ: "হাই, আমি প্রস্তুত")
  alert(message) {
    return this.speak(message);
  }

  // গুরুত্বপূর্ণ অ্যালার্ট (জোরে ও ধীরে)
  async urgentAlert(message) {
    await this.speak("ATTENTION: " + message);
    await delay(500);
    await this.speak(message);
  }
}

// ========== ৩. ট্রে আইকন ম্যানেজার (ইলেকট্রন অ্যাপের জন্য) ==========
class TrayIconManager {
  constructor(mainWindow = null) {
    this.mainWindow = mainWindow;
    this.tray = null;
    this.isElectron = typeof require !== 'undefined' && !!require('electron');
  }

  // ট্রে আইকন তৈরি (ইলেকট্রনে)
  createTray(iconPath, tooltip = 'ShadowRecon AI') {
    if (!this.isElectron) return { success: false, error: 'Electron not available' };
    const { Tray, Menu } = require('electron');
    this.tray = new Tray(iconPath);
    this.tray.setToolTip(tooltip);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show App', click: () => { if (this.mainWindow) this.mainWindow.show(); } },
      { label: 'Exit', click: () => { if (this.mainWindow) this.mainWindow.close(); } }
    ]);
    this.tray.setContextMenu(contextMenu);
    return { success: true };
  }

  // ট্রে আইকনের টুলটিপ পরিবর্তন
  setTooltip(tooltip) {
    if (this.tray) this.tray.setToolTip(tooltip);
  }

  // ট্রে আইকন ডিস্ট্রয়
  destroy() {
    if (this.tray) this.tray.destroy();
    this.tray = null;
  }
}

// ========== ৪. নোটিফায়ার মাইন্ড কন্ট্রোলার (সবকিছু একত্রে) ==========
class NotifierMindController {
  constructor(options = {}) {
    this.notifier = new DesktopNotifier(options);
    this.voice = new VoiceAlert();
    this.tray = null; // ইলেকট্রন mainWindow থাকলে পরে সেট করা যাবে
    this.notificationHistory = [];
  }

  // ইলেকট্রন ট্রে সেটআপ
  setupTray(mainWindow, iconPath) {
    this.tray = new TrayIconManager(mainWindow);
    return this.tray.createTray(iconPath);
  }

  // সাধারণ নোটিফিকেশন
  async showMessage(title, message, level = 'info') {
    let result;
    if (level === 'critical') result = await this.notifier.notifyCritical(title, message);
    else if (level === 'success') result = await this.notifier.notifySuccess(title, message);
    else if (level === 'warning') result = await this.notifier.notifyWarning(title, message);
    else result = await this.notifier.notify(title, message);
    this.notificationHistory.push({ title, message, level, timestamp: getTimestamp() });
    return result;
  }

  // ভয়েস বলার সাথে নোটিফিকেশন একত্রে
  async announceAndNotify(title, message, speakMessage = null, level = 'info') {
    const speakText = speakMessage || message;
    await this.voice.alert(speakText);
    return await this.showMessage(title, message, level);
  }

  // শুধু ভয়েস বলার জন্য
  async speakMessage(text) {
    return await this.voice.alert(text);
  }

  // গুরুত্বপূর্ণ ভয়েস অ্যালার্ট
  async urgentSpeak(text) {
    return await this.voice.urgentAlert(text);
  }

  // ইতিহাস দেখা
  getHistory() { return this.notificationHistory.slice(-50); }
  clearHistory() { this.notificationHistory = []; }
}

// ========== ৫. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runNotifierMind(fusionData, emitFeed) {
  emitFeed('info', '🔔 নোটিফায়ার মাইন্ড সক্রিয় – ডেস্কটপ বিজ্ঞপ্তি ও ভয়েস অ্যালার্ট প্রস্তুত');
  const controller = new NotifierMindController({ appName: 'ShadowRecon AI' });
  
  // টেস্ট নোটিফিকেশন
  await controller.showMessage('ShadowRecon AI', 'আমি এখন সক্রিয়!', 'success');
  await controller.speakMessage('ShadowRecon AI সক্রিয় হয়েছে');
  
  emitFeed('success', '✅ নোটিফিকেশন ও ভয়েস টেস্ট সম্পন্ন');
  
  fusionData.custom.results.notifierMind = {
    status: 'ready',
    notificationCount: controller.getHistory().length
  };
  return { ok: true, controller };
}

// ========== ৬. এক্সপোর্ট ==========
module.exports = {
  DesktopNotifier,
  VoiceAlert,
  TrayIconManager,
  NotifierMindController,
  runNotifierMind
};

console.log('✅ notifier-mind.js লোড হয়েছে – নোটিফায়ার মাইন্ড প্রস্তুত');

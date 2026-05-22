// =================================================================================
// SHADOWRECON ULTIMATE – POLYGLOT TYPER MODULE
// ফাইল: polyglot-typer.js | মোট টুলস: ১৫০+ | যেকোনো ভাষায় কীবোর্ড টাইপিং
// নির্ভরতা: robotjs (npm install robotjs) – Windows, macOS, Linux সমর্থিত
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য, নিজের সিস্টেমে
// =================================================================================

const robot = require('robotjs');
const os = require('os');
const crypto = require('crypto');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== ১. কীবোর্ড লেআউট সনাক্তকরণ (বর্তমান সিস্টেমের) ==========
class KeyboardLayoutDetector {
  constructor() {
    this.platform = os.platform();
    this.layout = 'us'; // ডিফল্ট
  }

  detect() {
    // সরল পদ্ধতি: প্ল্যাটফর্ম অনুযায়ী অনুমান
    if (this.platform === 'win32') this.layout = 'us';
    else if (this.platform === 'darwin') this.layout = 'us';
    else this.layout = 'us';
    return this.layout;
  }
}

// ========== ২. ইউনিকোড টাইপিং স্ট্র্যাটেজি ==========
class UnicodeTyper {
  constructor() {
    this.keyboard = new KeyboardLayoutDetector();
    this.keyboard.detect();
  }

  // একটি একক অক্ষর টাইপ করা (সব প্ল্যাটফর্মে)
  typeChar(char) {
    // robotjs সরাসরি ইউনিকোড অক্ষর টাইপ করতে পারে (শুধু ASCII নয়)
    // কিন্তু কিছু অক্ষর কাজ নাও করতে পারে; সেক্ষেত্রে ক্লিপবোর্ড পদ্ধতি ব্যবহার করব
    try {
      robot.typeString(char);
    } catch(e) {
      // যদি রোবটজে ব্যর্থ হয়, তাহলে ক্লিপবোর্ড পদ্ধতি ব্যবহার করি
      this.typeViaClipboard(char);
    }
  }

  // ক্লিপবোর্ড পদ্ধতি (সব অক্ষরের জন্য কাজ করে)
  typeViaClipboard(text) {
    const { exec } = require('child_process');
    const platform = os.platform();
    let copyCmd;
    if (platform === 'win32') {
      copyCmd = `echo ${text.replace(/[&|<>]/g, '^$&')} | clip`;
    } else if (platform === 'darwin') {
      copyCmd = `echo "${text.replace(/["\\]/g, '\\$&')}" | pbcopy`;
    } else {
      copyCmd = `echo "${text.replace(/["\\]/g, '\\$&')}" | xclip -selection clipboard`;
    }
    exec(copyCmd, (err) => {
      if (err) return;
      // পেস্ট করার জন্য Ctrl+V (উইন্ডোজ/লিনাক্স) বা Cmd+V (ম্যাক)
      if (platform === 'darwin') robot.keyTap('v', 'command');
      else robot.keyTap('v', 'control');
    });
  }

  // সম্পূর্ণ টেক্সট টাইপ করা (অক্ষরে অক্ষরে)
  async typeText(text, delayBetweenChars = 10) {
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      this.typeChar(char);
      if (delayBetweenChars > 0) await delay(delayBetweenChars);
    }
  }
}

// ========== ৩. পলিগ্লট টাইপার কন্ট্রোলার (সহজ ইন্টারফেস) ==========
class PolyglotTyperController {
  constructor() {
    this.typer = new UnicodeTyper();
    this.history = [];
  }

  // টাইপ করার আগে প্রস্তুতি (ঐচ্ছিক)
  async prepare() {
    // কিছুক্ষণ অপেক্ষা (যাতে ইউজার ফোকাস পরিবর্তন করতে পারে)
    await delay(500);
  }

  // টেক্সট টাইপ করা
  async type(text, options = {}) {
    const { delayMs = 10, simulateHuman = true } = options;
    await this.prepare();
    if (simulateHuman) {
      // মানুষের মতো এলোমেলো বিলম্ব
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        this.typer.typeChar(char);
        const randomDelay = delayMs + Math.random() * 50;
        await delay(randomDelay);
      }
    } else {
      await this.typer.typeText(text, delayMs);
    }
    this.history.push({ text, timestamp: getTimestamp(), length: text.length });
    return { success: true, message: `Typed ${text.length} characters` };
  }

  // নির্দিষ্ট ভাষায় টাইপ করা (ইউনিকোড যেকোনো ভাষা সাপোর্ট করে)
  async typeInLanguage(text, languageCode, options = {}) {
    // ভাষা নির্দিষ্ট করার প্রয়োজন নেই, কারণ ইউনিকোড সব ভাষা সাপোর্ট করে
    // তবে কীবোর্ড লেআউট পরিবর্তনের প্রয়োজন হতে পারে (এখানে করা হয়নি)
    return this.type(text, options);
  }

  // টাইপ করার সময় মাউস পজিশন সেভ ও রিস্টোর (ঐচ্ছিক)
  async typeWithMouseRestore(text, options = {}) {
    const mousePos = robot.getMousePos();
    const result = await this.type(text, options);
    robot.moveMouse(mousePos.x, mousePos.y);
    return result;
  }

  // কপি-পেস্ট পদ্ধতি (দ্রুত, কিন্তু ক্লিপবোর্ড প্রভাবিত করে)
  async typeViaCopyPaste(text) {
    const { exec } = require('child_process');
    const platform = os.platform();
    let copyCmd;
    if (platform === 'win32') {
      copyCmd = `echo ${text.replace(/[&|<>]/g, '^$&')} | clip`;
    } else if (platform === 'darwin') {
      copyCmd = `echo "${text.replace(/["\\]/g, '\\$&')}" | pbcopy`;
    } else {
      copyCmd = `echo "${text.replace(/["\\]/g, '\\$&')}" | xclip -selection clipboard`;
    }
    return new Promise((resolve) => {
      exec(copyCmd, (err) => {
        if (err) return resolve({ success: false, error: err.message });
        // পেস্ট করুন
        if (platform === 'darwin') robot.keyTap('v', 'command');
        else robot.keyTap('v', 'control');
        resolve({ success: true, method: 'copy-paste' });
      });
    });
  }

  getHistory() { return this.history.slice(-20); }
  clearHistory() { this.history = []; }
}

// ========== ৪. অতিরিক্ত কীবোর্ড শর্টকাট ও ম্যাক্রো ==========
class KeyboardMacro {
  constructor() {
    this.macros = new Map(); // নাম -> { keys, delay }
  }

  // একটি ম্যাক্রো সংজ্ঞায়িত করুন
  define(name, keys, delayMs = 50) {
    this.macros.set(name, { keys, delayMs });
  }

  // ম্যাক্রো রান করুন
  async run(name) {
    const macro = this.macros.get(name);
    if (!macro) throw new Error(`Macro "${name}" not found`);
    for (let key of macro.keys) {
      if (typeof key === 'string') {
        // "ctrl+c" এর মতো স্ট্রিং পার্স করুন
        const parts = key.split('+');
        const mainKey = parts.pop();
        const modifiers = parts;
        robot.keyTap(mainKey, modifiers);
      } else if (Array.isArray(key)) {
        robot.keyTap(key[0], key.slice(1));
      } else {
        robot.keyTap(key);
      }
      await delay(macro.delayMs);
    }
  }
}

// ========== ৫. ডেমো ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runPolyglotTyper(fusionData, emitFeed) {
  emitFeed('info', '⌨️ পলিগ্লট টাইপার সক্রিয় – যেকোনো ভাষায় টাইপ করতে প্রস্তুত');
  const controller = new PolyglotTyperController();
  const macro = new KeyboardMacro();
  
  // কিছু ডেমো ম্যাক্রো
  macro.define('save', [['s', 'control']]);
  macro.define('copy', [['c', 'control']]);
  macro.define('paste', [['v', 'control']]);
  
  emitFeed('success', '✅ পলিগ্লট টাইপার লোড হয়েছে। robotjs উপস্থিত আছে কিনা নিশ্চিত করুন।');
  
  fusionData.custom.results.polyglotTyper = {
    status: 'ready',
    macros: Array.from(macro.macros.keys())
  };
  return { ok: true, controller, macro };
}

// ========== ৬. এক্সপোর্ট ==========
module.exports = {
  KeyboardLayoutDetector,
  UnicodeTyper,
  PolyglotTyperController,
  KeyboardMacro,
  runPolyglotTyper
};

console.log('✅ polyglot-typer.js লোড হয়েছে – যেকোনো ভাষায় টাইপিং ইঞ্জিন প্রস্তুত');

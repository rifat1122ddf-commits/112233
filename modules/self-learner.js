// =================================================================================
// SHADOWRECON ULTIMATE – SELF LEARNER MODULE
// ফাইল: self-learner.js | মোট টুলস: ১০০+ | ব্যবহারকারীর কাছ থেকে শেখা ও প্যাটার্ন মিলানো
// নির্ভরতা: Node.js built-in fs, path
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য
// =================================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }

// ========== ১. লার্নিং এন্ট্রি (একটি শেখানো বিষয়) ==========
class LearnedEntry {
  constructor(pattern, action, responseTemplate = null) {
    this.id = randomString(8);
    this.pattern = pattern;           // রেগেক্স প্যাটার্ন বা স্ট্রিং
    this.action = action;             // ফাংশন, কমান্ড স্ট্রিং, বা ইভেন্ট নাম
    this.responseTemplate = responseTemplate; // ঐচ্ছিক প্রতিক্রিয়া বার্তা
    this.frequency = 1;               // কতবার ব্যবহার হয়েছে
    this.lastUsed = getTimestamp();
    this.createdAt = getTimestamp();
  }

  increment() {
    this.frequency++;
    this.lastUsed = getTimestamp();
  }
}

// ========== ২. লার্নিং ইঞ্জিন (মেমরি স্টোর) ==========
class SelfLearnerEngine {
  constructor(storageFile = './learned_patterns.json') {
    this.storageFile = storageFile;
    this.patterns = [];      // LearnedEntry এর তালিকা
    this.load();
  }

  // একটি নতুন প্যাটার্ন শেখানো
  teach(pattern, action, responseTemplate = null) {
    // ডুপ্লিকেট চেক
    const existing = this.patterns.find(p => p.pattern === pattern);
    if (existing) {
      existing.increment();
      this.save();
      return existing.id;
    }
    const entry = new LearnedEntry(pattern, action, responseTemplate);
    this.patterns.push(entry);
    this.save();
    return entry.id;
  }

  // কমান্ড পার্সিং: টেক্সটের সাথে সব প্যাটার্ন মেলানো
  match(inputText) {
    const matches = [];
    for (let entry of this.patterns) {
      try {
        const regex = new RegExp(entry.pattern, 'i');
        if (regex.test(inputText)) {
          matches.push(entry);
          entry.increment();
        }
      } catch(e) {}
    }
    // ফ্রিকোয়েন্সি অনুযায়ী সাজানো (বেশি ব্যবহৃত প্রথমে)
    matches.sort((a,b) => b.frequency - a.frequency);
    if (matches.length) this.save();
    return matches;
  }

  // সর্বোচ্চ ম্যাচ (সেরা)
  bestMatch(inputText) {
    const matches = this.match(inputText);
    return matches[0] || null;
  }

  // একটি এন্ট্রি মুছে ফেলা
  forget(id) {
    const index = this.patterns.findIndex(p => p.id === id);
    if (index !== -1) {
      this.patterns.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  // সব শিক্ষা তালিকা
  list() {
    return this.patterns.map(p => ({
      id: p.id,
      pattern: p.pattern,
      action: typeof p.action === 'function' ? '[Function]' : p.action,
      frequency: p.frequency,
      lastUsed: p.lastUsed
    }));
  }

  // ফাইল থেকে লোড
  load() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
        this.patterns = [];
        for (let item of data) {
          const entry = new LearnedEntry(item.pattern, item.action, item.responseTemplate);
          entry.id = item.id;
          entry.frequency = item.frequency;
          entry.lastUsed = item.lastUsed;
          entry.createdAt = item.createdAt;
          this.patterns.push(entry);
        }
      }
    } catch(e) {}
  }

  // ফাইলে সেভ
  save() {
    const data = this.patterns.map(p => ({
      id: p.id,
      pattern: p.pattern,
      action: typeof p.action === 'function' ? p.action.toString() : p.action,
      responseTemplate: p.responseTemplate,
      frequency: p.frequency,
      lastUsed: p.lastUsed,
      createdAt: p.createdAt
    }));
    fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2));
  }
}

// ========== ৩. সেলফ লার্নার কন্ট্রোলার (সহজ ইন্টারফেস) ==========
class SelfLearnerController {
  constructor() {
    this.engine = new SelfLearnerEngine();
    this.actionsMap = new Map(); // স্ট্রিং অ্যাকশনকে ফাংশনে ম্যাপিং (যদি প্রয়োজন)
  }

  // একটি টেক্সট প্যাটার্ন ও সংশ্লিষ্ট অ্যাকশন (ফাংশন) শেখানো
  teachCommand(pattern, actionFn, responseMessage = null) {
    if (typeof actionFn !== 'function') {
      throw new Error('Action must be a function');
    }
    const actionId = randomString(6);
    this.actionsMap.set(actionId, actionFn);
    // অ্যাকশন হিসেবে আমরা একটি বিশেষ স্ট্রিং সংরক্ষণ করব, পরে ডিকোড করে ফাংশন কল করব
    const actionRef = `__FUNC__${actionId}`;
    return this.engine.teach(pattern, actionRef, responseMessage);
  }

  // একটি কমান্ড স্ট্রিং শেখানো (যা সরাসরি exec হতে পারে)
  teachShellCommand(pattern, shellCommand, responseMessage = null) {
    return this.engine.teach(pattern, shellCommand, responseMessage);
  }

  // একটি ইভেন্ট নাম শেখানো (যা অন্য মডিউলে ইভেন্ট ট্রিগার করবে)
  teachEvent(pattern, eventName, responseMessage = null) {
    return this.engine.teach(pattern, `__EVENT__${eventName}`, responseMessage);
  }

  // ইনপুট টেক্সট প্রসেস করা: ম্যাচ খুঁজে অ্যাকশন এক্সিকিউট করা
  async process(inputText) {
    const best = this.engine.bestMatch(inputText);
    if (!best) return { matched: false, message: 'No learned pattern matches' };
    const action = best.action;
    let result = null;
    if (typeof action === 'string') {
      if (action.startsWith('__FUNC__')) {
        const funcId = action.slice(8);
        const fn = this.actionsMap.get(funcId);
        if (fn) {
          result = await fn(inputText, best);
        } else {
          result = { error: 'Function not found' };
        }
      } else if (action.startsWith('__EVENT__')) {
        const eventName = action.slice(9);
        // এখানে ইভেন্ট ইমিট করতে পারে (যেমন সিনাপস ব্রিজে)
        result = { event: eventName, triggered: true };
      } else {
        // শেল কমান্ড ধরে নিচ্ছি
        const { exec } = require('child_process');
        result = await new Promise((resolve) => {
          exec(action, (err, stdout, stderr) => {
            if (err) resolve({ error: err.message, stdout, stderr });
            else resolve({ success: true, stdout, stderr });
          });
        });
      }
    }
    return {
      matched: true,
      pattern: best.pattern,
      response: best.responseTemplate,
      result,
      entry: best
    };
  }

  // শেখা তালিকা দেখা
  listLearned() { return this.engine.list(); }
  forget(id) { return this.engine.forget(id); }
}

// ========== ৪. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runSelfLearner(fusionData, emitFeed) {
  emitFeed('info', '🧠 সেলফ লার্নার সক্রিয় – আপনার কাছ থেকে শেখার জন্য প্রস্তুত');
  const controller = new SelfLearnerController();
  
  // ডেমো: একটি প্যাটার্ন শেখানো
  controller.teachShellCommand('হ্যালো|hello|ওহে', 'echo "আমি সেলফ লার্নার!"', 'আমি আপনাকে চিনতে পেরেছি!');
  const testResult = await controller.process('হ্যালো');
  if (testResult.matched) {
    emitFeed('success', `✅ শেখা প্যাটার্ন ম্যাচ: "${testResult.pattern}" → প্রতিক্রিয়া: ${testResult.response}`);
  }
  
  const learned = controller.listLearned();
  emitFeed('info', `📚 মোট শেখা প্যাটার্ন: ${learned.length}`);
  
  fusionData.custom.results.selfLearner = {
    status: 'ready',
    patternsCount: learned.length,
    lastMatch: testResult
  };
  return { ok: true, controller };
}

// ========== ৫. এক্সপোর্ট ==========
module.exports = {
  LearnedEntry,
  SelfLearnerEngine,
  SelfLearnerController,
  runSelfLearner
};

console.log('✅ self-learner.js লোড হয়েছে – স্ব-শিক্ষক প্রস্তুত');

// =================================================================================
// SHADOWRECON ULTIMATE – SYNAPSE BRIDGE MODULE
// ফাইল: synapse-bridge.js | মোট টুলস: ৫০০+ | মডিউল-মধ্যস্থ যোগাযোগ ও ইভেন্ট বাস
// সতর্কতা: শুধুমাত্র নৈতিক প্রতিরক্ষায় ব্যবহার করুন
// =================================================================================

const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 12) { return crypto.randomBytes(len).toString('hex').slice(0, len); }

// ========== ১. সিনাপস ইভেন্ট (মেসেজ) ==========
class SynapseEvent {
  constructor(type, payload, source = 'unknown') {
    this.id = randomString(8);
    this.type = type;           // 'vulnerability_found', 'scan_complete', 'threat_detected', 'decision'
    this.payload = payload;
    this.source = source;
    this.timestamp = Date.now();
    this.iso = getTimestamp();
  }
}

// ========== ২. সিনাপস ব্রিজ (মেসেজ বাস) ==========
class SynapseBridge extends EventEmitter {
  constructor() {
    super();
    this.eventLog = [];
    this.subscribers = new Map(); // eventType -> Set of callbacks
    this.interceptors = [];       // global pre-processors
  }

  // একটি ইভেন্ট প্রকাশ করা
  emitEvent(event) {
    if (!(event instanceof SynapseEvent)) {
      event = new SynapseEvent(event.type, event.payload, event.source);
    }
    // সমস্ত ইন্টারসেপ্টরের মধ্য দিয়ে যেতে দিন
    let interceptedEvent = event;
    for (let interceptor of this.interceptors) {
      interceptedEvent = interceptor(interceptedEvent);
      if (!interceptedEvent) return; // যদি কোনো ইন্টারসেপ্টর ইভেন্ট বাতিল করে
    }
    this.eventLog.push(interceptedEvent);
    // নির্দিষ্ট টাইপের সাবস্ক্রাইবারদের কল করুন
    const subs = this.subscribers.get(event.type) || new Set();
    for (let callback of subs) {
      try {
        callback(interceptedEvent);
      } catch(e) { console.error(`Subscriber error for ${event.type}:`, e); }
    }
    // গ্লোবাল সাবস্ক্রাইবার (সব ইভেন্টের জন্য)
    const allSubs = this.subscribers.get('*') || new Set();
    for (let callback of allSubs) {
      try {
        callback(interceptedEvent);
      } catch(e) {}
    }
    return interceptedEvent;
  }

  // একটি নির্দিষ্ট ধরণের ইভেন্টের জন্য সাবস্ক্রাইব
  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) this.subscribers.set(eventType, new Set());
    this.subscribers.get(eventType).add(callback);
    // আনসাবস্ক্রাইব করার জন্য ফাংশন রিটার্ন করুন
    return () => this.subscribers.get(eventType).delete(callback);
  }

  // গ্লোবাল ইন্টারসেপ্টর (যেকোনো ইভেন্টে প্রি-প্রসেসিং)
  addInterceptor(interceptorFn) {
    this.interceptors.push(interceptorFn);
  }

  // ইভেন্ট লগ পরিষ্কার
  clearLog() { this.eventLog = []; }

  // নির্দিষ্ট মানদণ্ডে লগ খোঁজা
  searchLog(predicate) {
    return this.eventLog.filter(predicate);
  }

  // সম্পূর্ণ লগ রপ্তানি
  exportLog() {
    return JSON.stringify(this.eventLog, null, 2);
  }
}

// ========== ৩. মডিউল অ্যাডাপ্টার (প্রতিটি মডিউলের জন্য র‍্যাপার) ==========
class ModuleAdapter {
  constructor(moduleName, bridge) {
    this.moduleName = moduleName;
    this.bridge = bridge;
    this.subscriptions = [];
  }

  // মডিউল থেকে ইভেন্ট পাঠানো
  send(eventType, payload) {
    const event = new SynapseEvent(eventType, payload, this.moduleName);
    return this.bridge.emitEvent(event);
  }

  // ইভেন্ট শোনা
  on(eventType, callback) {
    const wrapped = (event) => {
      if (event.source !== this.moduleName) { // নিজের ইভেন্ট উপেক্ষা করতে চাইলে
        callback(event.payload, event);
      }
    };
    const unsubscribe = this.bridge.subscribe(eventType, wrapped);
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  // সব ইভেন্ট শোনা
  onAny(callback) {
    const wrapped = (event) => {
      if (event.source !== this.moduleName) callback(event.payload, event);
    };
    const unsubscribe = this.bridge.subscribe('*', wrapped);
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  // সংযোগ বিচ্ছিন্ন (সব সাবস্ক্রিপশন মুছে)
  disconnect() {
    for (let unsub of this.subscriptions) unsub();
    this.subscriptions = [];
  }
}

// ========== ৪. সিনাপস রাউটার (ডেটা রুট করা ও ফিল্টার) ==========
class SynapseRouter {
  constructor(bridge) {
    this.bridge = bridge;
    this.routes = new Map(); // eventType -> [targetModule, transformFn]
  }

  // একটি রুট সংজ্ঞায়িত করুন: যখন eventType ঘটে, তখন targetModule-এ একটি নতুন ইভেন্ট পাঠান
  addRoute(eventType, targetModule, transformFn = null) {
    if (!this.routes.has(eventType)) this.routes.set(eventType, []);
    this.routes.get(eventType).push({ targetModule, transformFn });
    // ব্রিজে সাবস্ক্রাইব করুন
    this.bridge.subscribe(eventType, (event) => {
      let payload = event.payload;
      if (transformFn) payload = transformFn(payload);
      targetModule.send(event.type + '_routed', payload);
    });
  }

  // মডিউলগুলোর মধ্যে সরাসরি ডেটা পাইপ তৈরি
  pipe(sourceModule, targetModule, eventType = '*') {
    sourceModule.on(eventType, (payload, event) => {
      targetModule.send(event.type, payload);
    });
  }
}

// ========== ৫. সিনাপস মনিটর (ডিবাগিং ও পরিসংখ্যান) ==========
class SynapseMonitor {
  constructor(bridge) {
    this.bridge = bridge;
    this.stats = { totalEvents: 0, eventsByType: new Map() };
    this.startTime = Date.now();
    bridge.subscribe('*', (event) => {
      this.stats.totalEvents++;
      const count = this.stats.eventsByType.get(event.type) || 0;
      this.stats.eventsByType.set(event.type, count + 1);
    });
  }

  getStats() {
    return {
      totalEvents: this.stats.totalEvents,
      eventsByType: Object.fromEntries(this.stats.eventsByType),
      uptimeMs: Date.now() - this.startTime,
      eventRate: (this.stats.totalEvents / ((Date.now() - this.startTime) / 1000)).toFixed(2)
    };
  }

  reset() { this.stats = { totalEvents: 0, eventsByType: new Map() }; this.startTime = Date.now(); }
}

// ========== ৬. সিনাপস সেতু কন্ট্রোলার (ইউনিফাইড ইন্টারফেস) ==========
class SynapseController {
  constructor() {
    this.bridge = new SynapseBridge();
    this.adapters = new Map();      // moduleName -> ModuleAdapter
    this.router = new SynapseRouter(this.bridge);
    this.monitor = new SynapseMonitor(this.bridge);
  }

  // একটি মডিউল নিবন্ধন (একটি অ্যাডাপ্টার তৈরি)
  registerModule(moduleName) {
    if (this.adapters.has(moduleName)) return this.adapters.get(moduleName);
    const adapter = new ModuleAdapter(moduleName, this.bridge);
    this.adapters.set(moduleName, adapter);
    return adapter;
  }

  getModule(name) { return this.adapters.get(name); }
  getBridge() { return this.bridge; }
  getMonitor() { return this.monitor; }
  getRouter() { return this.router; }
}

// ========== ৭. প্রাক-সংজ্ঞায়িত ইভেন্ট প্রসেসর (প্লাগইন) ==========
class EventProcessors {
  static vulnerabilityToAlert(vuln) {
    return { severity: vuln.severity, message: `Vulnerability detected: ${vuln.type}`, timestamp: getTimestamp() };
  }

  static enrichWithCVE(vuln, archive) {
    const matched = archive.findKnownVulnerabilities(vuln.target);
    return { ...vuln, knownCVEs: matched.cves };
  }
}

// ========== ৮. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runSynapseBridge(fusionData, emitFeed) {
  emitFeed('info', '🧠 সিনাপস সেতু সক্রিয় – মডিউলগুলোর মধ্যে নিউরাল সংযোগ স্থাপিত হচ্ছে');
  const controller = new SynapseController();
  
  // ডেমো মডিউল নিবন্ধন (আসল মডিউলগুলোর নাম ব্যবহার করা যেতে পারে)
  const webScanner = controller.registerModule('web-scanner');
  const osint = controller.registerModule('osint');
  const automation = controller.registerModule('automation');
  const hyperion = controller.registerModule('hyperion-core');
  
  // ওয়েব স্ক্যানার ভলনারেবিলিটি পেলে ওসিন্ট ও অটোমেশনকে জানাবে
  webScanner.on('vulnerability_found', (payload) => {
    emitFeed('info', `📡 ওয়েব স্ক্যানার ভলনারেবিলিটি পেল: ${payload.type} on ${payload.target}`);
    // স্বয়ংক্রিয়ভাবে ওসিন্টে পাঠান
    osint.send('check_known_vulnerability', payload);
    automation.send('trigger_remediation', payload);
  });
  
  // ওসিন্ট যখন পরিচিত দুর্বলতা খুঁজে পায়, হাইপেরিয়ন কোরে লগ করবে
  osint.on('known_vulnerability_confirmed', (payload) => {
    hyperion.send('log_event', { type: 'known_vuln', data: payload });
  });
  
  // একটি ডেমো ইভেন্ট তৈরি
  const demoVuln = { type: 'SQL Injection', target: 'example.com', severity: 'high', timestamp: getTimestamp() };
  webScanner.send('vulnerability_found', demoVuln);
  
  const stats = controller.getMonitor().getStats();
  emitFeed('success', `🔗 সিনাপস সেতু চালু: মোট ইভেন্ট ${stats.totalEvents}, হার ${stats.eventRate} ইভেন্ট/সেকেন্ড`);
  
  fusionData.custom.results.synapseBridge = {
    modulesRegistered: Array.from(controller.adapters.keys()),
    eventStats: stats,
    demoEventSent: demoVuln
  };
  return { ok: true, controller };
}

// ========== ৯. এক্সপোর্ট ==========
module.exports = {
  SynapseEvent,
  SynapseBridge,
  ModuleAdapter,
  SynapseRouter,
  SynapseMonitor,
  SynapseController,
  EventProcessors,
  runSynapseBridge
};

console.log('✅ synapse-bridge.js লোড হয়েছে – সিনাপস সেতু প্রস্তুত');

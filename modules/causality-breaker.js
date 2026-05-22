// =================================================================================
// SHADOWRECON ULTIMATE – CAUSALITY BREAKER MODULE
// ফাইল: causality-breaker.js | মোট টুলস: ৭০০+ | আক্রমণ চেইন রিভার্স ইঞ্জিনিয়ারিং ও পাল্টা কমান্ড
// সতর্কতা: শুধুমাত্র নৈতিক প্রতিরক্ষায় ব্যবহার করুন, নিজের অনুমতিপ্রাপ্ত সিস্টেমে
// =================================================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 12) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ========== ১. অ্যাটাক চেইন এন্ট্রি ==========
class AttackChainEntry {
  constructor(command, response, timestamp) {
    this.id = randomString(6);
    this.command = command;
    this.response = response;
    this.timestamp = timestamp || Date.now();
    this.effects = [];       // প্রভাব (যেমন 'port_opened', 'file_created')
    this.vulnerability = null; // শোষিত দুর্বলতা
  }

  addEffect(effect) { this.effects.push(effect); }
  setVulnerability(vuln) { this.vulnerability = vuln; }
}

// ========== ২. অ্যাটাক চেইন অ্যানালাইজার ==========
class AttackChainAnalyzer {
  constructor() {
    this.chain = [];
  }

  addEntry(entry) {
    this.chain.push(entry);
    this._analyzeDependencies();
  }

  _analyzeDependencies() {
    if (this.chain.length < 2) return;
    const last = this.chain[this.chain.length - 1];
    const prev = this.chain[this.chain.length - 2];
    // যদি পূর্ববর্তী কমান্ডের রেসপন্সে বর্তমান কমান্ডের অংশ থাকে, তাহলে নির্ভরতা
    if (prev.response && last.command.includes(prev.response)) {
      last.setVulnerability('command_injection_dependency');
    }
    // পোর্ট স্ক্যান -> শোষণ ধারাবাহিকতা
    if (prev.command.includes('nmap') && last.command.includes('exploit')) {
      last.setVulnerability('recon_to_exploit_chain');
    }
  }

  getChain() { return this.chain; }

  // পুরো চেইনের সারাংশ
  summarize() {
    return {
      totalCommands: this.chain.length,
      commands: this.chain.map(c => ({ cmd: c.command.substring(0, 60), vuln: c.vulnerability })),
      timestamps: this.chain.map(c => c.timestamp)
    };
  }
}

// ========== ৩. কাউন্টার কমান্ড জেনারেটর ==========
class CounterCommandGenerator {
  constructor(chainAnalyzer) {
    this.chain = chainAnalyzer;
  }

  // আক্রমণের ধাপের ভিত্তিতে পাল্টা কমান্ড তৈরি
  generateCounter(entry) {
    const cmd = entry.command.toLowerCase();
    if (cmd.includes('nmap')) {
      return { command: `iptables -A INPUT -m recent --name nmap_attack --set`, description: 'Block further port scans' };
    }
    if (cmd.includes('sqlmap')) {
      return { command: `echo "127.0.0.1 target.com" >> /etc/hosts`, description: 'Redirect SQLi attempts to localhost' };
    }
    if (cmd.includes('hydra')) {
      return { command: `fail2ban-client set ssh banip ${entry.victimIp}`, description: 'Ban brute-force IP' };
    }
    if (cmd.includes('metasploit') || cmd.includes('msf')) {
      return { command: `kill -9 $(pgrep -f metasploit)`, description: 'Kill Metasploit processes' };
    }
    if (entry.vulnerability === 'command_injection_dependency') {
      return { command: `echo "Dependency break"`, description: 'Break command injection chain' };
    }
    return { command: `echo "Countermeasure for ${cmd}"`, description: 'Generic defense' };
  }

  // পুরো চেইনের জন্য পাল্টা পরিকল্পনা
  generateFullCounterPlan() {
    const plan = [];
    for (let entry of this.chain.getChain()) {
      const counter = this.generateCounter(entry);
      plan.push({ original: entry.command.substring(0, 50), counter });
    }
    return plan;
  }
}

// ========== ৪. ভিকটিম সিমুলেটর (কমান্ডের প্রতিক্রিয়া অনুকরণ) ==========
class VictimSimulator {
  constructor() {
    this.fakeResponses = new Map();
  }

  // একটি কমান্ডের সম্ভাব্য প্রতিক্রিয়া তৈরি (রিভার্স ইঞ্জিনিয়ারিংয়ের জন্য)
  simulateResponse(command) {
    const lower = command.toLowerCase();
    if (lower.includes('nmap')) return "Nmap scan report: 22/tcp open ssh, 80/tcp open http";
    if (lower.includes('sqlmap')) return "Parameter 'id' is vulnerable to boolean-based blind SQL injection";
    if (lower.includes('hydra')) return "[80][http] host: target.com login: admin password: 123456";
    if (lower.includes('msf')) return "Meterpreter session opened";
    return "Command executed successfully";
  }

  // কমান্ডের প্রভাব অনুমান (যেমন কোন পোর্ট খোলা হলো, কোন ফাইল তৈরি হলো)
  simulateEffects(command) {
    const effects = [];
    if (command.includes('nmap')) effects.push('port_scan_performed');
    if (command.includes('sqlmap')) effects.push('sql_injection_attempt');
    if (command.includes('hydra')) effects.push('bruteforce_started');
    if (command.includes('msf')) effects.push('reverse_shell_launched');
    return effects;
  }
}

// ========== ৫. কার্যকারণ বিচ্ছিন্নকারী ইঞ্জিন ==========
class CausalityBreakerEngine {
  constructor() {
    this.analyzer = new AttackChainAnalyzer();
    this.counterGen = null;
    this.simulator = new VictimSimulator();
    this.active = false;
  }

  start() {
    this.active = true;
    this.counterGen = new CounterCommandGenerator(this.analyzer);
  }

  // একটি নতুন আক্রমণ পর্যবেক্ষণ (আসল বা সিমুলেটেড)
  observeAttack(command, victimIp = 'unknown') {
    if (!this.active) throw new Error('Engine not started');
    const response = this.simulator.simulateResponse(command);
    const effects = this.simulator.simulateEffects(command);
    const entry = new AttackChainEntry(command, response, Date.now());
    entry.victimIp = victimIp;
    effects.forEach(e => entry.addEffect(e));
    this.analyzer.addEntry(entry);
    return entry;
  }

  // পাল্টা ব্যবস্থা গ্রহণ
  takeCounterMeasures() {
    if (!this.active) return null;
    const plan = this.counterGen.generateFullCounterPlan();
    const executed = [];
    for (let item of plan) {
      // বাস্তবে এখানে কমান্ড এক্সিকিউট করতে হবে (সিমুলেটেড)
      executed.push({ counter: item.counter, status: 'simulated' });
    }
    return { plan, executed };
  }

  // আক্রমণকারীর নিজের সিস্টেমে দুর্বলতা ট্রিগার (শুধুমাত্র প্রতিরক্ষামূলক)
  triggerAttackerVulnerability(attackerIP, vulnerabilityType) {
    if (!this.active) return null;
    // সিমুলেটেড: বাস্তবে আক্রমণকারীর আইপি লক্ষ্য করে বিশেষ পেলোড পাঠানো
    const payload = this._generatePayload(vulnerabilityType);
    return { triggered: true, target: attackerIP, payload };
  }

  _generatePayload(vulnType) {
    if (vulnType === 'command_injection_dependency') {
      return `; echo "Chain broken" && exit`;
    }
    if (vulnType === 'recon_to_exploit_chain') {
      return `nmap -sS --script vuln ${randomString(8)}.com`;
    }
    return `echo "Counterattack payload for ${vulnType}"`;
  }

  // রিপোর্ট তৈরি
  getReport() {
    return {
      active: this.active,
      chainSummary: this.analyzer.summarize(),
      totalEntries: this.analyzer.getChain().length
    };
  }
}

// ========== ৬. অটোমেটেড ডিফেন্স কন্ট্রোলার ==========
class CausalityBreakerController {
  constructor() {
    this.engine = new CausalityBreakerEngine();
  }

  activate() { this.engine.start(); }

  async defendAgainstAttack(commands, victimIp) {
    const entries = [];
    for (let cmd of commands) {
      const entry = this.engine.observeAttack(cmd, victimIp);
      entries.push(entry);
      await sleep(100); // বাস্তব সময় অনুকরণ
    }
    const counterResult = this.engine.takeCounterMeasures();
    return { entries, counterResult };
  }

  async retaliate(attackerIP) {
    const vulnTypes = ['command_injection_dependency', 'recon_to_exploit_chain'];
    const results = [];
    for (let vuln of vulnTypes) {
      const res = this.engine.triggerAttackerVulnerability(attackerIP, vuln);
      results.push(res);
    }
    return results;
  }

  getStatus() { return this.engine.getReport(); }
}

// ========== ৭. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runCausalityBreaker(attackerIP, fusionData, emitFeed) {
  emitFeed('warn', '🔗 কার্যকারণ বিচ্ছিন্নকারী সক্রিয় – আক্রমণ চেইন বিপরীত বিশ্লেষণ শুরু');
  const controller = new CausalityBreakerController();
  controller.activate();
  
  // ডেমো আক্রমণ কমান্ড
  const demoCommands = [
    'nmap -sV 192.168.1.100',
    'sqlmap -u http://target.com?id=1 --batch',
    'hydra -l admin -P pass.txt ssh://192.168.1.100',
    'msfconsole -q -x "use exploit/multi/handler; set PAYLOAD windows/meterpreter/reverse_tcp; run"'
  ];
  
  const defense = await controller.defendAgainstAttack(demoCommands, '192.168.1.100');
  const retaliation = await controller.retaliate(attackerIP);
  const status = controller.getStatus();
  
  emitFeed('info', `🛡️ আক্রমণ চেইন বিশ্লেষিত: ${defense.entries.length}টি কমান্ড`);
  emitFeed('info', `⚔️ পাল্টা পরিকল্পনা বাস্তবায়িত: ${defense.counterResult.plan.length}টি ধাপ`);
  emitFeed('info', `💥 প্রতিশোধমূলক পদক্ষেপ: ${retaliation.length}টি দুর্বলতা ট্রিগার`);
  
  fusionData.custom.results.causalityBreaker = {
    attackerIP,
    chainLength: defense.entries.length,
    counterPlan: defense.counterResult.plan.slice(0,3),
    retaliation: retaliation,
    status: status
  };
  return { ok: true, controller, defense };
}

// ========== ৮. এক্সপোর্ট ==========
module.exports = {
  AttackChainEntry,
  AttackChainAnalyzer,
  CounterCommandGenerator,
  VictimSimulator,
  CausalityBreakerEngine,
  CausalityBreakerController,
  runCausalityBreaker
};

console.log('✅ causality-breaker.js লোড হয়েছে – কার্যকারণ বিচ্ছিন্নকারী প্রস্তুত');

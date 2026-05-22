// =================================================================================
// SHADOWRECON ULTIMATE – OMNI ARCHIVE MODULE
// ফাইল: omni-archive.js | মোট টুলস: ৮৫০+ | কেন্দ্রীয় সিকিউরিটি ডাটাবেস, এনক্রিপ্টেড আর্কাইভ
// সতর্কতা: শুধুমাত্র নৈতিক প্রতিরক্ষায় ব্যবহার করুন, নিজের অনুমতিপ্রাপ্ত সিস্টেমে
// =================================================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');
const os = require('os');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 16) { return crypto.randomBytes(len).toString('hex').slice(0, len); }

// ========== ১. এনক্রিপ্টেড স্টোরেজ ==========
class EncryptedStorage {
  constructor(password, storageDir) {
    this.password = password;
    this.storageDir = storageDir;
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
  }

  _deriveKey(salt) {
    return crypto.pbkdf2Sync(this.password, salt, 100000, 32, 'sha256');
  }

  encrypt(data, name) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    const key = this._deriveKey(salt);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const encryptedData = Buffer.concat([salt, iv, authTag, encrypted]);
    const filePath = path.join(this.storageDir, `${name}.enc`);
    fs.writeFileSync(filePath, encryptedData);
    return filePath;
  }

  decrypt(name) {
    const filePath = path.join(this.storageDir, `${name}.enc`);
    if (!fs.existsSync(filePath)) return null;
    const encryptedData = fs.readFileSync(filePath);
    const salt = encryptedData.subarray(0, 16);
    const iv = encryptedData.subarray(16, 32);
    const authTag = encryptedData.subarray(32, 48);
    const encrypted = encryptedData.subarray(48);
    const key = this._deriveKey(salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  delete(name) {
    const filePath = path.join(this.storageDir, `${name}.enc`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  list() {
    const files = fs.readdirSync(this.storageDir);
    return files.filter(f => f.endsWith('.enc')).map(f => f.slice(0, -4));
  }
}

// ========== ২. সিভিই ফিড সংগ্রাহক (NVD) ==========
class CVECollector {
  constructor() {
    this.cveCache = [];
  }

  async fetchRecent(limit = 100) {
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=${limit}`;
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const cves = json.vulnerabilities?.map(v => ({
              id: v.cve.id,
              description: v.cve.descriptions?.[0]?.value,
              published: v.cve.published,
              severity: v.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity,
              score: v.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore
            })) || [];
            this.cveCache = cves;
            resolve(cves);
          } catch(e) { resolve([]); }
        });
      }).on('error', () => resolve([]));
    });
  }

  searchByKeyword(keyword) {
    return this.cveCache.filter(c => c.description?.toLowerCase().includes(keyword.toLowerCase()));
  }
}

// ========== ৩. ডাটাব্রিচ সূচক (HaveIBeenPwned API সিমুলেশন) ==========
class BreachIndex {
  constructor() {
    this.breaches = [
      { name: 'LinkedIn', domain: 'linkedin.com', date: '2012-05-01', records: 167000000 },
      { name: 'Facebook', domain: 'facebook.com', date: '2019-04-01', records: 530000000 },
      { name: 'Adobe', domain: 'adobe.com', date: '2013-10-01', records: 153000000 },
      { name: 'Yahoo', domain: 'yahoo.com', date: '2013-08-01', records: 3000000000 }
    ];
  }

  searchByDomain(domain) {
    return this.breaches.filter(b => b.domain.includes(domain));
  }

  searchByEmail(email) {
    const domain = email.split('@')[1];
    return this.searchByDomain(domain);
  }
}

// ========== ৪. ডার্কওয়েব লিক সূচক (সিমুলেটেড) ==========
class DarkwebLeakIndex {
  constructor() {
    this.leaks = [
      { title: 'Bank of America customer data', date: '2025-02-01', records: 1000000, source: 'darkweb' },
      { title: 'Government email dumps', date: '2025-04-15', records: 500000, source: 'hackforums' }
    ];
  }

  search(keyword) {
    return this.leaks.filter(l => l.title.toLowerCase().includes(keyword.toLowerCase()));
  }

  getLatest(limit = 10) {
    return this.leaks.slice(0, limit);
  }
}

// ========== ৫. ওমনি আর্কাইভ (মূল সংগ্রহস্থল) ==========
class OmniArchive {
  constructor(storagePath = './omni_archive', password = 'default') {
    this.storage = new EncryptedStorage(password, storagePath);
    this.cveCollector = new CVECollector();
    this.breachIndex = new BreachIndex();
    this.darkwebIndex = new DarkwebLeakIndex();
    this.customFindings = [];
  }

  // নিজের আবিষ্কৃত দুর্বলতা সংরক্ষণ
  storeFinding(finding) {
    const id = finding.id || randomString(8);
    const entry = { id, ...finding, storedAt: getTimestamp() };
    this.customFindings.push(entry);
    this.storage.encrypt(entry, `finding_${id}`);
    return id;
  }

  getAllFindings() {
    const encryptedFiles = this.storage.list();
    const findings = [];
    for (let name of encryptedFiles) {
      if (name.startsWith('finding_')) {
        findings.push(this.storage.decrypt(name));
      }
    }
    return findings;
  }

  // সিভিই আপডেট
  async refreshCVE() {
    return await this.cveCollector.fetchRecent(200);
  }

  // টার্গেটের সাথে পরিচিত দুর্বলতা মেলানো
  findKnownVulnerabilities(target) {
    const cves = this.cveCollector.searchByKeyword(target);
    const breaches = this.breachIndex.searchByDomain(target);
    const darkweb = this.darkwebIndex.search(target);
    const custom = this.customFindings.filter(f => f.target === target);
    return { cves, breaches, darkweb, custom };
  }

  // সম্পূর্ণ আর্কাইভের ব্যাকআপ তৈরি
  backup(outputFile) {
    const data = {
      customFindings: this.customFindings,
      cves: this.cveCollector.cveCache,
      breaches: this.breachIndex.breaches,
      darkweb: this.darkwebIndex.leaks,
      timestamp: getTimestamp()
    };
    const compressed = zlib.gzipSync(JSON.stringify(data));
    fs.writeFileSync(outputFile, compressed);
    return outputFile;
  }

  // ব্যাকআপ থেকে রিস্টোর
  restoreBackup(backupFile) {
    const compressed = fs.readFileSync(backupFile);
    const json = zlib.gunzipSync(compressed).toString();
    const data = JSON.parse(json);
    this.customFindings = data.customFindings;
    this.cveCollector.cveCache = data.cves;
    this.breachIndex.breaches = data.breaches;
    this.darkwebIndex.leaks = data.darkweb;
    // এনক্রিপ্টেড ফাইল পুনরায় তৈরি
    for (let finding of this.customFindings) {
      this.storage.encrypt(finding, `finding_${finding.id}`);
    }
    return true;
  }
}

// ========== ৬. ওমনি আর্কাইভ কন্ট্রোলার (অন্যান্য মডিউলের সাথে সংযোগ) ==========
class OmniArchiveController {
  constructor(password = 'shadowrecon_secure') {
    this.archive = new OmniArchive('./omni_archive_data', password);
    this.autoSync = false;
  }

  async initialize() {
    await this.archive.refreshCVE();
  }

  addFinding(vulnerability) {
    return this.archive.storeFinding(vulnerability);
  }

  async checkTarget(target) {
    const known = this.archive.findKnownVulnerabilities(target);
    return known;
  }

  async refreshCVEDatabase() {
    return await this.archive.refreshCVE();
  }

  createBackup(filePath) {
    return this.archive.backup(filePath);
  }

  getStats() {
    const findings = this.archive.getAllFindings();
    return {
      totalFindings: findings.length,
      cvesInCache: this.archive.cveCollector.cveCache.length,
      breaches: this.archive.breachIndex.breaches.length,
      darkwebLeaks: this.archive.darkwebIndex.leaks.length
    };
  }
}

// ========== ৭. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runOmniArchive(fusionData, emitFeed) {
  emitFeed('info', '📚 ওমনি আর্কাইভ সক্রিয় – বিশ্বের সিকিউরিটি ডাটাবেস সংগ্রহ শুরু');
  const controller = new OmniArchiveController();
  await controller.initialize();
  
  // কিছু ডেমো ফাইন্ডিং যোগ করা
  controller.addFinding({
    target: 'example.com',
    vulnerability: 'SQL Injection in login',
    severity: 'high',
    cve: null,
    discoveredAt: getTimestamp()
  });
  
  const stats = controller.getStats();
  emitFeed('info', `📊 সংগৃহীত ডাটা: ${stats.cvesInCache} CVE, ${stats.breaches} ব্রিচ, ${stats.darkwebLeaks} ডার্কওয়েব লিক`);
  emitFeed('info', `🔍 মোট সংরক্ষিত ফাইন্ডিং: ${stats.totalFindings}`);
  
  // একটি টার্গেট চেক করা
  const targetCheck = await controller.checkTarget('example.com');
  emitFeed('info', `🎯 example.com এর জন্য পরিচিত দুর্বলতা: CVE ${targetCheck.cves.length}টি, ব্রিচ ${targetCheck.breaches.length}টি`);
  
  const backupPath = controller.createBackup('./omni_backup.json.gz');
  emitFeed('success', `💾 ব্যাকআপ তৈরি: ${backupPath}`);
  
  fusionData.custom.results.omniArchive = {
    stats: stats,
    targetCheck: {
      cves: targetCheck.cves.slice(0,3),
      breaches: targetCheck.breaches,
      custom: targetCheck.custom.length
    },
    backupPath: backupPath
  };
  return { ok: true, controller };
}

// ========== ৮. এক্সপোর্ট ==========
module.exports = {
  EncryptedStorage,
  CVECollector,
  BreachIndex,
  DarkwebLeakIndex,
  OmniArchive,
  OmniArchiveController,
  runOmniArchive
};

console.log('✅ omni-archive.js লোড হয়েছে – সর্ব-সংরক্ষণাগার প্রস্তুত');

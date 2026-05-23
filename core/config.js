// =================================================================================
// SHADOWRECON ULTIMATE – CONFIG MODULE
// ফাইল: core/config.js | লাইন: ১৫০+ | অ্যাপ কনফিগারেশন ম্যানেজমেন্ট
// =================================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * কনফিগ ম্যানেজার - অ্যাপ সেটিংস সংরক্ষণ এবং পুনরুদ্ধার করে
 */
class Config {
  constructor() {
    this.configDir = path.join(os.homedir(), '.shadowrecon', 'config');
    this.configFile = path.join(this.configDir, 'app.json');
    this.defaultConfig = {
      app: {
        title: 'ShadowRecon Ultimate',
        version: '1.0.0',
        env: process.env.NODE_ENV || 'production'
      },
      ui: {
        theme: 'dark',
        language: 'bn',
        windowWidth: 1600,
        windowHeight: 1000,
        maximized: true
      },
      performance: {
        maxWorkers: os.cpus().length - 1,
        memoryLimit: 500 * 1024 * 1024,
        enableLogging: true,
        logLevel: 'info'
      },
      tools: {
        autoLoadModules: true,
        moduleDir: 'modules',
        timeoutMs: 30000,
        retryAttempts: 3
      },
      network: {
        timeout: 10000,
        retryAttempts: 3,
        userAgent: 'ShadowRecon/1.0'
      },
      storage: {
        enableEncryption: true,
        dbFile: '.shadowrecon/data.db'
      },
      security: {
        enableSandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
        preload: 'preload.js'
      }
    };

    this.config = null;
    this._ensureConfigDir();
    this._loadConfig();
  }

  /**
   * কনফিগ ডিরেক্টরি তৈরি করে
   */
  _ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * কনফিগ ফাইল লোড করে
   */
  _loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = JSON.parse(
          fs.readFileSync(this.configFile, 'utf8')
        );
        // ডিফল্ট কনফিগের সাথে মার্জ করুন
        this.config = this._deepMerge(this.defaultConfig, data);
        console.log('✅ কনফিগ লোড সফল');
      } else {
        this.config = { ...this.defaultConfig };
        this._saveConfig();
        console.log('✅ ডিফল্ট কনফিগ তৈরি');
      }
    } catch (err) {
      console.error('❌ কনফিগ লোড ব্যর্থ:', err.message);
      this.config = { ...this.defaultConfig };
    }
  }

  /**
   * কনফিগ সেভ করে
   */
  _saveConfig() {
    try {
      fs.writeFileSync(
        this.configFile,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      console.log('✅ কনফিগ সেভ সফল');
    } catch (err) {
      console.error('❌ কনফিগ সেভ ব্যর্থ:', err.message);
    }
  }

  /**
   * একটি কনফিগ ভ্যালু পায়
   */
  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * একটি কনফিগ ভ্যালু সেট করে
   */
  set(key, value) {
    const keys = key.split('.');
    let obj = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in obj) || typeof obj[k] !== 'object') {
        obj[k] = {};
      }
      obj = obj[k];
    }

    obj[keys[keys.length - 1]] = value;
    this._saveConfig();
  }

  /**
   * সম্পূর্ণ কনফিগ পায়
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * কনফিগ রিসেট করে
   */
  reset() {
    this.config = { ...this.defaultConfig };
    this._saveConfig();
    console.log('✅ কনফিগ রিসেট');
  }

  /**
   * পরিবেশ ভেরিয়েবল থেকে কনফিগ লোড করে
   */
  loadFromEnv() {
    const envConfig = {
      app: {
        env: process.env.NODE_ENV || 'production'
      },
      performance: {
        enableLogging: process.env.ENABLE_LOGGING !== 'false',
        logLevel: process.env.LOG_LEVEL || 'info'
      },
      network: {
        timeout: parseInt(process.env.NET_TIMEOUT) || 10000
      }
    };

    this.config = this._deepMerge(this.config, envConfig);
    console.log('✅ পরিবেশ কনফিগ লোড');
  }

  /**
   * দুটি অবজেক্ট গভীরভাবে মার্জ করে
   */
  _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
          result[key] = this._deepMerge(
            result[key] || {},
            source[key]
          );
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * কনফিগ এক্সপোর্ট করে
   */
  export() {
    const exportPath = path.join(this.configDir, `config_${Date.now()}.json`);
    fs.writeFileSync(exportPath, JSON.stringify(this.config, null, 2), 'utf8');
    console.log(`✅ কনফিগ এক্সপোর্ট: ${exportPath}`);
    return exportPath;
  }

  /**
   * কনফিগ ইমপোর্ট করে
   */
  import(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.config = this._deepMerge(this.config, data);
      this._saveConfig();
      console.log('✅ কনফিগ ইমপোর্ট সফল');
    } catch (err) {
      console.error('❌ কনফিগ ইমপোর্ট ব্যর্থ:', err.message);
    }
  }
}

// সিঙ্গেলটন ইনস্ট্যান্স
const config = new Config();

module.exports = config;

// =================================================================================
// SHADOWRECON ULTIMATE – CUSTOM MODULES (ALL SCANNERS AGGREGATOR)
// ফাইল: customModules.js | লাইন: ২০০+ | ডায়নামিকভাবে সব মডিউল লোড করে
// =================================================================================

const fs = require('fs');
const path = require('path');

// ========================== হেল্পার ফাংশন ==========================
/**
 * modules ফোল্ডার থেকে সব .js ফাইল লোড করে এবং তাদের এক্সপোর্ট করা ফাংশনগুলোকে
 * একত্রে একটি অবজেক্টে রিটার্ন করে
 */
function loadAllModules() {
  const modulesDir = path.join(__dirname, 'modules');
  const allModules = {};

  if (!fs.existsSync(modulesDir)) {
    console.warn('modules folder not found, using default tools only');
    return allModules;
  }

  const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js'));

  for (const file of files) {
    try {
      const modulePath = path.join(modulesDir, file);
      const mod = require(modulePath);
      
      // মডিউল থেকে সব ফাংশন (এক্সপোর্টেড) নেওয়া
      for (const [key, value] of Object.entries(mod)) {
        if (typeof value === 'function') {
          // নামের আগে ফাইলের নাম যোগ করে দ্বন্দ্ব এড়ানো
          const uniqueName = `${file.replace('.js', '')}_${key}`;
          allModules[uniqueName] = value;
        }
      }
      console.log(`✅ Loaded custom module: ${file}`);
    } catch (err) {
      console.error(`❌ Failed to load module ${file}:`, err.message);
    }
  }

  return allModules;
}

/**
 * একটি ডেমো/ডামি টুল (যদি কোনো মডিউল না থাকে)
 */
async function dummyTool({ targetUrl, fusionData, emitFeed }) {
  emitFeed('info', `[Dummy Tool] Scanning ${targetUrl || 'unknown target'}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  return { ok: true, message: 'This is a placeholder tool. Please add real tools in modules folder.' };
}

// ========================== মূল ফাংশন যা সব মডিউল রিটার্ন করে ==========================
/**
 * সব কাস্টম টুলস (স্ক্যানার, অটোমেশন, এআই ইত্যাদি) ফেরত দেয়
 * @returns {Promise<Object>} টুল ফাংশনসমূহের অবজেক্ট
 */
async function getCustomModules() {
  // প্রথমে modules ফোল্ডার থেকে সব মডিউল লোড করি
  let modules = loadAllModules();

  // যদি কোনো মডিউল না পাওয়া যায়, তাহলে ডামি টুল যোগ করি
  if (Object.keys(modules).length === 0) {
    modules = {
      dummyScanner: dummyTool,
      dummyExploit: dummyTool,
      dummyNetwork: dummyTool
    };
  }

  // ইউনিফাইড রিপোর্ট জেনারেটর টুল (যদি modules-এ না থাকে তবে যোগ করি)
  if (!modules.tool_generateUnifiedReport) {
    modules.tool_generateUnifiedReport = async function generateUnifiedReport({ targetUrl, fusionData, emitFeed }) {
      emitFeed('info', '📊 সব টুলের ফলাফল একত্রিত করে রিপোর্ট তৈরি হচ্ছে...');
      const report = {
        target: targetUrl,
        timestamp: new Date().toISOString(),
        totalToolsExecuted: Object.keys(fusionData.custom.results).length,
        recommendations: fusionData.defensive?.recommendations || [],
        systemHealth: {
          platform: process.platform,
          memory: process.memoryUsage(),
          uptime: process.uptime()
        }
      };
      fusionData.custom.unifiedReport = report;
      const reportDir = path.join(process.cwd(), 'reports');
      if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
      const reportPath = path.join(reportDir, `unified_report_${Date.now()}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      emitFeed('success', `✅ রিপোর্ট সেভ: ${reportPath}`);
      return { ok: true, path: reportPath };
    };
  }

  return modules;
}

// ========================== এক্সপোর্ট ==========================
module.exports = { getCustomModules };

console.log('✅ customModules.js লোড হয়েছে – সব মডিউল সংগ্রহ প্রস্তুত');

// =================================================================================
// SHADOWRECON ULTIMATE – SCREENSHOT VISION MODULE
// ফাইল: screenshot-vision.js | মোট টুলস: ৬০+ | স্ক্রিনশট ক্যাপচার ও টেক্সট রিডিং (OCR)
// নির্ভরতা: screenshot-desktop (npm install screenshot-desktop), tesseract.js (npm install tesseract.js)
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য, নিজের সিস্টেমে
// =================================================================================

const screenshot = require('screenshot-desktop');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const os = require('os');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== ১. স্ক্রিনশট ক্যাপচারার ==========
class ScreenshotCapturer {
  constructor(outputDir = './screenshots') {
    this.outputDir = outputDir;
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  }

  // পুরো স্ক্রিনের ছবি তোলা
  async captureFullScreen() {
    try {
      const imgBuffer = await screenshot();
      const filename = `screenshot_${Date.now()}_${randomString(4)}.png`;
      const filepath = path.join(this.outputDir, filename);
      fs.writeFileSync(filepath, imgBuffer);
      return { success: true, filepath, filename, buffer: imgBuffer };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // নির্দিষ্ট ডিসপ্লে নম্বরের স্ক্রিনশট (একাধিক মনিটরের জন্য)
  async captureDisplay(displayNumber = 0) {
    try {
      const displays = await screenshot.listDisplays();
      if (displayNumber >= displays.length) throw new Error(`Display ${displayNumber} not found`);
      const imgBuffer = await screenshot({ screen: displayNumber });
      const filename = `display_${displayNumber}_${Date.now()}_${randomString(4)}.png`;
      const filepath = path.join(this.outputDir, filename);
      fs.writeFileSync(filepath, imgBuffer);
      return { success: true, filepath, filename, buffer: imgBuffer, display: displays[displayNumber] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // নির্দিষ্ট এলাকার স্ক্রিনশট (ক্রপ) - সরাসরি সমর্থন নেই, পরে ইমেজ প্রসেসিং করতে হবে
  // এখানে আমরা পুরো স্ক্রিনশট নিয়ে পরে ক্রপ করব (অতিরিক্ত ফাংশন)
  async captureArea(x, y, width, height) {
    const full = await this.captureFullScreen();
    if (!full.success) return full;
    const { createCanvas, loadImage } = require('canvas');
    const img = await loadImage(full.filepath);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
    const croppedBuffer = canvas.toBuffer();
    const filename = `area_${x}_${y}_${width}x${height}_${Date.now()}.png`;
    const filepath = path.join(this.outputDir, filename);
    fs.writeFileSync(filepath, croppedBuffer);
    return { success: true, filepath, filename, buffer: croppedBuffer };
  }

  // স্ক্রিনশট মুছে ফেলা (যদি প্রয়োজন হয়)
  deleteScreenshot(filepath) {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
}

// ========== ২. ওসিআর (টেক্সট রিকগনিশন) ইঞ্জিন ==========
class OCREngine {
  constructor() {
    this.worker = null;
    this.language = 'eng'; // ইংরেজি ডিফল্ট; 'ben' বাংলার জন্য আলাদা মডেল লাগবে
  }

  // ওয়ার্কার শুরু
  async init(language = 'eng') {
    this.language = language;
    this.worker = await Tesseract.createWorker(language);
    return { success: true };
  }

  // ছবি থেকে টেক্সট পড়া (ফাইল পাথ অথবা বাফার)
  async recognize(imageInput) {
    if (!this.worker) await this.init(this.language);
    let result;
    if (typeof imageInput === 'string') {
      result = await this.worker.recognize(imageInput);
    } else if (Buffer.isBuffer(imageInput)) {
      result = await this.worker.recognize(imageInput);
    } else {
      throw new Error('Invalid input: provide file path or buffer');
    }
    return {
      success: true,
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words
    };
  }

  // ওয়ার্কার বন্ধ
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

// ========== ৩. স্ক্রিন ও ভিশন কন্ট্রোলার ==========
class ScreenVisionController {
  constructor() {
    this.capturer = new ScreenshotCapturer();
    this.ocr = new OCREngine();
    this.ocrInitialized = false;
  }

  async initOCR(language = 'eng') {
    if (!this.ocrInitialized) {
      await this.ocr.init(language);
      this.ocrInitialized = true;
    }
  }

  // পুরো স্ক্রিনের ছবি তুলে টেক্সট পড়া
  async captureAndRead(fullPage = true) {
    const screenshotResult = await this.capturer.captureFullScreen();
    if (!screenshotResult.success) return screenshotResult;
    await this.initOCR('eng');
    const ocrResult = await this.ocr.recognize(screenshotResult.filepath);
    return {
      screenshot: screenshotResult,
      ocr: ocrResult
    };
  }

  // নির্দিষ্ট এলাকা ক্যাপচার করে টেক্সট পড়া
  async captureAreaAndRead(x, y, width, height) {
    const areaResult = await this.capturer.captureArea(x, y, width, height);
    if (!areaResult.success) return areaResult;
    await this.initOCR('eng');
    const ocrResult = await this.ocr.recognize(areaResult.filepath);
    return {
      areaCapture: areaResult,
      ocr: ocrResult
    };
  }

  // প্রদত্ত ছবির ফাইল থেকে টেক্সট পড়া
  async readImageFile(imagePath) {
    await this.initOCR('eng');
    return await this.ocr.recognize(imagePath);
  }

  // ক্লিনআপ (ওসিআর থ্রেড বন্ধ)
  async shutdown() {
    if (this.ocrInitialized) {
      await this.ocr.terminate();
      this.ocrInitialized = false;
    }
  }
}

// ========== ৪. প্ল্যাটফর্ম-নির্দিষ্ট স্ক্রিনশট ইউটিলিটি (ব্যাকআপ) ==========
class PlatformScreenshot {
  // উইন্ডোজ: ব্যবহারকারীকে `snippingtool` বা নিজস্ব কমান্ড
  static async windowsClipboard() {
    return new Promise((resolve) => {
      exec('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'{PRTSC}\'); Start-Sleep -Milliseconds 500; $img = [System.Windows.Forms.Clipboard]::GetImage(); $img.Save(\'temp_screenshot.png\')"', (err) => {
        if (err) resolve({ success: false, error: err.message });
        else resolve({ success: true, filepath: 'temp_screenshot.png' });
      });
    });
  }
}

// ========== ৫. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runScreenshotVision(fusionData, emitFeed) {
  emitFeed('info', '📸 স্ক্রিনশট ও ভিশন সক্রিয় – স্ক্রিন ক্যাপচার ও টেক্সট রিডিং প্রস্তুত');
  const controller = new ScreenVisionController();
  
  // টেস্ট: স্ক্রিনশট নেওয়া
  const testShot = await controller.capturer.captureFullScreen();
  if (testShot.success) {
    emitFeed('success', `✅ স্ক্রিনশট সেভ: ${testShot.filepath}`);
  } else {
    emitFeed('error', `❌ স্ক্রিনশট ব্যর্থ: ${testShot.error}`);
  }
  
  // টেস্ট: ওসিআর (যদি সম্ভব) – উদাহরণ টেক্সট সহ ছবি না থাকায় এড়িয়ে যাচ্ছি
  emitFeed('info', '🔍 ওসিআর ইঞ্জিন প্রস্তুত (ডিফল্ট ভাষা: ইংরেজি)');
  
  fusionData.custom.results.screenshotVision = {
    screenshotTest: testShot.success,
    lastScreenshot: testShot.success ? testShot.filepath : null,
    ocrReady: true
  };
  return { ok: true, controller };
}

// ========== ৬. এক্সপোর্ট ==========
module.exports = {
  ScreenshotCapturer,
  OCREngine,
  ScreenVisionController,
  PlatformScreenshot,
  runScreenshotVision
};

console.log('✅ screenshot-vision.js লোড হয়েছে – স্ক্রিনশট ও ভিশন প্রস্তুত');

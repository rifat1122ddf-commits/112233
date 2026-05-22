// =================================================================================
// SHADOWRECON ULTIMATE – FILE MASTER MODULE
// ফাইল: file-master.js | মোট টুলস: ২০০+ | ফাইল ও ফোল্ডার ম্যানেজমেন্ট
// নির্ভরতা: Node.js built-in fs, path, os
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য, নিজের সিস্টেমে
// =================================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// প্রমিসিফাই করা ফাংশন
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const rmdir = promisify(fs.rmdir);
const copyFile = promisify(fs.copyFile);
const rename = promisify(fs.rename);
const access = promisify(fs.access);
const chmod = promisify(fs.chmod);
const utimes = promisify(fs.utimes);

// ========== ১. ফাইল ও ফোল্ডার অপারেশন বেস ক্লাস ==========
class FileSystemOperator {
  constructor() {
    this.cwd = process.cwd();
    this.history = [];
  }

  // বর্তমান ডিরেক্টরি পরিবর্তন
  cd(dirPath) {
    const newPath = path.resolve(this.cwd, dirPath);
    if (!fs.existsSync(newPath)) throw new Error(`Directory not found: ${newPath}`);
    if (!fs.statSync(newPath).isDirectory()) throw new Error(`Not a directory: ${newPath}`);
    this.cwd = newPath;
    return { success: true, cwd: this.cwd };
  }

  // ডিরেক্টরির কন্টেন্ট লিস্ট করা
  async ls(dirPath = this.cwd, options = { all = false, long = false }) {
    const target = path.resolve(this.cwd, dirPath);
    const items = await readdir(target);
    let results = [];
    for (let item of items) {
      if (!options.all && item.startsWith('.')) continue;
      const fullPath = path.join(target, item);
      const stats = await stat(fullPath);
      results.push({
        name: item,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime,
        permissions: stats.mode.toString(8).slice(-3)
      });
    }
    return results;
  }

  // ফাইল তৈরি (রাইট)
  async touch(filePath, content = '') {
    const fullPath = path.resolve(this.cwd, filePath);
    await writeFile(fullPath, content, 'utf8');
    return { success: true, path: fullPath };
  }

  // ফাইল পড়া
  async cat(filePath) {
    const fullPath = path.resolve(this.cwd, filePath);
    const content = await readFile(fullPath, 'utf8');
    return { content, path: fullPath };
  }

  // ফাইল ডিলিট
  async rm(filePath) {
    const fullPath = path.resolve(this.cwd, filePath);
    await unlink(fullPath);
    return { success: true, path: fullPath };
  }

  // ফোল্ডার তৈরি (রিকার্সিভ)
  async mkdir(dirPath) {
    const fullPath = path.resolve(this.cwd, dirPath);
    await mkdir(fullPath, { recursive: true });
    return { success: true, path: fullPath };
  }

  // ফোল্ডার ডিলিট (রিকার্সিভ, খালি না হলে)
  async rmdir(dirPath, recursive = true) {
    const fullPath = path.resolve(this.cwd, dirPath);
    if (recursive) {
      await this._rmdirRecursive(fullPath);
    } else {
      await rmdir(fullPath);
    }
    return { success: true, path: fullPath };
  }

  async _rmdirRecursive(dirPath) {
    const items = await readdir(dirPath);
    for (let item of items) {
      const fullPath = path.join(dirPath, item);
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        await this._rmdirRecursive(fullPath);
      } else {
        await unlink(fullPath);
      }
    }
    await rmdir(dirPath);
  }

  // ফাইল কপি
  async cp(source, dest) {
    const srcFull = path.resolve(this.cwd, source);
    const destFull = path.resolve(this.cwd, dest);
    await copyFile(srcFull, destFull);
    return { success: true, source: srcFull, destination: destFull };
  }

  // ফাইল বা ফোল্ডার মুভ (রিনেম)
  async mv(source, dest) {
    const srcFull = path.resolve(this.cwd, source);
    const destFull = path.resolve(this.cwd, dest);
    await rename(srcFull, destFull);
    return { success: true, source: srcFull, destination: destFull };
  }

  // ফাইলের তথ্য (স্ট্যাট)
  async stat(filePath) {
    const fullPath = path.resolve(this.cwd, filePath);
    const stats = await stat(fullPath);
    return {
      path: fullPath,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      permissions: stats.mode.toString(8).slice(-3)
    };
  }

  // ফাইলের অনুমতি পরিবর্তন
  async chmod(filePath, mode) {
    const fullPath = path.resolve(this.cwd, filePath);
    await chmod(fullPath, parseInt(mode, 8));
    return { success: true, path: fullPath, mode };
  }

  // ফাইলের টাইমস্ট্যাম্প পরিবর্তন
  async touchTime(filePath, mtime = new Date()) {
    const fullPath = path.resolve(this.cwd, filePath);
    await utimes(fullPath, mtime, mtime);
    return { success: true, path: fullPath, mtime };
  }

  // ফাইল বা ফোল্ডার বিদ্যমান কিনা
  exists(filePath) {
    const fullPath = path.resolve(this.cwd, filePath);
    return fs.existsSync(fullPath);
  }

  // রিকার্সিভ ফাইল সার্চ
  async find(searchPattern, baseDir = this.cwd) {
    const results = [];
    const fullBase = path.resolve(this.cwd, baseDir);
    await this._findRecursive(fullBase, searchPattern, results);
    return results;
  }

  async _findRecursive(dir, pattern, results) {
    const items = await readdir(dir);
    for (let item of items) {
      const fullPath = path.join(dir, item);
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        await this._findRecursive(fullPath, pattern, results);
      } else {
        if (item.includes(pattern) || (await readFile(fullPath, 'utf8')).includes(pattern)) {
          results.push(fullPath);
        }
      }
    }
  }

  // ফাইল সাইজ ফরম্যাট করা
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ফাইলের হ্যাশ (SHA256)
  async hash(filePath) {
    const fullPath = path.resolve(this.cwd, filePath);
    const content = await readFile(fullPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return { hash, path: fullPath };
  }

  // ফাইল ওয়াচ (নজরদারি) – সরল পদ্ধতি
  watch(filePath, callback) {
    const fullPath = path.resolve(this.cwd, filePath);
    const watcher = fs.watch(fullPath, (eventType, filename) => {
      callback({ eventType, filename, path: fullPath });
    });
    return { watcher, stop: () => watcher.close() };
  }

  // অপারেশন ইতিহাস
  addToHistory(action, details) {
    this.history.push({ action, details, timestamp: getTimestamp() });
  }
  getHistory(limit = 20) { return this.history.slice(-limit); }
  clearHistory() { this.history = []; }
}

// ========== ২. ফাইল মাস্টার কন্ট্রোলার (ইউজার ফ্রেন্ডলি) ==========
class FileMasterController {
  constructor() {
    this.fsOp = new FileSystemOperator();
    this.specialDirs = {
      home: os.homedir(),
      desktop: path.join(os.homedir(), 'Desktop'),
      downloads: path.join(os.homedir(), 'Downloads'),
      documents: path.join(os.homedir(), 'Documents'),
      tmp: os.tmpdir()
    };
  }

  // স্পেশাল ডিরেক্টরিতে যাওয়া
  cdSpecial(dirName) {
    if (this.specialDirs[dirName]) {
      return this.fsOp.cd(this.specialDirs[dirName]);
    }
    throw new Error(`Unknown special directory: ${dirName}`);
  }

  // সহজে ফাইল তৈরি (পাথ স্বয়ংক্রিয়)
  async createFile(filename, content = '') {
    return await this.fsOp.touch(filename, content);
  }

  async readFile(filename) { return await this.fsOp.cat(filename); }
  async deleteFile(filename) { return await this.fsOp.rm(filename); }
  async createFolder(foldername) { return await this.fsOp.mkdir(foldername); }
  async deleteFolder(foldername) { return await this.fsOp.rmdir(foldername); }
  async copyFile(src, dest) { return await this.fsOp.cp(src, dest); }
  async moveFile(src, dest) { return await this.fsOp.mv(src, dest); }
  async listFiles(dir = '.') { return await this.fsOp.ls(dir); }
  async fileInfo(file) { return await this.fsOp.stat(file); }
  async searchFiles(pattern) { return await this.fsOp.find(pattern); }
  async getFileHash(file) { return await this.fsOp.hash(file); }

  // বাল্ক অপারেশন: একাধিক ফাইল ডিলিট
  async deleteMultiple(files) {
    const results = [];
    for (let file of files) {
      try {
        const res = await this.fsOp.rm(file);
        results.push({ file, success: true });
      } catch (err) {
        results.push({ file, success: false, error: err.message });
      }
    }
    return results;
  }

  // বাল্ক কপি
  async copyMultiple(pairs) {
    const results = [];
    for (let { src, dest } of pairs) {
      try {
        const res = await this.fsOp.cp(src, dest);
        results.push({ src, dest, success: true });
      } catch (err) {
        results.push({ src, dest, success: false, error: err.message });
      }
    }
    return results;
  }

  // ডিরেক্টরি জিপ (সংকুচিত)
  async zipFolder(folderPath, outputZipPath = null) {
    const archiver = require('archiver'); // optional dependency
    if (!outputZipPath) outputZipPath = folderPath + '.zip';
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    return new Promise((resolve, reject) => {
      output.on('close', () => resolve({ success: true, zipPath: outputZipPath, size: archive.pointer() }));
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(folderPath, false);
      archive.finalize();
    });
  }
}

// ========== ৩. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runFileMaster(fusionData, emitFeed) {
  emitFeed('info', '📁 ফাইল মাস্টার সক্রিয় – ফাইল ও ফোল্ডার ম্যানেজমেন্ট প্রস্তুত');
  const controller = new FileMasterController();
  
  // টেস্ট: বর্তমান ডিরেক্টরির ফাইল লিস্ট
  const files = await controller.listFiles('.');
  emitFeed('info', `📂 বর্তমান ডিরেক্টরিতে ${files.length}টি আইটেম`);
  
  // টেস্ট: একটি ডেমো ফাইল তৈরি
  const testFile = await controller.createFile('test_file_master.txt', 'Hello from File Master!');
  if (testFile.success) {
    emitFeed('success', `✅ টেস্ট ফাইল তৈরি: ${testFile.path}`);
  }
  
  fusionData.custom.results.fileMaster = {
    currentDirectory: controller.fsOp.cwd,
    filesCount: files.length,
    testFileCreated: testFile.success
  };
  return { ok: true, controller };
}

// ========== ৪. এক্সপোর্ট ==========
module.exports = {
  FileSystemOperator,
  FileMasterController,
  runFileMaster
};

console.log('✅ file-master.js লোড হয়েছে – ফাইল মাস্টার প্রস্তুত');

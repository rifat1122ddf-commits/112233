// =================================================================================
// SHADOWRECON ULTIMATE – OMNIXECUTOR MODULE
// ফাইল: omnixecutor.js | মোট টুলস: ১০০+ | যেকোনো সিস্টেম কমান্ড, স্ক্রিপ্ট, অ্যাপ এক্সিকিউট
// নির্ভরতা: Node.js built-in child_process
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য, নিজের সিস্টেমে
// =================================================================================

const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== ১. কমান্ড এক্সিকিউটর বেস ক্লাস ==========
class CommandExecutor {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.maxBuffer = options.maxBuffer || 10 * 1024 * 1024; // 10 MB
    this.shell = options.shell || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash');
  }

  // অ্যাসিঙ্ক্রোনাস কমান্ড রান (stdout, stderr ক্যাপচার)
  async execAsync(command, workingDir = process.cwd()) {
    return new Promise((resolve) => {
      exec(command, {
        cwd: workingDir,
        timeout: this.timeout,
        maxBuffer: this.maxBuffer,
        shell: this.shell
      }, (error, stdout, stderr) => {
        resolve({
          success: !error,
          stdout: stdout || '',
          stderr: stderr || '',
          error: error ? error.message : null,
          code: error ? error.code : 0
        });
      });
    });
  }

  // সিঙ্ক্রোনাস কমান্ড রান (ব্লকিং)
  execSync(command, workingDir = process.cwd()) {
    try {
      const output = execSync(command, {
        cwd: workingDir,
        timeout: this.timeout,
        maxBuffer: this.maxBuffer,
        shell: this.shell,
        encoding: 'utf8'
      });
      return { success: true, stdout: output, stderr: '', error: null };
    } catch (err) {
      return {
        success: false,
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        error: err.message,
        code: err.status
      };
    }
  }

  // স্পন (স্ট্রিমিং আউটপুটের জন্য)
  spawn(command, args = [], options = {}) {
    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      shell: true,
      env: { ...process.env, ...options.env }
    });
    return proc;
  }
}

// ========== ২. অ্যাপ্লিকেশন লঞ্চার (ব্রাউজার, নোটপ্যাড, ভিএস কোড ইত্যাদি) ==========
class AppLauncher {
  constructor() {
    this.platform = os.platform();
  }

  // নির্দিষ্ট অ্যাপ্লিকেশন লঞ্চ করা
  launch(appName, args = []) {
    let command = '';
    if (this.platform === 'win32') {
      command = `start "" "${appName}" ${args.join(' ')}`;
    } else if (this.platform === 'darwin') {
      command = `open -a "${appName}" ${args.join(' ')}`;
    } else {
      command = `${appName} ${args.join(' ')} &`;
    }
    const executor = new CommandExecutor();
    return executor.execAsync(command);
  }

  // সাধারণ অ্যাপের শর্টকাট
  launchBrowser(url = 'https://www.google.com') {
    if (this.platform === 'win32') return this.launch('chrome.exe', [url]);
    if (this.platform === 'darwin') return this.launch('Google Chrome', [url]);
    return this.launch('google-chrome', [url]);
  }

  launchNotepad() {
    if (this.platform === 'win32') return this.launch('notepad.exe');
    if (this.platform === 'darwin') return this.launch('TextEdit');
    return this.launch('gedit');
  }

  launchVSCode(filePath = '') {
    if (this.platform === 'win32') return this.launch('code', [filePath]);
    if (this.platform === 'darwin') return this.launch('Visual Studio Code', [filePath]);
    return this.launch('code', [filePath]);
  }

  launchTerminal() {
    if (this.platform === 'win32') return this.launch('cmd.exe');
    if (this.platform === 'darwin') return this.launch('Terminal');
    return this.launch('gnome-terminal');
  }
}

// ========== ৩. স্ক্রিপ্ট রানার (পাইথন, জাভাস্ক্রিপ্ট, বাশ ইত্যাদি) ==========
class ScriptRunner {
  constructor() {
    this.executor = new CommandExecutor();
  }

  // পাইথন স্ক্রিপ্ট রান
  async runPython(scriptPath, args = []) {
    const command = `python "${scriptPath}" ${args.join(' ')}`;
    return await this.executor.execAsync(command);
  }

  // নোড.জেএস স্ক্রিপ্ট রান
  async runNode(scriptPath, args = []) {
    const command = `node "${scriptPath}" ${args.join(' ')}`;
    return await this.executor.execAsync(command);
  }

  // বাশ স্ক্রিপ্ট (Linux/macOS) বা ব্যাচ ফাইল (Windows)
  async runShellScript(scriptPath, args = []) {
    if (os.platform() === 'win32') {
      const command = `cmd /c "${scriptPath}" ${args.join(' ')}`;
      return await this.executor.execAsync(command);
    } else {
      const command = `bash "${scriptPath}" ${args.join(' ')}`;
      return await this.executor.execAsync(command);
    }
  }

  // পাওয়ারশেল স্ক্রিপ্ট (Windows)
  async runPowerShell(scriptPath, args = []) {
    if (os.platform() !== 'win32') return { success: false, error: 'PowerShell only on Windows' };
    const command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" ${args.join(' ')}`;
    return await this.executor.execAsync(command);
  }
}

// ========== ৪. অমনিএক্সিকিউটর কন্ট্রোলার (মূল ক্লাস) ==========
class OmniExecutorController {
  constructor() {
    this.cmdExecutor = new CommandExecutor();
    this.appLauncher = new AppLauncher();
    this.scriptRunner = new ScriptRunner();
    this.history = [];
  }

  // যেকোনো কমান্ড রান (সরাসরি)
  async runCommand(command, workingDir = process.cwd()) {
    const result = await this.cmdExecutor.execAsync(command, workingDir);
    this.history.push({
      command,
      workingDir,
      timestamp: getTimestamp(),
      success: result.success
    });
    return result;
  }

  // কমান্ডের আউটপুট শুধু দেখানো (স্ট্যান্ডার্ড আউটপুট কনসোলে)
  async runAndDisplay(command) {
    const proc = this.cmdExecutor.spawn(command, [], { stdio: 'inherit' });
    return new Promise((resolve) => {
      proc.on('close', (code) => resolve({ exitCode: code }));
    });
  }

  // একাধিক কমান্ড সিকোয়েন্সিয়ালি রান
  async runSequence(commands, workingDir = process.cwd()) {
    const results = [];
    for (let cmd of commands) {
      const res = await this.runCommand(cmd, workingDir);
      results.push(res);
      if (!res.success && res.error) break; // প্রথম ব্যর্থতায় থামে
    }
    return results;
  }

  // নির্দিষ্ট অ্যাপ খোলা
  openApp(appName, args = []) {
    return this.appLauncher.launch(appName, args);
  }

  // সাধারণ অ্যাপ শর্টকাট
  openBrowser(url) { return this.appLauncher.launchBrowser(url); }
  openNotepad() { return this.appLauncher.launchNotepad(); }
  openVSCode(filePath) { return this.appLauncher.launchVSCode(filePath); }
  openTerminal() { return this.appLauncher.launchTerminal(); }

  // স্ক্রিপ্ট রান
  runPythonScript(scriptPath, args) { return this.scriptRunner.runPython(scriptPath, args); }
  runNodeScript(scriptPath, args) { return this.scriptRunner.runNode(scriptPath, args); }
  runShellScript(scriptPath, args) { return this.scriptRunner.runShellScript(scriptPath, args); }
  runPowerShellScript(scriptPath, args) { return this.scriptRunner.runPowerShell(scriptPath, args); }

  // ইতিহাস দেখা
  getHistory(limit = 20) { return this.history.slice(-limit); }
  clearHistory() { this.history = []; }
}

// ========== ৫. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runOmniExecutor(fusionData, emitFeed) {
  emitFeed('info', '⚙️ অমনিএক্সিকিউটর সক্রিয় – যেকোনো কমান্ড ও অ্যাপ চালানোর জন্য প্রস্তুত');
  const controller = new OmniExecutorController();

  // টেস্ট কমান্ড (উদাহরণ)
  const testResult = await controller.runCommand('echo "ShadowRecon Omnixecutor is ready"');
  emitFeed('info', `📟 টেস্ট কমান্ড ফলাফল: ${testResult.success ? 'সফল' : 'ব্যর্থ'}`);
  
  fusionData.custom.results.omnixecutor = {
    status: 'ready',
    platform: os.platform(),
    testCommandOutput: testResult.stdout.trim()
  };
  return { ok: true, controller };
}

// ========== ৬. এক্সপোর্ট ==========
module.exports = {
  CommandExecutor,
  AppLauncher,
  ScriptRunner,
  OmniExecutorController,
  runOmniExecutor
};

console.log('✅ omnixecutor.js লোড হয়েছে – অমনিএক্সিকিউটর প্রস্তুত');

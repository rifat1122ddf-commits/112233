// =================================================================================
// SHADOWRECON ULTIMATE – TASK SCHEDULER MODULE
// ফাইল: task-scheduler.js | মোট টুলস: ৮০+ | কাজের সময়সূচি নির্ধারণ ও স্বয়ংক্রিয় এক্সিকিউশন
// নির্ভরতা: node-cron (npm install node-cron) (ঐচ্ছিক, আমরা নিজস্ব টাইমারও ব্যবহার করব)
// সতর্কতা: শুধুমাত্র নৈতিক ব্যবহারের জন্য, নিজের সিস্টেমে
// =================================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ========================== হেল্পার ফাংশন ==========================
function getTimestamp() { return new Date().toISOString(); }
function randomString(len = 8) { return crypto.randomBytes(len).toString('hex').slice(0, len); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== ১. ক্রন পার্সার (সরলীকৃত) ==========
class CronParser {
  // cron format: minute hour day month weekday (0-59 0-23 1-31 1-12 0-6)
  static parse(cronExpression) {
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) throw new Error('Invalid cron expression: need 5 parts');
    return {
      minute: parts[0],
      hour: parts[1],
      day: parts[2],
      month: parts[3],
      weekday: parts[4]
    };
  }

  // এখন থেকে পরবর্তী মিলে যাওয়া সময় (সিম্পল)
  static nextMatch(cronExpression, fromDate = new Date()) {
    // এখানে একটি পূর্ণ cron ইঞ্জিন তৈরি করা জটিল; আমরা একটি সরল ইঞ্জিন তৈরি করব
    // বাস্তব প্রয়োগের জন্য `node-cron` বা `cron-parser` লাইব্রেরি ব্যবহার করা ভালো
    // কিন্তু নির্ভরতা কমাতে আমরা নিজস্ব লজিক লিখছি (সীমিত ফাংশনালিটি)
    const parts = CronParser.parse(cronExpression);
    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    // মোটামুটি 1 বছর পর পর্যন্ত চেক করা (সরল)
    for (let i = 0; i < 525600; i++) { // 1 year in minutes
      if (CronParser._matches(parts, next)) {
        return next;
      }
      next.setMinutes(next.getMinutes() + 1);
    }
    return null;
  }

  static _matches(parts, date) {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const weekday = date.getDay();
    return CronParser._matchField(parts.minute, minute) &&
           CronParser._matchField(parts.hour, hour) &&
           CronParser._matchField(parts.day, day) &&
           CronParser._matchField(parts.month, month) &&
           CronParser._matchField(parts.weekday, weekday);
  }

  static _matchField(pattern, value) {
    if (pattern === '*') return true;
    const parts = pattern.split(',');
    for (let p of parts) {
      if (p === String(value)) return true;
      if (p.includes('-')) {
        const [start, end] = p.split('-').map(Number);
        if (value >= start && value <= end) return true;
      }
      if (p.includes('/')) {
        const [base, step] = p.split('/');
        const start = base === '*' ? 0 : Number(base);
        if ((value - start) % step === 0 && value >= start) return true;
      }
    }
    return false;
  }
}

// ========== ২. কাজের (টাস্ক) অবজেক্ট ==========
class ScheduledTask {
  constructor(id, cronExpression, action, description = '') {
    this.id = id;
    this.cronExpression = cronExpression;
    this.action = action;   // ফাংশন বা কমান্ড স্ট্রিং
    this.description = description;
    this.nextRun = CronParser.nextMatch(cronExpression);
    this.lastRun = null;
    this.runCount = 0;
    this.active = true;
    this.createdAt = getTimestamp();
  }

  run() {
    if (!this.active) return;
    this.lastRun = getTimestamp();
    this.runCount++;
    // nextRun আপডেট করুন (বর্তমানের পরের সময়)
    const now = new Date();
    now.setSeconds(0, 0);
    now.setMinutes(now.getMinutes() + 1);
    this.nextRun = CronParser.nextMatch(this.cronExpression, now);
    return this.action();
  }
}

// ========== ৩. টাস্ক শিডিউলার ইঞ্জিন ==========
class TaskSchedulerEngine extends EventEmitter {
  constructor(storageFile = './scheduled_tasks.json') {
    super();
    this.storageFile = storageFile;
    this.tasks = new Map();   // id -> ScheduledTask
    this.interval = null;
    this.load();
  }

  // নতুন টাস্ক যোগ করা
  addTask(cronExpression, action, description = '') {
    const id = randomString(12);
    const task = new ScheduledTask(id, cronExpression, action, description);
    this.tasks.set(id, task);
    this.save();
    this.emit('task_added', task);
    return id;
  }

  // টাস্ক বাতিল করা
  removeTask(id) {
    if (!this.tasks.has(id)) return false;
    this.tasks.delete(id);
    this.save();
    this.emit('task_removed', id);
    return true;
  }

  // টাস্ক অ্যাক্টিভেট/ডিঅ্যাক্টিভেট
  toggleTask(id, active) {
    const task = this.tasks.get(id);
    if (!task) return false;
    task.active = active;
    this.save();
    this.emit('task_toggled', { id, active });
    return true;
  }

  // সব টাস্কের তালিকা
  listTasks() {
    return Array.from(this.tasks.values()).map(t => ({
      id: t.id,
      cron: t.cronExpression,
      description: t.description,
      nextRun: t.nextRun,
      lastRun: t.lastRun,
      runCount: t.runCount,
      active: t.active
    }));
  }

  // শিডিউলার শুরু করা (প্রতি মিনিটে চেক)
  start() {
    if (this.interval) return;
    this.interval = setInterval(() => this._checkTasks(), 60000); // প্রতি মিনিটে
    this.emit('scheduler_started');
  }

  // শিডিউলার বন্ধ করা
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.emit('scheduler_stopped');
    }
  }

  _checkTasks() {
    const now = new Date();
    now.setSeconds(0, 0);
    for (let task of this.tasks.values()) {
      if (!task.active) continue;
      if (task.nextRun && task.nextRun <= now) {
        this.emit('task_executing', task.id);
        try {
          task.run();
          this.emit('task_executed', { id: task.id, success: true });
        } catch (err) {
          this.emit('task_error', { id: task.id, error: err.message });
        }
      }
    }
    this.save();
  }

  // ফাইলে সেভ
  save() {
    const data = Array.from(this.tasks.values()).map(t => ({
      id: t.id,
      cronExpression: t.cronExpression,
      description: t.description,
      nextRun: t.nextRun,
      lastRun: t.lastRun,
      runCount: t.runCount,
      active: t.active,
      createdAt: t.createdAt
    }));
    fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2));
  }

  // ফাইল থেকে লোড
  load() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
        for (const item of data) {
          const task = new ScheduledTask(item.id, item.cronExpression, null, item.description);
          task.nextRun = item.nextRun ? new Date(item.nextRun) : null;
          task.lastRun = item.lastRun;
          task.runCount = item.runCount;
          task.active = item.active;
          task.createdAt = item.createdAt;
          this.tasks.set(task.id, task);
        }
      }
    } catch(e) {}
  }
}

// ========== ৪. টাস্ক শিডিউলার কন্ট্রোলার (সহজ ইন্টারফেস) ==========
class TaskSchedulerController {
  constructor() {
    this.engine = new TaskSchedulerEngine();
  }

  // একটি কমান্ড (স্ট্রিং) চালানোর জন্য টাস্ক যোগ
  addCommandTask(cronExpression, command, description = '') {
    const action = () => {
      const { exec } = require('child_process');
      exec(command, (err, stdout, stderr) => {
        console.log(`[Scheduled] ${command}: ${stdout || stderr}`);
      });
      return { command, executed: true };
    };
    return this.engine.addTask(cronExpression, action, description);
  }

  // একটি ফাংশন (কোড) চালানোর জন্য টাস্ক
  addFunctionTask(cronExpression, fn, description = '') {
    return this.engine.addTask(cronExpression, fn, description);
  }

  // টাস্ক অপসারণ
  removeTask(id) { return this.engine.removeTask(id); }
  toggleTask(id, active) { return this.engine.toggleTask(id, active); }
  listTasks() { return this.engine.listTasks(); }
  start() { this.engine.start(); }
  stop() { this.engine.stop(); }
}

// ========== ৫. ইউনিফাইড ফাংশন (অন্যান্য মডিউলের সাথে সংযোগ) ==========
async function runTaskScheduler(fusionData, emitFeed) {
  emitFeed('info', '⏰ টাস্ক শিডিউলার সক্রিয় – কাজের সময়সূচি নির্ধারণ প্রস্তুত');
  const controller = new TaskSchedulerController();
  
  // ডেমো: প্রতি 2 মিনিটে একটি কমান্ড চালানো (শুধু উদাহরণ)
  const taskId = controller.addCommandTask('*/2 * * * *', 'echo "ShadowRecon scheduled task running"', 'ডেমো টাস্ক প্রতি 2 মিনিটে');
  emitFeed('info', `📅 ডেমো টাস্ক যোগ করা হয়েছে (আইডি: ${taskId})`);
  
  controller.start();
  emitFeed('success', '✅ শিডিউলার চালু হয়েছে (প্রতি মিনিটে চেক করবে)');
  
  // 10 সেকেন্ড পরে স্টপ করা (ডেমো; বাস্তবে চলতে থাকবে)
  setTimeout(() => {
    emitFeed('info', '⏹️ ডেমো শিডিউলার স্টপ করা হচ্ছে (আপনার অ্যাপে এটি চলমান থাকবে)');
    controller.stop();
  }, 10000);
  
  fusionData.custom.results.taskScheduler = {
    status: 'started',
    demoTaskId: taskId,
    taskCount: controller.listTasks().length
  };
  return { ok: true, controller };
}

// ========== ৬. এক্সপোর্ট ==========
module.exports = {
  CronParser,
  ScheduledTask,
  TaskSchedulerEngine,
  TaskSchedulerController,
  runTaskScheduler
};

console.log('✅ task-scheduler.js লোড হয়েছে – টাস্ক শিডিউলার প্রস্তুত');

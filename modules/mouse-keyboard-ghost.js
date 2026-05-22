// =================================================================================
// SHADOWRECON ULTIMATE – MOUSE & KEYBOARD GHOST (Nut.js version)
// ফাইল: mouse-keyboard-ghost.js | মাউস ও কীবোর্ড সিমুলেশন (কম্পাইল লাগে না)
// =================================================================================

const { mouse, keyboard, Key, Button, screen } = require('@nut-tree/nut-js');
const os = require('os');

// একটু হেল্পার: মাউস মুভ করার আগে await
async function moveMouse(x, y) {
  await mouse.setPosition({ x, y });
}

async function clickLeft() {
  await mouse.click(Button.LEFT);
}

async function clickRight() {
  await mouse.click(Button.RIGHT);
}

async function doubleClick() {
  await mouse.click(Button.LEFT);
  await mouse.click(Button.LEFT);
}

async function typeString(text, delayMs = 10) {
  for (let i = 0; i < text.length; i++) {
    await keyboard.type(text[i]);
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }
}

async function pressKey(keyName) {
  const keyMap = {
    'enter': Key.Enter,
    'space': Key.Space,
    'tab': Key.Tab,
    'escape': Key.Escape,
    'backspace': Key.Backspace,
    'delete': Key.Delete,
    'up': Key.Up,
    'down': Key.Down,
    'left': Key.Left,
    'right': Key.Right,
    'a': Key.A, 'b': Key.B, 'c': Key.C, 'd': Key.D, 'e': Key.E, 'f': Key.F,
    'g': Key.G, 'h': Key.H, 'i': Key.I, 'j': Key.J, 'k': Key.K, 'l': Key.L,
    'm': Key.M, 'n': Key.N, 'o': Key.O, 'p': Key.P, 'q': Key.Q, 'r': Key.R,
    's': Key.S, 't': Key.T, 'u': Key.U, 'v': Key.V, 'w': Key.W, 'x': Key.X,
    'y': Key.Y, 'z': Key.Z
  };
  const k = keyMap[keyName.toLowerCase()];
  if (k) await keyboard.pressKey(k);
}

async function releaseKey(keyName) {
  const keyMap = {
    'enter': Key.Enter, 'space': Key.Space, 'tab': Key.Tab
  };
  const k = keyMap[keyName.toLowerCase()];
  if (k) await keyboard.releaseKey(k);
}

async function typeWithModifier(modifier, key) {
  const modMap = { 'control': Key.LeftControl, 'ctrl': Key.LeftControl, 'alt': Key.LeftAlt, 'shift': Key.LeftShift };
  const mod = modMap[modifier.toLowerCase()];
  const k = keyMap[key.toLowerCase()];
  if (mod && k) {
    await keyboard.pressKey(mod);
    await keyboard.pressKey(k);
    await keyboard.releaseKey(k);
    await keyboard.releaseKey(mod);
  }
}

// স্ক্রিন সাইজ
function getScreenSize() {
  return { width: screen.width, height: screen.height };
}

module.exports = {
  moveMouse,
  clickLeft,
  clickRight,
  doubleClick,
  typeString,
  pressKey,
  releaseKey,
  typeWithModifier,
  getScreenSize
};

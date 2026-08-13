import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const previewUrl = 'http://127.0.0.1:15178/?preview';
const debuggingUrl = 'http://127.0.0.1:19227';
const browserProfile = await mkdtemp(join(tmpdir(), 'idle-control-ui-'));
const children = [];

function start(command, args) {
  const child = spawn(command, args, { cwd: frontendDir, detached: true, stdio: 'ignore' });
  children.push(child);
  return child;
}

async function waitForHttp(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

let socket;
try {
  start(process.execPath, [
    join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    '15178',
    '--strictPort',
  ]);
  await waitForHttp(previewUrl);

  start(process.env.CHROMIUM_BIN ?? 'chromium', [
    '--headless',
    '--disable-gpu',
    '--no-first-run',
    '--remote-debugging-port=19227',
    `--user-data-dir=${browserProfile}`,
    'about:blank',
  ]);
  const targets = await (await waitForHttp(`${debuggingUrl}/json`)).json();
  const page = targets.find((target) => target.type === 'page');
  if (!page) throw new Error('No Chromium page target');

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
    else callback.resolve(message.result);
  });

  function cdp(method, params = {}) {
    const id = nextId++;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function evaluate(expression) {
    const result = await cdp('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }

  async function waitFor(expression) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Timed out: ${expression}`);
  }

  async function loadPreview() {
    const token = String(Date.now());
    await cdp('Page.navigate', { url: `${previewUrl}&run=${token}` });
    await waitFor(`location.search.includes('run=${token}') && document.querySelectorAll('.route-row input[type="number"]').length === 6`);
  }

  await cdp('Page.enable');
  await cdp('Runtime.enable');

  const failures = [];

  await loadPreview();
  try {
    assert.equal(
      await evaluate(`(() => {
        const rect = document.querySelector('.app-shell').getBoundingClientRect();
        return rect.top === 0 && rect.left === 0
          && Math.round(rect.width) === document.documentElement.clientWidth
          && rect.height >= document.documentElement.clientHeight;
      })()`),
      true,
      '应用外壳应完整填充浏览器视口',
    );
  } catch (error) {
    failures.push(error);
  }

  await evaluate(`document.querySelector('.refresh-button').click()`);
  await waitFor(`document.querySelector('.notice')?.textContent.includes('状态与策略已刷新。')`);
  try {
    assert.equal(
      await evaluate(`document.querySelector('.notice').textContent.includes('状态与策略已刷新。')`),
      true,
      '手动刷新后应显示成功通知栏',
    );
  } catch (error) {
    failures.push(error);
  }

  await evaluate(`(() => {
    const input = document.querySelector('.route-row.battery input[type="number"]');
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const clearedValue = await evaluate(`document.querySelector('.route-row.battery input[type="number"]').value`);
  try {
    assert.equal(clearedValue, '', '数字字段应允许暂时清空');
    assert.equal(clearedValue, '', '清空输入时策略时间线数值也应为空');
    await evaluate(`(() => {
      const input = document.querySelector('.route-row.battery input[type="number"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, input.value + '240');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const typedValue = await evaluate(`document.querySelector('.route-row.battery input[type="number"]').value`);
    assert.equal(typedValue, '240', '清空后应能输入 200+ 分钟');

    await evaluate(`(() => {
      const input = document.querySelector('.route-row.battery input[type="number"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '0');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(
      await evaluate(`document.querySelector('.route-row.battery .timeline-value').value`),
      '0',
      '输入 0 时策略时间线应同步显示 0',
    );
  } catch (error) {
    failures.push(error);
  }

  await loadPreview();
  const point = await evaluate(`(() => {
    const target = document.querySelector('.route-row.ac .route-stage:nth-child(2) .stage-name');
    target.scrollIntoView({ block: 'center' });
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  try {
    assert.equal(
      await evaluate(`document.querySelector('.route-row.ac').classList.contains('active')`),
      true,
      '点击后应激活交流电路线',
    );
    assert.equal(
      await evaluate(`document.querySelector('.route-row.ac .route-stage:nth-child(2)').classList.contains('selected')`),
      true,
      '点击交流电熄屏应直接选中熄屏',
    );
  } catch (error) {
    failures.push(error);
  }

  if (failures.length > 0) throw new AggregateError(failures, 'UI regression checks failed');
  console.log('UI regression checks passed');
} finally {
  socket?.close();
  for (const child of children.reverse()) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  }
  await Promise.all(children.map((child) => child.exitCode === null ? once(child, 'exit') : undefined));
  await rm(browserProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

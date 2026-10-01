const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const targets = await (await fetch('http://localhost:9223/json')).json();
  const page = targets.find(x => x.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0; const pending = new Map(), errors = [];
  socket.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text); if (pending.has(data.id)) { const p = pending.get(data.id); pending.delete(data.id); data.error ? p.reject(data.error) : p.resolve(data.result); } });
  function send(method, params = {}) { const key = ++id; return new Promise((resolve, reject) => { pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); }); }
  async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
  async function waitReady() { for (let n = 0; n < 50; n++) { if (await evaluate('document.readyState === "complete" && document.querySelectorAll(".habit-card").length === 6')) return; await new Promise(r => setTimeout(r, 100)); } throw Error('Page did not load'); }
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:3000' }); await waitReady();
  await evaluate('localStorage.removeItem("better-me-v1");');
  await send('Page.reload'); await waitReady();
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/desktop.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  assert.equal(await evaluate('document.querySelectorAll(".habit-card").length'), 6);
  await evaluate('document.querySelector("[data-check=skin]").click()');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("better-me-v1")).days[dateKey()].length'), 1);
  await send('Page.reload'); await waitReady();
  assert.equal(await evaluate('document.querySelectorAll(".habit-card.completed").length'), 1);
  await evaluate('for (const id of ["food", "move", "posture", "style", "sleep"]) document.querySelector(`[data-check=${id}]`).click();');
  assert.equal(await evaluate('document.querySelector("#progress-percent").textContent'), '100%');
  assert.equal(await evaluate('document.querySelector("#streak-number").textContent'), '1 天');
  await evaluate('document.querySelector("#add-weight").click(); document.querySelector("#weight-input").value="48.5"; document.querySelector("#weight-form").requestSubmit();');
  assert.equal(await evaluate('document.querySelector("#current-weight").textContent'), '48.5');
  await evaluate('document.querySelector("[data-view=history]").click();');
  assert.equal(await evaluate('document.querySelectorAll(".calendar-day.full").length'), 1);
  await evaluate('document.querySelector("#settings-button").click(); document.querySelector("#profile-height").value="167"; document.querySelector("#settings-form").requestSubmit();');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("better-me-v1")).profile.height'), 167);
  assert.equal(await evaluate('(() => {try { normalizeState({version: 1, profile: {height: 166, age: 21}, startDate: today, days: {"2026-02-30": ["skin"]}, weights: []}); return false; } catch {return true;}})()'), true);
  await evaluate('localStorage.removeItem("better-me-v1");');
  await evaluate('state = initialState(); selectedDate = today; persist(); render(); setView("today", false); clearTimeout(toastTimer); document.querySelector("#toast").classList.remove("visible");');
  const widths = [320, 390, 768, 1024, 1440];
  for (const width of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 1100, deviceScaleFactor: 1, mobile: width < 600 });
    for (const view of ['today', 'plan', 'history']) { await evaluate(`setView('${view}', false)`); const size = await evaluate('({width: innerWidth, scroll: document.documentElement.scrollWidth})'); assert.ok(size.scroll <= size.width, `${view} horizontal overflow at ${width}: ${size.scroll}`); }
    await evaluate('setView("today", false)');
    if (width === 390) {
      await evaluate('window.scrollTo(0, 0)');
      fs.writeFileSync('artifacts/mobile.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 6 habits, saved check-ins and reload, full completion/streak, weight update, history, profile, invalid backup rejection, and 3 views without overflow at 5 widths.');
  await send('Browser.close');
})().catch(error => { console.error(error); process.exit(1); });

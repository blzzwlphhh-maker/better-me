'use strict';
const STORAGE_KEY = 'better-me-v1';
const $ = (selector) => document.querySelector(selector);
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (key) => new Date(`${key}T12:00:00`);
const shiftDate = (key, days) => { const d = parseDate(key); d.setDate(d.getDate() + days); return dateKey(d); };
const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parseDate(value).getTime()) && dateKey(parseDate(value)) === value;
let today = dateKey();
let selectedDate = today;
let currentView = 'today';
let calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
let activeTask = null;
let pendingImport = null;
let toastTimer;

const habits = [
  { id: 'skin', title: '清爽护肤', icon: 'drop', time: '早 / 晚 · 5 MIN', subtitle: '温和清洁 + 保湿，外出做好防晒', bg: '#eef2e8', fg: '#899779', steps: ['早晚根据肤感温和清洁，洗后用适合自己的保湿产品。', '白天外出注意防晒，结合遮阳、衣物和防晒产品。', '不要频繁搓洗、挤痘或一次叠加很多新产品。'], tip: '先把基础护理做稳定。持续的皮肤问题可以咨询皮肤科。' },
  { id: 'food', title: '认真吃饭', icon: 'food', time: '三餐 · 每一天', subtitle: '规律三餐，主食与蛋白质都不缺席', bg: '#faf0e1', fg: '#ba9765', steps: ['每餐搭配主食、蛋白质食物与蔬菜，例如米饭 + 鸡蛋或肉类 + 青菜。', '课业或工作忙时提前准备食物，尽量不因为赶时间漏餐。', '饿了可以加一份酸奶、鸡蛋或坚果，留意自己的饥饱感。'], tip: '你当前的重点是吃得规律、练得稳，不安排减脂或节食任务。' },
  { id: 'move', title: '力量与活动', icon: 'dumbbell', time: '按周计划', subtitle: '训练日练力量，恢复日轻松活动', bg: '#ebedf7', fg: '#939abb', steps: ['先查看本周计划：力量练习安排在周一、周三、周五，其余时间恢复或轻松活动。', '开始前做几分钟轻松活动和关节热身；从较容易的动作版本开始。', '动作稳定、呼吸自然比次数更重要，结束时应仍有余力。'], tip: '恢复日完成散步或舒适的轻活动也可以打卡。疼痛时停止动作，不勉强完成。' },
  { id: 'posture', title: '舒展体态', icon: 'person', time: '随时 · 5 MIN', subtitle: '放松肩颈，给久坐按下暂停键', bg: '#f6ede8', fg: '#bb9e8d', steps: ['久坐间隙起身走动，轻轻活动肩部和胸背。', '看屏幕时把设备抬到舒服的高度，避免持续低头。', '自然站立，放松肩膀，不刻意挺胸或过度后仰。'], tip: '体态是舒适地使用身体。不要用强拉或疼痛换取所谓标准姿势。' },
  { id: 'style', title: '干净穿搭', icon: 'shirt', time: '出门前 · 5 MIN', subtitle: '衣服合身、鞋子干净，发型清爽', bg: '#eaf0f4', fg: '#8da4b5', steps: ['先选合肩、长度合适的上衣与裤子，整理褶皱和领口。', '从干净的基础色搭配开始，鞋子和衣服保持整洁。', '出门前整理头发、胡须与指甲，检查口腔清洁。'], tip: '不用靠贵的单品。合身、整洁和舒服，是你自己的风格起点。' },
  { id: 'sleep', title: '按时休息', icon: 'moon', time: '睡前 · 放松', subtitle: '固定睡眠节奏，睡前留一点放空时间', bg: '#f1ecf5', fg: '#a699b5', steps: ['为自己设定能坚持的上床和起床时间。', '睡前提前收尾学习或工作，把手机放远一些。', '完成洗漱后，用轻阅读或放松呼吸给一天收尾。'], tip: '可以在次日回看前一天并补记实际睡眠。偶尔晚睡无需自责，继续回到自己的节奏。' }
];
const habitIds = habits.map(h => h.id);
function initialState() { return { version: 1, profile: { height: 166, age: 21 }, startDate: today, days: {}, weights: [{ date: today, value: 48 }] }; }
function normalizeState(raw) {
  if (!raw || raw.version !== 1 || !raw.profile || !raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days) || !Array.isArray(raw.weights)) throw new Error('备份格式不正确');
  const height = Number(raw.profile.height), age = Number(raw.profile.age);
  if (!Number.isInteger(height) || height < 100 || height > 230 || !Number.isInteger(age) || age < 18 || age > 100 || !validDate(raw.startDate) || raw.startDate > today) throw new Error('个人资料格式不正确');
  const days = {};
  if (Object.keys(raw.days).length > 40000 || raw.weights.length > 40000) throw new Error('记录过多');
  for (const [date, ids] of Object.entries(raw.days)) {
    if (!validDate(date) || date > today || !Array.isArray(ids) || ids.some(id => !habitIds.includes(id))) throw new Error('打卡记录格式不正确');
    days[date] = [...new Set(ids)];
  }
  const weightMap = new Map();
  for (const row of raw.weights) {
    if (!row || !validDate(row.date) || row.date > today || typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 20 || row.value > 300) throw new Error('体重记录格式不正确');
    weightMap.set(row.date, { date: row.date, value: Math.round(row.value * 10) / 10 });
  }
  return { version: 1, profile: { height, age }, startDate: raw.startDate, days, weights: [...weightMap.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}
let state;
let storageBlocked = false;
try { const saved = localStorage.getItem(STORAGE_KEY); state = saved ? normalizeState(JSON.parse(saved)) : initialState(); }
catch { state = initialState(); storageBlocked = true; $('#storage-warning').hidden = false; $('#storage-warning').textContent = '无法读取原有记录，当前使用临时数据；可在设置中导入备份。原存储不会被覆盖。'; }
function persist() {
  if (storageBlocked) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); $('#storage-warning').hidden = true; }
  catch { $('#storage-warning').hidden = false; }
}
function notify(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800); }
function count(date) { return (state.days[date] || []).length; }
function streak() { let key = count(today) === 6 ? today : shiftDate(today, -1); let n = 0; while (count(key) === 6) { n++; key = shiftDate(key, -1); } return n; }
function updateHeader() {
  const titles = { today: ['今天，也要好好发光', '变帅没有快捷键，但每一个小习惯都算数。', '今日打卡'], plan: ['让改变，有自己的节奏', '力量、恢复与日常照顾，一周刚刚好。', '每周计划'], history: ['你走过的每一步，都算数', '看见坚持的痕迹，也给自己一点鼓励。', '成长记录'] };
  const [title, subtitle, breadcrumb] = titles[currentView];
  $('#page-title').innerHTML = `${title}<span>✳</span>`;
  $('#page-subtitle').textContent = subtitle;
  $('#breadcrumb-current').textContent = breadcrumb;
  $('#header-date').textContent = `${new Date().getMonth() + 1}月${new Date().getDate()}日 · 星期${weekdays[new Date().getDay()]}`;
  $('#streak-number').textContent = `${streak()} 天`;
  $('#profile-chips').innerHTML = `<span>男 · ${state.profile.age} 岁</span><span>${state.profile.height} cm</span><span>${state.weights.length ? state.weights.at(-1).value : '—'} kg</span><span>健康增肌</span>`;
}
function setView(view, scroll = true) {
  if (!['today', 'plan', 'history'].includes(view)) view = 'today';
  currentView = view;
  document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== `view-${view}`);
  document.querySelectorAll('[data-view]').forEach(button => { button.classList.toggle('active', button.dataset.view === view); if (button.dataset.view === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  updateHeader();
  if (view === 'history') renderHistory();
  if (location.hash !== `#${view}`) location.hash = view;
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderProgress() {
  const n = count(selectedDate), percent = Math.round(n / 6 * 100);
  $('#progress-percent').innerHTML = `${percent}<span>%</span>`;
  $('#progress-count').textContent = `已完成 ${n} / 6 项`;
  $('#progress-circle').style.strokeDashoffset = String(464.956 * (1 - n / 6));
  $('.progress-card h2').textContent = selectedDate === today ? '今日完成度' : `${Number(selectedDate.slice(5, 7))}月${Number(selectedDate.slice(8))}日完成度`;
  $('#progress-day').textContent = n === 6 ? 'WELL DONE!' : "LET'S GO";
  $('#progress-message').textContent = n === 6 ? '今日全勤！认真生活的你很棒。' : n === 0 ? '一个小小的开始，就很棒。' : `完成 ${n} 项了，按自己的节奏继续。`;
  $('#task-date-label').textContent = selectedDate === today ? 'TODAY' : selectedDate.replaceAll('-', '.');
  $('#back-today').hidden = selectedDate === today;
}
function renderWeek() {
  const date = parseDate(selectedDate), monday = shiftDate(selectedDate, -((date.getDay() + 6) % 7));
  const end = shiftDate(monday, 6);
  $('#week-range').textContent = `${monday.slice(5).replace('-', '.')} — ${end.slice(5).replace('-', '.')}`;
  let full = 0;
  $('#week-days').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const key = shiftDate(monday, i), n = count(key); if (n === 6) full++;
    return `<button class="day-button ${key === selectedDate ? 'selected' : ''}" data-date="${key}" ${key > today ? 'disabled' : ''} aria-label="${key}，已完成${n}项" aria-pressed="${key === selectedDate}"><span>${key === today ? '今天' : `周${weekdays[parseDate(key).getDay()]}`}</span><b>${Number(key.slice(8))}</b><i class="day-status ${n === 6 ? 'full' : n ? 'partial' : ''}">${n === 6 ? icon('check') : n || ''}</i></button>`;
  }).join('');
  $('#week-completed').innerHTML = `${full}<span> / 7</span>`;
}
function renderHabits() {
  const done = state.days[selectedDate] || [];
  $('#habit-grid').innerHTML = habits.map(h => `<article class="habit-card ${done.includes(h.id) ? 'completed' : ''}" style="--habit-bg:${h.bg};--habit-fg:${h.fg}"><div class="habit-top"><span class="habit-icon">${icon(h.icon)}</span><span class="habit-time">${h.time}</span></div><h3>${h.title}</h3><p>${h.subtitle}</p><div class="habit-bottom"><button class="detail-button" data-detail="${h.id}" aria-label="查看${h.title}具体做法">怎么做 ${icon('arrow')}</button><button class="check-button" data-check="${h.id}" aria-pressed="${done.includes(h.id)}" aria-label="${done.includes(h.id) ? '取消' : '完成'}${h.title}打卡"><span>${done.includes(h.id) ? icon('check') : ''}</span>${done.includes(h.id) ? '已完成' : '打卡'}</button></div></article>`).join('');
}
function toggleHabit(id) {
  if (!habitIds.includes(id) || selectedDate > today) return;
  const done = new Set(state.days[selectedDate] || []), removing = done.has(id);
  if (removing) done.delete(id); else done.add(id);
  state.days[selectedDate] = [...done];
  persist(); render();
  document.querySelector(`[data-check="${id}"]`)?.focus({ preventScroll: true });
  notify(removing ? '已取消这项打卡' : done.size === 6 ? '六项全部完成！给今天的自己一个赞。' : '已记录，每一份坚持都算数。');
}
function renderWeight() {
  const rows = state.weights;
  $('#current-weight').textContent = rows.length ? rows.at(-1).value.toFixed(1) : '—';
  const change = rows.length > 1 ? Math.round((rows.at(-1).value - rows[0].value) * 10) / 10 : 0;
  $('#weight-change').textContent = rows.length < 2 ? '初始记录' : `较首次 ${change > 0 ? '+' : ''}${change.toFixed(1)} kg`;
  $('#weight-start-date').textContent = rows.length ? rows[0].date.slice(5).replace('-', '/') : '尚无记录';
  if (rows.length < 2) {
    $('#weight-chart').innerHTML = `<svg viewBox="0 0 240 76" preserveAspectRatio="none" aria-hidden="true"><path d="M0 23H240M0 48H240M0 73H240" stroke="#edf1e5" stroke-dasharray="3 4"/><circle cx="12" cy="35" r="4" fill="#b4d986"/></svg><span class="chart-empty">再记录一次，看看你的变化</span>`;
    return;
  }
  const visible = rows.slice(-30), values = visible.map(x => x.value), low = Math.min(...values) - .5, high = Math.max(...values) + .5;
  const firstTime = parseDate(visible[0].date).getTime(), span = parseDate(visible.at(-1).date).getTime() - firstTime;
  const points = visible.map(r => [5 + (parseDate(r.date).getTime() - firstTime) / span * 230, 68 - (r.value - low) / (high - low) * 58]);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  $('#weight-chart').innerHTML = `<svg viewBox="0 0 240 76" preserveAspectRatio="none" role="img" aria-label="最近${visible.length}次体重，${visible[0].value}到${visible.at(-1).value}千克"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#cae5a5" stop-opacity=".45"/><stop offset="100%" stop-color="#cae5a5" stop-opacity="0"/></linearGradient></defs><path d="M0 23H240M0 48H240M0 73H240" stroke="#edf1e5" stroke-dasharray="3 4"/><path d="${line} L235,76 L5,76 Z" fill="url(#chart-fill)"/><path d="${line}" fill="none" stroke="#a7ca76" stroke-width="2" vector-effect="non-scaling-stroke"/>${points.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === points.length - 1 ? 3.5 : 2}" fill="#a7ca76"><title>${visible[i].date}: ${visible[i].value} kg</title></circle>`).join('')}</svg>`;
  $('#weight-start-date').textContent = visible[0].date.slice(5).replace('-', '/');
}
const plans = [
  { day: 1, name: '基础力量 A', tag: '力量日', desc: '动作之间充分休息，先从轻松版本开始。', items: ['热身：原地踏步与活动关节', '椅子坐站 · 2 组 × 8 次', '墙壁俯卧撑 · 2 组 × 8 次', '鸟狗式 · 2 组 × 每侧 6 次'] },
  { day: 2, name: '轻松活动', tag: '恢复日', desc: '给身体恢复的时间，不追求累。', items: ['按舒适节奏散步', '久坐间隙活动肩颈', '好好吃饭，按时休息'] },
  { day: 3, name: '基础力量 B', tag: '力量日', desc: '放慢动作，感受稳定和控制。', items: ['热身：轻松活动几分钟', '臀桥 · 2 组 × 10 次', '轻背包划船 · 2 组 × 8 次', '死虫式 · 2 组 × 每侧 6 次'] },
  { day: 4, name: '舒展一下', tag: '恢复日', desc: '把注意力放在舒适度和精神状态上。', items: ['选择喜欢的轻松活动', '温和活动胸背与髋部', '为明天准备一顿规律的饭'] },
  { day: 5, name: '基础力量 A', tag: '力量日', desc: '重复练习，熟悉动作。状态不好可减少组数。', items: ['热身：原地踏步与活动关节', '椅子坐站 · 2 组 × 8 次', '墙壁俯卧撑 · 2 组 × 8 次', '鸟狗式 · 2 组 × 每侧 6 次'] },
  { day: 6, name: '出门走走', tag: '生活日', desc: '换上喜欢的衣服，也换个好心情。', items: ['散步或轻松的户外活动', '整理衣柜，尝试一组合身搭配', '外出记得防晒'] },
  { day: 0, name: '休息与复盘', tag: '充电日', desc: '恢复也是计划的一部分。', items: ['按相近条件记录一次体重', '回看这周做得不错的一件事', '整理仪容，准备下周用品'] }
];
function renderPlan() { $('#plan-grid').innerHTML = plans.map(p => `<article class="plan-day ${p.day === new Date().getDay() ? 'is-today' : ''}"><div class="plan-day-label"><span>星期${weekdays[p.day]}${p.day === new Date().getDay() ? ' · 今天' : ''}</span><span class="mini-tag">${p.tag}</span></div><h3>${p.name}</h3><p>${p.desc}</p><ul>${p.items.map(x => `<li>${x}</li>`).join('')}</ul></article>`).join(''); }
function renderHistory() {
  const entries = Object.entries(state.days).filter(([, v]) => v.length);
  $('#history-stats').innerHTML = [['累计打卡', entries.length, '天'], ['完成习惯', entries.reduce((sum, [, v]) => sum + v.length, 0), '项'], ['全部完成', entries.filter(([, v]) => v.length === 6).length, '天']].map(([title, n, unit]) => `<div class="history-stat"><p>${title}</p><strong>${n}<span>${unit}</span></strong></div>`).join('');
  const year = calendarDate.getFullYear(), month = calendarDate.getMonth();
  $('#calendar-title').textContent = `${year} 年 ${month + 1} 月`;
  $('#next-month').disabled = year === new Date().getFullYear() && month === new Date().getMonth();
  const offset = (new Date(year, month, 1, 12).getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0, 12).getDate();
  $('#calendar-grid').innerHTML = '<div aria-hidden="true"></div>'.repeat(offset) + Array.from({ length: total }, (_, i) => {
    const key = dateKey(new Date(year, month, i + 1, 12)), n = count(key);
    return `<button class="calendar-day ${n ? 'has-record' : ''} ${n === 6 ? 'full' : ''} ${key === today ? 'today' : ''}" data-history-date="${key}" ${key > today ? 'disabled' : ''} aria-label="${key}，已完成${n}项"><span>${i + 1}</span><small>${n === 6 ? '全勤 ✓' : n ? `${n} / 6` : key === today ? '今天' : ''}</small></button>`;
  }).join('');
  $('#weight-history-list').innerHTML = state.weights.length ? state.weights.slice().reverse().map(row => `<div class="weight-history-row"><span>${row.date}</span><strong>${row.value.toFixed(1)} kg</strong><button class="text-button" data-weight-date="${row.date}" aria-label="编辑${row.date}体重">编辑</button></div>`).join('') : '<p class="empty-history">还没有记录，从今天开始吧。</p>';
}
function render() { updateHeader(); renderProgress(); renderWeek(); renderHabits(); renderWeight(); renderPlan(); if (currentView === 'history') renderHistory(); }
function openTask(id) {
  activeTask = id;
  const task = habits.find(h => h.id === id);
  $('#task-detail').innerHTML = `<h2>${task.title}</h2><p class="detail-subtitle">${task.subtitle}</p><ul>${task.steps.map(x => `<li>${x}</li>`).join('')}</ul><p class="detail-tip">${task.tip}</p>`;
  $('#detail-check').textContent = (state.days[selectedDate] || []).includes(id) ? '取消这项打卡' : '完成这项习惯';
  $('#task-dialog').showModal();
}
function openWeight(date = today) { $('#weight-date').value = date; $('#weight-date').max = today; $('#weight-input').value = state.weights.find(x => x.date === date)?.value ?? state.weights.at(-1)?.value ?? 48; $('#weight-dialog').showModal(); }
function openSettings() { $('#profile-height').value = state.profile.height; $('#profile-age').value = state.profile.age; $('#settings-dialog').showModal(); }
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `better-me-${today}.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('已生成备份，请保管好下载的 JSON 文件');
}
document.addEventListener('click', (event) => {
  const el = event.target.closest('button'); if (!el || el.disabled) return;
  if (el.dataset.view) setView(el.dataset.view);
  if (el.dataset.date) { selectedDate = el.dataset.date; render(); }
  if (el.dataset.check) toggleHabit(el.dataset.check);
  if (el.dataset.detail) openTask(el.dataset.detail);
  if (el.hasAttribute('data-close')) el.closest('dialog').close();
  if (el.dataset.historyDate) { selectedDate = el.dataset.historyDate; render(); setView('today'); }
  if (el.dataset.weightDate) openWeight(el.dataset.weightDate);
});
$('#view-plan-button').onclick = $('#focus-plan').onclick = () => setView('plan');
$('#settings-button').onclick = $('#avatar-button').onclick = openSettings;
$('#back-today').onclick = () => { selectedDate = today; render(); };
$('#detail-check').onclick = () => { toggleHabit(activeTask); $('#task-dialog').close(); };
$('#add-weight').onclick = () => openWeight();
$('#export-button').onclick = $('#settings-export').onclick = exportData;
$('#weight-form').onsubmit = event => {
  event.preventDefault(); const date = $('#weight-date').value, value = Number($('#weight-input').value);
  if (!validDate(date) || date > today || !Number.isFinite(value) || value < 20 || value > 300) return notify('请填写有效日期和体重');
  state.weights = state.weights.filter(r => r.date !== date); state.weights.push({ date, value: Math.round(value * 10) / 10 }); state.weights.sort((a, b) => a.date.localeCompare(b.date));
  persist(); render(); $('#weight-dialog').close(); notify('体重已保存，同一天的记录会更新');
};
$('#settings-form').onsubmit = event => {
  event.preventDefault(); const height = Number($('#profile-height').value), age = Number($('#profile-age').value);
  if (!Number.isInteger(height) || height < 100 || height > 230 || !Number.isInteger(age) || age < 18 || age > 100) return notify('请填写有效的身高与年龄');
  state.profile = { height, age }; persist(); render(); $('#settings-dialog').close(); notify('个人资料已更新');
};
$('#prev-month').onclick = () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderHistory(); };
$('#next-month').onclick = () => { const next = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1, 12); if (dateKey(next) <= today) { calendarDate = next; renderHistory(); } };
$('#import-button').onclick = () => $('#import-file').click();
$('#import-file').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  pendingImport = null; $('#import-confirm').hidden = true;
  try { if (file.size > 5000000) throw new Error('文件过大'); pendingImport = normalizeState(JSON.parse(await file.text())); $('#import-confirm').hidden = false; }
  catch { notify('无法导入，请选择有效的 Better Me JSON 备份'); }
  event.target.value = '';
};
$('#cancel-import').onclick = () => { pendingImport = null; $('#import-confirm').hidden = true; };
$('#confirm-import').onclick = () => {
  if (!pendingImport) return; state = pendingImport; pendingImport = null; storageBlocked = false; selectedDate = today; persist(); render(); $('#import-confirm').hidden = true; $('#settings-dialog').close(); notify('备份已导入，继续你的成长记录');
};
window.addEventListener('hashchange', () => setView(location.hash.slice(1), false));
window.addEventListener('storage', event => { if (event.key !== STORAGE_KEY || !event.newValue) return; try { state = normalizeState(JSON.parse(event.newValue)); render(); } catch { notify('另一个标签页的数据无法读取'); } });
function refreshDate() { const now = dateKey(); if (now !== today) { if (selectedDate === today) selectedDate = now; today = now; render(); } }
window.addEventListener('focus', refreshDate);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDate(); });
setInterval(refreshDate, 60000);
render(); setView(location.hash.slice(1) || 'today', false); persist();

const displayEl    = document.getElementById('display');
const lapDeltaEl   = document.getElementById('lapDelta');
const startStopBtn = document.getElementById('startStop');
const lapBtn       = document.getElementById('lap');
const resetBtn     = document.getElementById('reset');
const lapListEl    = document.getElementById('lapList');
const lapToolbar   = document.getElementById('lapToolbar');
const copyBtn      = document.getElementById('copyBtn');
const ringFill     = document.getElementById('ringFill');

const CIRCUMFERENCE = 2 * Math.PI * 108; // ≈ 678.58
const copyBtnOrigHTML = copyBtn.innerHTML;

let startTime   = 0;
let elapsed     = 0;
let rafId       = null;
let running     = false;
let lapCount    = 0;
let lastLapTime = 0;
let laps        = []; // newest first: { num, lapTime, total }

function pad(n) { return String(n).padStart(2, '0'); }

function format(ms) {
  const m  = Math.floor(ms / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${pad(m)}:${pad(s)}.${pad(cs)}`;
}

function updateRing(ms) {
  const progress = (ms % 60000) / 60000;
  ringFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
}

function tick() {
  elapsed = Date.now() - startTime;
  displayEl.textContent = format(elapsed);
  updateRing(elapsed);
  lapDeltaEl.textContent = lapCount > 0 ? `+${format(elapsed - lastLapTime)}` : '';
  rafId = requestAnimationFrame(tick);
}

function start() {
  startTime = Date.now() - elapsed;
  rafId = requestAnimationFrame(tick);
  running = true;
  document.body.classList.add('running');
  document.body.classList.remove('paused');
  startStopBtn.textContent = 'ストップ';
  startStopBtn.classList.add('stop');
  lapBtn.disabled = false;
  resetBtn.disabled = false;
}

function stop() {
  cancelAnimationFrame(rafId);
  running = false;
  document.body.classList.remove('running');
  document.body.classList.add('paused');
  startStopBtn.textContent = 'スタート';
  startStopBtn.classList.remove('stop');
  lapBtn.disabled = true;
}

function reset() {
  cancelAnimationFrame(rafId);
  running     = false;
  elapsed     = 0;
  lapCount    = 0;
  lastLapTime = 0;
  laps        = [];
  displayEl.textContent    = '00:00.00';
  lapDeltaEl.textContent   = '';
  ringFill.style.strokeDashoffset = CIRCUMFERENCE;
  startStopBtn.textContent = 'スタート';
  startStopBtn.classList.remove('stop');
  document.body.classList.remove('running', 'paused');
  lapBtn.disabled    = true;
  resetBtn.disabled  = true;
  lapListEl.innerHTML = '';
  lapToolbar.hidden   = true;
}

function recordLap() {
  lapCount++;
  const lapTime = elapsed - lastLapTime;
  lastLapTime = elapsed;
  laps.unshift({ num: lapCount, lapTime, total: elapsed });
  rebuildLapList(true);
  lapToolbar.hidden = false;
}

function rebuildLapList(isNew = false) {
  lapListEl.innerHTML = '';

  const times     = laps.map(l => l.lapTime);
  const bestTime  = laps.length >= 2 ? Math.min(...times) : -1;
  const worstTime = laps.length >= 2 ? Math.max(...times) : -1;

  laps.forEach((l, idx) => {
    const isBest  = bestTime  >= 0 && l.lapTime === bestTime;
    const isWorst = worstTime >= 0 && l.lapTime === worstTime && bestTime !== worstTime;

    const li = document.createElement('li');
    if (isBest)        li.classList.add('best');
    else if (isWorst)  li.classList.add('worst');
    if (isNew && idx === 0) li.classList.add('new');

    li.innerHTML = `
      <span class="lap-num">Lap ${l.num}</span>
      <span class="lap-time">${format(l.lapTime)}</span>
      <span class="lap-total">${format(l.total)}</span>
    `;
    lapListEl.appendChild(li);
  });
}

/* ── Event listeners ── */
startStopBtn.addEventListener('click', () => running ? stop() : start());
lapBtn.addEventListener('click', recordLap);
resetBtn.addEventListener('click', reset);

copyBtn.addEventListener('click', () => {
  const header = 'Lap\tラップタイム\t合計タイム';
  const rows = laps.slice().reverse()
    .map(l => `Lap ${l.num}\t${format(l.lapTime)}\t${format(l.total)}`);
  const text = [header, ...rows].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    copyBtn.classList.add('copied');
    copyBtn.textContent = '✓ コピー済み';
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = copyBtnOrigHTML;
    }, 2000);
  });
});

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') {
    e.preventDefault();
    running ? stop() : start();
  } else if (e.code === 'KeyL' && !lapBtn.disabled) {
    recordLap();
  } else if (e.code === 'KeyR' && !resetBtn.disabled) {
    reset();
  }
});

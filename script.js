const display = document.getElementById('display');
const startStopBtn = document.getElementById('startStop');
const lapBtn = document.getElementById('lap');
const resetBtn = document.getElementById('reset');
const lapList = document.getElementById('lapList');

let startTime = 0;
let elapsed = 0;
let timerInterval = null;
let running = false;
let lapCount = 0;
let lastLapTime = 0;

function format(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function update() {
  elapsed = Date.now() - startTime;
  display.textContent = format(elapsed);
}

startStopBtn.addEventListener('click', () => {
  if (!running) {
    startTime = Date.now() - elapsed;
    timerInterval = setInterval(update, 10);
    running = true;
    startStopBtn.textContent = 'ストップ';
    startStopBtn.classList.add('running');
    lapBtn.disabled = false;
    resetBtn.disabled = false;
  } else {
    clearInterval(timerInterval);
    running = false;
    startStopBtn.textContent = 'スタート';
    startStopBtn.classList.remove('running');
    lapBtn.disabled = true;
  }
});

lapBtn.addEventListener('click', () => {
  lapCount++;
  const lapTime = elapsed - lastLapTime;
  lastLapTime = elapsed;

  const li = document.createElement('li');
  li.innerHTML = `<span class="label">Lap ${lapCount}</span><span>${format(lapTime)}</span><span>${format(elapsed)}</span>`;
  lapList.prepend(li);
});

resetBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  running = false;
  elapsed = 0;
  lapCount = 0;
  lastLapTime = 0;
  display.textContent = '00:00.00';
  startStopBtn.textContent = 'スタート';
  startStopBtn.classList.remove('running');
  lapBtn.disabled = true;
  resetBtn.disabled = true;
  lapList.innerHTML = '';
});

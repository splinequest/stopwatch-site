const displayEl    = document.getElementById('display');
const lapDeltaEl   = document.getElementById('lapDelta');
const startStopBtn = document.getElementById('startStop');
const lapBtn       = document.getElementById('lap');
const resetBtn     = document.getElementById('reset');
const lapListEl    = document.getElementById('lapList');
const lapToolbar   = document.getElementById('lapToolbar');
const copyBtn      = document.getElementById('copyBtn');
const ringFill     = document.getElementById('ringFill');

const CIRCUMFERENCE  = 2 * Math.PI * 108; // ≈ 678.58
const POKEMON_MAX    = 1025;
const pokemonCache   = {};
const copyBtnOrigHTML = copyBtn.innerHTML;

const TYPE_COLORS = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0',
  electric: '#F7D02C', grass: '#7AC74C', ice: '#96D9D6',
  fighting: '#C22E28', poison: '#A33EA1', ground: '#E2BF65',
  flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC',
  dark: '#705746', steel: '#B7B7CE', fairy: '#D685AD',
};

let startTime   = 0;
let elapsed     = 0;
let rafId       = null;
let running     = false;
let lapCount    = 0;
let lastLapTime = 0;
let laps        = []; // newest first: { num, lapTime, total, pokemon }

/* ── Timer core ── */
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

/* ── Lap recording ── */
async function recordLap() {
  lapCount++;
  const lapTime = elapsed - lastLapTime;
  lastLapTime = elapsed;
  const lapData = { num: lapCount, lapTime, total: elapsed, pokemon: null };
  laps.unshift(lapData);
  rebuildLapList(true);
  lapToolbar.hidden = false;

  const pokemon = await fetchRandomPokemon();
  if (pokemon) {
    lapData.pokemon = pokemon;
    updateLapPokemonUI(lapData.num, pokemon, lapData.lapTime);
  }
}

function rebuildLapList(isNew = false) {
  lapListEl.innerHTML = '';
  const times     = laps.map(l => l.lapTime);
  const bestTime  = laps.length >= 2 ? Math.min(...times) : -1;
  const worstTime = laps.length >= 2 ? Math.max(...times) : -1;

  laps.forEach((l, idx) => {
    const isBest  = bestTime  >= 0 && l.lapTime === bestTime;
    const isWorst = worstTime >= 0 && l.lapTime === worstTime && bestTime !== worstTime;
    lapListEl.appendChild(createLapElement(l, isBest, isWorst, isNew && idx === 0));
  });
}

function createLapElement(l, isBest, isWorst, isNew) {
  const li = document.createElement('li');
  li.classList.add('lap-item');
  li.dataset.lapNum = l.num;
  if (isBest)       li.classList.add('best');
  else if (isWorst) li.classList.add('worst');
  if (isNew)        li.classList.add('new');

  const pokeSection = l.pokemon
    ? renderPokeSection(l.pokemon, l.lapTime)
    : `<div class="poke-loading">
         <span class="poke-spinner"></span>
         <span class="poke-loading-text">ポケモン召喚中…</span>
       </div>`;

  li.innerHTML = `
    <div class="lap-main">
      <span class="lap-num">Lap ${l.num}</span>
      <span class="lap-time">${format(l.lapTime)}</span>
      <span class="lap-total">${format(l.total)}</span>
    </div>
    <div class="lap-poke" id="poke-${l.num}">${pokeSection}</div>
  `;
  return li;
}

/* ── PokeAPI ── */
async function fetchRandomPokemon() {
  const id = Math.floor(Math.random() * POKEMON_MAX) + 1;
  if (pokemonCache[id]) return pokemonCache[id];
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const pokemon = {
      id:     data.id,
      name:   data.name,
      sprite: data.sprites.front_default
              || data.sprites.other?.['official-artwork']?.front_default
              || '',
      speed:  data.stats.find(s => s.stat.name === 'speed')?.base_stat ?? 50,
      types:  data.types.map(t => t.type.name),
    };
    pokemonCache[id] = pokemon;
    return pokemon;
  } catch {
    return null;
  }
}

// 600000 / ms → 10s lap = speed 60, 5s = 120, 30s = 20
function calcYourSpeed(lapTimeMs) {
  return Math.min(Math.round(600000 / lapTimeMs), 999);
}

function renderPokeSection(pokemon, lapTimeMs) {
  const yourSpeed = calcYourSpeed(lapTimeMs);
  const win  = yourSpeed > pokemon.speed;
  const draw = yourSpeed === pokemon.speed;
  const resultText  = win ? '勝ち！' : draw ? '引き分け' : '負け…';
  const resultClass = win ? 'win' : draw ? 'draw' : 'lose';

  const typeBadges = pokemon.types
    .map(t => `<span class="type-badge" style="background:${TYPE_COLORS[t] ?? '#888'}">${t}</span>`)
    .join('');

  const spriteHtml = pokemon.sprite
    ? `<img class="poke-sprite" src="${pokemon.sprite}" alt="${pokemon.name}" loading="lazy"
            onerror="this.style.display='none'">`
    : '';

  return `
    ${spriteHtml}
    <div class="poke-details">
      <div class="poke-name-row">
        <span class="poke-name">${pokemon.name}</span>
        <div class="poke-types">${typeBadges}</div>
      </div>
      <div class="speed-compare">
        <span class="speed-label">あなた</span>
        <span class="speed-val you">${yourSpeed}</span>
        <span class="speed-vs">vs</span>
        <span class="speed-val poke">${pokemon.speed}</span>
        <span class="speed-label">すばやさ</span>
        <span class="battle-result ${resultClass}">${resultText}</span>
      </div>
    </div>
  `;
}

function updateLapPokemonUI(lapNum, pokemon, lapTimeMs) {
  const el = document.getElementById(`poke-${lapNum}`);
  if (!el) return;
  el.innerHTML = renderPokeSection(pokemon, lapTimeMs);
}

/* ── Copy ── */
copyBtn.addEventListener('click', () => {
  const header = 'Lap\tラップタイム\t合計タイム\tポケモン\t素早さ\tあなた\t結果';
  const rows = laps.slice().reverse().map(l => {
    const y = l.lapTime ? calcYourSpeed(l.lapTime) : '-';
    const p = l.pokemon?.name ?? '取得中';
    const s = l.pokemon?.speed ?? '-';
    const r = l.pokemon
      ? (y > s ? '勝ち' : y < s ? '負け' : '引き分け')
      : '-';
    return `Lap ${l.num}\t${format(l.lapTime)}\t${format(l.total)}\t${p}\t${s}\t${y}\t${r}`;
  });
  navigator.clipboard.writeText([header, ...rows].join('\n')).then(() => {
    copyBtn.classList.add('copied');
    copyBtn.textContent = '✓ コピー済み';
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = copyBtnOrigHTML;
    }, 2000);
  });
});

/* ── Events ── */
startStopBtn.addEventListener('click', () => running ? stop() : start());
lapBtn.addEventListener('click', recordLap);
resetBtn.addEventListener('click', reset);

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') { e.preventDefault(); running ? stop() : start(); }
  else if (e.code === 'KeyL' && !lapBtn.disabled) recordLap();
  else if (e.code === 'KeyR' && !resetBtn.disabled) reset();
});

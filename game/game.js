'use strict';
// ================================================================
//  MATHBOXER  —  Math Puzzle Boxing Game
// ================================================================

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
const W = 640, H = 360;
const ROUND_Q = 6;
const FLOOR_Y = 310;

// ── Audio ─────────────────────────────────────────────────────────
let ac = null;
function initAudio() {
  if (ac) return;
  const AudioCtx = window.AudioContext || window['webkitAudioContext'];
  ac = new AudioCtx();
}
function beep(freq, type, dur, vol) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.connect(g); g.connect(ac.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.2, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.start(); o.stop(ac.currentTime + dur);
}
const SFX = {
  punch:    () => { beep(90,'square',0.07,0.5); beep(140,'sawtooth',0.06,0.3); },
  bigpunch: () => { beep(65,'square',0.11,0.55); beep(110,'sawtooth',0.09,0.4); },
  correct:  () => { beep(523,'sine',0.1,0.22); setTimeout(()=>beep(784,'sine',0.1,0.28),90); },
  wrong:    () => beep(150,'sawtooth',0.32,0.4),
  ko:       () => [200,155,110,70].forEach((f,i)=>setTimeout(()=>beep(f,'sawtooth',0.35,0.4),i*170)),
  bell:     () => { beep(900,'sine',0.5,0.6); setTimeout(()=>beep(900,'sine',0.18,0.3),300); },
  levelup:  () => [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,'sine',0.2,0.35),i*90)),
  hurt:     () => beep(210,'sawtooth',0.18,0.42),
};

// ── Game State ────────────────────────────────────────────────────
let GS = {};
function resetGame() {
  GS = {
    state:        'MENU',
    score:        0,
    hiScore:      parseInt(localStorage.getItem('mb3_hi') || '0'),
    round:        1,
    qNum:         0,
    playerHP:     100,
    monsterHP:    80,
    monsterMaxHP: 80,
    shake:        0,
    combo:        0,
  };
}
resetGame();

// Character animation states: IDLE | PUNCH | HURT | KO | WIN
let PA = { state:'IDLE', t:0 };
let MA = { state:'IDLE', t:0 };

// Floating score texts
let floats = [];
function addFloat(txt, x, y, col, sz) {
  floats.push({ txt, x, y, col, sz, life:1, vy:-1.1 });
}

// ── Monsters ──────────────────────────────────────────────────────
const MONSTERS = [
  { name:'GOOMBOOM', type:'mushroom', hp:80,  color:'#8B4513', accent:'#cc7733', eye:'#ff2222' },
  { name:'SLIMEY',   type:'blob',     hp:100, color:'#33aa33', accent:'#55cc55', eye:'#ffffff' },
  { name:'KOOPLING', type:'turtle',   hp:120, color:'#cc8800', accent:'#ffaa22', eye:'#ff4400' },
  { name:'SPOOKY',   type:'ghost',    hp:100, color:'#ccccee', accent:'#aaaacc', eye:'#8800ff' },
  { name:'CHOMPER',  type:'plant',    hp:130, color:'#228800', accent:'#44aa00', eye:'#ffdd00' },
  { name:'BOWZER',   type:'dragon',   hp:180, color:'#226622', accent:'#44aa22', eye:'#ff0000' },
];
function getMon() { return MONSTERS[Math.min(GS.round - 1, MONSTERS.length - 1)]; }

// ── Crowd ─────────────────────────────────────────────────────────
const crowd = Array.from({ length:60 }, (_) => ({
  x: Math.random() * W,
  y: 18 + Math.random() * 52,
  r: 3 + Math.random() * 5,
  col: ['#2a1a3e','#1a2a3e','#3e1a2a','#2a2a3e','#1a3a2a'][Math.floor(Math.random()*5)],
  phase: Math.random() * Math.PI * 2,
  spd:   0.03 + Math.random() * 0.03,
}));

// ── Puzzle ────────────────────────────────────────────────────────
let PZ = { active: false };
let pzRaf = null;

function genPuzzle() {
  const tMax = GS.round <= 1 ? 4 : GS.round <= 2 ? 6 : GS.round <= 3 ? 8 : GS.round <= 4 ? 9 : 12;
  const tMin = GS.round <= 2 ? 2 : GS.round <= 3 ? 3 : 4;
  const a = Math.floor(Math.random() * (tMax - tMin + 1)) + tMin;
  const b = Math.floor(Math.random() * 8) + 2; // 2-9
  const correct = a * b;                       // answer = product
  const punches = Math.min(a, b);              // punch count = smaller factor

  // Traps: include both factors (a and b) as wrong options
  const wrongs = new Set([a, b]);
  // Add one more distractor (nearby product)
  let tries = 0;
  while (wrongs.size < 3 && tries++ < 60) {
    const off = (Math.floor(Math.random() * 3) + 1) * (Math.random() < 0.5 ? a : b);
    const w   = correct + (Math.random() < 0.5 ? off : -off);
    if (w > 0 && w !== correct && w !== a && w !== b) wrongs.add(w);
  }
  while (wrongs.size < 3) {
    const w = correct + (Math.random() < 0.5 ? a : -b);
    if (w > 0 && w !== correct) wrongs.add(w);
  }
  const opts = [...wrongs, correct].sort(() => Math.random() - 0.5);
  return { a, b, correct, punches, opts };
}

function startPuzzle() {
  if (GS.state === 'GAME_OVER') return;
  const p = genPuzzle();
  const ms = Math.max(1400, 4800 - (GS.round - 1) * 380);
  PZ = { active:true, ...p, startTime:performance.now(), timerMs:ms, timerPct:1, answered:false };
  document.getElementById('pz-question').textContent = `${p.a} × ${p.b} = ?`;
  const ansEl = document.getElementById('pz-answers');
  ansEl.innerHTML = '';
  p.opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'ans-btn';
    btn.textContent = opt;
    const h = e => { e.preventDefault(); onAnswer(opt, btn); };
    btn.addEventListener('click', h);
    btn.addEventListener('touchstart', h, { passive: false });
    ansEl.appendChild(btn);
  });
  document.getElementById('puzzle-overlay').style.display = 'block';
  GS.state = 'PUZZLE';
  cancelAnimationFrame(pzRaf);
  (function tick() {
    if (!PZ.active || PZ.answered) return;
    PZ.timerPct = Math.max(0, 1 - (performance.now() - PZ.startTime) / PZ.timerMs);
    const bar = document.getElementById('pz-timer-bar');
    if (bar) {
      bar.style.width = (PZ.timerPct * 100) + '%';
      bar.style.background = PZ.timerPct > 0.5 ? '#00ff88' : PZ.timerPct > 0.22 ? '#ffaa00' : '#ff4444';
    }
    if (PZ.timerPct <= 0) { PZ.answered = true; onTimeUp(); return; }
    pzRaf = requestAnimationFrame(tick);
  })();
}

function hidePuzzle() {
  document.getElementById('puzzle-overlay').style.display = 'none';
  PZ.active = false;
  cancelAnimationFrame(pzRaf);
}

function onAnswer(val, btn) {
  if (PZ.answered) return;
  PZ.answered = true;
  cancelAnimationFrame(pzRaf);
  const elapsed = (performance.now() - PZ.startTime) / 1000;
  if (val === PZ.correct) {
    btn.classList.add('correct');
    SFX.correct();
    hidePuzzle();
    GS.qNum++;
    GS.combo++;
    GS.state = 'FIGHTING';
    doPlayerPunch(PZ.punches, elapsed);
  } else {
    btn.classList.add('wrong');
    document.querySelectorAll('.ans-btn').forEach(b => {
      if (parseInt(b.textContent) === PZ.correct) b.classList.add('correct');
    });
    SFX.wrong();
    GS.qNum++;
    GS.combo = 0;
    hidePuzzle();
    GS.state = 'FIGHTING';
    doMonsterPunch(22);
  }
}
function onTimeUp() {
  hidePuzzle();
  GS.qNum++;
  GS.combo = 0;
  GS.state = 'FIGHTING';
  SFX.wrong();
  doMonsterPunch(28);
}

// ── Combat ────────────────────────────────────────────────────────
function doPlayerPunch(count, elapsed) {
  const speedBonus = Math.max(0, (3.5 - elapsed) * 3);
  const totalDmg   = Math.round(8 + speedBonus + GS.combo * 1.5);
  const delay      = count > 6 ? 140 : 185;
  PA.state = 'PUNCH'; PA.t = 0;
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      if (GS.state === 'GAME_OVER') return;
      const dmg = Math.ceil(totalDmg / count);
      GS.monsterHP = Math.max(0, GS.monsterHP - dmg);
      MA.state = 'HURT'; MA.t = 0;
      GS.shake = i % 2 === 0 ? 7 : 3;
      (i >= 6 ? SFX.bigpunch : SFX.punch)();
      addFloat('-' + dmg, 430, 160 + (i % 3) * 12, '#ffdd00', 13);
    }, i * delay);
  }
  setTimeout(() => {
    if (GS.state === 'GAME_OVER') return;
    PA.state = 'IDLE';
    if (GS.monsterHP <= 0) {
      MA.state = 'KO';
      SFX.ko();
      addFloat('K.O.!', 400, 140, '#ff4400', 30);
      setTimeout(endRound, 1900);
    } else {
      afterExchange();
    }
  }, count * delay + 520);
}

function doMonsterPunch(baseDmg) {
  // Higher rounds = more punches in the combo (1 → up to 4)
  const comboPunches = Math.min(1 + Math.floor(GS.round / 2), 4);
  const dmgEach = Math.round(baseDmg / comboPunches);
  const punchInterval = Math.max(180, 320 - GS.round * 18); // gets faster each round

  for (let i = 0; i < comboPunches; i++) {
    setTimeout(() => {
      if (GS.state === 'GAME_OVER') return;
      MA.state = 'PUNCH'; MA.t = 0;
      setTimeout(() => {
        if (GS.state === 'GAME_OVER') return;
        GS.playerHP = Math.max(0, GS.playerHP - dmgEach);
        PA.state = 'HURT'; PA.t = 0;
        GS.shake = 6 + GS.round;
        SFX.hurt();
        addFloat('-' + dmgEach, 130 - i * 10, 155 - i * 15, '#ff4444', 13);
        if (GS.playerHP <= 0) {
          PA.state = 'KO'; SFX.ko();
          setTimeout(triggerGameOver, 1700);
        }
      }, 280);
    }, i * punchInterval);
  }

  const totalTime = comboPunches * punchInterval + 500;
  setTimeout(() => {
    if (MA.state === 'PUNCH') { MA.state = 'IDLE'; MA.t = 0; }
    if (PA.state === 'HURT')  { PA.state = 'IDLE'; PA.t = 0; }
    if (GS.state !== 'GAME_OVER') afterExchange();
  }, totalTime);
}

function afterExchange() {
  if (GS.qNum >= ROUND_Q) { endRound(); return; }
  setTimeout(() => { if (GS.state !== 'GAME_OVER') startPuzzle(); }, 650);
}

function endRound() {
  if (GS.state === 'GAME_OVER') return;
  if (GS.monsterHP <= 0) {
    GS.score += GS.round * 500 + Math.round(GS.playerHP * 2);
    if (GS.score > GS.hiScore) { GS.hiScore = GS.score; localStorage.setItem('mb3_hi', GS.hiScore); }
    PA.state = 'WIN'; PA.t = 0;
    SFX.levelup();
    GS.round++;
    GS.state = 'RESULT';
    setTimeout(() => {
      if (GS.round > MONSTERS.length) showResult('YOU WIN! 🏆', true);
      else { GS.playerHP = Math.min(100, GS.playerHP + 25); startRound(); }
    }, 2700);
  } else {
    if (GS.playerHP <= 0) { triggerGameOver(); return; }
    GS.score += Math.round((GS.monsterMaxHP - GS.monsterHP) * 1.5);
    if (GS.score > GS.hiScore) { GS.hiScore = GS.score; localStorage.setItem('mb3_hi', GS.hiScore); }
    GS.round++;
    PA.state = 'WIN'; PA.t = 0;
    GS.state = 'RESULT';
    SFX.bell();
    setTimeout(() => {
      if (GS.round > MONSTERS.length) showResult('YOU WIN! 🏆', true);
      else { GS.playerHP = Math.min(100, GS.playerHP + 20); startRound(); }
    }, 2200);
  }
}

function triggerGameOver() {
  GS.state = 'GAME_OVER';
  hidePuzzle();
  SFX.ko();
  cancelAnimationFrame(rafId);
  showResult('GAME OVER', false);
}

function showResult(msg, win) {
  const ov = document.getElementById('result-overlay');
  const t  = document.getElementById('res-title');
  t.textContent = msg;
  t.style.color = win ? '#00ff88' : '#ff4444';
  document.getElementById('res-score').textContent = 'Score: ' + GS.score;
  document.getElementById('res-hi').textContent    = 'Best: ' + GS.hiScore;
  ov.style.display = 'flex';
}

// ── Draw Ring ─────────────────────────────────────────────────────
function drawRing(t) {
  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#08001a'); bg.addColorStop(0.5, '#12002e'); bg.addColorStop(1, '#06000e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Spotlights
  const sl1 = ctx.createRadialGradient(160, 0, 5, 160, 0, 240);
  sl1.addColorStop(0, 'rgba(255,240,180,0.2)'); sl1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sl1; ctx.fillRect(0, 0, W, H);
  const sl2 = ctx.createRadialGradient(480, 0, 5, 480, 0, 240);
  sl2.addColorStop(0, 'rgba(180,200,255,0.2)'); sl2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sl2; ctx.fillRect(0, 0, W, H);

  // Crowd
  crowd.forEach(p => {
    const bob = Math.sin(t * p.spd + p.phase) * 5;
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y + bob, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.col; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x - p.r, p.y + bob + p.r); ctx.lineTo(p.x - p.r - 5, p.y + bob - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x + p.r, p.y + bob + p.r); ctx.lineTo(p.x + p.r + 5, p.y + bob - 2); ctx.stroke();
  });

  // Ring mat
  ctx.fillStyle = '#c8a86a';
  ctx.beginPath();
  ctx.moveTo(18, FLOOR_Y + 8); ctx.lineTo(W - 18, FLOOR_Y + 8);
  ctx.lineTo(W - 8, H); ctx.lineTo(8, H);
  ctx.closePath(); ctx.fill();

  // Depth lines on mat
  ctx.strokeStyle = '#b89858'; ctx.lineWidth = 1;
  for (let ly = FLOOR_Y + 22; ly < H; ly += 20) {
    const prog = (ly - FLOOR_Y) / (H - FLOOR_Y);
    ctx.beginPath();
    ctx.moveTo(18 + prog * 30, ly); ctx.lineTo(W - 18 - prog * 30, ly);
    ctx.stroke();
  }
  ctx.setLineDash([10, 8]); ctx.strokeStyle = '#aa8840'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W/2, FLOOR_Y + 8); ctx.lineTo(W/2, H); ctx.stroke();
  ctx.setLineDash([]);

  // Ropes
  const ropeCols = ['#ff2222', '#4488ff', '#ff2222'];
  [78, 106, 134].forEach((ry, ri) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(30, ry + 4); ctx.lineTo(W - 30, ry + 4); ctx.stroke();
    ctx.strokeStyle = ropeCols[ri]; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(30, ry); ctx.lineTo(W - 30, ry); ctx.stroke();
    ctx.fillStyle = '#999'; ctx.fillRect(24, ry - 9, 13, 20); ctx.fillRect(W - 37, ry - 9, 13, 20);
  });
  ctx.fillStyle = '#888';
  ctx.fillRect(24, 72, 13, FLOOR_Y - 70); ctx.fillRect(W - 37, 72, 13, FLOOR_Y - 70);

  // Corner pads
  ctx.fillStyle = '#cc2222'; ctx.fillRect(18, FLOOR_Y - 62, 18, 74);
  ctx.fillStyle = '#2244cc'; ctx.fillRect(W - 36, FLOOR_Y - 62, 18, 74);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(22, FLOOR_Y - 58, 10, 12); ctx.fillRect(W - 32, FLOOR_Y - 58, 10, 12);
}

// ── Draw Player — Athletic Boxer (Mario) ─────────────────────────
function drawPlayer(t) {
  const cx = 160, by = FLOOR_Y;
  const state = PA.state;
  ctx.save();

  // ── Pose parameters ──────────────────────────────────────────────
  // punch progress 0→1→0
  const pp = state === 'PUNCH' ? Math.min(1, PA.t / 8) : 0;
  const hurtProg = state === 'HURT' ? Math.min(1, PA.t / 6) : 0;

  // Body lean (torso tilts forward on punch, snaps back on hurt)
  const torsoLean = state === 'PUNCH' ? 0.28 * pp
                  : state === 'HURT'  ? -0.25
                  : state === 'KO'    ? 0.5
                  : 0;
  // Hip forward shift on punch
  const hipX = state === 'PUNCH' ? 18 * pp : state === 'HURT' ? -14 : 0;
  // Bob in idle
  const bob   = state === 'IDLE' || state === 'WIN' ? Math.sin(t * 0.08) * 3 : 0;
  // WIN jump
  const winY  = state === 'WIN' ? -Math.abs(Math.sin(t * 0.13)) * 18 : 0;
  // KO fall
  if (state === 'KO') { ctx.translate(cx, by); ctx.rotate(0.45); ctx.translate(-cx, -by); }

  const bx = cx + hipX;          // base x (hip centre)
  const bby = by + winY;          // base y (feet)

  // ── Shadow ────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(bx, bby - 4, 42 + pp * 10, 9, 0, 0, Math.PI * 2); ctx.fill();

  // ── LEGS ──────────────────────────────────────────────────────────
  // Stance: back leg (right) straight, front leg (left) bent forward
  const stanceLean = state === 'PUNCH' ? 0.14 * pp : 0;

  // Back leg — straight
  ctx.fillStyle = '#cc1111';  // red shorts
  ctx.save();
  ctx.translate(bx + 16, bby - 4);
  ctx.rotate(stanceLean);
  ctx.fillRect(-10, -58, 20, 58);  // thigh + shin
  ctx.restore();

  // Front leg — bent (knee forward)
  ctx.save();
  ctx.translate(bx - 14, bby - 4);
  ctx.rotate(-stanceLean * 0.5);
  ctx.fillStyle = '#cc1111';
  ctx.fillRect(-10, -56, 20, 30);  // thigh
  ctx.fillRect(-8, -28, 18, 28);   // shin (slightly forward)
  ctx.restore();

  // Shorts — waistband + hem
  ctx.fillStyle = '#ee2222';
  ctx.beginPath();
  ctx.ellipse(bx, bby - 62, 30, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';  // white waistband
  ctx.fillRect(bx - 30, bby - 82, 60, 9);
  ctx.fillStyle = '#ee3333';
  ctx.fillRect(bx - 29, bby - 81, 58, 7);

  // Boots (black, like reference)
  const bootL = bx - 14, bootR = bx + 16;
  ctx.fillStyle = '#111111';
  // Front boot
  ctx.beginPath(); ctx.ellipse(bootL - 4, bby - 6, 22, 12, -0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(bootL - 10, bby - 28, 20, 22);
  // Back boot
  ctx.beginPath(); ctx.ellipse(bootR + 4, bby - 6, 20, 11, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(bootR - 6, bby - 28, 20, 22);
  // Boot highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(bootL - 8, bby - 24, 8, 14);
  ctx.fillRect(bootR - 4, bby - 24, 8, 14);

  // ── TORSO (athletic, slightly shaded) ────────────────────────────
  ctx.save();
  ctx.translate(bx, bby - 88);
  ctx.rotate(torsoLean);

  // Body
  ctx.fillStyle = '#f0b060';   // skin tone
  // Torso shape: wider at shoulders, taper to waist
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.bezierCurveTo(-30, -30, -28, -55, -22, -62);
  ctx.lineTo(22, -62);
  ctx.bezierCurveTo(28, -55, 30, -30, 26, 0);
  ctx.closePath(); ctx.fill();
  // Muscle shading (chest line, abs)
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -58); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18, -30); ctx.lineTo(18, -30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18, -42); ctx.lineTo(18, -42); ctx.stroke();
  // Side shading
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.bezierCurveTo(-30,-20,-28,-50,-22,-62); ctx.lineTo(-10,-62); ctx.lineTo(-14, 0); ctx.closePath(); ctx.fill();

  // ── LEFT ARM (guard — tucked in, glove near chin) ────────────────
  const guardY = state === 'PUNCH' ? -50 : -48 + Math.sin(t * 0.09) * 2;  // stays up in guard
  ctx.fillStyle = '#f0b060';
  // Upper arm
  ctx.beginPath();
  ctx.ellipse(-22, -50, 11, 20, 0.3, 0, Math.PI * 2); ctx.fill();
  // Forearm angled up
  ctx.beginPath();
  ctx.ellipse(-28, guardY + 2, 10, 16, -0.4, 0, Math.PI * 2); ctx.fill();
  // LEFT GLOVE (red, guard position — near face)
  ctx.fillStyle = '#dd1111';
  ctx.beginPath(); ctx.ellipse(-32, guardY - 10, 16, 13, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cc0000';
  ctx.beginPath(); ctx.ellipse(-34, guardY - 14, 10, 8, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(-28, guardY - 18, 5, 4, -0.5, 0, Math.PI * 2); ctx.fill();

  // ── RIGHT ARM (PUNCH arm — extends fully forward on punch) ───────
  const punchReach = 48 + pp * 52;   // 48 idle → 100 full punch
  const punchArmY  = -50 - pp * 4;
  ctx.fillStyle = '#f0b060';
  // Upper arm
  ctx.beginPath();
  ctx.ellipse(22, -50, 12, 20, -0.25 + pp * 0.3, 0, Math.PI * 2); ctx.fill();
  // Forearm
  ctx.beginPath();
  ctx.ellipse(22 + punchReach * 0.4, punchArmY - 2, 11, 16, -0.1 - pp * 0.2, 0, Math.PI * 2); ctx.fill();
  // RIGHT GLOVE (red, punch fist — rotates forward)
  ctx.fillStyle = '#dd1111';
  ctx.save();
  ctx.translate(22 + punchReach, punchArmY);
  ctx.rotate(pp * 0.4);
  ctx.beginPath(); ctx.ellipse(0, 0, 18 + pp * 4, 14, 0, 0, Math.PI * 2); ctx.fill();
  // Knuckle highlight
  ctx.fillStyle = '#cc0000';
  ctx.beginPath(); ctx.ellipse(10, -2, 10, 8, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.ellipse(14, -6, 5, 4, 0.3, 0, Math.PI * 2); ctx.fill();
  // Impact flash on full punch
  if (pp > 0.85) {
    ctx.fillStyle = 'rgba(255,255,100,0.7)';
    ctx.beginPath(); ctx.arc(18, 0, 14, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // ── HEAD position (shifts with torso lean + hurt snap) ───────────
  const headX = state === 'PUNCH' ? 6 * pp
              : state === 'HURT'  ? -20 + hurtProg * 6
              : 0;
  const headTilt = state === 'PUNCH' ? 0.1 * pp
                 : state === 'HURT'  ? -0.28
                 : 0;

  ctx.save();
  ctx.translate(headX, -62 + bob);
  ctx.rotate(headTilt);

  // Neck
  ctx.fillStyle = '#f0b060';
  ctx.fillRect(-8, 2, 16, 14);

  // Head
  ctx.fillStyle = '#f4c87a';
  ctx.beginPath(); ctx.ellipse(0, -16, 28, 26, headTilt * 0.3, 0, Math.PI * 2); ctx.fill();

  // Ear
  ctx.fillStyle = '#f4c87a';
  ctx.beginPath(); ctx.arc(-26, -16, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0a860';
  ctx.beginPath(); ctx.arc(-26, -16, 5, 0, Math.PI * 2); ctx.fill();

  // HURT face: squinted eyes, open mouth pain
  if (state === 'HURT' || state === 'KO') {
    // Squinted eyes
    ctx.fillStyle = '#3a2a10';
    ctx.beginPath(); ctx.ellipse(-10, -22, 9, 4, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, -20, 9, 4, -0.3, 0, Math.PI * 2); ctx.fill();
    // Pained mouth
    ctx.fillStyle = '#8a2a10';
    ctx.beginPath(); ctx.ellipse(0, -6, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cc4422';
    ctx.beginPath(); ctx.arc(0, -3, 6, 0, Math.PI); ctx.fill();
    // Pain sweat drops
    ctx.fillStyle = '#88ccff';
    ctx.beginPath(); ctx.arc(-20, -30, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(22, -28, 2, 0, Math.PI * 2); ctx.fill();
  } else {
    // Normal eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-10, -22, 9, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, -22, 9, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2a10';
    ctx.beginPath(); ctx.arc(-9, -21, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(11, -21, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-8, -20, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -20, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-6, -24, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -24, 1.5, 0, Math.PI * 2); ctx.fill();
    // Determined mouth
    ctx.fillStyle = '#c07840';
    ctx.strokeStyle = '#a06030'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(10, -5); ctx.stroke();
  }

  // Nose
  ctx.fillStyle = '#e09050';
  ctx.beginPath(); ctx.ellipse(2, -12, 8, 7, 0, 0, Math.PI * 2); ctx.fill();

  // Bushy mustache
  ctx.fillStyle = '#2a1a08';
  ctx.beginPath(); ctx.ellipse(-10, -4, 13, 7, -0.15, 0, Math.PI); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, -4, 13, 7,  0.15, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#1a0e04';
  ctx.beginPath(); ctx.ellipse(-10, -6, 13, 5, -0.12, 0, Math.PI); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, -6, 13, 5,  0.12, 0, Math.PI); ctx.fill();

  // Mario cap
  ctx.fillStyle = '#cc2200';
  ctx.beginPath(); ctx.ellipse(2, -34, 34, 12, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(-34, -36, 68, 5);
  ctx.beginPath(); ctx.ellipse(0, -46, 26, 20, 0, Math.PI, Math.PI * 2); ctx.fill();
  // M badge
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, -46, 13, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cc2200'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
  ctx.fillText('M', 0, -39);

  ctx.restore(); // head
  ctx.restore(); // torso

  // ── Stars on hurt ─────────────────────────────────────────────────
  if (state === 'HURT' || state === 'KO') {
    for (let s = 0; s < 6; s++) {
      const sa = s * 1.05 + t * 0.3;
      const sr = 28 + Math.sin(t * 0.2) * 5;
      ctx.fillStyle = s % 2 === 0 ? '#ffff00' : '#ffffff';
      ctx.font = '13px monospace'; ctx.textAlign = 'center';
      ctx.fillText('★', bx + hipX + Math.cos(sa) * sr, bby - 148 + bob + Math.sin(sa) * sr);
    }
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

// ── Draw Monster ──────────────────────────────────────────────────
function drawMonster(t) {
  const m   = getMon();
  const cx  = 470, by = FLOOR_Y;
  const state = MA.state;
  ctx.save();
  let ox = 0, oy = 0;
  if (state === 'PUNCH') ox = -(16 + Math.sin(MA.t * 0.22) * 12);
  if (state === 'HURT')  { ox = 15; oy = MA.t % 8 < 4 ? -5 : 0; }
  if (state === 'KO')    { ctx.translate(cx, by); ctx.rotate(-0.42); ctx.translate(-cx, -by); oy = 22; }
  const bob = (state === 'IDLE' || state === 'WIN') ? Math.sin(t * 0.07) * 4 : 0;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(cx + ox, by - 3, 46, 12, 0, 0, Math.PI * 2); ctx.fill();

  switch (m.type) {
    case 'mushroom': drawMushroom(cx+ox, by+oy, m, state, t, bob); break;
    case 'blob':     drawBlob(cx+ox, by+oy, m, state, t, bob);     break;
    case 'turtle':   drawTurtle(cx+ox, by+oy, m, state, t, bob);   break;
    case 'ghost':    drawGhost(cx+ox, by+oy, m, state, t, bob);    break;
    case 'plant':    drawPlant(cx+ox, by+oy, m, state, t, bob);    break;
    case 'dragon':   drawDragon(cx+ox, by+oy, m, state, t, bob);   break;
  }

  // Hurt stars
  if (state === 'HURT') {
    ctx.fillStyle = '#ffaa00';
    for (let s = 0; s < 5; s++) {
      const sa = s * 1.26 + t * 0.3;
      ctx.font = '14px monospace'; ctx.textAlign = 'center';
      ctx.fillText('★', cx+ox + Math.cos(sa)*28, by+oy - 155 + bob + Math.sin(sa)*20);
    }
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

// ── Monster draw helpers ──────────────────────────────────────────
function angryEyes(cx, cy, col, hw, hh, spacing) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(cx - spacing, cy, hw, hh, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + spacing, cy, hw, hh, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(cx - spacing, cy, hw * 0.65, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + spacing, cy, hw * 0.65, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx - spacing + 2, cy + 1, hw * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + spacing + 2, cy + 1, hw * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx - spacing + 4, cy - 3, hw * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + spacing + 4, cy - 3, hw * 0.18, 0, Math.PI * 2); ctx.fill();
  // Angry brows
  ctx.strokeStyle = '#222'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(cx - spacing - hw, cy - hh - 4); ctx.lineTo(cx - spacing + hw - 2, cy - hh + 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + spacing + hw, cy - hh - 4); ctx.lineTo(cx + spacing - hw + 2, cy - hh + 4); ctx.stroke();
}

function gloves(cx, by, bob, state, topY) {
  const gox = state === 'PUNCH' ? -34 : 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(cx - 58 + gox, by + topY + bob, 19, 14, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 58,        by + topY + bob, 19, 14, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ddd';
  ctx.fillRect(cx - 74 + gox, by + topY - 8 + bob, 24, 13);
  ctx.fillRect(cx + 48, by + topY - 8 + bob, 24, 13);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(cx - 53 + gox, by + topY - 5 + bob, 6, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 64, by + topY - 5 + bob, 6, 5, 0.3, 0, Math.PI * 2); ctx.fill();
}

function drawMushroom(cx, by, m, state, _t, bob) {
  // Legs
  ctx.fillStyle = '#ddbbaa';
  ctx.fillRect(cx - 26, by - 55 + bob, 20, 52); ctx.fillRect(cx + 6, by - 55 + bob, 20, 52);
  ctx.fillStyle = '#4a2200';
  ctx.beginPath(); ctx.ellipse(cx - 18, by - 8 + bob, 22, 11, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 20, by - 8 + bob, 22, 11, -0.15, 0, Math.PI * 2); ctx.fill();
  // Body
  ctx.fillStyle = '#eeccaa';
  ctx.beginPath(); ctx.ellipse(cx, by - 88 + bob, 42, 40, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8B4513'; ctx.fillRect(cx - 42, by - 70 + bob, 84, 9);
  // Face
  angryEyes(cx, by - 100 + bob, m.eye, 13, 14, 17);
  ctx.fillStyle = '#5a2200'; ctx.strokeStyle = '#2a0800'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 18, by - 76 + bob); ctx.quadraticCurveTo(cx, by - 67 + bob, cx + 18, by - 76 + bob); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; [-10, 0, 8].forEach(dx => ctx.fillRect(cx + dx, by - 78 + bob, 8, 9));
  // Cap
  ctx.fillStyle = m.color;
  ctx.beginPath(); ctx.ellipse(cx, by - 132 + bob, 55, 46, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, by - 125 + bob, 62, 22, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#fff';
  [[-10,-145],[- 28,-134],[12,-142],[28,-124],[-4,-122]].forEach(p => {
    ctx.beginPath(); ctx.arc(cx + p[0], by + p[1] + bob, 9, 0, Math.PI * 2); ctx.fill();
  });
  gloves(cx, by, bob, state, -88);
}

function drawBlob(cx, by, m, state, _t, bob) {
  ctx.fillStyle = m.color;
  ctx.beginPath();
  ctx.moveTo(cx - 48, by - 18 + bob);
  ctx.bezierCurveTo(cx - 60, by - 85 + bob, cx - 38, by - 148 + bob, cx, by - 148 + bob);
  ctx.bezierCurveTo(cx + 38, by - 148 + bob, cx + 60, by - 85 + bob, cx + 48, by - 18 + bob);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = m.accent;
  [-22, 0, 22].forEach((dx, i) => { ctx.beginPath(); ctx.ellipse(cx + dx, by - 10 + bob, 8, 14 + i * 2, 0, 0, Math.PI * 2); ctx.fill(); });
  angryEyes(cx, by - 100 + bob, m.eye, 19, 22, 18);
  ctx.fillStyle = '#115511'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, by - 68 + bob, 24, 15, 0, 0, Math.PI); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; [-13, 0, 11].forEach(dx => ctx.fillRect(cx + dx, by - 76 + bob, 9, 11));
  gloves(cx, by, bob, state, -88);
}

function drawTurtle(cx, by, m, state, _t, bob) {
  ctx.fillStyle = '#788844';
  ctx.fillRect(cx - 28, by - 54 + bob, 22, 50); ctx.fillRect(cx + 6, by - 54 + bob, 22, 50);
  ctx.fillStyle = '#445522';
  ctx.beginPath(); ctx.ellipse(cx - 20, by - 9 + bob, 24, 13, 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 22, by - 9 + bob, 24, 13, -0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = m.color;
  ctx.beginPath(); ctx.ellipse(cx, by - 86 + bob, 56, 60, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = m.accent; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, by - 86 + bob, 36, 42, 0, 0, Math.PI * 2); ctx.stroke();
  [[0,0],[26,0],[-26,0],[13,24],[-13,24],[13,-24],[-13,-24]].forEach(p => {
    ctx.beginPath(); ctx.arc(cx + p[0], by - 86 + bob + p[1], 9, 0, Math.PI * 2); ctx.stroke();
  });
  ctx.fillStyle = '#8aaa44';
  ctx.beginPath(); ctx.ellipse(cx - 8, by - 140 + bob, 30, 28, 0.2, 0, Math.PI * 2); ctx.fill();
  angryEyes(cx - 6, by - 145 + bob, m.eye, 13, 13, 15);
  ctx.fillStyle = '#445522'; ctx.fillRect(cx - 26, by - 124 + bob, 38, 11);
  ctx.fillStyle = '#fff'; [-14, -4, 8].forEach(dx => ctx.fillRect(cx + dx, by - 126 + bob, 9, 9));
  ctx.fillStyle = '#ffaa00';
  [cx-32,cx-20,cx-8,cx+4].forEach((sx, i) => {
    ctx.beginPath(); ctx.moveTo(sx, by-130+bob-i*3); ctx.lineTo(sx-7, by-144+bob-i*3); ctx.lineTo(sx+7, by-144+bob-i*3); ctx.closePath(); ctx.fill();
  });
  ctx.fillStyle = '#8aaa44';
  ctx.fillRect(cx - 66, by - 106 + bob, 18, 28); ctx.fillRect(cx + 48, by - 106 + bob, 18, 28);
  gloves(cx, by, bob, state, -84);
}

function drawGhost(cx, by, m, state, _t, bob) {
  ctx.globalAlpha = 0.93;
  const glow = ctx.createRadialGradient(cx, by - 90 + bob, 12, cx, by - 90 + bob, 100);
  glow.addColorStop(0, 'rgba(180,150,255,0.28)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(cx - 110, by - 200, 220, 210);
  ctx.fillStyle = m.color;
  ctx.beginPath();
  ctx.arc(cx, by - 112 + bob, 64, Math.PI, 0);
  ctx.lineTo(cx + 64, by - 22 + bob);
  let tx = cx + 64;
  for (let i = 0; i < 6; i++) {
    const nx = tx - 22, mid = tx - 11;
    ctx.quadraticCurveTo(mid, by - (i % 2 === 0 ? 6 : 22) + bob, nx, by - 22 + bob);
    tx = nx;
  }
  ctx.closePath(); ctx.fill();
  angryEyes(cx, by - 125 + bob, m.eye, 20, 24, 22);
  ctx.fillStyle = '#440066'; ctx.strokeStyle = '#220033'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 22, by - 92 + bob);
  ctx.bezierCurveTo(cx - 10, by - 82 + bob, cx + 10, by - 82 + bob, cx + 22, by - 92 + bob);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  [-13, -4, 5, 14].forEach(dx => ctx.fillRect(cx + dx, by - 95 + bob, 8, 10));
  // Floating gloves
  const gox = state === 'PUNCH' ? -36 : 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(cx - 74 + gox, by - 100 + bob, 20, 14, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 74,        by - 100 + bob, 20, 14, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPlant(cx, by, m, state, t, bob) {
  ctx.fillStyle = '#338833'; ctx.fillRect(cx - 30, by - 52, 60, 52);
  ctx.fillStyle = '#448844'; ctx.fillRect(cx - 36, by - 64, 72, 18);
  ctx.fillStyle = '#2a662a'; ctx.fillRect(cx - 36, by - 64, 72, 7);
  ctx.fillStyle = m.color; ctx.fillRect(cx - 20, by - 128 + bob, 40, 70);
  ctx.fillStyle = '#44aa22';
  ctx.beginPath(); ctx.ellipse(cx - 44, by - 96 + bob, 34, 14, -0.55, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 44, by - 96 + bob, 34, 14,  0.55, 0, Math.PI * 2); ctx.fill();
  const mouthY = by - 156 + bob;
  const mopen = Math.abs(Math.sin(t * 0.1)) * 24 + 8;
  ctx.fillStyle = m.color;
  ctx.beginPath(); ctx.arc(cx, mouthY, 56, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - 56, mouthY - 16, 112, 18);
  ctx.beginPath(); ctx.arc(cx, mouthY, 56, 0, Math.PI); ctx.fill();
  ctx.fillRect(cx - 56, mouthY - 2, 112, 18);
  ctx.fillStyle = '#220000'; ctx.fillRect(cx - 54, mouthY - mopen, 108, mopen * 2);
  ctx.fillStyle = '#fff';
  for (let ti = -2; ti <= 2; ti++) {
    ctx.beginPath(); ctx.moveTo(cx + ti*22-10, mouthY-mopen); ctx.lineTo(cx+ti*22, mouthY-mopen+18); ctx.lineTo(cx+ti*22+10, mouthY-mopen); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + ti*22-10, mouthY+mopen); ctx.lineTo(cx+ti*22, mouthY+mopen-18); ctx.lineTo(cx+ti*22+10, mouthY+mopen); ctx.closePath(); ctx.fill();
  }
  angryEyes(cx, mouthY - 50, m.eye, 16, 18, 28);
  // Vine arms + gloves
  const gox2 = state === 'PUNCH' ? -30 : 0;
  ctx.strokeStyle = m.color; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(cx - 20, by - 106 + bob); ctx.quadraticCurveTo(cx - 54, by - 94 + bob, cx - 68 + gox2, by - 106 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 20, by - 106 + bob); ctx.quadraticCurveTo(cx + 54, by - 94 + bob, cx + 68, by - 106 + bob); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(cx - 68 + gox2, by - 106 + bob, 20, 14, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 68,         by - 106 + bob, 20, 14, -0.3, 0, Math.PI * 2); ctx.fill();
}

function drawDragon(cx, by, m, state, _t, bob) {
  // Tail
  ctx.fillStyle = m.color;
  ctx.beginPath();
  ctx.moveTo(cx + 56, by - 44 + bob);
  ctx.bezierCurveTo(cx + 96, by - 22 + bob, cx + 108, by - 76 + bob, cx + 86, by - 108 + bob);
  ctx.bezierCurveTo(cx + 66, by - 130 + bob, cx + 62, by - 66 + bob, cx + 52, by - 66 + bob);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffaa00';
  [[74,-62],[88,-80],[94,-100]].forEach(p => {
    ctx.beginPath(); ctx.moveTo(cx+p[0], by+p[1]+bob-12); ctx.lineTo(cx+p[0]+16, by+p[1]+bob); ctx.lineTo(cx+p[0]-2, by+p[1]+bob+12); ctx.closePath(); ctx.fill();
  });
  // Body
  ctx.fillStyle = m.color;
  ctx.beginPath(); ctx.ellipse(cx + 5, by - 86 + bob, 60, 62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = m.accent;
  ctx.beginPath(); ctx.ellipse(cx + 5, by - 78 + bob, 40, 46, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = m.color; ctx.lineWidth = 1;
  for (let bi = 0; bi < 4; bi++) {
    ctx.beginPath(); ctx.ellipse(cx + 5, by - 55 + bob - bi * 20, 32 - bi * 2, 11, 0, 0, Math.PI); ctx.stroke();
  }
  // Legs
  ctx.fillStyle = m.color;
  ctx.fillRect(cx - 46, by - 52 + bob, 24, 50); ctx.fillRect(cx + 24, by - 52 + bob, 24, 50);
  ctx.fillStyle = '#224422'; ctx.fillRect(cx - 52, by - 10 + bob, 32, 11); ctx.fillRect(cx + 22, by - 10 + bob, 32, 11);
  ctx.fillStyle = '#aaa';
  [-54,-46,-38].forEach(dx => ctx.fillRect(cx + dx, by - 14 + bob, 7, 15));
  [24, 32, 40].forEach(dx => ctx.fillRect(cx + dx, by - 14 + bob, 7, 15));
  // Back spikes
  ctx.fillStyle = '#ffaa00';
  [-24,-12,0,12,24].forEach((dx, i) => {
    ctx.beginPath(); ctx.moveTo(cx+dx, by-138+bob+i*4); ctx.lineTo(cx+dx-9, by-158+bob+i*4); ctx.lineTo(cx+dx+9, by-158+bob+i*4); ctx.closePath(); ctx.fill();
  });
  // Head
  ctx.fillStyle = m.color;
  ctx.beginPath(); ctx.ellipse(cx - 15, by - 162 + bob, 46, 38, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx - 50, by - 155 + bob, 26, 18, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff6600';
  ctx.beginPath(); ctx.arc(cx - 58, by - 150 + bob, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffdd00';
  ctx.beginPath(); ctx.arc(cx - 59, by - 150 + bob, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(cx-40,by-140+bob); ctx.lineTo(cx-30,by-128+bob); ctx.lineTo(cx-20,by-140+bob); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx-26,by-140+bob); ctx.lineTo(cx-16,by-128+bob); ctx.lineTo(cx-6, by-140+bob); ctx.closePath(); ctx.fill();
  angryEyes(cx - 5, by - 172 + bob, m.eye, 15, 18, 18);
  ctx.fillStyle = '#ffaa00';
  ctx.beginPath(); ctx.moveTo(cx + 4, by - 196 + bob); ctx.lineTo(cx + 22, by - 222 + bob); ctx.lineTo(cx + 30, by - 195 + bob); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 22, by - 192 + bob); ctx.lineTo(cx - 8,  by - 220 + bob); ctx.lineTo(cx + 2,  by - 194 + bob); ctx.closePath(); ctx.fill();
  // Arms + gloves
  ctx.fillStyle = m.color;
  ctx.fillRect(cx - 72, by - 114 + bob, 20, 32); ctx.fillRect(cx + 54, by - 114 + bob, 20, 32);
  gloves(cx, by, bob, state, -90);
}

// ── HUD ───────────────────────────────────────────────────────────
function drawHUD() {
  const m   = getMon();
  const BAR_W = 224;   // width of each energy bar
  const BAR_H = 22;
  const BAR_Y = 10;
  const LABEL_Y = BAR_Y + 14;

  // ── Background panel ──
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, W, 60);
  // Gold top border
  ctx.fillStyle = '#aa8800';
  ctx.fillRect(0, 0, W, 3);

  // ════ MARIO energy bar (left → right drain) ════
  const pp  = Math.max(0, GS.playerHP / 100);
  const pLo = pp <= 0.25;
  const pMid = pp <= 0.5;

  // Name label (left of bar)
  ctx.fillStyle = '#ffdd88'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('MARIO', 8, LABEL_Y);

  const barX1 = 70; // bar starts after name

  // Bar shadow / track
  ctx.fillStyle = '#111';
  ctx.fillRect(barX1, BAR_Y, BAR_W, BAR_H);
  // Yellow drain (ghost bar)
  if (pp < 1) {
    ctx.fillStyle = 'rgba(255,220,0,0.25)';
    ctx.fillRect(barX1, BAR_Y, BAR_W, BAR_H);
  }
  // Main energy fill
  const pColor = pLo ? '#ff2222' : pMid ? '#ffaa00' : '#22cc44';
  ctx.fillStyle = pColor;
  ctx.fillRect(barX1, BAR_Y, BAR_W * pp, BAR_H);
  // Shiny highlight on bar
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(barX1, BAR_Y, BAR_W * pp, BAR_H / 2);
  // Segment ticks
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const tx = barX1 + (BAR_W / 10) * i;
    ctx.beginPath(); ctx.moveTo(tx, BAR_Y); ctx.lineTo(tx, BAR_Y + BAR_H); ctx.stroke();
  }
  // Bar border
  ctx.strokeStyle = pLo ? '#ff4444' : '#666'; ctx.lineWidth = 2;
  ctx.strokeRect(barX1, BAR_Y, BAR_W, BAR_H);
  // HP text inside bar
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
  ctx.fillText(Math.ceil(GS.playerHP) + ' / 100', barX1 + BAR_W / 2, BAR_Y + 15);
  // Danger flash outline
  if (pLo && Math.sin(globalT * 0.35) > 0) {
    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3;
    ctx.strokeRect(barX1 - 1, BAR_Y - 1, BAR_W + 2, BAR_H + 2);
  }

  // ════ MONSTER energy bar (right → left drain) ════
  const mp  = Math.max(0, GS.monsterHP / GS.monsterMaxHP);
  const mLo = mp <= 0.25;
  const mMid = mp <= 0.5;

  // Name label (right of bar)
  ctx.fillStyle = '#ff9999'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'right';
  ctx.fillText(m.name, W - 8, LABEL_Y);

  const barX2 = W - 70 - BAR_W; // bar ends before name

  // Track
  ctx.fillStyle = '#111';
  ctx.fillRect(barX2, BAR_Y, BAR_W, BAR_H);
  // Ghost bar
  if (mp < 1) {
    ctx.fillStyle = 'rgba(255,220,0,0.25)';
    ctx.fillRect(barX2, BAR_Y, BAR_W, BAR_H);
  }
  // Monster bar fills right-to-left
  const mColor = mLo ? '#ff2222' : mMid ? '#ffaa00' : '#cc2222';
  ctx.fillStyle = mColor;
  ctx.fillRect(barX2 + BAR_W * (1 - mp), BAR_Y, BAR_W * mp, BAR_H);
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(barX2 + BAR_W * (1 - mp), BAR_Y, BAR_W * mp, BAR_H / 2);
  // Ticks
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const tx = barX2 + (BAR_W / 10) * i;
    ctx.beginPath(); ctx.moveTo(tx, BAR_Y); ctx.lineTo(tx, BAR_Y + BAR_H); ctx.stroke();
  }
  // Border
  ctx.strokeStyle = mLo ? '#ff4444' : '#882222'; ctx.lineWidth = 2;
  ctx.strokeRect(barX2, BAR_Y, BAR_W, BAR_H);
  // HP text
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
  ctx.fillText(Math.ceil(GS.monsterHP) + ' / ' + GS.monsterMaxHP, barX2 + BAR_W / 2, BAR_Y + 15);
  // Danger flash
  if (mLo && Math.sin(globalT * 0.35) > 0) {
    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3;
    ctx.strokeRect(barX2 - 1, BAR_Y - 1, BAR_W + 2, BAR_H + 2);
  }

  // ════ Centre panel ════
  // Round badge
  ctx.fillStyle = '#1a1a00';
  ctx.fillRect(W / 2 - 38, BAR_Y, 76, BAR_H);
  ctx.strokeStyle = '#aa8800'; ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 38, BAR_Y, 76, BAR_H);
  ctx.fillStyle = '#ffdd00'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  ctx.fillText('RND ' + GS.round, W / 2, BAR_Y + 15);

  // Q counter below centre badge
  ctx.fillStyle = '#888'; ctx.font = '10px monospace';
  ctx.fillText('Q ' + GS.qNum + '/' + ROUND_Q, W / 2, BAR_Y + BAR_H + 14);

  // Score bottom-left
  ctx.fillStyle = '#ffdd00'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText(GS.score, 8, 56);
  ctx.fillStyle = '#444'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
  ctx.fillText('HI:' + GS.hiScore, W - 8, 56);

  // ── Combo flash bottom-centre ──
  if (GS.combo > 1) {
    const sz = Math.min(22, 12 + GS.combo * 1.5);
    ctx.fillStyle = '#ff8800';
    ctx.font = `bold ${sz}px monospace`; ctx.textAlign = 'center';
    ctx.fillText(GS.combo + 'x COMBO!', W / 2, H - 8);
  }
  ctx.textAlign = 'left';
}

// ── Floating texts ────────────────────────────────────────────────
function updateFloats(dt) {
  floats = floats.filter(f => f.life > 0);
  floats.forEach(f => { f.y += f.vy * dt; f.life -= 0.022 * dt; });
}
function drawFloats() {
  floats.forEach(f => {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.col;
    ctx.font = `bold ${f.sz}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(f.txt, f.x, f.y);
  });
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

// ── Start round ───────────────────────────────────────────────────
function startRound() {
  const m = getMon();
  GS.qNum       = 0;
  GS.monsterHP  = m.hp;
  GS.monsterMaxHP = m.hp;
  PA = { state:'IDLE', t:0 };
  MA = { state:'IDLE', t:0 };
  floats = [];
  GS.state = 'READY';
  SFX.bell();
  document.getElementById('result-overlay').style.display = 'none';
  setTimeout(() => {
    GS.state = 'FIGHTING';
    setTimeout(startPuzzle, 750);
  }, 2300);
}

// ── Main loop ─────────────────────────────────────────────────────
let rafId = null, lastTs = 0, globalT = 0;

function loop(ts) {
  const dt = Math.min((ts - lastTs) / 16.667, 3);
  lastTs   = ts;
  globalT += dt;
  PA.t    += dt;
  MA.t    += dt;
  if (PA.state === 'HURT' && PA.t > 18) { PA.state = 'IDLE'; PA.t = 0; }
  if (MA.state === 'HURT' && MA.t > 18) { MA.state = 'IDLE'; MA.t = 0; }

  let sx = 0, sy = 0;
  if (GS.shake > 0) {
    sx = (Math.random() - 0.5) * GS.shake * 2;
    sy = (Math.random() - 0.5) * GS.shake * 2;
    GS.shake = Math.max(0, GS.shake - 0.75 * dt);
  }
  ctx.save(); ctx.translate(sx, sy);

  drawRing(globalT);
  drawPlayer(globalT);
  drawMonster(globalT);
  updateFloats(dt);
  drawFloats();
  drawHUD();

  // Round banner
  if (GS.state === 'READY') {
    ctx.fillStyle = 'rgba(0,0,0,0.58)'; ctx.fillRect(0, H / 2 - 52, W, 104);
    ctx.fillStyle = '#ffdd00'; ctx.font = 'bold 46px monospace'; ctx.textAlign = 'center';
    ctx.fillText('ROUND ' + GS.round, W / 2, H / 2 + 6);
    ctx.fillStyle = '#ff8800'; ctx.font = 'bold 22px monospace';
    ctx.fillText('VS  ' + getMon().name, W / 2, H / 2 + 36);
    ctx.textAlign = 'left';
  }

  ctx.restore();
  if (GS.state !== 'GAME_OVER' && GS.state !== 'MENU') {
    rafId = requestAnimationFrame(loop);
  }
}

// ── Public ────────────────────────────────────────────────────────
function startGame() {
  initAudio();
  resetGame();
  floats = [];
  document.getElementById('menu').style.display = 'none';
  document.getElementById('result-overlay').style.display = 'none';
  hidePuzzle();
  cancelAnimationFrame(rafId);
  lastTs = performance.now(); globalT = 0;
  rafId = requestAnimationFrame(loop);
  startRound();
}

function showMenu() {
  cancelAnimationFrame(rafId);
  hidePuzzle();
  GS.state = 'MENU';
  document.getElementById('result-overlay').style.display = 'none';
  document.getElementById('menu').style.display = 'flex';
}

// Initial render (menu preview)
(function() { drawRing(0); drawPlayer(0); drawMonster(0); })();

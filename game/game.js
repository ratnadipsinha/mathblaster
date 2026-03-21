'use strict';
// ================================================================
//  MATHBLASTER  —  Complete Game
// ================================================================

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
const W = 640, H = 360;
const GROUND_Y = 288;
const HERO_X   = 72;

// ── Audio ────────────────────────────────────────────────────────
let ac = null;
function initAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
}
function beep(freq, type, dur, vol=0.22) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.connect(g); g.connect(ac.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.start(); o.stop(ac.currentTime + dur);
}
const SFX = {
  shoot:    () => { beep(880,'square',0.07,0.2); setTimeout(()=>beep(440,'square',0.06,0.12),35); },
  mega:     () => [220,440,880,1320].forEach((f,i)=>setTimeout(()=>beep(f,'sawtooth',0.18,0.32),i*28)),
  power:    () => { beep(660,'square',0.1,0.25); setTimeout(()=>beep(880,'square',0.08,0.2),50); },
  correct:  () => { beep(523,'sine',0.1,0.22); setTimeout(()=>beep(659,'sine',0.1,0.22),75); setTimeout(()=>beep(784,'sine',0.14,0.3),150); },
  wrong:    () => beep(180,'sawtooth',0.28,0.38),
  damage:   () => beep(130,'square',0.22,0.28),
  levelup:  () => [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,'sine',0.22,0.38),i*90)),
  boss:     () => [110,110,220].forEach((f,i)=>setTimeout(()=>beep(f,'sawtooth',0.45,0.38),i*180)),
  gameover: () => [380,300,240,190].forEach((f,i)=>setTimeout(()=>beep(f,'sawtooth',0.28,0.38),i*220)),
};

// ── State ────────────────────────────────────────────────────────
let GS = {};  // set by resetGame()
function resetGame() {
  GS = {
    state:       'MENU',  // MENU | PLAYING | PUZZLE | LEVEL_CLEAR | BOSS_INTRO | GAME_OVER
    score:       0,
    hiScore:     parseInt(localStorage.getItem('mb_hi') || '0'),
    hearts:      3,
    maxHearts:   3,
    level:       1,
    combo:       0,
    comboTimer:  0,
    shake:       0,
    scrollX:     0,
  };
}
resetGame();

// ── Level Config ─────────────────────────────────────────────────
function lvlCfg(n) {
  return {
    tableMin:    n <= 2 ? 2 : n <= 4 ? 3 : n <= 7 ? 5 : n <= 10 ? 7 : 9,
    tableMax:    n <= 2 ? 3 : n <= 4 ? 5 : n <= 7 ? 7 : n <= 10 ? 9 : 12,
    speed:       Math.min(0.38 + n * 0.065, 2.4),
    timerMs:     Math.max(1700, 5400 - n * 210),
    killsNeeded: Math.min(3 + Math.floor(n / 2), 8),
    isBoss:      n % 5 === 0,
  };
}

// ── Entities ─────────────────────────────────────────────────────
let hero     = {};
let enemies  = [];
let bullets  = [];
let particles= [];
let floats   = [];   // floating text effects
let wave     = {};
let boss     = {};

function initEntities() {
  hero     = { x: HERO_X, y: GROUND_Y - 38, frame: 0, ft: 0, gunFlash: 0, hitFlash: 0 };
  enemies  = [];
  bullets  = [];
  particles= [];
  floats   = [];
  wave     = { kills: 0, spawning: false };
  boss     = { active: false };
}

// ── Puzzle State ──────────────────────────────────────────────────
let PZ = { active: false };
let pzTimerRAF = null;

function genPuzzle(lvl) {
  const c = lvlCfg(lvl);
  const a = rand(c.tableMin, c.tableMax);
  const b = rand(2, 10);
  const correct = a * b;
  const wrongs = new Set();
  while (wrongs.size < 3) {
    const d = rand(1, 4) * (Math.random() < 0.5 ? 1 : -1) * (Math.random() < 0.5 ? 1 : b);
    const w = correct + d;
    if (w > 0 && w !== correct) wrongs.add(w);
  }
  return { a, b, correct, opts: [...wrongs, correct].sort(() => Math.random() - 0.5) };
}

function showPuzzle() {
  if (!GS || GS.state === 'GAME_OVER') return;
  const c = lvlCfg(GS.level);
  const p = genPuzzle(GS.level);
  PZ = { active: true, ...p, startTime: performance.now(), timerMs: c.timerMs, timerPct: 1, answered: false };

  const qEl  = document.getElementById('pz-q');
  const ansEl = document.getElementById('pz-answers');
  const ov    = document.getElementById('puzzle-overlay');

  qEl.textContent = `${PZ.a} \u00d7 ${PZ.b} = ?`;
  ansEl.innerHTML = '';
  PZ.opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'ans-btn';
    btn.textContent = opt;
    const handler = (e) => { e.preventDefault(); onAnswer(opt, btn); };
    btn.addEventListener('click',      handler);
    btn.addEventListener('touchstart', handler, { passive: false });
    ansEl.appendChild(btn);
  });
  ov.style.display = 'block';
  GS.state = 'PUZZLE';

  cancelAnimationFrame(pzTimerRAF);
  (function tick() {
    if (!PZ.active || PZ.answered) return;
    const elapsed = performance.now() - PZ.startTime;
    PZ.timerPct = Math.max(0, 1 - elapsed / PZ.timerMs);
    const bar = document.getElementById('pz-timer-bar');
    if (bar) {
      bar.style.width = (PZ.timerPct * 100) + '%';
      bar.style.background = PZ.timerPct > 0.5 ? '#00ff88' : PZ.timerPct > 0.2 ? '#ffaa00' : '#ff4444';
    }
    if (PZ.timerPct <= 0) { PZ.answered = true; onTimeUp(); return; }
    pzTimerRAF = requestAnimationFrame(tick);
  })();
}

function hidePuzzle() {
  document.getElementById('puzzle-overlay').style.display = 'none';
  PZ.active = false;
  cancelAnimationFrame(pzTimerRAF);
}

function onAnswer(val, btn) {
  if (PZ.answered) return;
  PZ.answered = true;
  cancelAnimationFrame(pzTimerRAF);
  const elapsed = (performance.now() - PZ.startTime) / 1000;

  if (val === PZ.correct) {
    btn.classList.add('correct');
    SFX.correct();
    fireShot(elapsed);
    setTimeout(() => { hidePuzzle(); GS.state = 'PLAYING'; afterPuzzle(); }, 600);
  } else {
    btn.classList.add('wrong');
    document.querySelectorAll('.ans-btn').forEach(b => {
      if (parseInt(b.textContent) === PZ.correct) b.classList.add('correct');
    });
    SFX.wrong();
    takeDamage('WRONG!');
    setTimeout(() => { hidePuzzle(); GS.state = 'PLAYING'; afterPuzzle(); }, 750);
  }
}

function onTimeUp() {
  hidePuzzle();
  GS.state = 'PLAYING';
  SFX.damage();
  takeDamage('TOO SLOW!');
  setTimeout(afterPuzzle, 350);
}

function afterPuzzle() {
  if (GS.state === 'GAME_OVER') return;
  // If enemy still alive and close, it dealt a hit; spawn next
  if (enemies.length === 0 && !boss.active) {
    if (wave.kills >= lvlCfg(GS.level).killsNeeded) {
      triggerLevelClear();
    } else {
      setTimeout(() => { if (GS.state === 'PLAYING') spawnEnemy(); }, 700);
    }
  } else if (boss.active) {
    setTimeout(() => { if (GS.state === 'PLAYING' && boss.active) showPuzzle(); }, 800);
  }
}

// ── Shot Power ───────────────────────────────────────────────────
function fireShot(elapsed) {
  let power, label, color, pts;
  if      (elapsed < 1.0) { power=4; label='MEGA!';   color='#ff4400'; pts=300; SFX.mega();  }
  else if (elapsed < 2.0) { power=3; label='POWER!';  color='#ffdd00'; pts=200; SFX.power(); }
  else if (elapsed < 3.5) { power=2; label='SHOT!';   color='#00ff88'; pts=100; SFX.shoot(); }
  else                    { power=1; label='WEAK';     color='#888888'; pts=50;  SFX.shoot(); }

  GS.combo++;
  GS.comboTimer = 200;
  const mult = Math.min(GS.combo, 5);
  GS.score += pts * mult;
  if (GS.score > GS.hiScore) { GS.hiScore = GS.score; localStorage.setItem('mb_hi', GS.hiScore); }

  hero.gunFlash = 10;
  spawnBullet(power, color);

  const tx = enemies[0]?.x ?? (boss.active ? boss.x : 400);
  floatText(label, tx - 30, GROUND_Y - 85, color, 13);
  if (GS.combo > 1) floatText('x' + mult + ' COMBO', tx - 30, GROUND_Y - 102, '#ffdd00', 11);
}

// ── Bullets ──────────────────────────────────────────────────────
function spawnBullet(power, color) {
  const sizes = [5, 7, 10, 16];
  bullets.push({ x: hero.x + 36, y: hero.y + 15, vx: 9 + power*1.4, power, size: sizes[power-1], color, trail: [] });
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 6) b.trail.shift();
    b.x += b.vx * dt;
    if (b.x > W + 20) { bullets.splice(i, 1); continue; }

    // vs enemies
    let hit = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const hw = e.type === 'TANK' ? 18 : 14;
      if (b.x > e.x - hw && b.x < e.x + hw && b.y > e.y - 4 && b.y < e.y + e.h + 4) {
        hitEnemy(j, b.power);
        spawnBurst(e.x, e.y + e.h / 2, '#ff6600', 5 + b.power * 2);
        bullets.splice(i, 1); hit = true; break;
      }
    }
    if (hit) continue;

    // vs boss
    if (boss.active && b.x > boss.x - 28 && b.x < boss.x + 28 && b.y > boss.y - 5 && b.y < boss.y + 65) {
      hitBoss(b.power);
      spawnBurst(boss.x, boss.y + 30, '#ff4400', 8 + b.power * 2);
      bullets.splice(i, 1);
    }
  }
}

// ── Enemies ──────────────────────────────────────────────────────
const ETYPE = {
  GRUNT:  { hp:1, spd:1.0, h:36, col:'#cc2222', pts:100 },
  RUNNER: { hp:1, spd:1.9, h:30, col:'#ff6600', pts:150 },
  TANK:   { hp:3, spd:0.5, h:44, col:'#446644', pts:300 },
};

function spawnEnemy() {
  if (GS.state === 'GAME_OVER' || wave.spawning) return;
  wave.spawning = true;

  const cfg = lvlCfg(GS.level);
  let type = 'GRUNT';
  const r = Math.random();
  if (GS.level >= 3 && r < 0.28) type = 'RUNNER';
  if (GS.level >= 6 && r < 0.18) type = 'TANK';

  const t = ETYPE[type];
  enemies.push({ x: W + 18, y: GROUND_Y - t.h, type, hp: t.hp, maxHp: t.hp, speed: cfg.speed * t.spd, h: t.h, frame: 0, ft: 0, hitFlash: 0 });

  showPuzzle();
}

function hitEnemy(idx, power) {
  const e = enemies[idx];
  e.hp -= power;
  e.hitFlash = 8;
  if (e.hp <= 0) {
    spawnBurst(e.x, e.y + e.h / 2, '#ff8800', 10);
    floatText('+' + (ETYPE[e.type].pts * Math.min(GS.combo, 5)), e.x, e.y, '#ffdd00', 12);
    enemies.splice(idx, 1);
    wave.kills++;
    wave.spawning = false;

    const cfg = lvlCfg(GS.level);
    if (wave.kills >= cfg.killsNeeded) {
      if (cfg.isBoss) spawnBoss();
      else            triggerLevelClear();
    } else {
      setTimeout(() => { if (GS.state === 'PLAYING') spawnEnemy(); }, 700);
    }
  }
}

// ── Boss ──────────────────────────────────────────────────────────
function spawnBoss() {
  boss = { active: true, hp: 6 + GS.level, maxHp: 6 + GS.level, x: W + 40, y: GROUND_Y - 62, frame: 0, ft: 0, hitFlash: 0, speed: 0.28 };
  SFX.boss();
  floatText('!! BOSS INCOMING!', 200, 160, '#ff4400', 20);
  GS.state = 'BOSS_INTRO';
  setTimeout(() => { GS.state = 'PLAYING'; showPuzzle(); }, 2200);
}

function hitBoss(power) {
  boss.hp -= power;
  boss.hitFlash = 7;
  GS.shake = 5;
  if (boss.hp <= 0) {
    boss.active = false;
    spawnBurst(boss.x, boss.y + 30, '#ff4400', 28);
    floatText('BOSS DEFEATED! +2000', 180, 150, '#ffdd00', 18);
    GS.score += 2000;
    if (GS.score > GS.hiScore) { GS.hiScore = GS.score; localStorage.setItem('mb_hi', GS.hiScore); }
    wave.spawning = false;
    setTimeout(triggerLevelClear, 1100);
  }
}

// ── Level Clear ───────────────────────────────────────────────────
function triggerLevelClear() {
  if (GS.state === 'GAME_OVER') return;
  GS.state = 'LEVEL_CLEAR';
  GS.level++;
  wave.kills = 0;
  wave.spawning = false;
  enemies = [];
  bullets = [];
  SFX.levelup();

  const banner = document.getElementById('level-banner');
  banner.textContent = `LEVEL ${GS.level}`;
  banner.style.opacity = '1';
  setTimeout(() => { banner.style.opacity = '0'; }, 1800);

  setTimeout(() => {
    if (GS.state !== 'GAME_OVER') {
      GS.state = 'PLAYING';
      spawnEnemy();
    }
  }, 2400);
}

// ── Hearts ────────────────────────────────────────────────────────
function takeDamage(label) {
  GS.hearts--;
  GS.combo = 0;
  hero.hitFlash = 18;
  GS.shake = 10;
  spawnBurst(hero.x + 16, GROUND_Y - 20, '#ff2222', 8);
  floatText(label, hero.x + 10, GROUND_Y - 65, '#ff4444', 14);
  if (GS.hearts <= 0) {
    GS.hearts = 0;
    setTimeout(doGameOver, 400);
  }
}

function doGameOver() {
  GS.state = 'GAME_OVER';
  SFX.gameover();
  hidePuzzle();
  enemies = []; boss.active = false;
  document.getElementById('go-score').textContent = `Score: ${GS.score}  |  Level: ${GS.level}`;
  document.getElementById('go-hi').textContent    = `Best: ${GS.hiScore}`;
  document.getElementById('gameover').style.display = 'flex';
  cancelAnimationFrame(rafId);

  // final draw
  requestAnimationFrame(() => {
    drawBG();
    drawHero();
    drawHUD();
  });
}

// ── Particles ─────────────────────────────────────────────────────
function spawnBurst(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    particles.push({ x, y, col, vx:(Math.random()-0.5)*7, vy:(Math.random()-0.5)*7-2, r:Math.random()*4+2, life:1, decay:0.04+Math.random()*0.04 });
  }
}
function floatText(text, x, y, col, size) {
  floats.push({ text, x, y, col, size, vy:-0.75, life:1, decay:0.018 });
}
function updateFX(dt) {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) { p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=0.18*dt; p.life-=p.decay*dt; }
  floats = floats.filter(f => f.life > 0);
  for (const f of floats)    { f.y+=f.vy*dt; f.life-=f.decay*dt; }
}

// ── Draw Background ───────────────────────────────────────────────
function drawBG() {
  // Sky
  const g = ctx.createLinearGradient(0,0,0,GROUND_Y);
  g.addColorStop(0,'#090920'); g.addColorStop(1,'#181830');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,GROUND_Y);

  // Stars
  for (let i = 0; i < 55; i++) {
    const sx = (i*131+7) % W, sy = (i*79+3) % (GROUND_Y*0.72);
    ctx.globalAlpha = 0.35 + (i%5)*0.13;
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx, sy, i%4===0?2:1, i%4===0?2:1);
  }
  ctx.globalAlpha = 1;

  // Mountains (parallax)
  const moff = -(GS.scrollX * 0.12) % W;
  ctx.fillStyle = '#0c1c0c';
  for (let p = -1; p <= 1; p++) drawMtns(moff + p*W);

  // Ground
  const goff = -(GS.scrollX * 0.35) % 64;
  ctx.fillStyle = '#0e2a0e'; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = '#1e4a1e';
  for (let tx = goff - 64; tx < W + 64; tx += 64) {
    ctx.fillRect(tx, GROUND_Y, 64, 5);
  }
  ctx.fillStyle = '#2e5a2e';
  for (let tx = (goff*0.5) % 32 - 32; tx < W + 32; tx += 32) {
    ctx.fillRect(tx, GROUND_Y+1, 3, 3);
  }
}

function drawMtns(ox) {
  const pts = [[0,55],[90,10],[200,35],[300,5],[410,28],[520,12],[630,40],[W,55]];
  ctx.beginPath(); ctx.moveTo(ox, GROUND_Y);
  for (const [x,y] of pts) ctx.lineTo(ox+x, GROUND_Y-y);
  ctx.lineTo(ox+W, GROUND_Y); ctx.closePath(); ctx.fill();
}

// ── Draw Hero ─────────────────────────────────────────────────────
function drawHero() {
  const { x, y, frame, hitFlash, gunFlash } = hero;
  ctx.save();
  if (hitFlash > 0) ctx.globalAlpha = (hitFlash % 4 < 2) ? 0.35 : 1;
  const walk = frame % 2;

  // Head
  ctx.fillStyle='#f4c87a'; ctx.fillRect(x+7,y,14,12);
  ctx.fillStyle='#3a2a1a'; ctx.fillRect(x+7,y,14,4);
  ctx.fillStyle='#222';    ctx.fillRect(x+10,y+5,3,3); ctx.fillRect(x+15,y+5,3,3);

  // Body
  ctx.fillStyle='#2255cc'; ctx.fillRect(x+4,y+12,18,13);
  ctx.fillStyle='#aa8833'; ctx.fillRect(x+4,y+21,18,3);

  // Arm & gun
  ctx.fillStyle='#f4c87a'; ctx.fillRect(x+19,y+13,6,7);
  ctx.fillStyle='#555';    ctx.fillRect(x+23,y+15,13,5);
  ctx.fillStyle='#333';    ctx.fillRect(x+34,y+16,4,3);
  if (gunFlash > 0) { ctx.fillStyle='#ffff00'; ctx.fillRect(x+37,y+13,9,9); }

  // Legs
  const lo = walk ? [2,-2] : [-2,2];
  ctx.fillStyle='#334466';
  ctx.fillRect(x+5, y+25, 8, 13+lo[0]);
  ctx.fillRect(x+13,y+25, 8, 13+lo[1]);
  ctx.fillStyle='#111';
  ctx.fillRect(x+4, y+36+lo[0], 10, 4);
  ctx.fillRect(x+12,y+36+lo[1], 10, 4);
  ctx.restore();
}

// ── Draw Enemies ──────────────────────────────────────────────────
function drawGrunt(e) {
  const {x,y,frame,hitFlash} = e;
  ctx.save();
  if (hitFlash>0) ctx.globalAlpha = hitFlash%4<2?0.3:1;
  const w = frame%2;
  ctx.fillStyle='#aa2222'; ctx.fillRect(x+5,y,14,12);
  ctx.fillStyle='#661111'; ctx.fillRect(x+5,y,14,5);
  ctx.fillStyle='#ffff33'; ctx.fillRect(x+7,y+5,4,3); ctx.fillRect(x+13,y+5,4,3);
  ctx.fillStyle='#882222'; ctx.fillRect(x+3,y+12,18,13);
  ctx.fillStyle='#444';    ctx.fillRect(x-7,y+15,12,5);
  const lo=w?[2,-2]:[-2,2];
  ctx.fillStyle='#552222';
  ctx.fillRect(x+4, y+25,8,11+lo[0]); ctx.fillRect(x+12,y+25,8,11+lo[1]);
  ctx.fillStyle='#111';
  ctx.fillRect(x+3, y+34+lo[0],10,4); ctx.fillRect(x+11,y+34+lo[1],10,4);
  ctx.restore();
}

function drawRunner(e) {
  const {x,y,frame,hitFlash} = e;
  ctx.save();
  if (hitFlash>0) ctx.globalAlpha = hitFlash%4<2?0.3:1;
  const w = frame%2;
  ctx.fillStyle='#ff5500'; ctx.fillRect(x+5,y+3,12,10);
  ctx.fillStyle='#222';    ctx.fillRect(x+5,y+3,12,3);
  ctx.fillStyle='#cc4400'; ctx.fillRect(x+3,y+13,16,11);
  ctx.fillStyle='#888';    ctx.fillRect(x-5,y+17,8,3);
  const lo=w?[3,-3]:[-3,3];
  ctx.fillStyle='#884400';
  ctx.fillRect(x+4, y+24,6,8+lo[0]); ctx.fillRect(x+10,y+24,6,8+lo[1]);
  ctx.fillStyle='#111';
  ctx.fillRect(x+3, y+30+lo[0],8,3);  ctx.fillRect(x+9, y+30+lo[1],8,3);
  ctx.restore();
}

function drawTank(e) {
  const {x,y,frame,hitFlash} = e;
  ctx.save();
  if (hitFlash>0) ctx.globalAlpha = hitFlash%4<2?0.3:1;
  const w = frame%4<2?0:1;
  ctx.fillStyle='#446644'; ctx.fillRect(x+1,y,24,17);
  ctx.fillStyle='#335533'; ctx.fillRect(x+1,y,24,6);
  ctx.fillStyle='#88aa66'; ctx.fillRect(x+6,y+7,6,6);
  ctx.fillStyle='#446644'; ctx.fillRect(x-1,y+17,28,19);
  ctx.fillStyle='#335533'; ctx.fillRect(x-1,y+24,28,3);
  ctx.fillStyle='#333';    ctx.fillRect(x-13,y+18,17,7); ctx.fillRect(x-15,y+20,4,3);
  const lo=w?[1,-1]:[-1,1];
  ctx.fillStyle='#335533';
  ctx.fillRect(x+2, y+36,11,13+lo[0]); ctx.fillRect(x+13,y+36,11,13+lo[1]);
  ctx.fillStyle='#111';
  ctx.fillRect(x+0, y+47+lo[0],13,5);  ctx.fillRect(x+11,y+47+lo[1],13,5);
  ctx.restore();
}

function drawBossSprite() {
  if (!boss.active) return;
  const {x,y,frame,hitFlash,hp,maxHp} = boss;
  const bob = Math.sin(frame * 0.08) * 4;
  ctx.save();
  if (hitFlash>0) ctx.globalAlpha = hitFlash%4<2?0.25:1;

  // Body
  ctx.fillStyle='#1e0030'; ctx.fillRect(x-26,y+bob,52,32);
  ctx.fillRect(x-21,y+32+bob,42,26);
  ctx.fillStyle='#4a006a';
  ctx.fillRect(x-26,y+bob,52,9);
  ctx.fillRect(x-23,y+16+bob,16,11); ctx.fillRect(x+7,y+16+bob,16,11);

  // Head
  ctx.fillStyle='#28003c'; ctx.fillRect(x-19,y-24+bob,38,26);
  ctx.fillStyle='#4a006a';
  ctx.fillRect(x-16,y-30+bob,7,8); ctx.fillRect(x+9,y-30+bob,7,8); ctx.fillRect(x-3,y-33+bob,7,11);

  // Eyes
  ctx.fillStyle='#ff0000';
  ctx.fillRect(x-14,y-14+bob,9,6); ctx.fillRect(x+5,y-14+bob,9,6);
  ctx.fillStyle='rgba(255,0,0,0.3)';
  ctx.fillRect(x-18,y-18+bob,16,13); ctx.fillRect(x+2,y-18+bob,16,13);

  // Arms & weapons
  ctx.fillStyle='#1e0030'; ctx.fillRect(x-40,y+5+bob,16,22); ctx.fillRect(x+24,y+5+bob,16,22);
  ctx.fillStyle='#333';    ctx.fillRect(x-52,y+16+bob,18,7); ctx.fillRect(x+34,y+16+bob,18,7);

  // HP bar
  ctx.fillStyle='#330000'; ctx.fillRect(x-32,y-44+bob,64,9);
  const pct = hp/maxHp;
  ctx.fillStyle = pct>0.5?'#ff3300':pct>0.25?'#ff8800':'#ff0000';
  ctx.fillRect(x-32,y-44+bob,64*pct,9);
  ctx.strokeStyle='#ff6600'; ctx.lineWidth=1; ctx.strokeRect(x-32,y-44+bob,64,9);

  // Boss label
  ctx.globalAlpha=1;
  ctx.fillStyle='#ff4400'; ctx.font='bold 10px monospace';
  ctx.textAlign='center'; ctx.fillText('BOSS', x, y-48+bob);

  ctx.restore();
}

function drawEnemyHPBar(e) {
  if (e.maxHp <= 1) return;
  const bw=26, bh=4, bx=e.x-bw/2, by=e.y-9;
  ctx.fillStyle='#330000'; ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle='#ff3300'; ctx.fillRect(bx,by,bw*(e.hp/e.maxHp),bh);
}

// ── Draw Bullets ──────────────────────────────────────────────────
function drawBullets() {
  for (const b of bullets) {
    for (let i=0;i<b.trail.length;i++) {
      ctx.globalAlpha = (i/b.trail.length)*0.45;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.trail[i].x, b.trail[i].y - b.size*0.25, b.size*0.7, b.size*0.5);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color; ctx.shadowBlur = b.power * 5;
    ctx.fillRect(b.x - b.size*0.5, b.y - b.size*0.25, b.size, b.size*0.55);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

// ── Draw FX ───────────────────────────────────────────────────────
function drawFX() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x-p.r/2, p.y-p.r/2, p.r, p.r);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of floats) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.col;
    ctx.font = `bold ${f.size}px monospace`;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

// ── Draw HUD ──────────────────────────────────────────────────────
function drawHUD() {
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,26);
  ctx.font='14px monospace';
  for (let i=0;i<GS.maxHearts;i++) {
    ctx.fillStyle = i < GS.hearts ? '#ff3333' : '#2a2a2a';
    ctx.fillText('\u2665', 8+i*20, 18);
  }
  ctx.fillStyle='#00ff88'; ctx.font='bold 13px monospace';
  ctx.textAlign='center'; ctx.fillText(`LEVEL ${GS.level}`, W/2, 18);
  ctx.fillStyle='#ffdd00'; ctx.font='13px monospace';
  ctx.textAlign='right'; ctx.fillText(`${GS.score}`, W-8, 18);
  ctx.fillStyle='#555'; ctx.font='10px monospace';
  ctx.fillText(`HI:${GS.hiScore}`, W-8, 10);
  if (GS.combo > 1 && GS.comboTimer > 0) {
    ctx.globalAlpha = GS.comboTimer/200;
    ctx.fillStyle='#ffdd00'; ctx.font='bold 11px monospace';
    ctx.textAlign='left'; ctx.fillText(`x${Math.min(GS.combo,5)} COMBO`, 8, H-10);
    ctx.globalAlpha=1;
  }
  ctx.textAlign='left';
}

// ── Main Loop ────────────────────────────────────────────────────
let rafId = null, lastTs = 0;

function loop(ts) {
  const dt = Math.min((ts - lastTs) / 16.667, 3.0);
  lastTs = ts;

  let sx=0, sy=0;
  if (GS.shake > 0) {
    sx=(Math.random()-0.5)*GS.shake*2; sy=(Math.random()-0.5)*GS.shake*2;
    GS.shake = Math.max(0, GS.shake - 0.6 * dt);
  }

  // ── Update ──────────────────────────────────────────────────────
  const active = GS.state === 'PLAYING' || GS.state === 'LEVEL_CLEAR' || GS.state === 'BOSS_INTRO';
  if (active) {
    GS.scrollX += 1.4 * dt;
    if (GS.comboTimer > 0) { GS.comboTimer -= dt; if (GS.comboTimer <= 0) GS.combo = 0; }

    // Hero anim
    hero.ft += dt;
    if (hero.ft > 7) { hero.frame = (hero.frame+1)%4; hero.ft=0; }
    if (hero.gunFlash > 0) hero.gunFlash -= dt;
    if (hero.hitFlash > 0) hero.hitFlash -= dt;

    // Enemy movement (only when puzzle not active)
    if (GS.state === 'PLAYING') {
      for (let i = enemies.length-1; i >= 0; i--) {
        const e = enemies[i];
        e.x -= e.speed * dt;
        e.ft += dt; if (e.ft > 9) { e.frame=(e.frame+1)%4; e.ft=0; }
        if (e.hitFlash > 0) e.hitFlash -= dt;
        const danger = e.type==='TANK' ? 98 : 92;
        if (e.x < danger) {
          enemies.splice(i,1);
          wave.spawning = false;
          takeDamage('GOT HIT!');
          if (GS.state !== 'GAME_OVER') {
            setTimeout(() => { if (GS.state==='PLAYING' && enemies.length===0 && !boss.active) {
              if (wave.kills >= lvlCfg(GS.level).killsNeeded) triggerLevelClear();
              else spawnEnemy();
            }}, 900);
          }
          break;
        }
      }
      // Puzzle creep (enemy advances slowly while puzzle shown)
    } else if (GS.state === 'PUZZLE') {
      for (const e of enemies) { e.x -= e.speed * 0.22 * dt; }
      if (boss.active) boss.x -= boss.speed * 0.15 * dt;
    }

    // Boss movement
    if (boss.active && GS.state === 'PLAYING') {
      if (boss.x > W - 85) boss.x -= boss.speed * dt;
      boss.ft += dt; if (boss.ft > 5) { boss.frame++; boss.ft=0; }
      if (boss.hitFlash > 0) boss.hitFlash -= dt;
    }

    updateBullets(dt);
    updateFX(dt);
  }

  // ── Draw ────────────────────────────────────────────────────────
  ctx.save();
  ctx.translate(sx, sy);

  drawBG();

  for (const e of enemies) {
    if (e.x < -50 || e.x > W+50) continue;
    if (e.type==='GRUNT')  drawGrunt(e);
    if (e.type==='RUNNER') drawRunner(e);
    if (e.type==='TANK')   drawTank(e);
    drawEnemyHPBar(e);
  }
  if (boss.active) drawBossSprite();
  drawHero();
  drawBullets();
  drawFX();
  drawHUD();

  ctx.restore();

  if (GS.state !== 'GAME_OVER' && GS.state !== 'MENU') {
    rafId = requestAnimationFrame(loop);
  }
}

// ── Start / Menu ─────────────────────────────────────────────────
function startGame() {
  initAudio();
  resetGame();
  initEntities();
  document.getElementById('menu').style.display      = 'none';
  document.getElementById('gameover').style.display  = 'none';
  document.getElementById('level-banner').style.opacity = '0';
  hidePuzzle();
  GS.state = 'PLAYING';
  cancelAnimationFrame(rafId);
  lastTs = performance.now();
  rafId = requestAnimationFrame(loop);
  setTimeout(spawnEnemy, 700);
}

function showMenu() {
  cancelAnimationFrame(rafId);
  hidePuzzle();
  GS.state = 'MENU';
  document.getElementById('gameover').style.display = 'none';
  document.getElementById('menu').style.display     = 'flex';
}

// ── Utility ──────────────────────────────────────────────────────
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

// ── Init menu draw ───────────────────────────────────────────────
(function menuDraw() {
  drawBG();
  drawHUD();
})();

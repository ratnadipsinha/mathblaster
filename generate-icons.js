// Run with: node generate-icons.js
// Generates icons/icon-192.png and icons/icon-512.png
const { createCanvas } = require('canvas');
const fs = require('fs');

fs.mkdirSync('game/icons', { recursive: true });

function drawIcon(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const s = size / 64; // scale factor (base design is 64x64)

  // Background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  // Green border glow
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = s * 3;
  ctx.strokeRect(s * 4, s * 4, size - s * 8, size - s * 8);

  // Hero body (blue)
  ctx.fillStyle = '#2255cc';
  ctx.fillRect(s*12, s*28, s*18, s*14);

  // Hero head
  ctx.fillStyle = '#f4c87a';
  ctx.fillRect(s*14, s*18, s*14, s*12);

  // Hero hair
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(s*14, s*18, s*14, s*4);

  // Gun
  ctx.fillStyle = '#888';
  ctx.fillRect(s*28, s*30, s*14, s*5);

  // Muzzle flash
  ctx.fillStyle = '#ffff00';
  ctx.fillRect(s*40, s*27, s*8, s*10);

  // Bullet trail
  ctx.fillStyle = '#ff4400';
  ctx.fillRect(s*48, s*31, s*10, s*4);

  // Ground
  ctx.fillStyle = '#1e4a1e';
  ctx.fillRect(0, s*48, size, s*4);

  // Title text
  ctx.fillStyle = '#00ff88';
  ctx.font = `bold ${s * 7}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('MATH', size / 2, s * 58);
  ctx.fillStyle = '#ffdd00';
  ctx.fillText('BLASTER', size / 2, s * 63);

  return c.toBuffer('image/png');
}

fs.writeFileSync('game/icons/icon-192.png', drawIcon(192));
fs.writeFileSync('game/icons/icon-512.png', drawIcon(512));
console.log('Icons generated: game/icons/icon-192.png, game/icons/icon-512.png');

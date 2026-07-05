// ============================================================
//  TOP-DOWN CAR GAME
//  A simple canvas-based driving game with obstacles, coins,
//  and enemy cars to dodge.
// ============================================================

// ---- Canvas setup ----
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// ---- UI elements ----
const scoreEl = document.getElementById('score');
const distanceEl = document.getElementById('distance');
const livesEl = document.getElementById('lives');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

// ---- Input tracking ----
// We track which keys are currently held down so movement feels smooth
// (no need to repeatedly press keys).
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// ============================================================
//  PLAYER CAR
// ============================================================
// The car uses simple top-down "arcade" physics:
//  - Accelerating moves it forward in the direction it's facing
//  - Turning only has effect while the car is moving
//  - Friction gradually slows the car when no key is pressed
const player = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  angle: -Math.PI / 2,   // facing "up" initially
  speed: 0,
  maxSpeed: 4.5,
  maxReverseSpeed: -2.2,
  acceleration: 0.15,
  brakePower: 0.25,
  friction: 0.05,
  turnSpeed: 0.045,
  width: 26,
  height: 44,
  radius: 18,            // used for simple circle-based collisions
  invincible: 0,          // frames of invincibility after being hit
};

// ============================================================
//  WORLD OBJECTS: obstacles, coins, enemy cars
// ============================================================

// Static rectangular obstacles the player must steer around
const obstacles = [
  { x: 150, y: 120, w: 100, h: 40 },
  { x: 550, y: 100, w: 60, h: 140 },
  { x: 300, y: 300, w: 140, h: 30 },
  { x: 100, y: 420, w: 80, h: 80 },
  { x: 620, y: 400, w: 100, h: 40 },
  { x: 400, y: 480, w: 40, h: 100 },
];

// Coins the player collects for points. Positioned to (mostly) avoid
// overlapping the obstacles above.
let coins = [];
function spawnCoin() {
  let coin;
  let tries = 0;
  do {
    coin = {
      x: 30 + Math.random() * (WIDTH - 60),
      y: 30 + Math.random() * (HEIGHT - 60),
      radius: 10,
    };
    tries++;
  } while (isNearObstacle(coin.x, coin.y, 40) && tries < 20);
  return coin;
}
for (let i = 0; i < 6; i++) coins.push(spawnCoin());

// Enemy cars patrol back and forth and end a life if they hit the player
const enemies = [
  { x: 200, y: 200, vx: 2, vy: 0, w: 24, h: 40, angle: 0, range: [120, 400], axis: 'x' },
  { x: 600, y: 250, vx: 0, vy: 1.8, w: 24, h: 40, angle: Math.PI / 2, range: [80, 500], axis: 'y' },
  { x: 450, y: 550, vx: -1.6, vy: 0, w: 24, h: 40, angle: Math.PI, range: [250, 700], axis: 'x' },
];

// Helper: is a point too close to any obstacle? (used for coin spawning)
function isNearObstacle(x, y, margin) {
  return obstacles.some(o =>
    x > o.x - margin && x < o.x + o.w + margin &&
    y > o.y - margin && y < o.y + o.h + margin
  );
}

// ============================================================
//  GAME STATE
// ============================================================
let score = 0;
let distance = 0;
let lives = 3;
let gameRunning = true;

// ============================================================
//  UPDATE LOGIC (runs every frame)
// ============================================================
function update() {
  if (!gameRunning) return;

  handlePlayerInput();
  movePlayer();
  handleBoundaryCollision();
  handleObstacleCollisions();
  handleCoinCollection();
  updateEnemies();
  handleEnemyCollisions();

  if (player.invincible > 0) player.invincible--;

  updateHUD();
}

// --- Player input: acceleration + steering ---
function handlePlayerInput() {
  const up = keys['arrowup'] || keys['w'];
  const down = keys['arrowdown'] || keys['s'];
  const left = keys['arrowleft'] || keys['a'];
  const right = keys['arrowright'] || keys['d'];

  if (up) {
    player.speed += player.acceleration;
  } else if (down) {
    player.speed -= player.brakePower;
  } else {
    // Apply friction to gradually slow down when no key is pressed
    if (player.speed > 0) player.speed = Math.max(0, player.speed - player.friction);
    else if (player.speed < 0) player.speed = Math.min(0, player.speed + player.friction);
  }

  // Clamp speed to min/max
  player.speed = Math.max(player.maxReverseSpeed, Math.min(player.maxSpeed, player.speed));

  // Only allow turning while the car has some speed (feels more realistic)
  const turnFactor = Math.abs(player.speed) > 0.05 ? 1 : 0;
  if (left) player.angle -= player.turnSpeed * turnFactor * (player.speed < 0 ? -1 : 1);
  if (right) player.angle += player.turnSpeed * turnFactor * (player.speed < 0 ? -1 : 1);
}

// --- Move the player based on current speed & angle ---
function movePlayer() {
  const dx = Math.cos(player.angle) * player.speed;
  const dy = Math.sin(player.angle) * player.speed;
  player.x += dx;
  player.y += dy;

  // Track total distance traveled for the score/distance display
  distance += Math.abs(player.speed);
}

// --- Keep the player within the canvas edges ---
function handleBoundaryCollision() {
  const halfW = player.width / 2;
  const halfH = player.height / 2;

  if (player.x - halfW < 0) { player.x = halfW; player.speed = 0; }
  if (player.x + halfW > WIDTH) { player.x = WIDTH - halfW; player.speed = 0; }
  if (player.y - halfH < 0) { player.y = halfH; player.speed = 0; }
  if (player.y + halfH > HEIGHT) { player.y = HEIGHT - halfH; player.speed = 0; }
}

// --- Simple circle-vs-rectangle collision against static obstacles ---
function handleObstacleCollisions() {
  for (const o of obstacles) {
    const closestX = Math.max(o.x, Math.min(player.x, o.x + o.w));
    const closestY = Math.max(o.y, Math.min(player.y, o.y + o.h));
    const dx = player.x - closestX;
    const dy = player.y - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < player.radius) {
      // Push the car back out along the collision normal and stop it
      const overlap = player.radius - dist;
      const angle = Math.atan2(dy, dx);
      player.x += Math.cos(angle) * overlap;
      player.y += Math.sin(angle) * overlap;
      player.speed *= -0.3; // small bounce-back effect
    }
  }
}

// --- Circle-vs-circle collision for coin pickups ---
function handleCoinCollection() {
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    const dx = player.x - c.x;
    const dy = player.y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < player.radius + c.radius) {
      coins.splice(i, 1);
      coins.push(spawnCoin()); // respawn a new coin elsewhere
      score += 10;
    }
  }
}

// --- Move enemy cars back and forth along their patrol axis ---
function updateEnemies() {
  for (const e of enemies) {
    if (e.axis === 'x') {
      e.x += e.vx;
      if (e.x < e.range[0] || e.x > e.range[1]) {
        e.vx *= -1;
        e.angle = e.vx > 0 ? 0 : Math.PI;
      }
    } else {
      e.y += e.vy;
      if (e.y < e.range[0] || e.y > e.range[1]) {
        e.vy *= -1;
        e.angle = e.vy > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
  }
}

// --- Check collisions between player and enemy cars ---
function handleEnemyCollisions() {
  if (player.invincible > 0) return; // brief grace period after getting hit

  for (const e of enemies) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const enemyRadius = 18;

    if (dist < player.radius + enemyRadius) {
      loseLife();
      break;
    }
  }
}

// --- Handle the player losing a life ---
function loseLife() {
  lives--;
  player.invincible = 90; // ~1.5 seconds of invincibility at 60fps
  player.speed = 0;

  // Knock the player back toward the center a bit so they aren't
  // immediately re-hit by the same enemy
  const dx = player.x - WIDTH / 2;
  const dy = player.y - HEIGHT / 2;
  const mag = Math.sqrt(dx * dx + dy * dy) || 1;
  player.x += (dx / mag) * 40;
  player.y += (dy / mag) * 40;

  if (lives <= 0) {
    endGame();
  }
}

// --- End the game and show the game over screen ---
function endGame() {
  gameRunning = false;
  finalScoreEl.textContent = `Score: ${score} | Distance: ${Math.floor(distance)}m`;
  gameOverScreen.classList.remove('hidden');
}

// --- Update the on-screen HUD text ---
function updateHUD() {
  scoreEl.textContent = `Score: ${score}`;
  distanceEl.textContent = `Distance: ${Math.floor(distance)}m`;
  livesEl.textContent = 'Lives: ' + '❤️'.repeat(Math.max(0, lives));
}

// ============================================================
//  DRAWING / RENDERING
// ============================================================
function draw() {
  // Clear and draw background (a simple grass-like arena)
  ctx.fillStyle = '#3a5a40';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawRoadMarkings();
  drawObstacles();
  drawCoins();
  drawEnemies();
  drawPlayer();
}

// Decorative dashed lines to make the arena feel less empty
function drawRoadMarkings() {
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([15, 15]);
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 0);
  ctx.lineTo(WIDTH / 2, HEIGHT);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT / 2);
  ctx.lineTo(WIDTH, HEIGHT / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawObstacles() {
  ctx.fillStyle = '#6c757d';
  ctx.strokeStyle = '#495057';
  ctx.lineWidth = 3;
  for (const o of obstacles) {
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }
}

function drawCoins() {
  for (const c of coins) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#f4d35e';
    ctx.fill();
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// Draws a small rectangular car shape with a windshield, given a color
function drawCarShape(x, y, angle, w, h, bodyColor) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2); // sprites are drawn "pointing up" by default

  // Car body
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // Windshield
  ctx.fillStyle = 'rgba(200, 230, 255, 0.8)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 6, w - 6, h / 4);

  // Wheels (small dark rectangles at corners)
  ctx.fillStyle = '#111';
  const wheelW = 4, wheelH = 10;
  ctx.fillRect(-w / 2 - 1, -h / 2 + 4, wheelW, wheelH);
  ctx.fillRect(w / 2 - wheelW + 1, -h / 2 + 4, wheelW, wheelH);
  ctx.fillRect(-w / 2 - 1, h / 2 - wheelH - 4, wheelW, wheelH);
  ctx.fillRect(w / 2 - wheelW + 1, h / 2 - wheelH - 4, wheelW, wheelH);

  ctx.restore();
}

function drawPlayer() {
  // Flicker the player car while invincible to signal the hit
  if (player.invincible > 0 && Math.floor(player.invincible / 6) % 2 === 0) {
    return;
  }
  drawCarShape(player.x, player.y, player.angle, player.width, player.height, '#e63946');
}

function drawEnemies() {
  for (const e of enemies) {
    drawCarShape(e.x, e.y, e.angle, e.w, e.h, '#457b9d');
  }
}

// ============================================================
//  MAIN GAME LOOP
// ============================================================
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// ============================================================
//  RESTART HANDLING
// ============================================================
restartBtn.addEventListener('click', () => {
  // Reset all game state back to defaults
  player.x = WIDTH / 2;
  player.y = HEIGHT / 2;
  player.angle = -Math.PI / 2;
  player.speed = 0;
  player.invincible = 0;

  score = 0;
  distance = 0;
  lives = 3;
  gameRunning = true;

  coins = [];
  for (let i = 0; i < 6; i++) coins.push(spawnCoin());

  gameOverScreen.classList.add('hidden');
});

// Kick off the game loop
gameLoop();

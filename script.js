(function () {
  'use strict';

  /* ============================================================
     ЭЛЕМЕНТЫ
     ============================================================ */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const scoreEl = document.getElementById('score');
  const coinsEl = document.getElementById('coins');
  const livesEl = document.getElementById('lives');
  const highEl = document.getElementById('highscore');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const restartBtn = document.getElementById('restart');

  const STORAGE_KEY = 'miniMarioHighScore';

  /* ============================================================
     КОНСТАНТЫ
     ============================================================ */
  const GRAVITY = 0.85;
  const MOVE_ACCEL = 0.8;
  const MAX_SPEED = 5.4;
  const FRICTION = 0.8;
  const JUMP_FORCE = -15.5;
  const MAX_FALL = 18;

  const WORLD_WIDTH = 4200;
  const GROUND_Y = 440;
  const FLAG_X = 4000;

  /* ============================================================
     УРОВЕНЬ
     ============================================================ */
  const platforms = [
    // земля
    { x: 0, y: GROUND_Y, w: 900, h: 80 },
    { x: 1000, y: GROUND_Y, w: 700, h: 80 },
    { x: 1800, y: GROUND_Y, w: 2400, h: 80 },

    // висячие платформы
    { x: 300, y: 340, w: 130, h: 24 },
    { x: 520, y: 265, w: 130, h: 24 },
    { x: 760, y: 330, w: 110, h: 24 },
    { x: 1060, y: 350, w: 150, h: 24 },
    { x: 1310, y: 275, w: 130, h: 24 },
    { x: 1520, y: 340, w: 110, h: 24 },
    { x: 1900, y: 350, w: 140, h: 24 },
    { x: 2120, y: 280, w: 130, h: 24 },
    { x: 2360, y: 335, w: 150, h: 24 },
    { x: 2620, y: 255, w: 130, h: 24 },
    { x: 2870, y: 340, w: 150, h: 24 },
    { x: 3130, y: 295, w: 130, h: 24 },
    { x: 3400, y: 350, w: 150, h: 24 }
  ];

  const coinData = [
    [330, 295], [375, 295], [420, 295],
    [555, 220], [600, 220], [645, 220],
    [790, 285], [830, 285],
    [960, 380], [1010, 380],
    [1090, 305], [1140, 305], [1190, 305],
    [1345, 230], [1390, 230],
    [1550, 295], [1595, 295],
    [1740, 380], [1790, 380],
    [1935, 305], [1980, 305],
    [2155, 235], [2200, 235],
    [2400, 290], [2445, 290], [2490, 290],
    [2655, 210], [2700, 210],
    [2905, 295], [2950, 295], [2995, 295],
    [3165, 250], [3210, 250],
    [3435, 305], [3480, 305],
    [3700, 380], [3750, 380], [3800, 380]
  ];

  const enemyData = [
    { x: 640, y: 406, min: 500, max: 880 },
    { x: 1150, y: 406, min: 1020, max: 1400 },
    { x: 1600, y: 406, min: 1450, max: 1690 },
    { x: 1100, y: 316, min: 1060, max: 1210 },
    { x: 2000, y: 406, min: 1850, max: 2200 },
    { x: 2420, y: 301, min: 2360, max: 2510 },
    { x: 2650, y: 406, min: 2500, max: 2950 },
    { x: 3100, y: 406, min: 2950, max: 3350 },
    { x: 3550, y: 406, min: 3400, max: 3850 }
  ];

  // декорации (фон)
  const clouds = [];
  for (let i = 0; i < 18; i++) {
    clouds.push({
      x: 120 + i * 260 + Math.random() * 120,
      y: 40 + Math.random() * 110,
      s: 0.75 + Math.random() * 0.7
    });
  }

  const hills = [];
  for (let i = 0; i < 14; i++) {
    hills.push({
      x: 150 + i * 340 + Math.random() * 100,
      r: 70 + Math.random() * 60
    });
  }

  /* ============================================================
     СОСТОЯНИЕ
     ============================================================ */
  let state = 'playing';   // playing | gameover | won
  let score = 0;
  let coins = 0;
  let lives = 3;
  let tick = 0;
  let camX = 0;
  let jumpBuffer = 0;
  let jumpHeld = false;

  let highScore = Number(localStorage.getItem(STORAGE_KEY) || 0);

  let player = null;
  let enemies = [];
  let coinList = [];

  const keys = {};

  /* ============================================================
     ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     ============================================================ */
  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function aabb(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  }

  function updateHud() {
    scoreEl.textContent = score;
    coinsEl.textContent = coins;
    livesEl.textContent = lives;
    highEl.textContent = highScore;
  }

  function saveHighScore() {
    if (score > highScore) {
      highScore = score;
      try {
        localStorage.setItem(STORAGE_KEY, String(highScore));
      } catch (e) {
        /* локальное хранилище недоступно — игнорируем */
      }
    }
    updateHud();
  }

  /* ============================================================
     СБРОС ИГРЫ
     ============================================================ */
  function resetGame() {
    state = 'playing';
    score = 0;
    coins = 0;
    lives = 3;
    tick = 0;
    camX = 0;
    jumpBuffer = 0;
    jumpHeld = false;

    player = {
      x: 60,
      y: 380,
      w: 30,
      h: 42,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1,
      invuln: 60
    };

    enemies = enemyData.map(function (e) {
      return {
        x: e.x,
        y: e.y,
        w: 34,
        h: 34,
        vx: -1.3,
        min: e.min,
        max: e.max,
        alive: true
      };
    });

    coinList = coinData.map(function (c) {
      return {
        x: c[0],
        y: c[1],
        r: 9,
        taken: false,
        phase: Math.random() * Math.PI * 2
      };
    });

    overlay.classList.add('hidden');
    updateHud();
  }

  /* ============================================================
     СМЕРТЬ / КОНЕЦ ИГРЫ / ПОБЕДА
     ============================================================ */
  function playerDie() {
    if (state !== 'playing') return;

    lives--;
    updateHud();

    if (lives <= 0) {
      gameOver();
      return;
    }

    player.x = 60;
    player.y = 380;
    player.vx = 0;
    player.vy = 0;
    player.invuln = 90;
    camX = 0;
  }

  function gameOver() {
    state = 'gameover';
    saveHighScore();

    overlayTitle.textContent = 'Игра окончена';
    overlayText.textContent = 'Ваш счёт: ' + score + '  ·  Рекорд: ' + highScore;
    overlay.classList.remove('hidden');
  }

  function winGame() {
    if (state !== 'playing') return;

    state = 'won';
    score += 1000;
    saveHighScore();

    overlayTitle.textContent = 'Уровень пройден!';
    overlayText.textContent = 'Бонус за финиш: +1000  ·  Итог: ' + score +
                              '  ·  Рекорд: ' + highScore;
    overlay.classList.remove('hidden');
  }

  /* ============================================================
     ОБНОВЛЕНИЕ ЛОГИКИ (фиксированный шаг 60 FPS)
     ============================================================ */
  function update() {
    tick++;

    if (state !== 'playing') return;

    /* ---------- Управление игроком ---------- */
    const left = keys['ArrowLeft'] || keys['KeyA'];
    const right = keys['ArrowRight'] || keys['KeyD'];
    jumpHeld = !!(keys['Space'] || keys['ArrowUp'] || keys['KeyW']);

    if (left && !right) {
      player.vx -= MOVE_ACCEL;
      player.facing = -1;
    } else if (right && !left) {
      player.vx += MOVE_ACCEL;
      player.facing = 1;
    } else {
      player.vx *= FRICTION;
      if (Math.abs(player.vx) < 0.1) player.vx = 0;
    }

    player.vx = clamp(player.vx, -MAX_SPEED, MAX_SPEED);

    /* ---------- Прыжок ---------- */
    if (jumpBuffer > 0) jumpBuffer--;

    if (jumpBuffer > 0 && player.onGround) {
      player.vy = JUMP_FORCE;
      player.onGround = false;
      jumpBuffer = 0;
    }

    // короткое нажатие = низкий прыжок
    if (!jumpHeld && player.vy < -6) player.vy = -6;

    /* ---------- Гравитация ---------- */
    player.vy += GRAVITY;
    if (player.vy > MAX_FALL) player.vy = MAX_FALL;

    /* ---------- Движение по X + коллизии ---------- */
    player.x += player.vx;

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (aabb(player, p)) {
        if (player.vx > 0) {
          player.x = p.x - player.w;
        } else if (player.vx < 0) {
          player.x = p.x + p.w;
        }
        player.vx = 0;
      }
    }

    if (player.x < 0) {
      player.x = 0;
      player.vx = 0;
    }

    /* ---------- Движение по Y + коллизии ---------- */
    player.y += player.vy;
    player.onGround = false;

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (aabb(player, p)) {
        if (player.vy > 0) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
        } else if (player.vy < 0) {
          player.y = p.y + p.h;
          player.vy = 0;
        }
      }
    }

    if (player.invuln > 0) player.invuln--;

    /* ---------- Падение в пропасть ---------- */
    if (player.y > 760) {
      playerDie();
      return;
    }

    /* ---------- Враги ---------- */
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;

      e.x += e.vx;

      if (e.x <= e.min) {
        e.x = e.min;
        e.vx = Math.abs(e.vx);
      } else if (e.x + e.w >= e.max) {
        e.x = e.max - e.w;
        e.vx = -Math.abs(e.vx);
      }

      if (aabb(player, e)) {
        const prevBottom = player.y + player.h - player.vy;

        if (player.vy > 0 && prevBottom <= e.y + 12) {
          // прыжок на врага
          e.alive = false;
          player.vy = -10.5;
          score += 200;
          updateHud();
        } else if (player.invuln <= 0) {
          playerDie();
          return;
        }
      }
    }

    /* ---------- Монеты ---------- */
    for (let i = 0; i < coinList.length; i++) {
      const c = coinList[i];
      if (c.taken) continue;

      const box = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
      if (aabb(player, box)) {
        c.taken = true;
        coins++;
        score += 100;
        updateHud();
      }
    }

    /* ---------- Финиш ---------- */
    if (player.x + player.w >= FLAG_X) {
      winGame();
      return;
    }

    /* ---------- Камера ---------- */
    const target = clamp(
      player.x + player.w / 2 - W / 2,
      0,
      WORLD_WIDTH - W
    );
    camX += (target - camX) * 0.15;
  }

  /* ============================================================
     ОТРИСОВКА
     ============================================================ */
  function drawBackground() {
    // небо
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#4f8ef7');
    sky.addColorStop(0.6, '#79b3ff');
    sky.addColorStop(1, '#b9dcff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // холмы (параллакс 0.5)
    ctx.fillStyle = '#57b34a';
    for (let i = 0; i < hills.length; i++) {
      const hx = hills[i].x - camX * 0.5;
      if (hx < -260 || hx > W + 260) continue;
      ctx.beginPath();
      ctx.arc(hx, GROUND_Y + 20, hills[i].r, Math.PI, 0);
      ctx.fill();
    }

    // облака (параллакс 0.3)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const cx = c.x - camX * 0.3;
      if (cx < -220 || cx > W + 220) continue;
      drawCloud(cx, c.y, c.s);
    }
  }

  function drawCloud(x, y, s) {
    const r = 22 * s;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.95, y - r * 0.4, r * 0.85, 0, Math.PI * 2);
    ctx.arc(x + r * 1.9, y, r * 0.75, 0, Math.PI * 2);
    ctx.arc(x + r * 0.95, y + r * 0.35, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlatforms() {
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];

      // отсечение невидимого
      if (p.x + p.w < camX - 60 || p.x > camX + W + 60) continue;

      // земля
      const grd = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
      grd.addColorStop(0, '#9b6434');
      grd.addColorStop(1, '#5c3a17');
      ctx.fillStyle = grd;
      ctx.fillRect(p.x, p.y, p.w, p.h);

      // текстура земли
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.13)';
      ctx.lineWidth = 2;
      for (let bx = p.x + 30; bx < p.x + p.w; bx += 45) {
        ctx.beginPath();
        ctx.moveTo(bx, p.y + 14);
        ctx.lineTo(bx, p.y + p.h);
        ctx.stroke();
      }

      // трава
      ctx.fillStyle = '#3ea832';
      ctx.fillRect(p.x, p.y, p.w, 11);
      ctx.fillStyle = '#5fd14d';
      ctx.fillRect(p.x, p.y, p.w, 5);
    }
  }

  function drawCoins() {
    for (let i = 0; i < coinList.length; i++) {
      const c = coinList[i];
      if (c.taken) continue;
      if (c.x + 30 < camX || c.x - 30 > camX + W) continue;

      const bob = Math.sin(c.phase + tick * 0.08) * 3;
      const squash = Math.abs(Math.cos(tick * 0.06 + c.phase));
      const sx = Math.max(0.25, squash);

      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.scale(sx, 1);

      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd93b';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#c99400';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-2.5, -2.5, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();

      ctx.restore();
    }
  }

  function drawEnemies() {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      if (e.x + e.w < camX - 60 || e.x > camX + W + 60) continue;

      const x = e.x;
      const y = e.y;
      const w = e.w;
      const h = e.h;
      const cx = x + w / 2;
      const cy = y + h * 0.5;

      // панцирь / шляпка
      ctx.beginPath();
      ctx.arc(cx, cy, w / 2, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = '#a0522d';
      ctx.fill();

      // нижняя часть
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(x, cy, w, h * 0.5);

      // лапки
      ctx.fillStyle = '#4a2408';
      ctx.fillRect(x + 2, y + h - 6, 11, 6);
      ctx.fillRect(x + w - 13, y + h - 6, 11, 6);

      // глаза
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 7, y + h * 0.38, 7, 9);
      ctx.fillRect(x + w - 14, y + h * 0.38, 7, 9);

      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(x + 9, y + h * 0.42, 4, 5);
      ctx.fillRect(x + w - 12, y + h * 0.42, 4, 5);

      // брови
      ctx.fillStyle = '#4a2408';
      ctx.fillRect(x + 6, y + h * 0.32, 9, 3);
      ctx.fillRect(x + w - 15, y + h * 0.32, 9, 3);
    }
  }

  function drawFlag() {
    if (FLAG_X < camX - 120 || FLAG_X > camX + W + 120) return;

    // шест
    ctx.fillStyle = '#b9b9b9';
    ctx.fillRect(FLAG_X, 180, 6, 260);
    ctx.fillStyle = '#eaeaea';
    ctx.fillRect(FLAG_X, 180, 2, 260);

    // флаг
    ctx.fillStyle = '#2ecc40';
    ctx.beginPath();
    ctx.moveTo(FLAG_X + 6, 195);
    ctx.lineTo(FLAG_X + 78, 220);
    ctx.lineTo(FLAG_X + 6, 245);
    ctx.closePath();
    ctx.fill();

    // наконечник
    ctx.beginPath();
    ctx.arc(FLAG_X + 3, 176, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd93b';
    ctx.fill();
  }

  function drawPlayer() {
    const p = player;
    if (!p) return;

    // мигание после смерти
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) return;

    const w = p.w;
    const h = p.h;

    ctx.save();
    ctx.translate(p.x + w / 2, p.y);
    ctx.scale(p.facing, 1);
    ctx.translate(-w / 2, 0);

    // ботинки
    ctx.fillStyle = '#5a2d0c';
    ctx.fillRect(1, h - 8, 12, 8);
    ctx.fillRect(w - 13, h - 8, 12, 8);

    // комбинезон
    ctx.fillStyle = '#1b4fd8';
    ctx.fillRect(3, h - 20, w - 6, 13);

    // рубашка
    ctx.fillStyle = '#e52521';
    ctx.fillRect(3, h - 28, w - 6, 10);

    // руки
    ctx.fillRect(0, h - 27, 4, 10);
    ctx.fillRect(w - 4, h - 27, 4, 10);

    // лицо
    ctx.fillStyle = '#ffcb9a';
    ctx.fillRect(6, h - 38, w - 12, 11);

    // кепка
    ctx.fillStyle = '#e52521';
    ctx.fillRect(5, h - 43, w - 10, 5);
    ctx.fillRect(w - 12, h - 39, 12, 3);

    // глаз
    ctx.fillStyle = '#222222';
    ctx.fillRect(w - 13, h - 36, 3, 4);

    // усы
    ctx.fillStyle = '#4a2a10';
    ctx.fillRect(w - 17, h - 32, 10, 3);

    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    drawBackground();

    ctx.save();
    ctx.translate(-Math.round(camX), 0);

    drawPlatforms();
    drawCoins();
    drawEnemies();
    drawFlag();
    drawPlayer();

    ctx.restore();
  }

  /* ============================================================
     ВВОД
     ============================================================ */
  window.addEventListener('keydown', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].indexOf(e.code) !== -1) {
      e.preventDefault();
    }

    // перезапуск
    if (e.code === 'KeyR') {
      resetGame();
      return;
    }

    // рестарт из оверлея
    if ((e.code === 'Space' || e.code === 'Enter') &&
        (state === 'gameover' || state === 'won')) {
      resetGame();
      return;
    }

    keys[e.code] = true;

    if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') && !e.repeat) {
      jumpBuffer = 8;
    }
  });

  window.addEventListener('keyup', function (e) {
    keys[e.code] = false;
  });

  restartBtn.addEventListener('click', function () {
    resetGame();
  });

  /* ============================================================
     ГЛАВНЫЙ ЦИКЛ
     ============================================================ */
  const STEP = 1000 / 60;
  let lastTime = 0;
  let accumulator = 0;

  function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;

    let delta = timestamp - lastTime;
    lastTime = timestamp;

    if (delta > 200) delta = 200;

    accumulator += delta;

    let guard = 0;
    while (accumulator >= STEP && guard < 5) {
      update();
      accumulator -= STEP;
      guard++;
    }

    if (guard >= 5) accumulator = 0;

    render();
    requestAnimationFrame(loop);
  }

  /* ============================================================
     СТАРТ
     ============================================================ */
  resetGame();
  requestAnimationFrame(loop);
})();
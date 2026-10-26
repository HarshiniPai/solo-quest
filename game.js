const COLS = 17;
const ROWS = 13;
const WIN_FLOOR = 8;

const GLYPH = {
  wall: "#",
  floor: ".",
  player: "@",
  stairs: ">",
  potion: "!",
  blade: "/",
  gold: "$",
  slime: "s",
  goblin: "g",
  wraith: "w",
};

function rand(n) {
  return Math.floor(Math.random() * n);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function dist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

class Game {
  constructor() {
    this.boardEl = document.getElementById("board");
    this.statsEl = document.getElementById("stats");
    this.logEl = document.getElementById("log");
    this.overlay = document.getElementById("overlay");
    this.modalTitle = document.getElementById("modal-title");
    this.modalBody = document.getElementById("modal-body");
    this.modalBtn = document.getElementById("modal-btn");
    this.best = Number(localStorage.getItem("soloQuestBest") || 0);
    this.running = false;

    this.boardEl.style.gridTemplateColumns = `repeat(${COLS}, 32px)`;
    this.modalBtn.addEventListener("click", () => this.start());
    window.addEventListener("keydown", (e) => this.onKey(e));
  }

  start() {
    this.floor = 1;
    this.score = 0;
    this.player = { x: 1, y: 1, hp: 24, maxHp: 24, atk: 4, gold: 0 };
    this.messages = [];
    this.overlay.classList.add("hidden");
    this.overlay.setAttribute("hidden", "");
    this.running = true;
    this.buildFloor();
    this.log("The gate seals behind you. You are alone.");
    this.render();
  }

  buildFloor() {
    this.map = Array.from({ length: ROWS }, () => Array(COLS).fill("wall"));
    this.seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    this.carve();
    this.enemies = [];
    this.items = [];
    this.placeStairs();
    this.placePlayer();
    this.spawnItems();
    this.spawnEnemies();
  }

  carve() {
    let x = Math.floor(COLS / 2);
    let y = Math.floor(ROWS / 2);
    const steps = COLS * ROWS * 8;
    for (let i = 0; i < steps; i++) {
      this.map[y][x] = "floor";
      const dir = rand(4);
      if (dir === 0) x += 1;
      if (dir === 1) x -= 1;
      if (dir === 2) y += 1;
      if (dir === 3) y -= 1;
      x = clamp(x, 1, COLS - 2);
      y = clamp(y, 1, ROWS - 2);
    }
    for (let n = 0; n < 14; n++) {
      const w = 3 + rand(5);
      const h = 3 + rand(4);
      const ox = 1 + rand(COLS - w - 2);
      const oy = 1 + rand(ROWS - h - 2);
      for (let yy = oy; yy < oy + h; yy++) {
        for (let xx = ox; xx < ox + w; xx++) this.map[yy][xx] = "floor";
      }
    }
  }

  floors() {
    const tiles = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.map[y][x] === "floor") tiles.push({ x, y });
      }
    }
    return tiles;
  }

  emptyTiles() {
    return this.floors().filter(
      (t) =>
        !(t.x === this.player.x && t.y === this.player.y) &&
        !(this.stairs && t.x === this.stairs.x && t.y === this.stairs.y) &&
        !this.enemies.some((e) => e.x === t.x && e.y === t.y) &&
        !this.items.some((i) => i.x === t.x && i.y === t.y)
    );
  }

  placeStairs() {
    const tiles = this.floors();
    this.stairs = tiles[rand(tiles.length)];
  }

  placePlayer() {
    const tiles = this.floors().filter((t) => dist(t, this.stairs) > 6);
    const pick = tiles.length ? tiles[rand(tiles.length)] : this.floors()[0];
    this.player.x = pick.x;
    this.player.y = pick.y;
  }

  spawnItems() {
    this.items = [];
    const count = 3 + rand(3);
    for (let i = 0; i < count; i++) {
      const spots = this.emptyTiles();
      if (!spots.length) break;
      const t = spots[rand(spots.length)];
      const roll = Math.random();
      let kind = "gold";
      if (roll < 0.4) kind = "potion";
      else if (roll < 0.55) kind = "blade";
      this.items.push({ ...t, kind });
    }
  }

  spawnEnemies() {
    this.enemies = [];
    const n = 3 + this.floor + rand(2);
    for (let i = 0; i < n; i++) {
      const spots = this.emptyTiles().filter((t) => dist(t, this.player) > 4);
      if (!spots.length) break;
      const t = spots[rand(spots.length)];
      const kind = this.enemyKind();
      this.enemies.push({ ...t, ...kind, hp: kind.maxHp });
    }
  }

  enemyKind() {
    if (this.floor >= 6 && Math.random() < 0.35) {
      return { kind: "wraith", maxHp: 10 + this.floor, atk: 4 + Math.floor(this.floor / 2) };
    }
    if (this.floor >= 3 && Math.random() < 0.5) {
      return { kind: "goblin", maxHp: 8 + this.floor, atk: 3 + Math.floor(this.floor / 3) };
    }
    return { kind: "slime", maxHp: 5 + this.floor, atk: 2 };
  }

  onKey(e) {
    if (!this.running) {
      if (e.key === "Enter" || e.key === " ") this.start();
      return;
    }
    const keys = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      w: [0, -1],
      a: [-1, 0],
      s: [0, 1],
      d: [1, 0],
      W: [0, -1],
      A: [-1, 0],
      S: [0, 1],
      D: [1, 0],
    };
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      this.tick(0, 0);
      return;
    }
    const d = keys[e.key];
    if (!d) return;
    e.preventDefault();
    this.tick(d[0], d[1]);
  }

  tick(dx, dy) {
    if (!this.running) return;
    if (dx || dy) this.tryMove(dx, dy);
    else this.log("You wait. The dark listens.");
    if (!this.running) return;
    this.enemyTurn();
    this.render();
  }

  tryMove(dx, dy) {
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
    if (this.map[ny][nx] === "wall") {
      this.log("Stone. No further.");
      return;
    }
    const foe = this.enemies.find((e) => e.x === nx && e.y === ny);
    if (foe) {
      this.fight(foe);
      return;
    }
    this.player.x = nx;
    this.player.y = ny;
    this.pickup();
    if (this.stairs.x === nx && this.stairs.y === ny) this.descend();
  }

  fight(foe) {
    const dmg = this.player.atk + rand(3);
    foe.hp -= dmg;
    this.log(`You strike the ${foe.kind} for ${dmg}.`);
    if (foe.hp <= 0) {
      this.enemies = this.enemies.filter((e) => e !== foe);
      const loot = 4 + this.floor * 2 + rand(6);
      this.player.gold += loot;
      this.score += 10 + this.floor * 3;
      this.log(`The ${foe.kind} falls. +${loot} gold.`);
    }
  }

  pickup() {
    const item = this.items.find((i) => i.x === this.player.x && i.y === this.player.y);
    if (!item) return;
    this.items = this.items.filter((i) => i !== item);
    if (item.kind === "potion") {
      const heal = 6 + rand(5);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.log(`A bitter draught. +${heal} HP.`);
    } else if (item.kind === "blade") {
      this.player.atk += 1;
      this.log("The edge sings. Attack +1.");
    } else {
      const g = 8 + rand(12);
      this.player.gold += g;
      this.score += g;
      this.log(`Coins in the dust. +${g} gold.`);
    }
  }

  descend() {
    if (this.floor >= WIN_FLOOR) {
      this.win();
      return;
    }
    this.floor += 1;
    this.score += 25;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 4);
    this.log(`Stairs groan. Floor ${this.floor}. A little warmth returns.`);
    this.buildFloor();
  }

  enemyTurn() {
    for (const e of [...this.enemies]) {
      if (e.hp <= 0) continue;
      if (dist(e, this.player) === 1) {
        const dmg = Math.max(1, e.atk - rand(2));
        this.player.hp -= dmg;
        this.log(`The ${e.kind} hits you for ${dmg}.`);
        if (this.player.hp <= 0) {
          this.player.hp = 0;
          this.lose();
          return;
        }
        continue;
      }
      if (dist(e, this.player) > 8) continue;
      const step = this.stepToward(e, this.player);
      const blocked =
        this.map[step.y][step.x] === "wall" ||
        this.enemies.some((o) => o !== e && o.x === step.x && o.y === step.y) ||
        (step.x === this.player.x && step.y === this.player.y);
      if (!blocked) {
        e.x = step.x;
        e.y = step.y;
      }
    }
  }

  stepToward(from, to) {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
      if (this.map[from.y][from.x + dx] !== "wall") return { x: from.x + dx, y: from.y };
      if (dy && this.map[from.y + dy][from.x] !== "wall") return { x: from.x, y: from.y + dy };
    } else {
      if (this.map[from.y + dy][from.x] !== "wall") return { x: from.x, y: from.y + dy };
      if (dx && this.map[from.y][from.x + dx] !== "wall") return { x: from.x + dx, y: from.y };
    }
    return { x: from.x, y: from.y };
  }

  visible(x, y) {
    return Math.abs(x - this.player.x) <= 4 && Math.abs(y - this.player.y) <= 4;
  }

  log(msg) {
    this.messages.unshift(msg);
    this.messages = this.messages.slice(0, 12);
  }

  glyphAt(x, y) {
    if (this.player.x === x && this.player.y === y) return { cls: "player", g: GLYPH.player };
    const vis = this.visible(x, y);
    if (vis) {
      const e = this.enemies.find((en) => en.x === x && en.y === y);
      if (e) return { cls: "enemy", g: GLYPH[e.kind] };
      const item = this.items.find((i) => i.x === x && i.y === y);
      if (item) return { cls: "item", g: GLYPH[item.kind] };
      if (this.stairs.x === x && this.stairs.y === y) return { cls: "stairs", g: GLYPH.stairs };
    }
    return { cls: this.map[y][x], g: GLYPH[this.map[y][x]] };
  }

  render() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.visible(x, y)) this.seen[y][x] = true;
      }
    }

    this.boardEl.innerHTML = "";
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = document.createElement("div");
        const { cls, g } = this.glyphAt(x, y);
        const vis = this.visible(x, y);
        cell.className = `cell ${cls}`;
        if (vis) cell.classList.add("visible");
        if (this.seen[y][x]) cell.classList.add("seen");
        cell.textContent = this.seen[y][x] || vis ? g : "";
        this.boardEl.appendChild(cell);
      }
    }

    this.statsEl.innerHTML = [
      ["HP", `${this.player.hp}/${this.player.maxHp}`],
      ["ATK", this.player.atk],
      ["Gold", this.player.gold],
      ["Floor", `${this.floor}/${WIN_FLOOR}`],
      ["Score", this.score],
      ["Best", this.best],
    ]
      .map(
        ([k, v]) => `<div class="stat"><span>${k}</span><strong>${v}</strong></div>`
      )
      .join("");

    this.logEl.innerHTML = this.messages.map((m) => `<li>${m}</li>`).join("");
  }

  saveBest() {
    const total = this.score + this.player.gold;
    if (total > this.best) {
      this.best = total;
      localStorage.setItem("soloQuestBest", String(this.best));
    }
  }

  lose() {
    this.running = false;
    this.saveBest();
    this.render();
    this.showModal(
      "You fall",
      `The dungeon keeps your name. Score ${this.score + this.player.gold}. Best ${this.best}.`,
      "Rise again"
    );
  }

  win() {
    this.running = false;
    this.score += 200 + this.player.gold;
    this.saveBest();
    this.render();
    this.showModal(
      "The relic is yours",
      `Eight floors, one seeker. Final score ${this.score}. Best ${this.best}.`,
      "Seek it once more"
    );
  }

  showModal(title, body, btn) {
    this.modalTitle.textContent = title;
    this.modalBody.textContent = body;
    this.modalBtn.textContent = btn;
    this.overlay.classList.remove("hidden");
    this.overlay.removeAttribute("hidden");
  }
}

new Game();

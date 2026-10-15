'use strict';
/* =========================================================
   IDLE CORE — click, automate, and trade energy for tickets.
   Progress is saved and keeps generating while you're away (up to 8 hours).
========================================================= */
(() => {
  const A = Arcade;
  const UPGRADES = [
    { id: 'cursor', name: 'Auto Cursor', desc: '+1 energy/sec', baseCost: 15, rate: 1 },
    { id: 'drone', name: 'Mining Drone', desc: '+5 energy/sec', baseCost: 80, rate: 5 },
    { id: 'reactor', name: 'Micro Reactor', desc: '+20 energy/sec', baseCost: 400, rate: 20 },
    { id: 'satellite', name: 'Orbital Satellite', desc: '+90 energy/sec', baseCost: 1800, rate: 90 },
    { id: 'aicore', name: 'AI Core', desc: '+400 energy/sec', baseCost: 9000, rate: 400 }
  ];
  const ENERGY_PER_TICKET = 1000;
  const OFFLINE_CAP = 8 * 3600; // seconds

  // persistent state lives in the save file
  const s = A.data.games.clicker = Object.assign(
    { points: 0, total: 0, owned: {}, lastSeen: Date.now() },
    A.data.games.clicker || {}
  );
  UPGRADES.forEach(u => { s.owned[u.id] = s.owned[u.id] || 0; });
  const rate = () => UPGRADES.reduce((sum, u) => sum + u.rate * s.owned[u.id], 0);
  const cost = u => Math.floor(u.baseCost * Math.pow(1.15, s.owned[u.id]));
  const buttons = {};
  let e;

  A.achievements([
    { id: 'clicker_100', game: 'clicker', icon: '⬡', name: 'Spark', desc: 'Earn 100 energy.' },
    { id: 'clicker_1000', game: 'clicker', icon: '☄️', name: 'Reactor Online', desc: 'Earn 1,000 energy.' },
    { id: 'clicker_upgrade', game: 'clicker', icon: '🛠️', name: 'Automated', desc: 'Buy your first upgrade.' },
    { id: 'clicker_trade', game: 'clicker', icon: '💱', name: 'Cash Out', desc: 'Trade energy for tickets.' },
    { id: 'clicker_100k', game: 'clicker', icon: '🌐', name: 'Power Grid', desc: 'Earn 100,000 energy in total.' }
  ]);

  function earn(n){
    s.points += n;
    s.total += n;
    if (s.total >= 100) A.unlock('clicker_100');
    if (s.total >= 1000) A.unlock('clicker_1000');
    if (s.total >= 100000) A.unlock('clicker_100k');
  }

  function update(){
    if (!e) return;
    e.points.textContent = A.fmt(s.points);
    e.rate.textContent = A.fmt(rate());
    UPGRADES.forEach(u => {
      const b = buttons[u.id];
      const c = cost(u);
      b.disabled = s.points < c;
      b.querySelector('.shop-item-count').textContent = 'x' + s.owned[u.id];
      b.querySelector('.shop-item-cost').textContent = A.fmt(c) + ' ⬡';
    });
    const canTrade = Math.floor(s.points / ENERGY_PER_TICKET);
    e.trade1.disabled = canTrade < 1;
    e.tradeAll.disabled = canTrade < 1;
    e.tradeAll.textContent = canTrade >= 1 ? `Trade all for ${A.fmt(canTrade)} 🎟` : 'Trade all';
  }

  function buy(u){
    const c = cost(u);
    if (s.points < c) { A.sfx('error'); return; }
    s.points -= c;
    s.owned[u.id]++;
    A.sfx('power');
    A.fx.burstAt(buttons[u.id], { count: 10, colors: [A.COLORS.green, A.COLORS.lime] });
    A.unlock('clicker_upgrade');
    A.save();
    update();
  }

  function trade(all){
    const n = all ? Math.floor(s.points / ENERGY_PER_TICKET) : 1;
    if (n < 1 || s.points < n * ENERGY_PER_TICKET) return;
    s.points -= n * ENERGY_PER_TICKET;
    A.payout(n);
    A.unlock('clicker_trade');
    A.save();
    update();
  }

  /* Real elapsed time, so background-tab throttling doesn't slow production */
  let lastTick = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min((now - lastTick) / 1000, 3600);
    lastTick = now;
    const r = rate();
    if (r > 0) earn(r * dt);
    s.lastSeen = Date.now();
    if (A.current === 'clicker') update();
  }, 100);
  setInterval(() => A.save(), 5000);

  /* Offline earnings, shown once when the arcade opens */
  A.on('boot', () => {
    const away = Math.min((Date.now() - (s.lastSeen || Date.now())) / 1000, OFFLINE_CAP);
    const r = rate();
    if (away > 60 && r > 0) {
      const gained = r * away;
      earn(gained);
      A.toast(`⬡ Idle Core made ${A.fmt(gained)} energy while you were away`);
    }
    s.lastSeen = Date.now();
    A.save();
  });

  A.registerGame({
    id: 'clicker', name: 'IDLE CORE', title: 'Idle Core', marquee: 'IDLE CORE',
    label: 'Click & Automate', color: 'green', hasDifficulty: false, wide: true,
    blurb: 'Keeps running while you play other games.',
    mini: `<div class="mini-core">⬡</div>`,
    build(body){
      body.innerHTML = `
        <div class="clicker-layout">
          <div class="screen clicker-main" data-el="main">
            <div class="core-count"><span data-el="points">0</span> <small>energy</small></div>
            <div class="core-rate">+<span data-el="rate">0</span>/sec</div>
            <button class="core-btn" data-el="core" aria-label="Generate 1 energy">
              <span class="core-glyph">⬡</span><span class="core-hint">TAP</span>
            </button>
            <div class="trade">
              <p class="trade-rate">${A.fmt(ENERGY_PER_TICKET)} ⬡ = 1 🎟</p>
              <div class="trade-btns">
                <button class="chip-btn" data-el="trade1">Trade 1</button>
                <button class="chip-btn" data-el="tradeAll">Trade all</button>
              </div>
            </div>
          </div>
          <div class="clicker-shop">
            <h3>Upgrades</h3>
            <div class="shop-list" data-el="shop"></div>
          </div>
        </div>`;
      e = A.els(body);
      UPGRADES.forEach(u => {
        const b = document.createElement('button');
        b.className = 'shop-item';
        b.innerHTML = `
          <span><span class="shop-item-name">${u.name}<span class="shop-item-count"></span></span><br>
          <span class="shop-item-desc">${u.desc}</span></span>
          <span class="shop-item-cost"></span>`;
        b.addEventListener('click', () => buy(u));
        buttons[u.id] = b;
        e.shop.appendChild(b);
      });
      e.core.addEventListener('click', ev => {
        earn(1);
        update();
        A.sfx('key');
        const r = e.main.getBoundingClientRect();
        const x = ev.clientX || r.left + r.width / 2;
        const y = ev.clientY || r.top + r.height / 2;
        A.fx.floatText(e.main, '+1', x - r.left - 10, y - r.top - 24, A.COLORS.green);
      });
      e.trade1.addEventListener('click', () => trade(false));
      e.tradeAll.addEventListener('click', () => trade(true));
      update();
    },
    start: update
  });
})();

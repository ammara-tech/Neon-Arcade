'use strict';
/* =========================================================
   NEON ARCADE — UI
   HUD, the arcade floor (cabinet carousel), daily banner,
   trophy case, high-score tables, settings, prize counter
   and boot. Loaded after every game file.
========================================================= */
(() => {
  const A = Arcade;
  const { $, data } = A;

  /* =======================================================
     PRIZE COUNTER CATALOGUE
  ======================================================= */
  const PRIZE_CATS = [
    { id: 'carpet', name: 'Carpets', blurb: 'The floor of the whole arcade.' },
    { id: 'trim', name: 'Cabinet trim', blurb: 'The edging on every cabinet.' },
    { id: 'lights', name: 'Marquee lights', blurb: 'How the selected cabinet lights up.' },
    { id: 'title', name: 'Titles', blurb: 'Shown under your rank in the top bar.' }
  ];
  const PRIZES = [
    { id: 'carpet-classic', cat: 'carpet', name: 'Black-light Classic', desc: 'Squiggles and shapes that glow under UV.', price: 0 },
    { id: 'carpet-galaxy', cat: 'carpet', name: 'Galaxy', desc: 'Stars and ringed planets underfoot.', price: 150 },
    { id: 'carpet-checker', cat: 'carpet', name: 'Checker Floor', desc: 'Classic diner tiles.', price: 200 },
    { id: 'carpet-grid', cat: 'carpet', name: 'Synthwave Grid', desc: 'Pink grid lines to the horizon.', price: 300 },
    { id: 'trim-standard', cat: 'trim', name: 'Factory Trim', desc: 'Matches each cabinet colour.', price: 0 },
    { id: 'trim-chrome', cat: 'trim', name: 'Chrome Trim', desc: 'Polished silver edging.', price: 120 },
    { id: 'trim-gold', cat: 'trim', name: 'Gold Trim', desc: 'For high rollers only.', price: 350 },
    { id: 'lights-chaser', cat: 'lights', name: 'Chaser Bulbs', desc: 'Bulbs blink around the selected marquee.', price: 220 },
    { id: 'lights-rainbow', cat: 'lights', name: 'Rainbow Neon', desc: 'The marquee glow cycles through colours.', price: 400 },
    { id: 'title-masher', cat: 'title', name: 'Button Masher', desc: 'Everyone starts somewhere.', price: 60 },
    { id: 'title-shark', cat: 'title', name: 'Ticket Shark', desc: 'Always at the prize counter.', price: 180 },
    { id: 'title-wizard', cat: 'title', name: 'Pixel Wizard', desc: 'Sees the game in 8 bits.', price: 350 },
    { id: 'title-legend', cat: 'title', name: 'Living Legend', desc: 'Name on every high-score table.', price: 600 }
  ];
  const prizeById = Object.fromEntries(PRIZES.map(p => [p.id, p]));
  const OPTIONAL_CATS = ['lights', 'title']; // these can be switched off

  function applyCosmetics(){
    const b = document.body;
    [...b.classList].filter(c => /^(carpet|trim|lights)-/.test(c)).forEach(c => b.classList.remove(c));
    ['carpet', 'trim', 'lights'].forEach(cat => { if (data.equipped[cat]) b.classList.add(data.equipped[cat]); });
    renderHud();
  }

  function renderPrizes(){
    $('prizeTickets').textContent = A.fmt(data.tickets);
    const host = $('prizeList');
    host.innerHTML = '';
    PRIZE_CATS.forEach(cat => {
      const sec = document.createElement('section');
      sec.className = 'prize-cat';
      sec.innerHTML = `<h3>${cat.name}</h3><p class="muted">${cat.blurb}</p><div class="prize-grid"></div>`;
      const grid = sec.querySelector('.prize-grid');
      PRIZES.filter(p => p.cat === cat.id).forEach(p => {
        const owned = data.owned.includes(p.id);
        const equipped = data.equipped[p.cat] === p.id;
        const affordable = data.tickets >= p.price;
        let label, cls = '', disabled = false;
        if (equipped) { label = OPTIONAL_CATS.includes(p.cat) ? 'Equipped · tap to remove' : 'Equipped'; cls = 'is-equipped'; disabled = !OPTIONAL_CATS.includes(p.cat); }
        else if (owned) { label = 'Equip'; cls = 'is-owned'; }
        else { label = `${A.fmt(p.price)} 🎟`; disabled = !affordable; cls = affordable ? 'is-buy' : 'is-locked'; }
        const card = document.createElement('div');
        card.className = 'prize-card ' + cls;
        card.innerHTML = `
          <div class="prize-swatch swatch-${p.cat}" data-prize="${p.id}">${p.cat === 'title' ? `<span>${p.name}</span>` : ''}</div>
          <div class="prize-info"><b>${p.name}</b><span>${p.desc}</span></div>
          <button class="prize-btn" ${disabled ? 'disabled' : ''}>${label}</button>`;
        card.querySelector('.prize-btn').addEventListener('click', () => prizeAction(p));
        grid.appendChild(card);
      });
      host.appendChild(sec);
    });
  }

  function prizeAction(p){
    const owned = data.owned.includes(p.id);
    if (data.equipped[p.cat] === p.id) {
      if (OPTIONAL_CATS.includes(p.cat)) { data.equipped[p.cat] = null; A.sfx('click'); }
    } else if (owned) {
      data.equipped[p.cat] = p.id;
      A.sfx('click');
    } else {
      if (!A.spend(p.price)) { A.sfx('error'); return; }
      data.owned.push(p.id);
      data.equipped[p.cat] = p.id;
      A.sfx('win');
      A.toast(`🎁 Bought ${p.name}`);
      A.unlock('prize_first');
      A.fx.burstAt($('prizeTickets'), { count: 30 });
    }
    A.save();
    applyCosmetics();
    renderPrizes();
  }

  /* =======================================================
     HUD
  ======================================================= */
  function renderHud(){
    $('hudScore').textContent = A.fmt(data.score);
    $('hudTickets').textContent = A.fmt(data.tickets);
    $('hudRank').textContent = A.rankName();
    const title = data.equipped.title && prizeById[data.equipped.title];
    $('hudTitle').textContent = title ? title.name : '';
    $('hudTitle').hidden = !title;
    $('achCount').textContent = data.unlocked.filter(id => A.ACH.some(a => a.id === id)).length;
    $('achTotal').textContent = A.ACH.length;
    $('soundBtn').textContent = data.sound ? '🔊' : '🔇';
    $('soundBtn').setAttribute('aria-label', data.sound ? 'Mute sound' : 'Turn sound on');
    $('soundBtn').setAttribute('aria-pressed', String(!data.sound));
    if (!$('prizeModal').hidden) $('prizeTickets').textContent = A.fmt(data.tickets);
  }
  A.on('hud', renderHud);
  A.on('tickets', () => A.fx.bump($('hudTickets').parentElement));

  $('soundBtn').addEventListener('click', () => A.setSound(!data.sound));
  $('prizeBtn').addEventListener('click', () => { renderPrizes(); A.openModal('prizeModal'); });
  $('achBtn').addEventListener('click', () => openTrophies('trophies'));
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => A.closeModal()));
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', e => { if (e.target === bd && bd.id !== 'initialsModal') A.closeModal(); });
  });

  /* =======================================================
     TROPHY CASE  (tabs: trophies · hi-scores · settings)
  ======================================================= */
  let highlightGame = null;
  function openTrophies(tab, gameId){
    highlightGame = gameId || null;
    renderTrophies();
    renderHiscores();
    selectTab(tab);
    A.openModal('achModal');
    if (gameId) {
      const card = document.querySelector(`.hs-card[data-game="${gameId}"]`);
      if (card) setTimeout(() => card.scrollIntoView({ block: 'nearest' }), 50);
    }
  }
  function selectTab(tab){
    document.querySelectorAll('.tab').forEach(t => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.dataset.panel !== tab; });
    A.emit('tab', tab);
  }
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab)));

  function renderTrophies(){
    const host = $('achGrid');
    host.innerHTML = '';
    const groups = [{ id: 'arcade', name: 'Arcade' }, ...A.games.map(g => ({ id: g.id, name: g.title.replace(/·/g, ' ') }))];
    groups.forEach(gr => {
      const list = A.ACH.filter(a => (a.game || 'arcade') === gr.id);
      if (!list.length) return;
      const got = list.filter(a => data.unlocked.includes(a.id)).length;
      const sec = document.createElement('section');
      sec.className = 'ach-group';
      sec.innerHTML = `<h3>${gr.name} <span class="muted">${got}/${list.length}</span></h3><div class="ach-grid"></div>`;
      const grid = sec.querySelector('.ach-grid');
      list.forEach(a => {
        const on = data.unlocked.includes(a.id);
        const card = document.createElement('div');
        card.className = 'ach-card' + (on ? ' unlocked' : '');
        card.innerHTML = `<div class="ach-icon">${a.icon}</div><div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
        grid.appendChild(card);
      });
      host.appendChild(sec);
    });
  }
  A.on('trophies', () => { if (!$('achModal').hidden) renderTrophies(); });

  function renderHiscores(){
    const host = $('hsGrid');
    host.innerHTML = '';
    A.games.filter(g => g.hiscore).forEach(g => {
      const t = A.hiTable(g.id);
      const card = document.createElement('div');
      card.className = 'hs-card' + (highlightGame === g.id ? ' highlight' : '');
      card.dataset.game = g.id;
      card.style.setProperty('--cab', `var(--${g.color})`);
      const rows = t.length
        ? t.map((e, i) => `<li><span class="hs-pos">${i + 1}</span><span class="hs-name">${e.name}</span><span class="hs-val">${A.fmtHi(g.id, e.value)}</span></li>`).join('')
        : '<li class="hs-empty">No scores yet. Be the first.</li>';
      card.innerHTML = `<h3>${g.title}</h3><p class="muted">${g.hiscore.label}</p><ol class="hs-list">${rows}</ol>`;
      host.appendChild(card);
    });
  }

  /* Settings */
  $('settingsSound').addEventListener('click', () => A.setSound(!data.sound));
  A.on('hud', () => {
    $('settingsSound').textContent = data.sound ? 'Sound: on' : 'Sound: off';
    $('settingsSound').setAttribute('aria-pressed', String(data.sound));
  });
  let resetArmed = null;
  $('resetBtn').addEventListener('click', () => {
    const btn = $('resetBtn');
    if (resetArmed) { A.resetAll(); return; }
    btn.textContent = 'Tap again to erase everything';
    btn.classList.add('armed');
    resetArmed = setTimeout(() => {
      resetArmed = null;
      btn.textContent = 'Reset all progress';
      btn.classList.remove('armed');
    }, 3500);
  });

  /* Initials entry */
  const initialsInput = $('initialsInput');
  initialsInput.addEventListener('input', () => {
    initialsInput.value = initialsInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  });
  initialsInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); A.commitInitials(); } });
  $('initialsSave').addEventListener('click', () => A.commitInitials());
  A.on('hiscore', id => { renderPlates(); A.toast(`📋 You're on the ${A.gameById[id].title.replace(/·/g, ' ')} high-score table`); });

  /* =======================================================
     GAME SCREENS (generated from each game's definition)
  ======================================================= */
  function buildScreens(){
    const host = $('gameScreens');
    A.games.forEach(g => {
      const sec = document.createElement('section');
      sec.className = 'view game';
      sec.id = 'screen-' + g.id;
      sec.style.setProperty('--cab', `var(--${g.color})`);
      sec.innerHTML = `
        <div class="game-panel${g.wide ? ' wide' : ''}">
          <div class="game-head">
            <button class="back-btn">‹ Floor</button>
            ${g.hiscore ? '<button class="chip-btn hs-open">Hi-scores</button>' : ''}
            <span class="daily-badge" hidden>Daily</span>
            <h2 class="game-title">${g.title}</h2>
          </div>
          <div class="game-body"></div>
        </div>`;
      host.appendChild(sec);
      sec.querySelector('.back-btn').addEventListener('click', () => A.show('floor'));
      const hs = sec.querySelector('.hs-open');
      if (hs) hs.addEventListener('click', () => openTrophies('scores', g.id));
      g.dailyBadge = sec.querySelector('.daily-badge');
      g.build(sec.querySelector('.game-body'));
    });
  }
  A.on('play', id => { A.gameById[id].dailyBadge.hidden = !A.isDaily(id); });

  /* =======================================================
     FLOOR: cover-flow carousel of cabinets
  ======================================================= */
  const cabinets = [];
  const BUTTON_COLORS = ['yellow', 'pink', 'cyan', 'lime', 'orange', 'violet'];
  let carouselIndex = 0;

  function buildFloor(){
    const car = $('carousel');
    A.games.forEach((g, i) => {
      const c = document.createElement('div');
      c.className = 'cabinet';
      c.dataset.game = g.id;
      c.style.setProperty('--cab', `var(--${g.color})`);
      const b1 = BUTTON_COLORS[i % BUTTON_COLORS.length], b2 = BUTTON_COLORS[(i + 2) % BUTTON_COLORS.length];
      c.innerHTML = `
        <div class="cab">
          <div class="cab-marquee">${g.marquee}</div>
          <div class="cab-bezel"><div class="crt">${g.mini}</div></div>
          <div class="cab-panel"><span class="stick"></span><span class="pbtn" style="--c:var(--${b1})"></span><span class="pbtn" style="--c:var(--${b2})"></span></div>
          <div class="cab-door"><span class="cab-meta"><b>${g.label}</b><em class="cab-plate"></em></span></div>
        </div>`;
      c.addEventListener('click', () => {
        if (justSwiped) return;
        if (c.classList.contains('selected')) A.play(g.id);
        else turn(shortest(i));
      });
      car.appendChild(c);
      cabinets.push(c);
    });
    const saved = A.games.findIndex(g => g.id === data.modes.lastGame);
    if (saved >= 0) carouselIndex = saved;
  }

  function renderPlates(){
    cabinets.forEach(c => {
      const g = A.gameById[c.dataset.game];
      const top = A.best(g.id);
      const parts = [g.plate || (g.hasDifficulty ? A.capitalize(A.difficulty(g.id)) : 'Free play')];
      if (top) parts.push(`HI ${A.fmtHi(g.id, top.value)}`);
      c.querySelector('.cab-plate').textContent = parts.join(' · ');
    });
  }

  function shortest(i){
    const n = cabinets.length;
    let d = ((i - carouselIndex) % n + n) % n;
    if (d > n / 2) d -= n;
    return d;
  }
  function turn(dir){
    if (!dir) return;
    carouselIndex += dir;
    A.sfx('tick');
    layoutCarousel();
  }

  function layoutCarousel(){
    const n = cabinets.length;
    const w = cabinets[0].offsetWidth || 240;
    const maxVisible = n >= 5 ? 2 : 1;
    cabinets.forEach((cab, i) => {
      let d = ((i - carouselIndex) % n + n) % n;
      if (d > n / 2) d -= n;
      const ad = Math.abs(d);
      const visible = ad <= maxVisible;
      const x = Math.sign(d) * (ad === 0 ? 0 : ad === 1 ? w * 0.8 : w * 1.4);
      cab.style.transform = `translateX(${x}px) translateZ(${-ad * 170}px) rotateY(${-d * 26}deg)`;
      cab.style.opacity = visible ? String([1, 0.75, 0.38][ad]) : '0';
      cab.style.zIndex = String(10 - ad);
      cab.style.pointerEvents = visible ? 'auto' : 'none';
      cab.classList.toggle('selected', d === 0);
      cab.setAttribute('aria-hidden', String(d !== 0));
    });

    const g = A.games[((carouselIndex % n) + n) % n];
    data.modes.lastGame = g.id;
    A.save();
    $('playGameName').textContent = g.name;
    $('playBtn').style.setProperty('--cab', `var(--${g.color})`);
    $('diffPicker').hidden = !g.hasDifficulty;
    if (g.hasDifficulty) {
      document.querySelectorAll('.diff-opt').forEach(o => {
        const on = o.dataset.diff === A.difficulty(g.id);
        o.classList.toggle('active', on);
        o.setAttribute('aria-pressed', String(on));
      });
    }
    const top = A.best(g.id);
    $('floorBest').textContent = top ? `Best: ${A.fmtHi(g.id, top.value)} ${g.hiscore.unit || ''} by ${top.name}` : (g.blurb || '');
  }
  const selectedGame = () => A.games[((carouselIndex % cabinets.length) + cabinets.length) % cabinets.length];

  $('turnRight').addEventListener('click', () => turn(1));
  $('turnLeft').addEventListener('click', () => turn(-1));
  $('playBtn').addEventListener('click', () => A.play(selectedGame().id));
  document.querySelectorAll('.diff-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const g = selectedGame();
      if (!g.hasDifficulty) return;
      A.setDifficulty(g.id, opt.dataset.diff);
      A.sfx('click');
      layoutCarousel();
      renderPlates();
    });
  });
  /* swipe the carousel on touch screens */
  let swipeX = null;
  let justSwiped = false;
  $('carouselStage').addEventListener('pointerdown', e => { swipeX = e.clientX; });
  $('carouselStage').addEventListener('pointerup', e => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 50) {
      turn(dx < 0 ? 1 : -1);
      justSwiped = true; // stop the click that follows from also starting a game
      setTimeout(() => { justSwiped = false; }, 0);
    }
  });
  window.addEventListener('resize', () => { if (A.current === 'floor') layoutCarousel(); });

  A.on('floorKey', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); turn(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); }
    if (e.key === 'Enter' && (document.activeElement === document.body || !document.activeElement)) A.play(selectedGame().id);
  });
  A.on('screen', id => {
    if (id !== 'floor') return;
    renderPlates();
    renderDaily();
    layoutCarousel();
    $('playBtn').focus({ preventScroll: true });
  });

  /* =======================================================
     DAILY CHALLENGE BANNER
  ======================================================= */
  function renderDaily(){
    const ch = A.dailyToday();
    const g = A.gameById[ch.game];
    const el = $('dailyBanner');
    el.style.setProperty('--cab', `var(--${g.color})`);
    el.classList.toggle('done', ch.done);
    $('dailyText').innerHTML = `<b>${g.title}</b><span>${ch.text}</span>`;
    $('dailyReward').textContent = ch.done ? 'Completed ✓' : `+${ch.reward} 🎟`;
    $('dailyPlay').textContent = ch.done ? 'Play again' : 'Play';
  }
  $('dailyPlay').addEventListener('click', () => A.startDaily());
  A.on('daily', renderDaily);

  /* =======================================================
     INSTALLABLE APP (service worker + install button)
  ======================================================= */
  // Service workers only run from a web address (http/https), not from a file opened on disk.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  let installPrompt = null;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  function renderInstall(){
    const btn = $('installBtn'), note = $('installNote');
    if (standalone) { btn.hidden = true; note.textContent = 'You are playing the installed app.'; return; }
    btn.hidden = !installPrompt;
    if (installPrompt) note.textContent = 'Add Neon Arcade to your home screen or desktop. It works offline too.';
    else if (/iphone|ipad/i.test(navigator.userAgent)) note.textContent = 'On iPhone or iPad: tap Share, then "Add to Home Screen".';
    else if (location.protocol === 'file:') note.textContent = 'Installing works once the arcade is online (for example on GitHub Pages).';
    else note.textContent = "Use your browser menu's \"Install\" or \"Add to Home Screen\" option.";
  }
  window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); installPrompt = ev; renderInstall(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; A.toast('📲 Neon Arcade installed'); renderInstall(); });
  $('installBtn').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (err) { /* dismissed */ }
    installPrompt = null;
    renderInstall();
  });

  /* =======================================================
     BOOT
  ======================================================= */
  buildScreens();
  buildFloor();
  applyCosmetics();
  renderPlates();
  renderDaily();
  renderHud();
  renderInstall();
  A.emit('hud');
  layoutCarousel();
  A.emit('boot');
})();

'use strict';
/* =========================================================
   PLAYER STATS — the "Stats" tab in the Trophy Case.
   Everything here is read from the save file; nothing new is stored
   except what core.js already records (plays, time, score history).
========================================================= */
(() => {
  const A = Arcade;
  const { data } = A;
  let chartGame = null;

  const plays = id => A.getStat('plays_' + id);
  const secs = id => A.getStat('time_' + id);
  function duration(s){
    if (s < 60) return `${Math.round(s)}s`;
    const m = Math.floor(s / 60), h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}m` : `${m}m`;
  }

  function rankProgress(){
    const R = A.RANKS;
    let i = 0;
    R.forEach((r, k) => { if (data.score >= r.min) i = k; });
    const next = R[i + 1];
    if (!next) return { name: R[i].name, next: null, pct: 100 };
    const pct = (data.score - R[i].min) / (next.min - R[i].min) * 100;
    return { name: R[i].name, next, pct };
  }

  function render(){
    const host = A.$('statsPanel');
    if (!host) return;
    const games = A.games;
    const totalPlays = games.reduce((s, g) => s + plays(g.id), 0);
    const totalTime = games.reduce((s, g) => s + secs(g.id), 0);
    const fav = games.slice().sort((a, b) => secs(b.id) - secs(a.id) || plays(b.id) - plays(a.id))[0];
    const favLabel = fav && (secs(fav.id) || plays(fav.id)) ? fav.title : '—';
    const rp = rankProgress();
    const trophies = data.unlocked.filter(id => A.ACH.some(a => a.id === id)).length;

    const withHistory = games.filter(g => (data.history && data.history[g.id] || []).length);
    if (!withHistory.some(g => g.id === chartGame)) chartGame = withHistory[0] ? withHistory[0].id : null;

    host.innerHTML = `
      <div class="st-rank">
        <div class="st-rank-head">
          <span><span class="muted">Rank</span> <b>${rp.name}</b></span>
          <span class="muted">${rp.next ? `${A.fmt(data.score)} / ${A.fmt(rp.next.min)} to <b>${rp.next.name}</b>` : 'Top rank reached'}</span>
        </div>
        <div class="st-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(rp.pct)}"><i style="width:${rp.pct}%"></i></div>
      </div>
      <div class="st-tiles">
        ${tile('Games played', A.fmt(totalPlays))}
        ${tile('Time played', duration(totalTime))}
        ${tile('Favourite', favLabel)}
        ${tile('Tickets earned', A.fmt(data.ticketsEarned))}
        ${tile('Trophies', `${trophies}/${A.ACH.length}`)}
        ${tile('Daily challenges', A.fmt(data.daily.count || 0))}
      </div>

      <section class="st-chart-wrap">
        <div class="st-chart-head">
          <h3>Recent scores</h3>
          ${withHistory.length ? `<label class="st-select"><span class="sr-only">Game</span><select id="statsGame">${withHistory.map(g => `<option value="${g.id}"${g.id === chartGame ? ' selected' : ''}>${g.title}</option>`).join('')}</select></label>` : ''}
        </div>
        <div class="st-chart" id="statsChart">${chartGame ? '' : '<p class="muted st-empty">Finish a few games and your scores will show up here.</p>'}</div>
      </section>

      <section>
        <h3 class="st-h">Every game</h3>
        <div class="st-table-wrap">
          <table class="st-table">
            <thead><tr><th>Game</th><th>Plays</th><th>Time</th><th>Best</th></tr></thead>
            <tbody>${games.map(g => {
              const b = A.best(g.id);
              return `<tr style="--cab:var(--${g.color})"><td><i class="st-dot"></i>${g.title}</td><td>${A.fmt(plays(g.id))}</td><td>${secs(g.id) ? duration(secs(g.id)) : '—'}</td><td>${b ? `${A.fmtHi(g.id, b.value)} <small>${g.hiscore.unit || ''}</small>` : '—'}</td></tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </section>`;

    const sel = A.$('statsGame');
    if (sel) sel.addEventListener('change', () => { chartGame = sel.value; drawChart(); });
    drawChart();
  }

  const tile = (label, value) => `<div class="st-tile"><span>${label}</span><b>${value}</b></div>`;

  /* single-series line chart of the last 30 finished runs */
  function drawChart(){
    const host = A.$('statsChart');
    if (!host || !chartGame) return;
    const g = A.gameById[chartGame];
    const pts = (data.history[chartGame] || []).slice(-30);
    const W = 640, H = 230, L = 48, R = 16, T = 30, B = 30;
    const max = Math.max(1, ...pts.map(p => p.v));
    const step = niceStep(max / 3);
    const top = Math.ceil(max / step) * step;
    const x = i => L + (pts.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (pts.length - 1));
    const y = v => T + (1 - v / top) * (H - T - B);
    const ticks = [];
    for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const bestI = pts.reduce((bi, p, i) => (p.v > pts[bi].v ? i : bi), 0);

    host.style.setProperty('--cab', `var(--${g.color})`);
    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${g.title}: last ${pts.length} scores, best ${A.fmtHi(g.id, pts[bestI].v)}">
        ${ticks.map(v => `<line class="st-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="st-axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${A.fmt(v)}</text>`).join('')}
        <text class="st-axis" x="${L}" y="${H - 8}">Oldest</text>
        <text class="st-axis" x="${W - R}" y="${H - 8}" text-anchor="end">Latest</text>
        ${pts.length > 1 ? `<path class="st-line" d="${line}"/>` : ''}
        ${pts.map((p, i) => `<circle class="st-pt${i === bestI ? ' best' : ''}" cx="${x(i)}" cy="${y(p.v)}" r="${i === bestI ? 5.5 : 4}"/>`).join('')}
        <text class="st-label" x="${x(bestI)}" y="${y(pts[bestI].v) - 12}" text-anchor="middle">Best ${A.fmtHi(g.id, pts[bestI].v)}</text>
        ${pts.map((p, i) => `<circle class="st-hit" data-i="${i}" cx="${x(i)}" cy="${y(p.v)}" r="14"/>`).join('')}
      </svg>
      <div class="st-tip" hidden></div>`;

    // hover / tap tooltip for each point
    const tip = host.querySelector('.st-tip');
    host.querySelectorAll('.st-hit').forEach(c => {
      const showTip = () => {
        const p = pts[+c.dataset.i];
        const r = c.getBoundingClientRect(), hr = host.getBoundingClientRect();
        tip.innerHTML = `<b>${A.fmtHi(g.id, p.v)} ${g.hiscore.unit || ''}</b><span>${p.d}</span>`;
        tip.hidden = false;
        tip.style.left = `${r.left - hr.left + r.width / 2}px`;
        tip.style.top = `${r.top - hr.top}px`;
      };
      c.addEventListener('pointerenter', showTip);
      c.addEventListener('pointerdown', showTip);
      c.addEventListener('pointerleave', () => { tip.hidden = true; });
    });
  }
  function niceStep(raw){
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  A.on('tab', t => { if (t === 'stats') render(); });
})();

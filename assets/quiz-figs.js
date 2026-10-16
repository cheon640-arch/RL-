/* 퀴즈용 그림 그리기 도구 (SVG/HTML 문자열을 만들어 줌) */
(function () {
  const C = { cream: '#fdfbf9', dew: '#f7efe9', ink: '#2b1a07', char: '#171717', orange: '#ff6f1e', sienna: '#ce500a', sky: '#3b82f6', mist: '#bebcbb', hole: '#e7f0ff', goal: '#fff0e6', wall: '#5b5149' };
  let uid = 0;
  const svgOpen = (w, h, maxw) => `<svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:${maxw || w}px;height:auto" font-family="Geist, Gowun Dodum, sans-serif" xmlns="http://www.w3.org/2000/svg">`;
  const marker = (id, color) => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker></defs>`;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const F = {};

  /* 격자: cells = { idx: { t:'S'|'G'|'H'|'W', v:'표시값', a:'→', hl:true } } */
  F.grid = ({ rows, cols, cells = {}, cs = 58, idx = true, caption }) => {
    const W = cols * cs + 8, H = rows * cs + 8 + (caption ? 22 : 0);
    let s = svgOpen(W, H, Math.min(W, 360));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, x = 4 + c * cs, y = 4 + r * cs, o = cells[i] || {};
      const fill = o.t === 'H' ? C.hole : o.t === 'G' ? C.goal : o.t === 'W' ? C.wall : o.t === 'S' ? C.dew : C.cream;
      s += `<rect x="${x + 2}" y="${y + 2}" width="${cs - 4}" height="${cs - 4}" rx="7" fill="${o.fill || fill}" stroke="${o.hl ? C.orange : C.char}" stroke-width="${o.hl ? 3 : 1}"/>`;
      if (idx && o.t !== 'W') s += `<text x="${x + cs - 7}" y="${y + 14}" text-anchor="end" font-size="10" fill="${C.mist}">${o.n ?? i}</text>`;
      if (o.t && o.t !== 'W' && o.v == null) s += `<text x="${x + cs / 2}" y="${y + cs / 2 + 7}" text-anchor="middle" font-size="19" font-weight="700" fill="${o.t === 'H' ? C.sky : o.t === 'G' ? C.orange : C.ink}">${o.t}</text>`;
      if (o.t === 'S' && o.v != null) s += `<text x="${x + 7}" y="${y + 14}" font-size="10" fill="${C.ink}">S</text>`;
      if (o.v != null) s += `<text x="${x + cs / 2}" y="${y + cs / 2 + (o.a ? 0 : 5)}" text-anchor="middle" font-size="14" font-family="JetBrains Mono, monospace" fill="${C.ink}">${esc(o.v)}</text>`;
      if (o.a) s += `<text x="${x + cs / 2}" y="${y + cs / 2 + (o.v != null ? 20 : 8)}" text-anchor="middle" font-size="20" fill="${C.sienna}">${o.a}</text>`;
    }
    if (caption) s += `<text x="${W / 2}" y="${H - 4}" text-anchor="middle" font-size="12" fill="${C.ink}">${esc(caption)}</text>`;
    return s + '</svg>';
  };

  /* 일렬 체인: nodes = ['A','B',{l:'T',term:true}], labels = ['r=0', ...] (노드 사이 화살표 위 글자) */
  F.chain = (nodes, labels = [], { gap = 120, r = 24 } = {}) => {
    const id = 'ch' + (++uid), W = (nodes.length - 1) * gap + 2 * r + 30, H = 90;
    let s = svgOpen(W, H, Math.min(W, 520)) + marker(id, C.ink);
    nodes.forEach((n, i) => {
      const o = typeof n === 'string' ? { l: n } : n, x = 15 + r + i * gap, y = 55;
      if (i < nodes.length - 1) {
        s += `<line x1="${x + r}" y1="${y}" x2="${x + gap - r - 4}" y2="${y}" stroke="${C.ink}" stroke-width="1.5" marker-end="url(#${id})"/>`;
        if (labels[i]) s += `<text x="${x + gap / 2}" y="${y - 10}" text-anchor="middle" font-size="13" fill="${C.sienna}" font-family="JetBrains Mono, monospace">${esc(labels[i])}</text>`;
      }
      s += o.term ? `<rect x="${x - r * .8}" y="${y - r * .8}" width="${r * 1.6}" height="${r * 1.6}" rx="4" fill="${C.goal}" stroke="${C.char}" stroke-width="1.4"/>`
        : `<circle cx="${x}" cy="${y}" r="${r}" fill="${o.fill || C.cream}" stroke="${C.char}" stroke-width="1.5"/>`;
      s += `<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" fill="${C.ink}">${esc(o.l)}</text>`;
      if (o.sub) s += `<text x="${x}" y="${y + r + 16}" text-anchor="middle" font-size="12" fill="${C.ink}" font-family="JetBrains Mono, monospace">${esc(o.sub)}</text>`;
    });
    return s + '</svg>';
  };

  /* 일반 그래프: nodes = [{id,x,y,l,sub,term}], edges = [{f,t,l,bend}] (f===t 면 자기 루프) */
  F.graph = ({ w, h, nodes, edges, r = 28 }) => {
    const id = 'g' + (++uid), N = Object.fromEntries(nodes.map(n => [n.id, n]));
    let s = svgOpen(w, h, Math.min(w, 520)) + marker(id, C.ink);
    for (const e of edges) {
      const a = N[e.f], b = N[e.t];
      if (e.f === e.t) {
        const up = e.dir === 'down' ? 1 : -1, y0 = a.y + up * r;
        s += `<path d="M${a.x - 12} ${y0} C ${a.x - 34} ${y0 + up * 42}, ${a.x + 34} ${y0 + up * 42}, ${a.x + 12} ${y0 + up * 2}" fill="none" stroke="${C.ink}" stroke-width="1.4" marker-end="url(#${id})"/>`;
        if (e.l) s += `<text x="${a.x}" y="${y0 + up * 44 + (up > 0 ? 12 : -2)}" text-anchor="middle" font-size="12.5" fill="${C.sienna}" font-family="JetBrains Mono, monospace">${esc(e.l)}</text>`;
        continue;
      }
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const bend = e.bend || 0, nx = -uy * bend, ny = ux * bend;
      const x1 = a.x + ux * r, y1 = a.y + uy * r, x2 = b.x - ux * (r + 3), y2 = b.y - uy * (r + 3);
      const mx = (a.x + b.x) / 2 + nx, my = (a.y + b.y) / 2 + ny;
      s += `<path d="M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" fill="none" stroke="${C.ink}" stroke-width="1.4" marker-end="url(#${id})"/>`;
      if (e.l) s += `<text x="${mx + (e.lx || 0)}" y="${my + (e.ly ?? -6)}" text-anchor="middle" font-size="12.5" fill="${C.sienna}" font-family="JetBrains Mono, monospace">${esc(e.l)}</text>`;
    }
    for (const n of nodes) {
      s += n.term ? `<rect x="${n.x - r * .8}" y="${n.y - r * .8}" width="${r * 1.6}" height="${r * 1.6}" rx="4" fill="${C.goal}" stroke="${C.char}" stroke-width="1.4"/>`
        : n.dot ? `<circle cx="${n.x}" cy="${n.y}" r="7" fill="${C.char}"/>`
        : `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${n.fill || C.cream}" stroke="${C.char}" stroke-width="1.5"/>`;
      if (!n.dot) s += `<text x="${n.x}" y="${n.y + 5}" text-anchor="middle" font-size="14" fill="${C.ink}">${esc(n.l)}</text>`;
      if (n.sub) s += `<text x="${n.x + (n.subx || 0)}" y="${n.y + (n.suby ?? r + 17)}" text-anchor="middle" font-size="12" fill="${C.ink}" font-family="JetBrains Mono, monospace">${esc(n.sub)}</text>`;
    }
    return s + '</svg>';
  };

  /* 백업 다이어그램 여러 개를 나란히: list = [['v','(A)'], ['qstar','(B)'], ...] */
  F.backups = list => {
    const cw = 150, W = list.length * cw, H = 210;
    let s = svgOpen(W, H, Math.min(W, 600));
    list.forEach(([k, lab], i) => { s += `<g transform="translate(${i * cw},0)">${tree(k)}<text x="${cw / 2}" y="${H - 6}" text-anchor="middle" font-size="14" fill="${C.ink}" font-weight="600">${esc(lab)}</text></g>`; });
    return s + '</svg>';
    function tree(k) {
      const st = (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="${C.cream}" stroke="${C.char}" stroke-width="1.4"/>`;
      const ac = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="${C.char}"/>`;
      const sq = (x, y) => `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="${C.goal}" stroke="${C.char}" stroke-width="1.2"/>`;
      const ln = (x1, y1, x2, y2, dash) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ink}" stroke-width="1.2"${dash ? ' stroke-dasharray="3 3"' : ''}/>`;
      const arc = (cx, cy, w) => `<path d="M${cx - w} ${cy} Q ${cx} ${cy + 10} ${cx + w} ${cy}" fill="none" stroke="${C.orange}" stroke-width="2"/>`;
      const c = 75;
      let g = '';
      if (k === 'v' || k === 'vstar' || k === 'dp') {
        g += ln(c, 25, c - 35, 75) + ln(c, 25, c + 35, 75);
        [[c - 35, -18], [c - 35, 18], [c + 35, -18], [c + 35, 18]].forEach(([x, d]) => { g += ln(x, 75, x + d, 140); });
        if (k === 'vstar') g += arc(c, 50, 22);
        g += st(c, 25) + ac(c - 35, 75) + ac(c + 35, 75);
        [[c - 53], [c - 17], [c + 17], [c + 53]].forEach(([x]) => { g += st(x, 140); });
      } else if (k === 'q' || k === 'qstar') {
        g += ln(c, 25, c - 35, 80) + ln(c, 25, c + 35, 80);
        [[c - 35, -18], [c - 35, 18], [c + 35, -18], [c + 35, 18]].forEach(([x, d]) => { g += ln(x, 80, x + d, 145); });
        if (k === 'qstar') { g += arc(c - 35, 108, 12) + arc(c + 35, 108, 12); }
        g += ac(c, 25) + st(c - 35, 80) + st(c + 35, 80);
        [[c - 53], [c - 17], [c + 17], [c + 53]].forEach(([x]) => { g += ac(x, 145); });
      } else if (k === 'td') {
        g += ln(c, 30, c, 85) + ln(c, 85, c, 140) + st(c, 30) + ac(c, 85) + st(c, 140);
      } else if (k === 'mc') {
        g += ln(c, 15, c, 160);
        [15, 55, 95, 135].forEach((y, i) => { g += i % 2 ? ac(c, y) : st(c, y); });
        g += `<text x="${c}" y="${150}" text-anchor="middle" font-size="12">⋮</text>` + sq(c, 168);
      } else if (k === 'ex') {
        g += ln(c, 15, c - 40, 55) + ln(c, 15, c + 40, 55);
        [[c - 40], [c + 40]].forEach(([x]) => { g += ln(x, 55, x - 20, 95) + ln(x, 55, x + 20, 95); });
        [c - 60, c - 20, c + 20, c + 60].forEach(x => { g += ln(x, 95, x - 9, 135, 1) + ln(x, 95, x + 9, 135, 1); });
        g += st(c, 15) + ac(c - 40, 55) + ac(c + 40, 55);
        [c - 60, c - 20, c + 20, c + 60].forEach(x => { g += st(x, 95); });
        [c - 69, c - 51, c - 29, c - 11, c + 11, c + 29, c + 51, c + 69].forEach(x => { g += sq(x, 140); });
      } else if (k === 'sarsa') {
        g += ln(c, 20, c, 160) + ac(c, 20) + st(c, 90) + ac(c, 160);
        g += `<text x="${c + 14}" y="24" font-size="11">S,A</text><text x="${c + 16}" y="94" font-size="11">R, S′</text><text x="${c + 12}" y="164" font-size="11">A′</text>`;
      } else if (k === 'qlearn') {
        g += ln(c, 20, c, 90) + ln(c, 90, c - 30, 160) + ln(c, 90, c, 160) + ln(c, 90, c + 30, 160) + arc(c, 118, 18);
        g += ac(c, 20) + st(c, 90) + ac(c - 30, 160) + ac(c, 160) + ac(c + 30, 160);
        g += `<text x="${c + 14}" y="24" font-size="11">S,A</text><text x="${c + 16}" y="94" font-size="11">R, S′</text>`;
      }
      return g;
    }
  };

  F.table = (head, rows) => `<div class="tbl-wrap"><table class="t" style="min-width:0;font-size:15px"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  F.code = (src, mark) => `<pre class="code" style="font-size:13px">${esc(src).split('\n').map((l, i) => mark && mark.includes(i + 1) ? `<span style="background:rgba(255,111,30,.35)">${l}</span>` : l).join('\n')}</pre>`;

  window.QF = F;
})();

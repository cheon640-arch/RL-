/* 형광펜 · 동그라미 · 붙이는 메모장. 모든 데이터는 이 브라우저(localStorage)에만 저장됨.
   - 글자를 드래그 → 팝업에서 형광펜 색 / ⭕ 동그라미 / 메모 붙이기
   - 칠하거나 동그라미 친 곳을 클릭 → 색 바꾸기, 메모 붙이기, 지우기
   - 메모장(포스트잇)은 항상 보이고, 위쪽 막대를 잡고 끌어서 옮길 수 있음
   - 섹션마다 '✎ 메모' 버튼 → 섹션 포스트잇
   - 오른쪽 아래 도구: 펜 모드(OFF/형광펜/동그라미), 색, 메모 보이기, 내 노트 */
(function () {
  const COLORS = [['y', '노랑'], ['o', '주황'], ['g', '초록'], ['p', '분홍'], ['b', '파랑']];
  const STROKE = { y: '#d9a400', o: '#ff6f1e', g: '#16a34a', p: '#e83fb4', b: '#2563eb' };
  const SKIP = '.widget,.anim,.card-tools,.memo-box,.hl-note-mark,.ann-layer,script,style,button,select,input,textarea,svg';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  document.addEventListener('DOMContentLoaded', () => {
    const ch = document.body.dataset.ch;
    if (!ch || !window.RL_STORE) return;
    const S = window.RL_STORE;
    const KEY_HL = 'hl-' + ch, KEY_MEMO = 'memo-' + ch;
    let hls = S.get(KEY_HL) || [];
    let memos = S.get(KEY_MEMO) || {};
    let curColor = S.get('hl-color') || 'y';
    let penMode = S.get('pen-mode') || (S.get('pen-on') ? 'hl' : '');
    let notesHidden = !!S.get('notes-hidden');
    hls.forEach(h => { h.k = h.k || 'hl'; if (h.sticky === undefined) h.sticky = !!(h.n && h.n.trim()); });
    const saveHl = () => { S.set(KEY_HL, hls.map(({ lost, ...x }) => x)); refreshDock(); };
    const saveMemo = () => { S.set(KEY_MEMO, memos); refreshDock(); };
    const sections = [...document.querySelectorAll('section.card[id]')];
    const secTitle = id => { const s = document.getElementById(id); return s ? (s.dataset.toc || s.querySelector('h2')?.textContent.trim() || id) : id; };

    /* ---------- 텍스트 좌표계: 섹션 안의 글자들을 일렬로 세기 (수식 하나 = 1칸) ---------- */
    function units(sec) {
      const out = []; let pos = 0;
      (function walk(n) {
        for (const c of n.childNodes) {
          if (c.nodeType === 3) {
            const L = c.nodeValue.length;
            if (L) { out.push({ node: c, type: 't', start: pos, end: pos + L }); pos += L; }
          } else if (c.nodeType === 1) {
            if (c.matches(SKIP)) continue;
            if (c.classList.contains('katex')) { out.push({ node: c, type: 'a', start: pos, end: pos + 1 }); pos += 1; continue; }
            walk(c);
          }
        }
      })(sec);
      out.total = pos;
      return out;
    }
    function matchText(us, s, e) {
      let r = '';
      for (const u of us) {
        if (u.end <= s || u.start >= e) continue;
        r += u.type === 'a' ? '§' : u.node.nodeValue.slice(Math.max(s, u.start) - u.start, Math.min(e, u.end) - u.start);
      }
      return r;
    }
    function dispText(us, s, e) {
      let r = '';
      for (const u of us) {
        if (u.end <= s || u.start >= e) continue;
        if (u.type === 'a') r += ' ' + (u.node.querySelector('annotation')?.textContent || '수식').trim() + ' ';
        else r += u.node.nodeValue.slice(Math.max(s, u.start) - u.start, Math.min(e, u.end) - u.start);
      }
      return r.replace(/\s+/g, ' ').trim();
    }
    function pointOff(us, node, off, isEnd) {
      for (const u of us) {
        if (u.type === 't' && u.node === node) return u.start + off;
        const r = document.createRange();
        if (u.type === 't') r.selectNodeContents(u.node); else r.selectNode(u.node);
        let c;
        try { c = r.comparePoint(node, off); } catch (e) { continue; }
        if (c < 0) return u.start;
        if (c === 0) {
          const e2 = r.cloneRange(); e2.collapse(false);
          if (e2.comparePoint(node, off) === 0) continue;
          if (u.type === 'a') { const s2 = r.cloneRange(); s2.collapse(true); return (isEnd && s2.comparePoint(node, off) !== 0) ? u.end : u.start; }
          return u.start;
        }
      }
      return us.total;
    }

    /* ---------- 표시하기 / 지우기 ---------- */
    const markClass = h => h.k === 'circ' ? 'hl circ' : 'hl hl-' + h.c;
    function paint(h) {
      const sec = document.getElementById(h.sec);
      if (!sec) return false;
      const us = units(sec);
      if (matchText(us, h.s, h.e) !== h.t) {
        const idx = matchText(us, 0, us.total).indexOf(h.t);
        if (idx < 0) return false;
        h.s = idx; h.e = idx + h.t.length;
      }
      const segs = us.filter(u => u.end > h.s && u.start < h.e);
      const wrap = n => { const m = document.createElement('mark'); m.className = markClass(h); m.dataset.hid = h.id; n.parentNode.insertBefore(m, n); m.appendChild(n); return m; };
      let last = null;
      for (let i = segs.length - 1; i >= 0; i--) {
        const u = segs[i]; let n = u.node;
        if (u.type === 'a') { const m = wrap(n); if (!last) last = m; continue; }
        const s = Math.max(h.s, u.start) - u.start, e = Math.min(h.e, u.end) - u.start;
        if (!n.nodeValue.slice(s, e).trim()) continue;
        if (e < n.nodeValue.length) n.splitText(e);
        if (s > 0) n = n.splitText(s);
        const m = wrap(n); if (!last) last = m;
      }
      if (last) {
        const sup = document.createElement('sup');
        sup.className = 'hl-note-mark'; sup.dataset.hid = h.id; sup.textContent = '📝';
        last.after(sup);
      }
      return !!last;
    }
    function unpaint(id) {
      document.querySelectorAll(`.hl-note-mark[data-hid="${id}"]`).forEach(x => x.remove());
      document.querySelectorAll(`mark.hl[data-hid="${id}"]`).forEach(m => {
        const p = m.parentNode;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        m.remove(); p.normalize();
      });
      document.querySelectorAll(`.ann-layer [data-hid="${id}"]`).forEach(x => x.remove());
    }
    hls.forEach(h => { h.lost = !paint(h); });

    /* ---------- 동그라미 · 메모장 레이어 ---------- */
    function layerOf(sec) {
      let L = sec.querySelector(':scope > .ann-layer');
      if (!L) {
        L = document.createElement('div'); L.className = 'ann-layer';
        L.innerHTML = '<svg class="ann-svg" xmlns="http://www.w3.org/2000/svg"></svg>';
        sec.appendChild(L);
      }
      return L;
    }
    function rnd(seed) { let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
    function roughEllipse(b, seed) {
      const R = rnd(seed), cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2 + 12, ry = b.h / 2 + 8;
      const pts = [], n = 14, a0 = -Math.PI * 0.75 + R() * 0.4;
      for (let i = 0; i <= n + 2; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        const j = 1 + (R() - 0.5) * 0.09 + (i > n ? 0.06 : 0);
        pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
      }
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      return d;
    }
    function bboxOf(h, secRect) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      document.querySelectorAll(`mark.hl[data-hid="${h.id}"]`).forEach(m => {
        for (const r of m.getClientRects()) {
          if (!r.width && !r.height) continue;
          x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
        }
      });
      if (x0 === Infinity) return null;
      return { x: x0 - secRect.left, y: y0 - secRect.top, w: x1 - x0, h: y1 - y0 };
    }

    function stickyEl(h, L) {
      let el = L.querySelector(`.sticky[data-hid="${h.id}"]`);
      if (el) return el;
      el = document.createElement('div');
      el.className = 'sticky st-' + (h.k === 'circ' ? h.c || 'o' : h.c);
      el.dataset.hid = h.id;
      el.innerHTML = `<div class="st-bar"><span class="st-grip" title="끌어서 옮기기">⠿ 메모</span><button type="button" class="st-min" title="접기">–</button><button type="button" class="st-del" title="메모 떼기">×</button></div>
        <textarea placeholder="여기에 바로 적어요"></textarea>`;
      const ta = el.querySelector('textarea');
      ta.value = h.n || '';
      const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.max(46, ta.scrollHeight) + 'px'; };
      let t;
      ta.addEventListener('input', () => { fit(); clearTimeout(t); t = setTimeout(() => { h.n = ta.value; saveHl(); renderDrawer(); }, 350); });
      setTimeout(fit, 0);
      el.querySelector('.st-min').onclick = () => { h.min = true; saveHl(); layoutSec(document.getElementById(h.sec)); };
      el.querySelector('.st-del').onclick = () => {
        if (h.n && h.n.trim() && !confirm('이 메모장을 뗄까요? (동그라미/형광펜은 남아요)')) return;
        h.sticky = false; h.n = ''; h.dx = h.dy = 0; el.remove(); saveHl(); layoutSec(document.getElementById(h.sec)); renderDrawer();
      };
      // 드래그
      const grip = el.querySelector('.st-bar');
      grip.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY, dx0 = h.dx || 0, dy0 = h.dy || 0;
        grip.setPointerCapture(e.pointerId);
        el.classList.add('dragging');
        const mv = ev => { h.dx = dx0 + ev.clientX - sx; h.dy = dy0 + ev.clientY - sy; layoutSec(document.getElementById(h.sec)); };
        const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); el.classList.remove('dragging'); saveHl(); };
        grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
      });
      L.appendChild(el);
      return el;
    }

    function layoutSec(sec) {
      if (!sec) return;
      const mine = hls.filter(h => h.sec === sec.id && !h.lost);
      const L = layerOf(sec);
      const svg = L.querySelector('svg');
      const sr = sec.getBoundingClientRect();
      if (!sr.width) return;
      svg.setAttribute('width', sr.width); svg.setAttribute('height', sr.height);
      svg.innerHTML = '';
      L.querySelectorAll('.sticky').forEach(s => { if (!mine.some(h => h.id === s.dataset.hid && h.sticky)) s.remove(); });
      for (const h of mine) {
        const b = bboxOf(h, sr);
        const sup = sec.querySelector(`.hl-note-mark[data-hid="${h.id}"]`);
        const showSticky = h.sticky && !h.min && !notesHidden;
        if (sup) sup.style.display = (h.sticky && !showSticky) ? '' : 'none';
        if (!b) continue;
        if (h.k === 'circ') {
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          p.setAttribute('d', roughEllipse(b, h.id));
          p.setAttribute('fill', 'none'); p.setAttribute('stroke', STROKE[h.c] || STROKE.o);
          p.setAttribute('stroke-width', '2.6'); p.setAttribute('stroke-linecap', 'round');
          svg.appendChild(p);
        }
        const st = L.querySelector(`.sticky[data-hid="${h.id}"]`);
        if (!showSticky) { if (st) st.hidden = true; continue; }
        const el = stickyEl(h, L);
        el.hidden = false;
        const w = el.offsetWidth || 210, hh = el.offsetHeight || 90;
        let left = b.x + b.w / 2 - 30 + (h.dx || 0);
        let top = b.y - hh - 26 + (h.dy || 0);
        left = Math.max(-40, Math.min(sr.width - w + 40, left));
        el.style.left = left + 'px'; el.style.top = top + 'px';
        // 끈
        const ax = Math.min(Math.max(left + 24, b.x), b.x + b.w), ay = b.y - (h.k === 'circ' ? 8 : 2);
        const fx = left + 24, fy = top + hh - 4;
        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const mx = (fx + ax) / 2, my = (fy + ay) / 2 + 10;
        ln.setAttribute('d', `M${fx} ${fy} Q${mx} ${my} ${ax} ${ay}`);
        ln.setAttribute('fill', 'none'); ln.setAttribute('stroke', '#8a6d00'); ln.setAttribute('stroke-width', '1.4'); ln.setAttribute('stroke-dasharray', '4 3');
        svg.appendChild(ln);
        const pin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pin.setAttribute('cx', ax); pin.setAttribute('cy', ay); pin.setAttribute('r', 3.5); pin.setAttribute('fill', STROKE[h.c] || STROKE.o);
        svg.appendChild(pin);
      }
    }
    let tmr = 0;
    const layoutAll = () => { clearTimeout(tmr); tmr = setTimeout(() => sections.forEach(layoutSec), 30); };
    const ro = new ResizeObserver(layoutAll);
    sections.forEach(s => ro.observe(s));
    addEventListener('resize', layoutAll);
    document.addEventListener('toggle', layoutAll, true);
    document.fonts && document.fonts.ready.then(layoutAll);
    setTimeout(layoutAll, 600); setTimeout(layoutAll, 2000);

    /* ---------- 팝업 ---------- */
    const pop = document.createElement('div');
    pop.className = 'hl-pop'; pop.hidden = true;
    document.body.appendChild(pop);
    let pending = null;
    const dots = active => COLORS.map(([c, nm]) => `<button type="button" class="dot hl-${c}${c === active ? ' on' : ''}" data-c="${c}" title="${nm} 형광펜"></button>`).join('');
    function place(rect) {
      pop.hidden = false;
      const w = pop.offsetWidth, x = Math.max(8, Math.min(innerWidth - w - 8, rect.left + rect.width / 2 - w / 2));
      pop.style.left = (x + scrollX) + 'px';
      pop.style.top = (rect.bottom + scrollY + 10) + 'px';
    }
    const hidePop = () => { pop.hidden = true; pop.innerHTML = ''; };

    function showSelPop(rect) {
      pop.innerHTML = `<div class="row">${dots(curColor)}<span class="sep"></span>
        <button type="button" class="txt" data-act="circ">⭕ 동그라미</button>
        <button type="button" class="txt" data-act="circnote">⭕ + 📝</button>
        <button type="button" class="txt" data-act="hlnote">🖍 + 📝</button></div>`;
      pop.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.c) { curColor = b.dataset.c; S.set('hl-color', curColor); create('hl', false); refreshDock(); }
        else if (b.dataset.act === 'circ') create('circ', false);
        else if (b.dataset.act === 'circnote') create('circ', true);
        else if (b.dataset.act === 'hlnote') create('hl', true);
      };
      place(rect);
    }
    function showMarkPop(h, rect) {
      const isC = h.k === 'circ';
      pop.innerHTML = `<div class="row">${dots(h.c)}<span class="sep"></span>
        <button type="button" class="txt" data-act="kind">${isC ? '🖍 형광펜으로' : '⭕ 동그라미로'}</button>
        <button type="button" class="txt" data-act="note">${h.sticky ? (h.min || notesHidden ? '📝 메모 펼치기' : '📝 메모로 이동') : '📝 메모 붙이기'}</button>
        <button type="button" class="txt del" data-act="del">지우기</button></div>`;
      pop.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.c) { h.c = b.dataset.c; restyle(h); saveHl(); showMarkPop(h, rect); }
        else if (b.dataset.act === 'kind') { h.k = isC ? 'hl' : 'circ'; restyle(h); saveHl(); hidePop(); }
        else if (b.dataset.act === 'note') { openSticky(h); hidePop(); }
        else if (b.dataset.act === 'del') { unpaint(h.id); hls = hls.filter(x => x !== h); saveHl(); hidePop(); renderDrawer(); layoutSec(document.getElementById(h.sec)); }
      };
      place(rect);
    }
    function restyle(h) {
      document.querySelectorAll(`mark.hl[data-hid="${h.id}"]`).forEach(m => { m.className = markClass(h); });
      const st = document.querySelector(`.sticky[data-hid="${h.id}"]`);
      if (st) st.className = 'sticky st-' + h.c;
      layoutSec(document.getElementById(h.sec));
      renderDrawer();
    }
    function openSticky(h) {
      h.sticky = true; h.min = false;
      if (notesHidden) { notesHidden = false; S.set('notes-hidden', false); refreshDock(); }
      saveHl();
      const sec = document.getElementById(h.sec);
      layoutSec(sec);
      const el = sec.querySelector(`.sticky[data-hid="${h.id}"]`);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => el.querySelector('textarea').focus({ preventScroll: true }), 300); }
      renderDrawer();
    }

    function create(kind, withNote) {
      if (!pending) return;
      const sec = document.getElementById(pending.sec);
      const us = units(sec);
      const h = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), sec: pending.sec, s: pending.s, e: pending.e, k: kind, c: kind === 'circ' && curColor === 'y' ? 'o' : curColor, t: matchText(us, pending.s, pending.e), d: dispText(us, pending.s, pending.e), n: '', sticky: false };
      pending = null;
      getSelection().removeAllRanges();
      hidePop();
      if (!h.t.trim() || !paint(h)) return;
      hls.push(h); saveHl(); renderDrawer();
      if (withNote) openSticky(h); else layoutSec(sec);
    }

    function onSelection() {
      const sel = getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return;
      const r = sel.getRangeAt(0);
      const secOf = n => (n.nodeType === 1 ? n : n.parentElement)?.closest('section.card[id]');
      const sec = secOf(r.startContainer);
      if (!sec || sec !== secOf(r.endContainer)) return;
      const ca = r.commonAncestorContainer;
      if ((ca.nodeType === 1 ? ca : ca.parentElement).closest(SKIP)) return;
      const us = units(sec);
      const s = pointOff(us, r.startContainer, r.startOffset, false), e = pointOff(us, r.endContainer, r.endOffset, true);
      if (e <= s) return;
      pending = { sec: sec.id, s, e };
      if (penMode) create(penMode, false); else showSelPop(r.getBoundingClientRect());
    }
    const ignoreTarget = t => t.closest('.hl-pop,.note-dock,.note-drawer,.memo-box,.widget,.anim,.card-tools,.ann-layer,input,textarea,select');
    document.addEventListener('mouseup', e => { if (!ignoreTarget(e.target)) setTimeout(onSelection, 0); });
    document.addEventListener('touchend', e => { if (!ignoreTarget(e.target)) setTimeout(onSelection, 250); });
    document.addEventListener('mousedown', e => { if (!pop.hidden && !e.target.closest('.hl-pop')) hidePop(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { hidePop(); closeDrawer(); } });
    document.addEventListener('click', e => {
      const sup = e.target.closest('.hl-note-mark');
      if (sup) { const h = hls.find(x => x.id === sup.dataset.hid); if (h) openSticky(h); return; }
      const m = e.target.closest('mark.hl');
      if (!m || !getSelection().isCollapsed) return;
      const h = hls.find(x => x.id === m.dataset.hid);
      if (h) { e.preventDefault(); setTimeout(() => showMarkPop(h, m.getBoundingClientRect()), 0); }
    });

    /* ---------- 섹션 포스트잇 메모 ---------- */
    sections.forEach(sec => {
      let tools = sec.querySelector(':scope > .card-tools');
      if (!tools) { tools = document.createElement('div'); tools.className = 'card-tools'; sec.appendChild(tools); }
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'memo-btn'; btn.textContent = '✎ 메모';
      tools.prepend(btn);
      let box = null;
      const sync = () => btn.classList.toggle('has', !!(memos[sec.id] || '').trim());
      function open(focus) {
        if (!box) {
          box = document.createElement('div');
          box.className = 'memo-box';
          box.innerHTML = `<div class="memo-head"><span>내 메모</span><span class="memo-saved"></span><button type="button" class="memo-close" title="닫기">×</button></div><textarea placeholder="이 섹션에서 헷갈린 점, 외울 것, 교수님이 강조한 것…"></textarea>`;
          sec.insertBefore(box, tools);
          const ta = box.querySelector('textarea');
          ta.value = memos[sec.id] || '';
          const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.max(80, ta.scrollHeight + 2) + 'px'; };
          let t;
          ta.addEventListener('input', () => {
            fit(); clearTimeout(t);
            box.querySelector('.memo-saved').textContent = '…';
            t = setTimeout(() => {
              if (ta.value.trim()) memos[sec.id] = ta.value; else delete memos[sec.id];
              saveMemo(); sync(); renderDrawer();
              box.querySelector('.memo-saved').textContent = '저장됨 ✓';
            }, 400);
          });
          box.querySelector('.memo-close').onclick = () => { box.hidden = true; };
          requestAnimationFrame(fit);
        }
        box.hidden = false;
        if (focus) box.querySelector('textarea').focus();
      }
      btn.onclick = () => { if (box && !box.hidden) box.hidden = true; else open(true); };
      if ((memos[sec.id] || '').trim()) open(false);
      sec._openMemo = open;
      sync();
    });

    /* ---------- 오른쪽 아래 도구 + 모아보기 ---------- */
    const dock = document.createElement('div');
    dock.className = 'note-dock';
    dock.innerHTML = `<button type="button" class="dock-pen" title="누를 때마다 OFF → 형광펜 → 동그라미">펜 <b></b></button>
      <span class="dock-colors">${dots(curColor)}</span>
      <button type="button" class="dock-show" title="붙인 메모장 보이기/숨기기"></button>
      <button type="button" class="dock-open">📒 내 노트 <span class="cnt"></span></button>`;
    document.body.appendChild(dock);
    dock.querySelector('.dock-pen').onclick = () => { penMode = penMode === '' ? 'hl' : penMode === 'hl' ? 'circ' : ''; S.set('pen-mode', penMode); refreshDock(); };
    dock.querySelector('.dock-colors').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; curColor = b.dataset.c; S.set('hl-color', curColor); refreshDock(); };
    dock.querySelector('.dock-show').onclick = () => { notesHidden = !notesHidden; S.set('notes-hidden', notesHidden); refreshDock(); layoutAll(); };
    dock.querySelector('.dock-open').onclick = () => (drawer.classList.contains('open') ? closeDrawer() : openDrawer());
    function refreshDock() {
      dock.classList.toggle('pen-on', !!penMode);
      document.body.classList.toggle('pen-mode', !!penMode);
      dock.querySelector('.dock-pen b').textContent = penMode === 'hl' ? '🖍 형광펜' : penMode === 'circ' ? '⭕ 동그라미' : 'OFF';
      dock.querySelector('.dock-show').textContent = notesHidden ? '📝 메모 숨김' : '📝 메모 보임';
      dock.querySelector('.dock-show').classList.toggle('off', notesHidden);
      dock.querySelectorAll('.dock-colors .dot').forEach(d => d.classList.toggle('on', d.dataset.c === curColor));
      const n = hls.length + Object.keys(memos).length;
      dock.querySelector('.cnt').textContent = n ? n : '';
    }

    const drawer = document.createElement('aside');
    drawer.className = 'note-drawer';
    document.body.appendChild(drawer);
    function openDrawer() { renderDrawer(); drawer.classList.add('open'); }
    function closeDrawer() { drawer.classList.remove('open'); }
    function renderDrawer() {
      const order = sections.map(s => s.id);
      const ids = [...new Set([...Object.keys(memos), ...hls.map(h => h.sec)])].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      const body = ids.map(id => {
        const m = (memos[id] || '').trim();
        const hs = hls.filter(h => h.sec === id).sort((a, b) => a.s - b.s);
        return `<div class="nd-sec"><a href="#${id}" class="nd-title" data-jump="${id}">${esc(secTitle(id))}</a>
          ${m ? `<div class="nd-memo" data-memo="${id}">${esc(m)}</div>` : ''}
          ${hs.map(h => `<div class="nd-hl"><span class="chip ${h.k === 'circ' ? 'circ-chip' : 'hl-' + h.c}" style="${h.k === 'circ' ? 'border-color:' + STROKE[h.c] : ''}"></span><div><a href="#" data-hl="${h.id}" class="nd-q">${esc(h.d.length > 140 ? h.d.slice(0, 140) + '…' : h.d)}</a>${h.lost ? ' <i class="lost">(위치를 못 찾음)</i>' : ''}${(h.n || '').trim() ? `<div class="nd-note">📝 ${esc(h.n.trim())}</div>` : ''}</div><button type="button" class="x" data-del="${h.id}" title="지우기">×</button></div>`).join('')}
        </div>`;
      }).join('');
      drawer.innerHTML = `<div class="nd-head"><span class="nd-h">이 장의 내 노트</span><button type="button" class="pill small" data-act="copy">텍스트로 복사</button><button type="button" class="nd-close" title="닫기">×</button></div>
        <div class="nd-body">${body || '<p class="nd-empty">아직 아무것도 없어요.<br>본문 글자를 드래그해서 형광펜·⭕ 동그라미를 치거나 📝 메모를 붙여 보세요. 섹션 오른쪽 위 <b>✎ 메모</b> 버튼도 있어요.</p>'}</div>
        ${hls.length ? '<div class="nd-foot"><button type="button" class="pill small" data-act="clear">이 장 형광펜·동그라미 모두 지우기</button></div>' : ''}`;
    }
    drawer.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('.nd-close')) return closeDrawer();
      if (t.closest('[data-jump]')) { if (innerWidth < 900) closeDrawer(); return; }
      const memo = t.closest('[data-memo]');
      if (memo) { const sec = document.getElementById(memo.dataset.memo); sec.scrollIntoView({ block: 'start' }); sec._openMemo && sec._openMemo(true); if (innerWidth < 900) closeDrawer(); return; }
      const q = t.closest('[data-hl]');
      if (q) {
        e.preventDefault();
        const m = document.querySelector(`mark.hl[data-hid="${q.dataset.hl}"]`);
        if (m) { m.scrollIntoView({ block: 'center' }); document.querySelectorAll(`mark.hl[data-hid="${q.dataset.hl}"]`).forEach(x => { x.classList.remove('flash'); void x.offsetWidth; x.classList.add('flash'); }); }
        if (innerWidth < 900) closeDrawer();
        return;
      }
      const del = t.closest('[data-del]');
      if (del) { const h = hls.find(x => x.id === del.dataset.del); unpaint(del.dataset.del); hls = hls.filter(x => x.id !== del.dataset.del); saveHl(); renderDrawer(); h && layoutSec(document.getElementById(h.sec)); return; }
      const act = t.closest('[data-act]')?.dataset.act;
      if (act === 'clear' && confirm('이 장의 형광펜·동그라미(와 거기 붙은 메모장)를 모두 지울까요? 섹션 메모는 남아요.')) { hls.forEach(h => unpaint(h.id)); hls = []; saveHl(); renderDrawer(); layoutAll(); }
      if (act === 'copy') {
        const txt = [`[${document.title}] 내 노트`, ''].concat(
          [...new Set([...Object.keys(memos), ...hls.map(h => h.sec)])].map(id => {
            const lines = [`■ ${secTitle(id)}`];
            if ((memos[id] || '').trim()) lines.push('메모: ' + memos[id].trim());
            hls.filter(h => h.sec === id).forEach(h => lines.push(`${h.k === 'circ' ? '⭕' : '-'} “${h.d}”` + ((h.n || '').trim() ? `  → ${h.n.trim()}` : '')));
            return lines.join('\n') + '\n';
          })).join('\n');
        const done = () => { t.closest('button').textContent = '복사됨 ✓'; setTimeout(renderDrawer, 1200); };
        (navigator.clipboard?.writeText(txt) || Promise.reject()).then(done, () => { prompt('아래 내용을 복사하세요', txt); });
      }
    });

    renderDrawer();
    refreshDock();
    layoutAll();
  });
})();

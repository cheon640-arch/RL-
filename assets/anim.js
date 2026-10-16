/* 움직이는 그림(애니메이션)들. <div data-anim="이름"></div> 위치에 렌더링됨.
   화면에 보이면 자동 재생, 벗어나면 일시정지. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const C = { cream: '#fdfbf9', dew: '#f7efe9', ink: '#2b1a07', char: '#171717', orange: '#ff6f1e', sienna: '#ce500a', sky: '#3b82f6', pink: '#ff66cf', sprout: '#22c55e', mist: '#bebcbb', hole: '#e7f0ff', goal: '#fff0e6' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const fmt = (x, d = 2) => { const v = Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x; return v.toFixed(d).replace('-', '−'); };
  const SUB = n => String(n).split('').map(c => '₀₁₂₃₄₅₆₇₈₉'[+c]).join('');

  function mk(parent, tag, attrs = {}, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    parent.appendChild(e);
    return e;
  }
  function heat(v, vmax) {
    const t = clamp(v / vmax, 0, 1);
    const a = [253, 251, 249], b = [255, 111, 30];
    return `rgb(${a.map((x, i) => Math.round(lerp(x, b[i], t))).join(',')})`;
  }
  function tween(ms, fn, ctl) {
    const dur = ms / (ctl ? ctl.speed : 1);
    return new Promise(res => {
      const t0 = performance.now();
      function f(now) {
        const t = clamp((now - t0) / dur, 0, 1);
        fn(ease(t));
        if (t < 1) requestAnimationFrame(f); else res();
      }
      requestAnimationFrame(f);
    });
  }
  const arrowDefs = (svg, id, color) => {
    const d = mk(svg, 'defs');
    const m = mk(d, 'marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' });
    mk(m, 'path', { d: 'M0 0L10 5L0 10z', fill: color });
  };

  /* ---------- 공통 틀 + 재생 컨트롤 ---------- */
  function setup(root, title, spec) {
    root.classList.add('anim');
    root.innerHTML = `<div class="a-head"><span class="w-title">${title}</span><span class="a-badge">움직이는 그림</span></div>
      <div class="a-stage"></div><div class="a-cap"></div>
      <div class="a-ctrl">
        <button class="pill small a-play" type="button">▶ 재생</button>
        <button class="pill small a-step" type="button">한 단계 ▸</button>
        <button class="pill small a-reset" type="button">처음부터 ↺</button>
        <label>속도 <select class="a-speed"><option value="0.5">느리게</option><option value="1" selected>보통</option><option value="2">빠르게</option><option value="4">아주 빠르게</option></select></label>
        ${spec.extra || ''}
      </div>`;
    const ctl = { speed: 1, gen: 0 };
    let playing = false, busy = false, userPaused = false;
    const btn = root.querySelector('.a-play');
    const setPlaying = p => { playing = p; btn.textContent = p ? '⏸ 일시정지' : '▶ 재생'; root.classList.toggle('paused', !p); };
    const stage = () => root.querySelector('.a-stage');
    ctl.cap = html => { root.querySelector('.a-cap').innerHTML = html; };
    ctl.svg = (w, h) => {
      stage().innerHTML = '';
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('viewBox', `0 0 ${w} ${h}`);
      s.setAttribute('font-family', 'Geist, Gowun Dodum, sans-serif');
      stage().appendChild(s);
      return s;
    };
    ctl.alive = g => g === ctl.gen;

    function reset() { ctl.gen++; busy = false; spec.reset(ctl); }
    async function doStep() {
      if (busy) return true;
      busy = true;
      const g = ctl.gen;
      let cont;
      try { cont = await spec.step(ctl); } finally { if (g === ctl.gen) busy = false; }
      return g === ctl.gen ? cont : true;
    }
    async function loop() {
      const g = ctl.gen;
      while (playing && g === ctl.gen) {
        const cont = await doStep();
        if (!playing || g !== ctl.gen) return;
        if (cont === false) {
          await sleep(spec.endPause || 2600);
          if (!playing || g !== ctl.gen) return;
          reset();
          return loop();
        }
        await sleep((spec.delay || 900) / ctl.speed);
      }
    }
    function play() { if (playing) return; setPlaying(true); loop(); }
    function pause() { setPlaying(false); }

    btn.onclick = () => { if (playing) { userPaused = true; pause(); } else { userPaused = false; play(); } };
    root.querySelector('.a-step').onclick = async () => { userPaused = true; pause(); const c = await doStep(); if (c === false) { await sleep(1200); reset(); } };
    root.querySelector('.a-reset').onclick = () => { const was = playing; pause(); reset(); if (was) play(); };
    root.querySelector('.a-speed').onchange = e => { ctl.speed = +e.target.value; };
    root.querySelectorAll('.a-opt').forEach(o => o.addEventListener('change', () => { const was = playing; pause(); reset(); if (was) play(); }));
    ctl.opt = name => root.querySelector(`.a-opt[data-k="${name}"]`)?.value;

    reset();
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { if (!userPaused && !reduce) play(); }
      else pause();
    }), { threshold: 0.35 }).observe(root);
  }

  const AN = {};

  /* =============== 02. 에이전트-환경 루프 =============== */
  AN.loop = root => {
    const TX = {
      Airport: [['Airport', .7, -1], ['Seomyeon', .1, 10], ['Haeundae', .2, 20]],
      Seomyeon: [['Seomyeon', .2, -1], ['Airport', .3, 10], ['Haeundae', .5, 5]],
      Haeundae: [['Haeundae', .4, -1], ['Seomyeon', .2, 5], ['Airport', .4, 20]],
    };
    let el, s, t, phase, a, traj;
    setup(root, '에이전트와 환경이 주고받는 한 스텝', {
      delay: 700,
      reset(ctl) {
        const svg = ctl.svg(600, 260);
        arrowDefs(svg, 'lpA', C.ink);
        el = {};
        el.agent = mk(svg, 'rect', { x: 30, y: 85, width: 170, height: 90, rx: 14, class: 'tr', style: `fill:${C.cream}`, stroke: C.char, 'stroke-width': 1.5 });
        mk(svg, 'text', { x: 115, y: 117, 'text-anchor': 'middle', fill: C.ink, 'font-size': 17 }, 'Agent');
        el.sTxt = mk(svg, 'text', { x: 115, y: 152, 'text-anchor': 'middle', fill: C.sienna, 'font-family': 'Gaegu', 'font-size': 21 }, '');
        el.env = mk(svg, 'rect', { x: 400, y: 85, width: 170, height: 90, rx: 14, class: 'tr', style: `fill:${C.dew}`, stroke: C.char, 'stroke-width': 1.5 });
        mk(svg, 'text', { x: 485, y: 117, 'text-anchor': 'middle', fill: C.ink, 'font-size': 17 }, 'Environment');
        el.eTxt = mk(svg, 'text', { x: 485, y: 152, 'text-anchor': 'middle', fill: C.ink, 'font-size': 13 }, '택시 MDP');
        el.top = mk(svg, 'path', { d: 'M200 100 C 290 20, 310 20, 400 100', fill: 'none', stroke: C.ink, 'stroke-width': 1.5, 'marker-end': 'url(#lpA)' });
        el.bot = mk(svg, 'path', { d: 'M400 160 C 310 240, 290 240, 200 160', fill: 'none', stroke: C.ink, 'stroke-width': 1.5, 'marker-end': 'url(#lpA)' });
        el.tLab = mk(svg, 'text', { x: 300, y: 30, 'text-anchor': 'middle', fill: C.sienna, 'font-family': 'Gaegu', 'font-size': 21 }, 'action');
        el.bLab = mk(svg, 'text', { x: 300, y: 252, 'text-anchor': 'middle', fill: C.sienna, 'font-family': 'Gaegu', 'font-size': 21 }, 'reward, next state');
        el.tok = mk(svg, 'circle', { r: 10, fill: C.orange, stroke: C.char, 'stroke-width': 1.5, opacity: 0 });
        s = 'Airport'; t = 0; phase = 0; traj = [];
        ctl.cap('준비! 택시 기사(에이전트)가 서면·공항·해운대 사이를 돌아다녀요.');
      },
      async step(ctl) {
        const along = (path, d) => tween(d, u => { const L = path.getTotalLength(); const p = path.getPointAtLength(u * L); el.tok.setAttribute('cx', p.x); el.tok.setAttribute('cy', p.y); }, ctl);
        const hist = () => `<br><span style="font-family:var(--font-mono);font-size:13px">궤적: ${traj.slice(-4).join(' , ')} …</span>`;
        if (phase === 0) {
          el.sTxt.textContent = `S${SUB(t)} = ${s}`;
          el.agent.style.fill = '#ffe3d1'; await sleep(350 / ctl.speed); el.agent.style.fill = C.cream;
          ctl.cap(`<b>t = ${t}</b> · 에이전트가 현재 상태 <b>S${SUB(t)} = ${s}</b> 를 관측해요.` + hist());
          phase = 1; return true;
        }
        if (phase === 1) {
          a = Math.random() < 0.65 ? 'Wait' : 'Move→' + Object.keys(TX).filter(x => x !== s)[Math.random() < .5 ? 0 : 1];
          el.tLab.textContent = `A${SUB(t)} = ${a}`;
          el.tok.setAttribute('opacity', 1);
          ctl.cap(`정책 π(a|s) 에 따라 행동 <b>A${SUB(t)} = ${a}</b> 를 골라 환경에 보내요.` + hist());
          await along(el.top, 1000);
          phase = 2; return true;
        }
        let s2, r;
        if (a === 'Wait') {
          let u = Math.random(), acc = 0;
          for (const [n, p, rw] of TX[s]) { acc += p; if (u <= acc) { s2 = n; r = rw; break; } }
          if (!s2) { [s2, , r] = TX[s][TX[s].length - 1]; }
          el.eTxt.textContent = `p(s′|${s},Wait) 로 샘플`;
        } else { s2 = a.split('→')[1]; r = -5; el.eTxt.textContent = 'Move: 확정 이동, −5'; }
        el.env.style.fill = '#ffe3d1'; await sleep(300 / ctl.speed); el.env.style.fill = C.dew;
        el.bLab.textContent = `R${SUB(t + 1)} = ${r > 0 ? '+' : ''}${r},  S${SUB(t + 1)} = ${s2}`;
        traj.push(`S${SUB(t)}=${s.slice(0, 3)}`, `A${SUB(t)}=${a.replace('Move→', 'M→').slice(0, 7)}`, `R${SUB(t + 1)}=${r}`);
        ctl.cap(`환경이 보상 <b>R${SUB(t + 1)} = ${r}</b> 과 다음 상태 <b>S${SUB(t + 1)} = ${s2}</b> 를 돌려줘요. 다음 상태는 오직 (현재 상태, 행동)에만 의존 → 마르코프!` + hist());
        await along(el.bot, 1000);
        el.tok.setAttribute('opacity', 0);
        s = s2; t++; phase = 0;
        return t < 6;
      },
    });
  };

  /* =============== 02. 마르코프 체인 무작위 이동 =============== */
  AN.chain = root => {
    const names = ['Airport', 'Seomyeon', 'Haeundae'];
    const P = [[.7, .1, .2], [.3, .2, .5], [.4, .2, .4]];
    const pos = [[120, 235], [300, 70], [480, 235]];
    let pi = [1 / 3, 1 / 3, 1 / 3];
    for (let k = 0; k < 200; k++) pi = [0, 1, 2].map(j => pi.reduce((acc, x, i) => acc + x * P[i][j], 0));
    let el, cur, cnt, n;
    setup(root, '마르코프 체인: 택시가 확률에 따라 이동', {
      delay: 350,
      reset(ctl) {
        const svg = ctl.svg(780, 310);
        el = { hl: [] };
        const g = mk(svg, 'g');
        for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) mk(g, 'line', { x1: pos[i][0], y1: pos[i][1], x2: pos[j][0], y2: pos[j][1], stroke: C.mist, 'stroke-width': 1.5 });
        el.hlg = mk(svg, 'g');
        pos.forEach(([x, y], i) => {
          mk(svg, 'circle', { cx: x, cy: y + (i === 1 ? -44 : 44), r: 16, fill: 'none', stroke: C.mist, 'stroke-width': 1.5 });
          el['n' + i] = mk(svg, 'circle', { cx: x, cy: y, r: 40, class: 'tr', style: `fill:${C.cream}`, stroke: C.char, 'stroke-width': 1.5 });
          mk(svg, 'text', { x, y: y + 5, 'text-anchor': 'middle', fill: C.ink, 'font-size': 14 }, names[i]);
        });
        el.tok = mk(svg, 'circle', { r: 11, fill: C.orange, stroke: C.char, 'stroke-width': 1.5 });
        // 막대
        mk(svg, 'text', { x: 600, y: 40, fill: C.sienna, 'font-family': 'Gaegu', 'font-size': 20 }, '방문 비율');
        el.bars = names.map((nm, i) => {
          const y = 70 + i * 70;
          mk(svg, 'text', { x: 600, y: y - 6, fill: C.ink, 'font-size': 13 }, nm);
          mk(svg, 'rect', { x: 600, y, width: 160, height: 22, rx: 4, fill: C.dew, stroke: C.char, 'stroke-width': 1 });
          const b = mk(svg, 'rect', { x: 600, y, width: 0, height: 22, rx: 4, fill: C.orange });
          mk(svg, 'line', { x1: 600 + 160 * pi[i], x2: 600 + 160 * pi[i], y1: y - 4, y2: y + 26, stroke: C.char, 'stroke-width': 2, 'stroke-dasharray': '3 2' });
          const tx = mk(svg, 'text', { x: 600, y: y + 40, fill: C.ink, 'font-size': 12, 'font-family': 'JetBrains Mono' }, '');
          return { b, tx };
        });
        mk(svg, 'text', { x: 600, y: 290, fill: C.ink, 'font-size': 12 }, '점선 = 장기적으로 머무는 비율');
        cur = 1; cnt = [0, 0, 0]; n = 0;
        el.tok.setAttribute('cx', pos[cur][0]); el.tok.setAttribute('cy', pos[cur][1] - 52);
        ctl.cap('택시가 서면에서 출발해요. 다음 위치는 <b>지금 위치만 보고</b> 확률적으로 정해져요.');
      },
      async step(ctl) {
        // 현재 노드에서 나가는 확률 강조
        el.hlg.innerHTML = '';
        [0, 1, 2].forEach(j => { if (j !== cur) mk(el.hlg, 'line', { x1: pos[cur][0], y1: pos[cur][1], x2: pos[j][0], y2: pos[j][1], stroke: C.orange, 'stroke-width': 1 + 12 * P[cur][j], 'stroke-opacity': .55, 'stroke-linecap': 'round' }); });
        let u = Math.random(), nx = 2, acc = 0;
        for (let j = 0; j < 3; j++) { acc += P[cur][j]; if (u <= acc) { nx = j; break; } }
        ctl.cap(`지금 <b>${names[cur]}</b> → 다음 확률 ${names.map((nm, j) => `${nm} ${P[cur][j]}`).join(', ')} → 🎲 <b>${names[nx]}</b>` +
          `<br><span style="font-size:14px">과거 경로는 전혀 안 봐요 (마르코프 성질). 많이 돌수록 방문 비율이 점선에 수렴해요.</span>`);
        const [x0, y0] = [+el.tok.getAttribute('cx'), +el.tok.getAttribute('cy')];
        let [x1, y1] = pos[nx];
        if (nx === cur) { y1 += nx === 1 ? -52 : 52; await tween(450, t => { el.tok.setAttribute('cy', y0 + Math.sin(t * Math.PI) * (nx === 1 ? -14 : 14)); }, ctl); }
        else { y1 += nx === 1 ? -52 : 52; await tween(550, t => { el.tok.setAttribute('cx', lerp(x0, x1, t)); el.tok.setAttribute('cy', lerp(y0, y1, t)); }, ctl); }
        el.tok.setAttribute('cx', x1); el.tok.setAttribute('cy', y1);
        el['n' + nx].style.fill = '#ffe3d1'; setTimeout(() => { el['n' + nx].style.fill = C.cream; }, 250);
        cur = nx; cnt[nx]++; n++;
        el.bars.forEach((o, i) => { const f = cnt[i] / n; o.b.setAttribute('width', 160 * f); o.tx.textContent = `${(f * 100).toFixed(1)}%  (이론 ${(pi[i] * 100).toFixed(1)}%)`; });
        return n < 300;
      },
    });
  };

  /* =============== 03. 백업 다이어그램 (기대 vs 최적) =============== */
  AN.backup = root => {
    let el, k;
    setup(root, '백업: 아래(다음 상태)의 값을 위로 끌어올리기', {
      delay: 1300, endPause: 3200,
      extra: `<label>방정식 <select class="a-opt" data-k="mode"><option value="exp">기대 방정식 (π: L 0.5, R 0.5)</option><option value="opt">최적 방정식 (max)</option></select></label>`,
      reset(ctl) {
        const svg = ctl.svg(620, 300);
        el = {};
        const R = [300, 50], AL = [170, 150], AR = [450, 150], SL = [170, 250], SR = [450, 250];
        const line = (a, b, attrs = {}) => mk(svg, 'line', Object.assign({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.ink, 'stroke-width': 1.4 }, attrs));
        line(R, AL); line(R, AR); line(AL, SL); line(AR, SR);
        const flow = (a, b) => { const l = line(a, b, { stroke: C.orange, 'stroke-width': 5, 'stroke-linecap': 'round' }); const L = Math.hypot(b[0] - a[0], b[1] - a[1]); l.setAttribute('stroke-dasharray', L); l.setAttribute('stroke-dashoffset', L); l._L = L; return l; };
        el.fSL = flow(SL, AL); el.fSR = flow(SR, AR); el.fAL = flow(AL, R); el.fAR = flow(AR, R);
        el.root = mk(svg, 'circle', { cx: R[0], cy: R[1], r: 28, class: 'tr', style: `fill:${C.cream}`, stroke: C.char, 'stroke-width': 1.6 });
        mk(svg, 'text', { x: R[0], y: R[1] + 5, 'text-anchor': 'middle', fill: C.ink, 'font-size': 14 }, 's=0');
        el.rootV = mk(svg, 'text', { x: R[0] + 40, y: R[1] + 6, fill: C.sienna, 'font-family': 'JetBrains Mono', 'font-size': 15 }, '');
        [AL, AR].forEach((p, i) => { mk(svg, 'circle', { cx: p[0], cy: p[1], r: 9, fill: C.char }); });
        mk(svg, 'text', { x: AL[0] - 16, y: AL[1] - 18, 'text-anchor': 'end', fill: C.ink, 'font-size': 13 }, 'a = L,  r = −1');
        mk(svg, 'text', { x: AR[0] + 16, y: AR[1] - 18, fill: C.ink, 'font-size': 13 }, 'a = R,  r = +1');
        el.qL = mk(svg, 'text', { x: AL[0] - 18, y: AL[1] + 6, 'text-anchor': 'end', fill: C.sienna, 'font-family': 'JetBrains Mono', 'font-size': 14 }, '');
        el.qR = mk(svg, 'text', { x: AR[0] + 18, y: AR[1] + 6, fill: C.sienna, 'font-family': 'JetBrains Mono', 'font-size': 14 }, '');
        el.sl = mk(svg, 'circle', { cx: SL[0], cy: SL[1], r: 26, class: 'tr', style: `fill:${C.cream}`, stroke: C.char, 'stroke-width': 1.5 });
        el.sr = mk(svg, 'circle', { cx: SR[0], cy: SR[1], r: 26, class: 'tr', style: `fill:${C.cream}`, stroke: C.char, 'stroke-width': 1.5 });
        mk(svg, 'text', { x: SL[0], y: SL[1] + 5, 'text-anchor': 'middle', fill: C.ink, 'font-size': 13 }, "s′=0");
        mk(svg, 'text', { x: SR[0], y: SR[1] + 5, 'text-anchor': 'middle', fill: C.ink, 'font-size': 13 }, "s′=1");
        el.vL = mk(svg, 'text', { x: SL[0] + 36, y: SL[1] + 6, fill: C.sienna, 'font-family': 'JetBrains Mono', 'font-size': 14 }, '');
        el.vR = mk(svg, 'text', { x: SR[0] + 36, y: SR[1] + 6, fill: C.sienna, 'font-family': 'JetBrains Mono', 'font-size': 14 }, '');
        k = 0;
        ctl.cap('사과 로봇, 상태 0 에서의 가치를 계산해 봐요 (γ = 0.9). 흰 원 = 상태, 검은 점 = 행동.');
      },
      async step(ctl) {
        const opt = ctl.opt('mode') === 'opt';
        const v = opt ? [5.263, 4.737] : [-2.25, -2.75];
        const vn = opt ? 'v*' : 'v_π';
        const qL = -1 + 0.9 * v[0], qR = 1 + 0.9 * v[1];
        const draw = (l, ms) => tween(ms, t => l.setAttribute('stroke-dashoffset', l._L * (1 - t)), ctl);
        k++;
        if (k === 1) {
          el.sl.style.fill = C.dew; el.sr.style.fill = C.dew;
          el.vL.textContent = `${vn}(0) = ${fmt(v[0])}`; el.vR.textContent = `${vn}(1) = ${fmt(v[1])}`;
          ctl.cap(`① 다음 상태들의 가치 ${vn}(s′) 를 이미 알고 있다고 해요 (맨 아래).`);
          return true;
        }
        if (k === 2) {
          ctl.cap(`② 각 행동마다: <b>q(s,a) = r + γ·${vn}(s′)</b><br>L: −1 + 0.9×(${fmt(v[0])}) = <b>${fmt(qL, 3)}</b> &nbsp;&nbsp; R: +1 + 0.9×(${fmt(v[1])}) = <b>${fmt(qR, 3)}</b>`);
          await Promise.all([draw(el.fSL, 900), draw(el.fSR, 900)]);
          el.qL.textContent = `q = ${fmt(qL, 3)}`; el.qR.textContent = `q = ${fmt(qR, 3)}`;
          return true;
        }
        if (k === 3) {
          if (opt) {
            ctl.cap(`③ 최적 방정식: 행동들 중 <b>최댓값</b>을 취해요 → max(${fmt(qL, 3)}, ${fmt(qR, 3)}) = <b>${fmt(Math.max(qL, qR), 3)}</b> (R 쪽만 위로 올라감)`);
            el.fAL.setAttribute('stroke', C.mist); el.fAL.setAttribute('stroke-width', 2);
            await Promise.all([draw(el.fAL, 900), draw(el.fAR, 900)]);
            el.rootV.textContent = `v*(0) = ${fmt(Math.max(qL, qR), 3)}`;
          } else {
            ctl.cap(`③ 기대 방정식: 정책 확률로 <b>평균</b>을 내요 → 0.5×(${fmt(qL, 3)}) + 0.5×(${fmt(qR, 3)}) = <b>${fmt(0.5 * qL + 0.5 * qR, 3)}</b>`);
            await Promise.all([draw(el.fAL, 900), draw(el.fAR, 900)]);
            el.rootV.textContent = `v_π(0) = ${fmt(0.5 * qL + 0.5 * qR, 3)}`;
          }
          el.root.style.fill = '#ffe3d1';
          return true;
        }
        ctl.cap(opt ? '✔ 결과가 맨 아래 v*(0)=5.263 과 똑같죠? 그래서 v* 는 벨만 <b>최적</b> 방정식의 해(고정점)예요. 위의 “방정식” 선택을 바꿔 기대 방정식도 보세요.'
          : '✔ 결과가 아래의 v_π(0)=−2.25 와 똑같죠? 그래서 v_π 는 벨만 <b>기대</b> 방정식을 만족해요. 위의 “방정식”을 최적(max)으로 바꿔 보세요.');
        return false;
      },
    });
  };

  /* =============== 03. 축약사상: 여러 점이 v* 로 모이기 =============== */
  AN.contract = root => {
    const lo = -22, hi = 22, X = x => 50 + (x - lo) / (hi - lo) * 380, Y = y => 420 - (y - lo) / (hi - lo) * 380;
    const T = (v, g) => [Math.max(-1 + g * v[0], 1 + g * v[1]), Math.max(0 + g * v[0], -1 + g * v[1])];
    const cols = [C.orange, C.sky, C.sprout, C.pink];
    let el, pts, trails, k, dPrev, g;
    const spread = ps => { let m = 0; ps.forEach(a => ps.forEach(b => { m = Math.max(m, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])); })); return m; };
    setup(root, '축약사상 T: 어디서 시작하든 v* 로 빨려 들어가요', {
      delay: 380, endPause: 3000,
      extra: `<label>γ <select class="a-opt" data-k="g"><option>0.5</option><option selected>0.8</option><option>0.9</option></select></label>`,
      reset(ctl) {
        g = +ctl.opt('g');
        const svg = ctl.svg(640, 450);
        el = {};
        for (let v = -20; v <= 20; v += 10) {
          mk(svg, 'line', { x1: X(v), x2: X(v), y1: Y(lo), y2: Y(hi), stroke: C.dew, 'stroke-width': v === 0 ? 2 : 1 });
          mk(svg, 'line', { y1: Y(v), y2: Y(v), x1: X(lo), x2: X(hi), stroke: C.dew, 'stroke-width': v === 0 ? 2 : 1 });
          mk(svg, 'text', { x: X(v), y: 440, 'text-anchor': 'middle', fill: C.mist, 'font-size': 11 }, v);
          mk(svg, 'text', { x: 40, y: Y(v) + 4, 'text-anchor': 'end', fill: C.mist, 'font-size': 11 }, v);
        }
        mk(svg, 'rect', { x: X(lo), y: Y(hi), width: 380, height: 380, fill: 'none', stroke: C.char, 'stroke-width': 1 });
        mk(svg, 'text', { x: 430, y: 412, 'text-anchor': 'end', fill: C.ink, 'font-size': 13 }, 'v(0) →');
        mk(svg, 'text', { x: 56, y: 52, fill: C.ink, 'font-size': 13 }, '↑ v(1)');
        el.box = mk(svg, 'rect', { fill: 'rgba(255,111,30,.06)', stroke: C.orange, 'stroke-width': 1.2, 'stroke-dasharray': '5 4' });
        const vs = [1 / (1 - g * g), g / (1 - g * g)];
        el.star = mk(svg, 'text', { x: X(vs[0]), y: Y(vs[1]) + 8, 'text-anchor': 'middle', 'font-size': 24, fill: C.char }, '★');
        mk(svg, 'text', { x: X(vs[0]) + 14, y: Y(vs[1]) - 10, fill: C.char, 'font-size': 13 }, `v* = (${vs[0].toFixed(2)}, ${vs[1].toFixed(2)})`);
        pts = cols.map(() => [Math.random() * 40 - 20, Math.random() * 40 - 20]);
        trails = pts.map((p, i) => mk(svg, 'polyline', { points: `${X(p[0])},${Y(p[1])}`, fill: 'none', stroke: cols[i], 'stroke-width': 1.5, 'stroke-opacity': .6 }));
        el.dots = pts.map((p, i) => mk(svg, 'circle', { cx: X(p[0]), cy: Y(p[1]), r: 7, fill: cols[i], stroke: C.char, 'stroke-width': 1.2 }));
        // 거리 그래프
        mk(svg, 'text', { x: 460, y: 50, fill: C.sienna, 'font-family': 'Gaegu', 'font-size': 20 }, '최대 거리 ‖·‖∞');
        mk(svg, 'line', { x1: 460, x2: 620, y1: 230, y2: 230, stroke: C.char });
        el.dg = mk(svg, 'polyline', { points: '', fill: 'none', stroke: C.orange, 'stroke-width': 2 });
        el.dtxt = mk(svg, 'text', { x: 460, y: 255, fill: C.ink, 'font-size': 12, 'font-family': 'JetBrains Mono' }, '');
        k = 0; dPrev = spread(pts); el.d0 = dPrev; el.dpts = [[460, 70]];
        drawBox();
        ctl.cap(`서로 다른 4개의 시작 가치함수 v = (v(0), v(1)) 에 벨만 최적 연산자 T 를 반복 적용해요 (사과 로봇, γ = ${g}).`);
      },
      async step(ctl) {
        const nx = pts.map(p => T(p, g));
        const old = pts.map(p => p.slice());
        await tween(500, t => { el.dots.forEach((d, i) => { d.setAttribute('cx', X(lerp(old[i][0], nx[i][0], t))); d.setAttribute('cy', Y(lerp(old[i][1], nx[i][1], t))); }); }, ctl);
        pts = nx; k++;
        trails.forEach((tr, i) => tr.setAttribute('points', tr.getAttribute('points') + ` ${X(pts[i][0])},${Y(pts[i][1])}`));
        drawBox();
        const d = spread(pts);
        el.dpts.push([460 + k * 5, 230 - 160 * d / el.d0]);
        el.dg.setAttribute('points', el.dpts.map(p => p.join(',')).join(' '));
        el.dtxt.textContent = `k=${k}: ${d.toFixed(3)}`;
        ctl.cap(`<b>k = ${k}</b> · 점들 사이 최대 거리 ${dPrev.toFixed(2)} → <b>${d.toFixed(2)}</b> (비율 ${(d / dPrev).toFixed(2)} ≤ γ = ${g}). 주황 점선 상자가 계속 줄어들어요 → <b>축약!</b>`);
        dPrev = d;
        if (d < 0.03 || k >= 30) { ctl.cap(`✔ 4개 점 모두 ★ v* 에 도착! 시작점과 상관없이 <b>유일한 고정점</b> v* = T v* 로 수렴 → 바나흐 고정점 정리 (k = ${k})`); return false; }
        return true;
      },
    });
    function drawBox() {
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = X(Math.min(...xs)), x1 = X(Math.max(...xs)), y0 = Y(Math.max(...ys)), y1 = Y(Math.min(...ys));
      el.box.setAttribute('x', x0 - 6); el.box.setAttribute('y', y0 - 6); el.box.setAttribute('width', x1 - x0 + 12); el.box.setAttribute('height', y1 - y0 + 12);
    }
  };

  /* =============== FrozenLake 공통 =============== */
  const FL = { map: ['SFFF', 'FHFH', 'FFFH', 'HFFG'], acts: [[0, -1], [1, 0], [0, 1], [-1, 0]], deg: [180, 90, 0, -90], names: ['←', '↓', '→', '↑'] };
  FL.type = i => FL.map[(i / 4) | 0][i % 4];
  FL.term = i => 'HG'.includes(FL.type(i));
  FL.step = (i, a) => { const r = clamp(((i / 4) | 0) + FL.acts[a][0], 0, 3), c = clamp(i % 4 + FL.acts[a][1], 0, 3); const j = r * 4 + c; return [j, FL.type(j) === 'G' ? 10 : 0]; };
  FL.q = (V, s, a) => { const [j, r] = FL.step(s, a); return r + 0.9 * V[j]; };
  function flGrid(svg, x0, y0, size) {
    const cells = [];
    for (let s = 0; s < 16; s++) {
      const x = x0 + (s % 4) * size, y = y0 + ((s / 4) | 0) * size, t = FL.type(s);
      const g = mk(svg, 'g');
      const rect = mk(g, 'rect', { x: x + 2, y: y + 2, width: size - 4, height: size - 4, rx: 8, class: 'tr', style: `fill:${t === 'H' ? C.hole : t === 'G' ? C.goal : C.cream}`, stroke: C.char, 'stroke-width': 1 });
      mk(g, 'text', { x: x + size - 8, y: y + 14, 'text-anchor': 'end', fill: C.mist, 'font-size': 10 }, s);
      let val = null, arr = null;
      if (t === 'H' || t === 'G') mk(g, 'text', { x: x + size / 2, y: y + size / 2 + 7, 'text-anchor': 'middle', fill: t === 'H' ? C.sky : C.orange, 'font-size': 20, 'font-weight': 700 }, t);
      else {
        val = mk(g, 'text', { x: x + size / 2, y: y + 20, 'text-anchor': 'middle', fill: C.ink, 'font-size': 12, 'font-family': 'JetBrains Mono' }, '0.00');
        arr = mk(g, 'text', { x: x + size / 2, y: y + size / 2 + 14, 'text-anchor': 'middle', fill: C.sienna, 'font-size': 22, class: 'rot' }, '➜');
      }
      if (t === 'S') mk(g, 'text', { x: x + 8, y: y + 14, fill: C.mist, 'font-size': 10 }, 'S');
      cells.push({ rect, val, arr, t });
    }
    return cells;
  }

  /* =============== 04. 정책 이터레이션: 평가 ↔ 개선 =============== */
  AN.pi = root => {
    let el, V, pol, phase, sweep, it;
    setup(root, '정책 이터레이션: 평가로 가치를 채우고, 개선으로 화살표를 돌리고', {
      delay: 650, endPause: 3500,
      reset(ctl) {
        const svg = ctl.svg(640, 300);
        el = { cells: flGrid(svg, 20, 20, 66) };
        el.phase = mk(svg, 'text', { x: 310, y: 60, fill: C.ink, 'font-family': 'Fraunces', 'font-size': 30, 'font-weight': 600 }, '');
        el.sub = mk(svg, 'text', { x: 310, y: 92, fill: C.sienna, 'font-family': 'Gaegu', 'font-size': 21 }, '');
        el.it = mk(svg, 'text', { x: 310, y: 130, fill: C.ink, 'font-size': 14 }, '');
        // 사이클 그림
        mk(svg, 'text', { x: 310, y: 190, fill: C.ink, 'font-size': 13 }, '색 = 가치 (진할수록 큼)');
        for (let i = 0; i <= 10; i++) mk(svg, 'rect', { x: 310 + i * 26, y: 200, width: 26, height: 14, fill: heat(i, 10) });
        mk(svg, 'text', { x: 310, y: 232, fill: C.mist, 'font-size': 11 }, '0'); mk(svg, 'text', { x: 586, y: 232, fill: C.mist, 'font-size': 11, 'text-anchor': 'end' }, '10');
        mk(svg, 'text', { x: 310, y: 262, fill: C.ink, 'font-size': 13 }, '➜ = 현재 정책의 행동 (처음엔 전부 ←)');
        V = Array(16).fill(0); pol = Array(16).fill(0); phase = 'eval'; sweep = 0; it = 1;
        draw([]);
        el.phase.textContent = '시작'; el.sub.textContent = '초기 정책 π₀: 모든 칸에서 ←'; el.it.textContent = '';
        ctl.cap('FrozenLake (γ=0.9, 목표 보상 10). 엉망인 초기 정책(전부 왼쪽)에서 시작해 정책 이터레이션으로 최적 정책을 찾아가요.');
      },
      async step(ctl) {
        if (phase === 'eval') {
          const nv = V.map((_, s) => FL.term(s) ? 0 : FL.q(V, s, pol[s]));
          const diff = Math.max(...nv.map((x, i) => Math.abs(x - V[i])));
          V = nv; sweep++;
          draw([]);
          el.phase.textContent = '① 정책 평가'; el.sub.textContent = `evaluation · sweep ${sweep}`; el.it.textContent = `반복 ${it}회째: π${SUB(it - 1)} 의 가치 v_π 계산 중`;
          ctl.cap(`<b>정책 평가</b> (sweep ${sweep}): 화살표(정책)는 그대로 두고, 그 정책을 따랐을 때의 가치를 벨만 기대 방정식으로 갱신해요. 색이 목표에서부터 퍼져 나가요.`);
          if (diff < 1e-9) { phase = 'improve'; ctl.cap(`평가 수렴! 이제 이 가치 v_π${SUB(it - 1)} 를 보고 더 좋은 행동이 있는 칸을 찾아요.`); }
          return true;
        }
        // improve
        const changed = [];
        const np = pol.map((a, s) => {
          if (FL.term(s)) return a;
          const q = [0, 1, 2, 3].map(b => FL.q(V, s, b)); const m = Math.max(...q);
          if (Math.abs(q[a] - m) < 1e-9) return a;
          changed.push(s); return q.indexOf(m);
        });
        pol = np;
        el.phase.textContent = '② 정책 개선'; el.sub.textContent = 'improvement · π ← greedy(v)';
        draw(changed);
        if (!changed.length) {
          el.phase.textContent = '최적 정책 도달!'; el.sub.textContent = `개선해도 바뀌는 칸 0개 (총 ${it - 1}번 개선)`;
          ctl.cap('🎉 그리디하게 바꿔도 아무것도 안 바뀜 = 벨만 최적 방정식 만족 → <b>최적 정책 π*</b>. 시작점(0)에서 구멍을 피해 6칸 만에 목표로 가요.');
          return false;
        }
        ctl.cap(`<b>정책 개선</b>: 각 칸에서 q(s,a) = r + γ·v(s′) 가 가장 큰 행동으로 화살표를 돌려요. <b>${changed.length}개 칸</b>의 행동이 바뀜 (주황 테두리) → 정책 개선 정리에 의해 v_π′ ≥ v_π`);
        await sleep(900 / ctl.speed);
        phase = 'eval'; sweep = 0; it++;
        return true;
      },
    });
    function draw(changed) {
      el.cells.forEach((c, s) => {
        if (!c.val) return;
        c.rect.style.fill = heat(V[s], 10);
        c.val.textContent = V[s].toFixed(2);
        c.arr.style.transform = `rotate(${FL.deg[pol[s]]}deg)`;
        c.rect.setAttribute('stroke', changed.includes(s) ? C.orange : C.char);
        c.rect.setAttribute('stroke-width', changed.includes(s) ? 3.5 : 1);
      });
    }
  };

  /* =============== 04. 가치 이터레이션: 가치가 목표에서 번져 나감 =============== */
  AN.vi = root => {
    let el, V, k;
    setup(root, '가치 이터레이션: max 백업으로 가치가 목표에서부터 번져요', {
      delay: 900, endPause: 3000,
      extra: `<label>방식 <select class="a-opt" data-k="mode"><option value="sync">동기식 (sweep 단위)</option><option value="inplace">In-place (칸 하나씩, 15→0)</option></select></label>`,
      reset(ctl) {
        const svg = ctl.svg(640, 300);
        el = { cells: flGrid(svg, 20, 20, 66) };
        el.k = mk(svg, 'text', { x: 310, y: 60, fill: C.ink, 'font-family': 'Fraunces', 'font-size': 30, 'font-weight': 600 }, 'k = 0');
        el.sub = mk(svg, 'text', { x: 310, y: 95, fill: C.sienna, 'font-family': 'Gaegu', 'font-size': 21 }, '');
        el.fx = mk(svg, 'text', { x: 310, y: 140, fill: C.ink, 'font-size': 13, 'font-family': 'JetBrains Mono' }, '');
        el.fx2 = mk(svg, 'text', { x: 310, y: 162, fill: C.ink, 'font-size': 13, 'font-family': 'JetBrains Mono' }, '');
        mk(svg, 'text', { x: 310, y: 262, fill: C.ink, 'font-size': 13 }, '➜ = 지금 가치에 대한 그리디 행동');
        V = Array(16).fill(0); k = 0; el.cur = 15;
        draw([]);
        ctl.cap('V₀ = 0 에서 시작. 매번 v(s) ← max_a [ r + γ·v(s′) ] 로 갱신해요. 명시적인 정책 없이 가치만!');
      },
      async step(ctl) {
        const inplace = ctl.opt('mode') === 'inplace';
        if (!inplace) {
          const nv = V.map((_, s) => FL.term(s) ? 0 : Math.max(...[0, 1, 2, 3].map(a => FL.q(V, s, a))));
          const changed = nv.map((x, i) => Math.abs(x - V[i]) > 1e-9 ? i : -1).filter(i => i >= 0);
          V = nv; k++;
          draw(changed);
          el.k.textContent = `k = ${k}`; el.sub.textContent = changed.length ? `${changed.length}개 칸 갱신` : '변화 없음 → 수렴!';
          if (changed.length) {
            const s = changed[0]; const a = [0, 1, 2, 3].reduce((b, x) => FL.q(V, s, x) > FL.q(V, s, b) ? x : b, 0);
            el.fx.textContent = `예) V${SUB(k)}(${s}) = max_a [r + 0.9·V${SUB(k - 1)}(s′)]`;
            el.fx2.textContent = `      = ${V[s].toFixed(2)}  (${FL.names[a]})`;
          }
          ctl.cap(changed.length ? `<b>k = ${k}</b> · 동기식: 모든 칸을 이전 표 V${SUB(k - 1)} 로 한꺼번에 갱신. 가치가 목표에서 한 칸씩 퍼지며 0.9배씩 줄어요 (10 → 9 → 8.1 → 7.29 …).`
            : `✔ 더 이상 안 바뀜 → v* 도달 (k = ${k}). 화살표 = 최적 정책. 시작점 가치 5.9 = 10 × 0.9⁵`);
          return changed.length > 0;
        }
        // in-place: 한 칸씩
        let s = el.cur;
        while (s >= 0 && FL.term(s)) s--;
        if (s < 0) {
          k++;
          const any = el.sweepChanged; el.sweepChanged = false; el.cur = 15;
          el.k.textContent = `sweep ${k} 끝`;
          if (!any) { ctl.cap(`✔ sweep ${k} 동안 아무것도 안 바뀜 → 수렴! 동기식(k=6)보다 훨씬 적은 sweep 으로 끝나요.`); return false; }
          ctl.cap(`sweep ${k} 끝! In-place 는 방금 갱신한 값을 <b>같은 sweep 안에서 바로</b> 써서, 한 번에 여러 칸까지 가치가 전파돼요.`);
          return true;
        }
        const old = V[s];
        V[s] = Math.max(...[0, 1, 2, 3].map(a => FL.q(V, s, a)));
        if (Math.abs(V[s] - old) > 1e-9) el.sweepChanged = true;
        el.k.textContent = `sweep ${k + 1}`; el.sub.textContent = `칸 ${s} 갱신`;
        el.fx.textContent = `v(${s}) ← max_a [r + 0.9·v(s′)]`;
        el.fx2.textContent = `     = ${V[s].toFixed(2)}`;
        draw([s]);
        ctl.cap(`In-place: 칸 <b>${s}</b> 를 갱신하고 그 값을 <b>즉시</b> 표에 덮어써요 (값 표가 하나뿐).`);
        el.cur = s - 1;
        return true;
      },
    });
    function draw(changed) {
      el.cells.forEach((c, s) => {
        if (!c.val) return;
        c.rect.style.fill = heat(V[s], 10);
        c.val.textContent = V[s].toFixed(2);
        const q = [0, 1, 2, 3].map(a => FL.q(V, s, a)); const m = Math.max(...q);
        c.arr.style.transform = `rotate(${FL.deg[q.indexOf(m)]}deg)`;
        c.arr.style.opacity = m > 1e-9 ? 1 : 0.15;
        c.rect.setAttribute('stroke', changed.includes(s) ? C.orange : C.char);
        c.rect.setAttribute('stroke-width', changed.includes(s) ? 3.5 : 1);
      });
    }
  };

  /* =============== 04. GPI 지그재그 =============== */
  AN.gpi = root => {
    let el, y, n, side, pts;
    const top = [280, 50];
    const L1 = y => 60 + (300 - y) / 250 * 220, L2 = y => 500 - (300 - y) / 250 * 220;
    setup(root, 'GPI: 평가와 개선이 지그재그로 v*, π* 에서 만나요', {
      delay: 500, endPause: 3000,
      reset(ctl) {
        const svg = ctl.svg(560, 330);
        arrowDefs(svg, 'gpA', C.orange);
        el = {};
        mk(svg, 'line', { x1: 60, y1: 300, x2: top[0], y2: top[1], stroke: C.char, 'stroke-width': 2 });
        mk(svg, 'line', { x1: 500, y1: 300, x2: top[0], y2: top[1], stroke: C.char, 'stroke-width': 2 });
        mk(svg, 'text', { x: 70, y: 322, fill: C.ink, 'font-size': 15 }, 'v = v_π  (평가 목표)');
        mk(svg, 'text', { x: 490, y: 322, 'text-anchor': 'end', fill: C.ink, 'font-size': 15 }, 'π = greedy(v)  (개선 목표)');
        el.star = mk(svg, 'text', { x: top[0], y: top[1] - 8, 'text-anchor': 'middle', 'font-size': 26, class: 'tr', style: `fill:${C.mist}` }, '★');
        mk(svg, 'text', { x: top[0] + 22, y: top[1] - 14, fill: C.ink, 'font-size': 15 }, 'v*, π*');
        el.path = mk(svg, 'g');
        el.dot = mk(svg, 'circle', { r: 8, fill: C.orange, stroke: C.char, 'stroke-width': 1.4 });
        y = 300; n = 0; side = 0; pts = [[280, 300]];
        el.dot.setAttribute('cx', 280); el.dot.setAttribute('cy', 300);
        mk(svg, 'text', { x: 292, y: 296, fill: C.ink, 'font-size': 13 }, 'π₀, V₀');
        ctl.cap('아무 정책 π₀ 와 가치 V₀ 에서 시작해요.');
      },
      async step(ctl) {
        const ny = y - (y - top[1]) * 0.28;
        const nx = side === 0 ? L1(ny) : L2(ny);
        const [x0, y0] = pts[pts.length - 1];
        const ln = mk(el.path, 'line', { x1: x0, y1: y0, x2: x0, y2: y0, stroke: C.orange, 'stroke-width': 2, 'marker-end': 'url(#gpA)' });
        ctl.cap(side === 0 ? `<b>평가</b>: 정책은 고정, V 를 v_π 쪽으로 이동 (왼쪽 선으로) — “지금 정책이 얼마나 좋은가?”`
          : `<b>개선</b>: V 는 고정, π 를 greedy(V) 로 바꿈 (오른쪽 선으로) — “그 가치를 보고 더 좋은 행동으로!”`);
        await tween(650, t => { const x = lerp(x0, nx, t), yy = lerp(y0, ny, t); ln.setAttribute('x2', x); ln.setAttribute('y2', yy); el.dot.setAttribute('cx', x); el.dot.setAttribute('cy', yy); }, ctl);
        pts.push([nx, ny]); y = ny; side = 1 - side; n++;
        if (y - top[1] < 3) {
          await tween(400, t => { el.dot.setAttribute('cx', lerp(nx, top[0], t)); el.dot.setAttribute('cy', lerp(ny, top[1], t)); }, ctl);
          el.star.style.fill = C.orange;
          ctl.cap('✔ 서로 밀고 당기다 두 조건(v = v_π, π = greedy(v))을 <b>동시에</b> 만족하는 점에서 멈춰요 → 그게 바로 v*, π*. PI·VI·MC 제어·SARSA 모두 이 틀(GPI)!');
          return false;
        }
        return true;
      },
    });
  };

  /* =============== 05. MC 에피소드 → 뒤에서부터 G =============== */
  AN.mcep = root => {
    const ep = [[1, 'D', -1], [4, 'D', -1], [7, 'R', -1], [8, 'L', -1], [7, 'R', -1], [8, 'R', 0]];
    const states = [1, 4, 7, 8, 7, 8, 9];
    const cx = s => 20 + ((s - 1) % 3) * 92 + 46, cy = s => 20 + (((s - 1) / 3) | 0) * 92 + 46;
    let el, t, phase, G;
    setup(root, '몬테카를로: 끝까지 가 본 다음, 뒤에서부터 리턴 계산', {
      delay: 800, endPause: 3500,
      reset(ctl) {
        const svg = ctl.svg(660, 300);
        el = { cells: {} };
        for (let s = 1; s <= 9; s++) {
          el.cells[s] = mk(svg, 'rect', { x: cx(s) - 44, y: cy(s) - 44, width: 88, height: 88, rx: 8, class: 'tr', style: `fill:${s === 9 ? C.goal : C.cream}`, stroke: C.char, 'stroke-width': 1 });
          mk(svg, 'text', { x: cx(s) + 36, y: cy(s) - 30, 'text-anchor': 'end', fill: C.mist, 'font-size': 11 }, s === 9 ? 'G 9' : s === 1 ? 'S 1' : s);
        }
        el.q = {};
        el.path = mk(svg, 'polyline', { points: `${cx(1)},${cy(1)}`, fill: 'none', stroke: C.orange, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-opacity': .7 });
        el.agent = mk(svg, 'circle', { cx: cx(1), cy: cy(1), r: 13, fill: C.orange, stroke: C.char, 'stroke-width': 1.5 });
        mk(svg, 'text', { x: 310, y: 30, fill: C.sienna, 'font-family': 'Gaegu', 'font-size': 21 }, '메모리 (S, A, R)');
        el.rows = ep.map((e, i) => mk(svg, 'text', { x: 310, y: 62 + i * 30, fill: C.ink, 'font-size': 14, 'font-family': 'JetBrains Mono', opacity: 0 }, `t=${i}  (${e[0]}, ${e[1]}, ${e[2]})`));
        el.gs = ep.map((e, i) => mk(svg, 'text', { x: 470, y: 62 + i * 30, fill: C.sienna, 'font-size': 14, 'font-family': 'JetBrains Mono' }, ''));
        t = 0; phase = 'fwd'; G = 0;
        ctl.cap('3×3 격자 (목표 9, 매 스텝 −1, 목표 도달 0, γ=0.9). 에이전트가 정책대로 에피소드를 진행해요.');
      },
      async step(ctl) {
        if (phase === 'fwd') {
          const [s, a, r] = ep[t]; const s2 = states[t + 1];
          ctl.cap(`<b>t = ${t}</b>: S=${s}, A=${a}, R=${r} → 메모리에 <b>저장만</b> 해요. MC 는 아직 아무것도 업데이트 못 해요 (리턴을 모르니까).`);
          el.rows[t].setAttribute('opacity', 1);
          await tween(600, u => { el.agent.setAttribute('cx', lerp(cx(s), cx(s2), u)); el.agent.setAttribute('cy', lerp(cy(s), cy(s2), u)); }, ctl);
          el.path.setAttribute('points', el.path.getAttribute('points') + ` ${cx(s2)},${cy(s2)}`);
          t++;
          if (t === ep.length) { phase = 'end'; }
          return true;
        }
        if (phase === 'end') {
          el.cells[9].style.fill = '#ffd9c2';
          ctl.cap('🏁 목표 도착, 에피소드 끝! 이제야 리턴을 계산할 수 있어요. <b>뒤에서부터</b> g ← r + γ·g');
          phase = 'bwd'; t = ep.length - 1; return true;
        }
        if (phase === 'bwd') {
          const [s, a, r] = ep[t];
          const prev = G; G = r + 0.9 * G;
          el.cells[s].style.fill = '#ffd9c2';
          setTimeout(() => { el.cells[s].style.fill = C.cream; }, 500 / ctl.speed);
          el.gs[t].textContent = `G=${fmt(G)}`;
          const firstIdx = ep.findIndex(e => e[0] === s && e[1] === a);
          ctl.cap(`G${SUB(t)} = R + 0.9 × G${SUB(t + 1)} = ${r} + 0.9 × ${fmt(prev)} = <b>${fmt(G)}</b>` + (firstIdx !== t ? `<br>(${s},${a}) 는 t=${firstIdx} 에도 나와요 → first-visit MC 는 나중에 t=${firstIdx} 의 값으로 덮어써요.` : ''));
          if (firstIdx !== t) el.gs[t].setAttribute('opacity', .4);
          t--;
          if (t < 0) phase = 'upd';
          return true;
        }
        // 업데이트
        let g2 = 0; const Q = {};
        for (let i = ep.length - 1; i >= 0; i--) { g2 = ep[i][2] + 0.9 * g2; Q[ep[i][0] + ep[i][1]] = [ep[i][0], ep[i][1], g2]; }
        const svg = el.agent.ownerSVGElement;
        const off = { L: [-26, 4], R: [26, 4], D: [0, 30], U: [0, -22] };
        Object.values(Q).forEach(([s, a, g]) => {
          mk(svg, 'text', { x: cx(s) + off[a][0], y: cy(s) + off[a][1], 'text-anchor': 'middle', fill: C.sienna, 'font-size': 12, 'font-family': 'JetBrains Mono', 'font-weight': 700 }, fmt(g));
        });
        ctl.cap('✔ Q(S,A) ← Q + (1/N)(G − Q): Q(1,D)=−4.1, Q(4,D)=−3.44, Q(7,R)=−2.71, Q(8,L)=−1.9, Q(8,R)=0 (각 칸 안의 숫자). 에피소드가 <b>끝나야만</b> 한꺼번에 업데이트!');
        return false;
      },
    });
  };

  /* =============== 05. ε-greedy 룰렛 =============== */
  AN.spin = root => {
    const Q = [-1.2, 0.5, 0.3, -0.4], names = ['←', '↓', '→', '↑'], best = 1;
    let el, eps, probs, cnt, rot, n;
    const cxw = 140, cyw = 140, R = 110;
    setup(root, 'ε-greedy 룰렛: 대부분은 그리디, 가끔은 탐험', {
      delay: 400, endPause: 3000,
      extra: `<label>ε <select class="a-opt" data-k="eps"><option>0.1</option><option selected>0.3</option><option>0.6</option><option>1.0</option></select></label>`,
      reset(ctl) {
        eps = +ctl.opt('eps');
        probs = Q.map((_, a) => eps / 4 + (a === best ? 1 - eps : 0));
        const svg = ctl.svg(620, 290);
        el = {};
        let ang = -90;
        probs.forEach((p, a) => {
          const a0 = ang * Math.PI / 180, a1 = (ang + p * 360) * Math.PI / 180;
          const large = p > 0.5 ? 1 : 0;
          const d = p >= 0.9999 ? `M${cxw - R} ${cyw} a${R} ${R} 0 1 0 ${2 * R} 0 a${R} ${R} 0 1 0 ${-2 * R} 0` :
            `M${cxw} ${cyw} L${cxw + R * Math.cos(a0)} ${cyw + R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${cxw + R * Math.cos(a1)} ${cyw + R * Math.sin(a1)} Z`;
          mk(svg, 'path', { d, fill: a === best ? '#ffb37f' : [C.dew, '#e7f0ff', '#e8f7ee', '#fde7f6'][a], stroke: C.char, 'stroke-width': 1.2 });
          const mid = (ang + p * 180) * Math.PI / 180;
          if (p > 0.04) mk(svg, 'text', { x: cxw + R * .62 * Math.cos(mid), y: cyw + R * .62 * Math.sin(mid) + 6, 'text-anchor': 'middle', 'font-size': 18, fill: C.ink }, names[a]);
          ang += p * 360;
        });
        el.needle = mk(svg, 'g', { class: 'rot', style: 'transition: transform 1s cubic-bezier(.2,.8,.2,1)' });
        mk(el.needle, 'circle', { cx: cxw, cy: cyw, r: R + 14, fill: 'transparent' });
        mk(el.needle, 'line', { x1: cxw, y1: cyw, x2: cxw, y2: cyw - R + 8, stroke: C.char, 'stroke-width': 3.5, 'stroke-linecap': 'round' });
        mk(el.needle, 'circle', { cx: cxw, cy: cyw, r: 8, fill: C.char });
        mk(svg, 'text', { x: 330, y: 30, fill: C.sienna, 'font-family': 'Gaegu', 'font-size': 20 }, '뽑힌 횟수');
        el.bars = names.map((nm, a) => {
          const x = 340 + a * 66;
          mk(svg, 'line', { x1: x - 6, x2: x + 50, y1: 240, y2: 240, stroke: C.char });
          const b = mk(svg, 'rect', { x, y: 60, width: 44, height: 180, fill: a === best ? C.orange : C.char, class: 'barv', style: 'transform: scaleY(0)' });
          mk(svg, 'text', { x: x + 22, y: 260, 'text-anchor': 'middle', 'font-size': 16, fill: C.ink }, nm);
          const tx = mk(svg, 'text', { x: x + 22, y: 280, 'text-anchor': 'middle', 'font-size': 11, fill: C.ink, 'font-family': 'JetBrains Mono' }, `${(probs[a] * 100).toFixed(1)}%`);
          return { b, tx };
        });
        cnt = [0, 0, 0, 0]; rot = 0; n = 0;
        ctl.cap(`Q = [← −1.2, ↓ 0.5, → 0.3, ↑ −0.4] → 그리디 행동은 <b>↓</b>. ε = ${eps}: ↓ 확률 = ε/4 + 1−ε = ${probs[best].toFixed(3)}, 나머지 각 ${(eps / 4).toFixed(3)}`);
      },
      async step(ctl) {
        let u = Math.random(), a = 3, acc = 0;
        for (let i = 0; i < 4; i++) { acc += probs[i]; if (u <= acc) { a = i; break; } }
        const start = probs.slice(0, a).reduce((x, y) => x + y, 0) * 360;
        const target = start + probs[a] * 360 * (0.2 + Math.random() * 0.6);
        rot = rot - (rot % 360) + 720 + target;
        el.needle.style.transitionDuration = (1 / ctl.speed) + 's';
        el.needle.style.transform = `rotate(${rot}deg)`;
        await sleep(1050 / ctl.speed);
        cnt[a]++; n++;
        const mx = Math.max(...cnt);
        el.bars.forEach((o, i) => { o.b.style.transform = `scaleY(${cnt[i] / Math.max(mx, 1)})`; o.tx.textContent = `${cnt[i]}회`; });
        ctl.cap(`🎯 ${names[a]} ${a === best ? '<b>(그리디 행동 — 활용)</b>' : '<b style="color:var(--sky)">(탐험!)</b> 덕분에 Q 가 낮은 행동도 계속 시도해 봐요'} · 지금까지 ${n}번 중 그리디 ${cnt[best]}번 (${(cnt[best] / n * 100).toFixed(0)}%, 기대 ${(probs[best] * 100).toFixed(0)}%)`);
        return n < 40;
      },
    });
  };

  /* =============== 06. MC vs TD: 업데이트 타이밍 =============== */
  AN.mctd = root => {
    const N = 5, names = 'ABCDE', truth = [1, 2, 3, 4, 5].map(x => x / 6), alpha = 0.1;
    const X = i => 130 + i * 90; // i: 0..4, -1 왼쪽 끝, 5 오른쪽 끝
    const base = [150, 330];
    let el, Vm, Vt, pos, visited, ep, steps;
    setup(root, 'MC vs TD: 같은 경험, 다른 업데이트 타이밍', {
      delay: 420,
      reset(ctl) {
        const svg = ctl.svg(720, 360);
        el = { m: [], t: [] };
        [['MC', base[0], 'm'], ['TD(0)', base[1], 't']].forEach(([lab, y, key]) => {
          mk(svg, 'text', { x: 12, y: y - 40, fill: C.ink, 'font-family': 'Fraunces', 'font-size': 22, 'font-weight': 600 }, lab);
          mk(svg, 'line', { x1: 60, x2: 660, y1: y, y2: y, stroke: C.char, 'stroke-width': 1.2 });
          mk(svg, 'rect', { x: 40, y: y - 26, width: 40, height: 26, rx: 4, fill: C.dew, stroke: C.char });
          mk(svg, 'text', { x: 60, y: y - 8, 'text-anchor': 'middle', 'font-size': 12, fill: C.ink }, '0');
          mk(svg, 'rect', { x: 620, y: y - 26, width: 40, height: 26, rx: 4, fill: C.goal, stroke: C.char });
          mk(svg, 'text', { x: 640, y: y - 8, 'text-anchor': 'middle', 'font-size': 12, fill: C.orange, 'font-weight': 700 }, '+1');
          for (let i = 0; i < N; i++) {
            mk(svg, 'rect', { x: X(i) - 18, y: y - 120, width: 36, height: 120, fill: 'none', stroke: C.dew });
            const b = mk(svg, 'rect', { x: X(i) - 18, y: y - 120, width: 36, height: 120, fill: key === 'm' ? C.char : C.orange, class: 'barv', style: 'transform: scaleY(0.5)' });
            mk(svg, 'line', { x1: X(i) - 24, x2: X(i) + 24, y1: y - 120 * truth[i], y2: y - 120 * truth[i], stroke: C.sky, 'stroke-width': 2, 'stroke-dasharray': '4 3' });
            mk(svg, 'text', { x: X(i), y: y + 18, 'text-anchor': 'middle', 'font-size': 13, fill: C.ink }, names[i]);
            el[key].push(b);
          }
          el[key + 'err'] = mk(svg, 'text', { x: 680, y: y - 60, 'text-anchor': 'end', fill: C.ink, 'font-size': 12, 'font-family': 'JetBrains Mono' }, '');
          el[key + 'dot'] = mk(svg, 'circle', { cx: X(2), cy: y + 0, r: 9, fill: C.sprout, stroke: C.char, 'stroke-width': 1.3 });
        });
        mk(svg, 'text', { x: 300, y: 20, fill: C.sky, 'font-size': 12 }, '- - - 파란 점선 = 진짜 가치 v_π');
        Vm = Array(N).fill(0.5); Vt = Array(N).fill(0.5); pos = 2; visited = [2]; ep = 1; steps = 0;
        draw(); errs();
        ctl.cap('랜덤 워크: C 에서 시작해 왼쪽/오른쪽으로 50% 씩 이동, 오른쪽 끝에 닿으면 +1. 초기 V = 0.5, α = 0.1, γ = 1.');
      },
      async step(ctl) {
        const prev = pos; const nxt = pos + (Math.random() < .5 ? -1 : 1);
        const term = nxt < 0 || nxt >= N; const r = nxt >= N ? 1 : 0;
        const xTo = nxt < 0 ? 60 : nxt >= N ? 640 : X(nxt);
        await tween(320, u => ['m', 't'].forEach((k, j) => el[k + 'dot'].setAttribute('cx', lerp(X(prev), xTo, u))), ctl);
        // TD: 즉시
        const target = r + (term ? 0 : Vt[nxt]);
        const delta = target - Vt[prev];
        Vt[prev] += alpha * delta;
        flash(el.t[prev]);
        steps++;
        if (!term) {
          visited.push(nxt); pos = nxt;
          draw(); errs();
          ctl.cap(`에피소드 ${ep}, ${names[prev]} → ${names[nxt]} · <b>TD</b>: 방금 떠난 ${names[prev]} 를 <b>바로</b> 업데이트 (δ = ${r} + V(${names[nxt]}) − V(${names[prev]}) = ${fmt(delta, 3)}) · <b>MC</b>: 아직 기다리는 중…`);
          return true;
        }
        // MC: 에피소드 끝에 모든 방문 상태 업데이트 (every-visit, G = r)
        draw();
        ctl.cap(`에피소드 ${ep} 끝 (${r ? '+1 도착' : '왼쪽 끝, 0'}). <b>MC</b>: 이제야 G = ${r} 로 방문했던 ${[...new Set(visited)].map(i => names[i]).join(',')} 를 <b>한꺼번에</b> 업데이트!`);
        visited.forEach(i => { Vm[i] += alpha * (r - Vm[i]); });
        [...new Set(visited)].forEach(i => flash(el.m[i]));
        draw(); errs();
        await sleep(900 / ctl.speed);
        pos = 2; visited = [2]; ep++;
        ['m', 't'].forEach(k => el[k + 'dot'].setAttribute('cx', X(2)));
        return ep <= 60;
      },
      endPause: 4000,
    });
    function draw() { el.m.forEach((b, i) => b.style.transform = `scaleY(${Vm[i]})`); el.t.forEach((b, i) => b.style.transform = `scaleY(${Vt[i]})`); }
    function errs() {
      const rms = V => Math.sqrt(V.reduce((a, v, i) => a + (v - truth[i]) ** 2, 0) / N);
      el.merr.textContent = `RMS 오차 ${rms(Vm).toFixed(3)}`; el.terr.textContent = `RMS 오차 ${rms(Vt).toFixed(3)}`;
    }
    function flash(b) { b.style.fill = C.sprout; setTimeout(() => { b.style.fill = b === el.m[el.m.indexOf(b)] ? C.char : C.orange; }, 300); }
  };

  /* =============== 06. Eligibility trace =============== */
  AN.trace = root => {
    const N = 6, gamma = 0.95, alpha = 0.4;
    const X = i => 70 + i * 92;
    let el, V, E, pos, lam, ep, steps;
    setup(root, 'Eligibility trace: 지나온 길에 남는 “책임” 흔적', {
      delay: 550, endPause: 3500,
      extra: `<label>λ <select class="a-opt" data-k="lam"><option>0</option><option>0.5</option><option selected>0.8</option><option>1</option></select></label>`,
      reset(ctl) {
        lam = +ctl.opt('lam');
        const svg = ctl.svg(700, 300);
        el = { v: [], e: [], vt: [] };
        mk(svg, 'text', { x: 10, y: 40, fill: C.sienna, 'font-family': 'Gaegu', 'font-size': 19 }, '가치 V');
        mk(svg, 'text', { x: 10, y: 262, fill: C.sky, 'font-family': 'Gaegu', 'font-size': 19 }, 'trace E');
        for (let i = 0; i < N; i++) {
          mk(svg, 'rect', { x: X(i) - 16, y: 50, width: 32, height: 80, fill: 'none', stroke: C.dew });
          el.v.push(mk(svg, 'rect', { x: X(i) - 16, y: 50, width: 32, height: 80, fill: C.orange, class: 'barv', style: 'transform: scaleY(0)' }));
          el.vt.push(mk(svg, 'text', { x: X(i), y: 44, 'text-anchor': 'middle', 'font-size': 11, fill: C.ink, 'font-family': 'JetBrains Mono' }, '0.00'));
          mk(svg, 'circle', { cx: X(i), cy: 158, r: 20, fill: C.cream, stroke: C.char, 'stroke-width': 1.3 });
          mk(svg, 'text', { x: X(i), y: 163, 'text-anchor': 'middle', 'font-size': 13, fill: C.ink }, 's' + i);
          mk(svg, 'rect', { x: X(i) - 16, y: 186, width: 32, height: 70, fill: 'none', stroke: C.dew });
          el.e.push(mk(svg, 'rect', { x: X(i) - 16, y: 186, width: 32, height: 70, fill: C.sky, class: 'bard', style: 'transform: scaleY(0)' }));
        }
        mk(svg, 'line', { x1: 50, x2: X(N), y1: 158, y2: 158, stroke: C.mist, 'stroke-width': 1, 'stroke-dasharray': '3 3' });
        mk(svg, 'rect', { x: X(N) - 22, y: 136, width: 44, height: 44, rx: 6, fill: C.goal, stroke: C.char });
        mk(svg, 'text', { x: X(N), y: 163, 'text-anchor': 'middle', 'font-size': 13, fill: C.orange, 'font-weight': 700 }, 'G +1');
        el.agent = mk(svg, 'circle', { cx: X(0), cy: 158, r: 10, fill: C.orange, stroke: C.char, 'stroke-width': 1.4 });
        V = Array(N + 1).fill(0); E = Array(N + 1).fill(0); pos = 0; ep = 1; steps = 0;
        ctl.cap(`오른쪽으로 70%, 왼쪽으로 30% 확률로 걷다가 G 에 닿으면 +1 (γ = ${gamma}, λ = ${lam}, α = ${alpha}). 아래 파란 막대 = trace, 위 주황 막대 = 가치.`);
      },
      async step(ctl) {
        const s = pos, s2 = Math.max(0, s + (Math.random() < .7 ? 1 : -1));
        const term = s2 === N, r = term ? 1 : 0;
        await tween(350, u => el.agent.setAttribute('cx', lerp(X(s), X(s2), u)), ctl);
        const delta = r + gamma * (term ? 0 : V[s2]) - V[s];
        for (let i = 0; i < N; i++) E[i] *= gamma * lam;
        E[s] += 1;
        for (let i = 0; i < N; i++) V[i] += alpha * delta * E[i];
        steps++;
        draw(Math.abs(delta) > 1e-6);
        if (term) {
          ctl.cap(`🏁 G 도착! δ = ${r} + 0 − V(s${s}) = <b>${fmt(delta, 3)}</b>. 이 오차가 <b>trace 크기만큼</b> 지나온 상태들에 나눠져요: V(s) += α·δ·E(s). 최근·자주 방문한 상태일수록 더 많이! ` + (lam === 0 ? '(λ=0 이면 직전 상태만 → TD(0))' : lam === 1 ? '(λ=1 이면 MC 처럼 멀리까지)' : ''));
          await sleep(1800 / ctl.speed);
          E = Array(N + 1).fill(0); pos = 0; ep++; el.agent.setAttribute('cx', X(0)); draw(false);
          return ep <= 6;
        }
        pos = s2;
        ctl.cap(`에피소드 ${ep} · s${s} → s${s2}: 모든 trace 가 γλ = ${(gamma * lam).toFixed(2)} 배로 줄고, 방금 떠난 s${s} 의 trace 는 +1. ` + (Math.abs(delta) > 1e-6 ? `δ = ${fmt(delta, 3)} 를 trace 비율로 분배.` : 'δ = 0 이라 가치는 그대로.'));
        return true;
      },
    });
    function draw(glow) {
      for (let i = 0; i < N; i++) {
        el.e[i].style.transform = `scaleY(${Math.min(1, E[i] / 2)})`;
        el.v[i].style.transform = `scaleY(${clamp(V[i], 0, 1)})`;
        el.vt[i].textContent = V[i].toFixed(2);
        if (glow && E[i] > 0.01) { el.v[i].style.fill = C.sprout; setTimeout(() => { el.v[i].style.fill = C.orange; }, 400); }
      }
    }
  };

  /* =============== 06. Cliff: 학습된 경로를 걷는 두 에이전트 =============== */
  AN.cliffwalk = root => {
    const R = 4, Cn = 12, S = 36, x0 = 20, y0 = 30;
    // 교과서적 결과 경로 (Q-learning: 절벽 바로 위, SARSA: 맨 위로 우회)
    const qPath = [[3, 0], [2, 0], ...Array.from({ length: 11 }, (_, i) => [2, i + 1]), [3, 11]];
    const sPath = [[3, 0], [2, 0], [1, 0], [0, 0], ...Array.from({ length: 11 }, (_, i) => [0, i + 1]), [1, 11], [2, 11], [3, 11]];
    let el, i, mode, fell, ep;
    const P = ([r, c]) => [x0 + c * S + S / 2, y0 + r * S + S / 2];
    setup(root, 'Cliff Walking: 같은 ε-greedy 탐험, 다른 학습 결과', {
      delay: 160, endPause: 1500,
      reset(ctl) {
        const svg = ctl.svg(470, 240);
        el = {};
        for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) {
          const cl = r === 3 && c > 0 && c < 11;
          mk(svg, 'rect', { x: x0 + c * S + 1, y: y0 + r * S + 1, width: S - 2, height: S - 2, rx: 4, fill: cl ? C.hole : r === 3 && c === 11 ? C.goal : r === 3 && c === 0 ? C.dew : C.cream, stroke: cl ? C.sky : 'rgba(23,23,23,.2)' });
        }
        mk(svg, 'text', { x: x0 + S / 2, y: y0 + 3 * S + 23, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: C.ink }, 'S');
        mk(svg, 'text', { x: x0 + 11 * S + S / 2, y: y0 + 3 * S + 23, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: C.orange }, 'G');
        mk(svg, 'text', { x: x0 + 6 * S, y: y0 + 3 * S + 23, 'text-anchor': 'middle', 'font-size': 12, fill: C.sky }, 'The Cliff (−100)');
        const line = (p, col, dash) => mk(svg, 'polyline', { points: p.map(P).map(q => q.join(',')).join(' '), fill: 'none', stroke: col, 'stroke-width': 3, 'stroke-opacity': .5, 'stroke-dasharray': dash || '' });
        line(qPath, C.orange); line(sPath, C.sprout, '6 4');
        mk(svg, 'text', { x: x0, y: 18, fill: C.sienna, 'font-size': 13 }, '— Q-learning (최단, 절벽 옆)');
        mk(svg, 'text', { x: x0 + 230, y: 18, fill: '#15803d', 'font-size': 13 }, '- - SARSA (안전, 멀리 돌아감)');
        el.q = mk(svg, 'circle', { r: 9, fill: C.orange, stroke: C.char, 'stroke-width': 1.3 });
        el.s = mk(svg, 'circle', { r: 9, fill: C.sprout, stroke: C.char, 'stroke-width': 1.3 });
        [el.q, el.s].forEach(d => { const [x, y] = P([3, 0]); d.setAttribute('cx', x); d.setAttribute('cy', y); });
        el.boom = mk(svg, 'text', { x: 0, y: 0, 'font-size': 20, opacity: 0, 'text-anchor': 'middle' }, '💥');
        i = 0; fell = null; ep = 0;
        el.qi = 0; el.si = 0; el.qr = 0; el.sr = 0; el.qret = []; el.sret = [];
        ctl.cap('두 에이전트 모두 학습된 경로를 따라가지만 실제 행동은 <b>ε-greedy</b> (가끔 무작위로 한 칸 벗어남).');
      },
      async step(ctl) {
        // 각자 한 칸씩. 무작위로 아래로 미끄러지는 탐험 (ε=0.1)
        const move = (key, path) => {
          const idx = el[key + 'i'];
          const cur = path[idx];
          if (Math.random() < 0.1) {
            const down = [cur[0] + 1, cur[1]];
            if (down[0] === 3 && down[1] > 0 && down[1] < 11) return 'fall';
          }
          el[key + 'i'] = Math.min(idx + 1, path.length - 1);
          el[key + 'r'] -= 1;
          return el[key + 'i'] === path.length - 1 ? 'goal' : 'ok';
        };
        const resQ = move('q', qPath), resS = move('s', sPath);
        const place = (d, p) => { const [x, y] = P(p); d.setAttribute('cx', x); d.setAttribute('cy', y); };
        place(el.q, qPath[el.qi]); place(el.s, sPath[el.si]);
        let msg = '';
        for (const [k, res, path, nm] of [['q', resQ, qPath, 'Q-learning'], ['s', resS, sPath, 'SARSA']]) {
          if (res === 'fall') {
            const [x, y] = P([3, path[el[k + 'i']][1]]); el.boom.setAttribute('x', x); el.boom.setAttribute('y', y + 7); el.boom.setAttribute('opacity', 1);
            setTimeout(() => el.boom.setAttribute('opacity', 0), 500);
            el[k + 'r'] -= 100; el[k + 'ret'].push(el[k + 'r']); el[k + 'r'] = 0; el[k + 'i'] = 0; place(k === 'q' ? el.q : el.s, path[0]);
            msg += `💥 ${nm} 가 탐험하다 절벽에 떨어졌어요 (−100)! `;
          } else if (res === 'goal') {
            el[k + 'ret'].push(el[k + 'r']); el[k + 'r'] = 0; el[k + 'i'] = 0;
            msg += `🏁 ${nm} 도착! `;
          }
        }
        const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '–';
        ctl.cap((msg || 'Q-learning 은 절벽 바로 위 최단 경로(13칸), SARSA 는 위로 돌아가는 경로(17칸).') +
          `<br><span style="font-family:var(--font-mono);font-size:13px">평균 에피소드 보상 · Q-learning ${avg(el.qret)} (${el.qret.length}회) | SARSA ${avg(el.sret)} (${el.sret.length}회)</span>`);
        ep++;
        return ep < 400;
      },
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-anim]').forEach(n => { const f = AN[n.dataset.anim]; if (f) f(n); });
  });
})();

/* 인터랙티브 실습 위젯들. <div data-widget="이름"></div> 위치에 렌더링됨 */
(function () {
  const W = {};
  const f2 = x => (Math.abs(x) < 5e-3 ? 0 : x).toFixed(2);
  const f3 = x => (Math.abs(x) < 5e-4 ? 0 : x).toFixed(3);
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

  /* ---------- ch02: 할인된 return 계산기 ---------- */
  W.discount = (root) => {
    root.innerHTML = `<div class="w-title">직접 해보기: 할인율 γ 와 return</div>
      <div class="controls">
        <label>γ <input type="range" min="0" max="1" step="0.01" value="0.9" class="g"> <b class="gv">0.90</b></label>
        <label>보상 수열 R<sub>t+1</sub>, R<sub>t+2</sub>, … <input type="text" class="rs" value="1, 0, 0, 5, 0, 0, 0, 10" style="width:220px;font-family:var(--font-mono);border:1px solid #171717;border-radius:8px;padding:4px 8px;background:#fdfbf9"></label>
      </div>
      <div class="bars"></div><div class="bars-x"></div>
      <div class="readout"></div>`;
    const g = root.querySelector('.g'), rs = root.querySelector('.rs');
    function upd() {
      const gamma = +g.value;
      root.querySelector('.gv').textContent = gamma.toFixed(2);
      const r = rs.value.split(',').map(s => parseFloat(s)).filter(x => !isNaN(x));
      let G = 0; const terms = [];
      r.forEach((x, k) => { const w = Math.pow(gamma, k); G += w * x; terms.push(`${w.toFixed(3)}×${x}`); });
      const ws = r.map((_, k) => Math.pow(gamma, k));
      root.querySelector('.bars').innerHTML = ws.map(w => `<i style="height:${w * 100}%" title="γ^k=${w.toFixed(3)}"></i>`).join('');
      root.querySelector('.bars-x').innerHTML = ws.map((_, k) => `<span>k=${k}</span>`).join('');
      root.querySelector('.readout').textContent =
        `막대 = 각 보상에 곱해지는 가중치 γ^k\nG_t = ${terms.join(' + ')}\n    = ${G.toFixed(3)}\n` +
        (gamma < 0.3 ? '→ γ가 0에 가까움: 당장 받는 보상만 신경 쓰는 "근시안(myopic)"' :
         gamma > 0.9 ? '→ γ가 1에 가까움: 먼 미래 보상까지 챙기는 "원시안(far-sighted)"' : '');
    }
    g.oninput = upd; rs.oninput = upd; upd();
  };

  /* ---------- 사과 2-state 환경 ---------- */
  // s=0(왼쪽, 에이전트 시작), s=1(오른쪽, 사과). 0에서 R → 1로 가며 사과 +1. 1에서 L → 0 (보상 0). 벽에 부딪히면 -1, 제자리.
  const APPLE = { next: [[0, 1], [0, 1]], rew: [[-1, 1], [0, -1]] }; // [s][a], a: 0=L,1=R
  function evalPolicyApple(pi, gamma) { // pi[s] = [p(L), p(R)]
    // v = r_pi + γ P_pi v  → 2x2 해석해
    const r = [0, 1].map(s => pi[s][0] * APPLE.rew[s][0] + pi[s][1] * APPLE.rew[s][1]);
    const P = [[0, 0], [0, 0]];
    [0, 1].forEach(s => [0, 1].forEach(a => { P[s][APPLE.next[s][a]] += pi[s][a]; }));
    const a11 = 1 - gamma * P[0][0], a12 = -gamma * P[0][1], a21 = -gamma * P[1][0], a22 = 1 - gamma * P[1][1];
    const det = a11 * a22 - a12 * a21;
    return [(r[0] * a22 - a12 * r[1]) / det, (a11 * r[1] - a21 * r[0]) / det];
  }
  function qFromV(v, gamma) {
    return [0, 1].map(s => [0, 1].map(a => APPLE.rew[s][a] + gamma * v[APPLE.next[s][a]]));
  }
  W.apple = (root) => {
    root.innerHTML = `<div class="w-title">직접 해보기: 사과 줍기 로봇의 4가지 정책</div>
      <div class="controls"><label>γ <input type="range" min="0" max="0.99" step="0.01" value="0.9" class="g"> <b class="gv">0.90</b></label></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>정책</th><th>π(0)</th><th>π(1)</th><th class="num">v<sub>π</sub>(0)</th><th class="num">v<sub>π</sub>(1)</th></tr></thead><tbody></tbody></table></div>
      <div class="readout"></div>`;
    const g = root.querySelector('.g');
    const pols = [['L', 'L'], ['L', 'R'], ['R', 'L'], ['R', 'R']];
    function upd() {
      const gamma = +g.value; root.querySelector('.gv').textContent = gamma.toFixed(2);
      let best = -1e9, bi = 0;
      const rows = pols.map((p, i) => {
        const pi = p.map(x => x === 'L' ? [1, 0] : [0, 1]);
        const v = evalPolicyApple(pi, gamma);
        if (v[0] > best + 1e-9) { best = v[0]; bi = i; }
        return { p, v };
      });
      root.querySelector('tbody').innerHTML = rows.map((r, i) =>
        `<tr class="${i === bi ? 'hl' : ''}"><td>Policy ${i + 1}</td><td>${r.p[0]}</td><td>${r.p[1]}</td><td class="num">${f2(r.v[0])}</td><td class="num">${f2(r.v[1])}</td></tr>`).join('');
      const vr = evalPolicyApple([[.5, .5], [.5, .5]], gamma);
      root.querySelector('.readout').textContent =
        `가장 좋은 정책: Policy ${bi + 1} (색칠된 행)\n` +
        `참고) 무작위 정책 π(L)=π(R)=0.5 의 가치: v(0)=${f2(vr[0])}, v(1)=${f2(vr[1])}`;
    }
    g.oninput = upd; upd();
  };

  /* ---------- 택시 MDP 기대보상 ---------- */
  const TAXI = {
    S: ['Airport', 'Seomyeon', 'Haeundae'],
    wait: { // [다음상태, 확률, 보상]
      Airport: [['Airport', .7, -1], ['Seomyeon', .1, 10], ['Haeundae', .2, 20]],
      Seomyeon: [['Seomyeon', .2, -1], ['Airport', .3, 10], ['Haeundae', .5, 5]],
      Haeundae: [['Haeundae', .4, -1], ['Seomyeon', .2, 5], ['Airport', .4, 20]],
    },
  };
  W.taxi = (root) => {
    root.innerHTML = `<div class="w-title">직접 해보기: 택시 기사의 기대 보상 r(s, a)</div>
      <div class="controls">
        <label>현재 위치 s <select class="s">${TAXI.S.map(s => `<option>${s}</option>`).join('')}</select></label>
        <label>행동 a <select class="a"><option value="Wait">Wait (손님 기다리기)</option>${TAXI.S.map(s => `<option value="Move:${s}">Move → ${s}</option>`).join('')}</select></label>
      </div>
      <div class="readout"></div>`;
    const S = root.querySelector('.s'), A = root.querySelector('.a');
    function upd() {
      const s = S.value, a = A.value;
      let txt;
      if (a === 'Wait') {
        const tr = TAXI.wait[s];
        const r = tr.reduce((acc, [, p, rw]) => acc + p * rw, 0);
        txt = tr.map(([s2, p, rw]) => `  p(${s2}|${s},Wait)=${p}, 보상 ${rw}`).join('\n') +
          `\n\nr(${s}, Wait) = Σ p·보상 = ${tr.map(([, p, rw]) => `${p}×(${rw})`).join(' + ')} = ${r.toFixed(2)}`;
      } else {
        const to = a.split(':')[1];
        txt = to === s ? '자기 자신으로 Move 하는 것은 정의되지 않아요 (Wait을 쓰세요).'
          : `Move 는 결정적(deterministic) 전이: p(${to}|${s},Move)=1\nr(${s}, Move→${to}) = -5 (빈 차로 이동하는 비용)`;
      }
      root.querySelector('.readout').textContent = txt;
    }
    S.onchange = upd; A.onchange = upd; upd();
  };

  /* ---------- ch03: 축약사상 데모 ---------- */
  W.contraction = (root) => {
    root.innerHTML = `<div class="w-title">직접 해보기: 벨만 최적 연산자 T 는 축약사상!</div>
      <p style="margin:4px 0 8px;font-size:15px">사과 환경에서 서로 다른 두 시작 벡터 v, v′ 에 T 를 반복 적용하면 거리 ‖v−v′‖<sub>∞</sub> 가 매번 γ배 이하로 줄어들고, 둘 다 같은 v* 로 모여요.</p>
      <div class="controls"><label>γ <input type="range" min="0.1" max="0.95" step="0.05" value="0.9" class="g"> <b class="gv"></b></label>
      <button class="pill small go">T 한 번 적용</button><button class="pill small reset">랜덤으로 다시</button></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>k</th><th class="num">v(0)</th><th class="num">v(1)</th><th class="num">v′(0)</th><th class="num">v′(1)</th><th class="num">‖v−v′‖∞</th><th class="num">비율</th></tr></thead><tbody></tbody></table></div>`;
    const g = root.querySelector('.g');
    let v, w, k, rows, prevD;
    const T = (v, gamma) => [0, 1].map(s => Math.max(...[0, 1].map(a => APPLE.rew[s][a] + gamma * v[APPLE.next[s][a]])));
    const dist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    function reset() {
      v = [Math.random() * 40 - 20, Math.random() * 40 - 20]; w = [Math.random() * 40 - 20, Math.random() * 40 - 20];
      k = 0; prevD = dist(v, w); rows = [row()]; draw();
    }
    function row(ratio) { return `<tr><td>${k}</td><td class="num">${f2(v[0])}</td><td class="num">${f2(v[1])}</td><td class="num">${f2(w[0])}</td><td class="num">${f2(w[1])}</td><td class="num">${f3(dist(v, w))}</td><td class="num">${ratio === undefined ? '–' : ratio}</td></tr>`; }
    function draw() { root.querySelector('tbody').innerHTML = rows.slice(-8).join(''); root.querySelector('.gv').textContent = (+g.value).toFixed(2); }
    root.querySelector('.go').onclick = () => {
      const gamma = +g.value; v = T(v, gamma); w = T(w, gamma); k++;
      const d = dist(v, w); const ratio = prevD > 1e-12 ? (d / prevD).toFixed(3) + ' ≤ γ' : '–';
      prevD = d; rows.push(row(ratio)); draw();
    };
    root.querySelector('.reset').onclick = reset; g.oninput = reset; reset();
  };

  /* ---------- ch04: FrozenLake DP ---------- */
  const FL = {
    map: ['SFFF', 'FHFH', 'FFFH', 'HFFG'],
    n: 4,
    acts: [[0, -1, '←'], [1, 0, '↓'], [0, 1, '→'], [-1, 0, '↑']], // gym 순서: LEFT, DOWN, RIGHT, UP
  };
  FL.type = i => FL.map[(i / 4) | 0][i % 4];
  FL.terminal = i => FL.type(i) === 'H' || FL.type(i) === 'G';
  FL.step = (i, a) => {
    const r = (i / 4) | 0, c = i % 4;
    const nr = Math.min(3, Math.max(0, r + FL.acts[a][0])), nc = Math.min(3, Math.max(0, c + FL.acts[a][1]));
    const j = nr * 4 + nc;
    return [j, FL.type(j) === 'G' ? 10 : 0];
  };
  W.frozenlake = (root) => {
    const mode0 = root.dataset.mode || 'eval';
    root.innerHTML = `<div class="w-title">직접 해보기: FrozenLake 4×4 (γ = 0.9, 목표 보상 10)</div>
      <div class="controls">
        <label>알고리즘 <select class="mode">
          <option value="eval">반복적 정책 평가 (무작위 정책)</option>
          <option value="vi">가치 이터레이션 (동기식)</option>
          <option value="inplace">가치 이터레이션 (In-place)</option>
          <option value="pi">정책 이터레이션 (평가→개선)</option>
        </select></label>
        <button class="pill small step">k + 1</button>
        <button class="pill small run">수렴까지</button>
        <button class="pill small reset">처음으로</button>
        <b class="k" style="font-family:var(--font-mono)"></b>
      </div>
      <div style="display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start">
        <div><div class="hand" style="font-size:20px">가치함수 V<sub>k</sub></div><div class="gw vals" style="grid-template-columns:repeat(4,auto)"></div></div>
        <div><div class="hand" style="font-size:20px">그리디 정책</div><div class="gw pol" style="grid-template-columns:repeat(4,auto)"></div></div>
      </div>
      <div class="readout"></div>`;
    const modeSel = root.querySelector('.mode'); modeSel.value = mode0;
    let V, k, pol, piIter;
    const N = 16, gamma = 0.9;
    const qsa = (V, s, a) => { const [j, r] = FL.step(s, a); return r + gamma * V[j]; };
    function greedy(V) {
      return [...Array(N)].map((_, s) => {
        if (FL.terminal(s)) return [];
        const q = [0, 1, 2, 3].map(a => qsa(V, s, a)); const m = Math.max(...q);
        return [0, 1, 2, 3].filter(a => Math.abs(q[a] - m) < 1e-9);
      });
    }
    function reset() { V = Array(N).fill(0); k = 0; pol = null; piIter = 0; draw([]); }
    function evalPolicyFull(pol) { // 결정적 정책 평가 (수렴까지)
      let v = Array(N).fill(0);
      for (let it = 0; it < 1000; it++) {
        const nv = v.map((_, s) => FL.terminal(s) ? 0 : qsa(v, s, pol[s]));
        const d = Math.max(...nv.map((x, i) => Math.abs(x - v[i]))); v = nv; if (d < 1e-10) break;
      }
      return v;
    }
    function step() {
      const mode = modeSel.value; const changed = [];
      if (mode === 'eval') {
        const nv = V.map((_, s) => FL.terminal(s) ? 0 : [0, 1, 2, 3].reduce((acc, a) => acc + 0.25 * qsa(V, s, a), 0));
        nv.forEach((x, i) => { if (Math.abs(x - V[i]) > 1e-9) changed.push(i); }); V = nv;
      } else if (mode === 'vi') {
        const nv = V.map((_, s) => FL.terminal(s) ? 0 : Math.max(...[0, 1, 2, 3].map(a => qsa(V, s, a))));
        nv.forEach((x, i) => { if (Math.abs(x - V[i]) > 1e-9) changed.push(i); }); V = nv;
      } else if (mode === 'inplace') {
        for (const s of [14, 13, 10, 9, 6, 8, 2, 4, 1, 3, 0]) { // 목표에 가까운 칸부터 → 한 sweep 에 끝까지 전파 (슬라이드 p.52)
          const x = Math.max(...[0, 1, 2, 3].map(a => qsa(V, s, a)));
          if (Math.abs(x - V[s]) > 1e-9) changed.push(s); V[s] = x;
        }
      } else if (mode === 'pi') {
        if (!pol) pol = Array(N).fill(0); // 초기 정책: 모두 LEFT
        V = evalPolicyFull(pol);
        const g = greedy(V);
        const np = pol.map((a, s) => FL.terminal(s) ? 0 : (g[s].includes(a) ? a : g[s][0]));
        const stable = np.every((a, s) => a === pol[s]);
        pol = np; piIter++;
        draw(changed, stable ? `정책이 더 이상 바뀌지 않음 → 최적 정책 도달! (개선 ${piIter}회)` : `평가 후 그리디 개선 (개선 ${piIter}회)`);
        k++; return changed;
      }
      k++; draw(changed); return changed;
    }
    function draw(changed, msg) {
      const g = greedy(V);
      const cell = (s, inner) => {
        const t = FL.type(s);
        const cls = ['cell', t === 'H' ? 'hole' : '', t === 'G' ? 'goal' : '', t === 'S' ? 'start' : '', changed.includes(s) ? 'flash' : ''].join(' ');
        return `<div class="${cls}"><span class="idx">${s}</span>${inner}</div>`;
      };
      root.querySelector('.vals').innerHTML = V.map((v, s) => cell(s, FL.type(s) === 'H' ? 'H' : FL.type(s) === 'G' ? 'G' : f2(v))).join('');
      root.querySelector('.pol').innerHTML = V.map((v, s) => cell(s, FL.type(s) === 'H' ? 'H' : FL.type(s) === 'G' ? 'G' :
        `<span class="arrow">${(modeSel.value === 'pi' && pol ? [pol[s]] : g[s]).map(a => FL.acts[a][2]).join('')}</span>`)).join('');
      root.querySelector('.k').textContent = modeSel.value === 'pi' ? `반복 ${k}` : `k = ${k}`;
      root.querySelector('.readout').textContent = msg || ({
        eval: '무작위 정책(상하좌우 각 0.25)의 가치를 벨만 기대 방정식으로 반복 계산. 오른쪽은 그 가치에 대한 그리디 정책.',
        vi: '벨만 최적 방정식을 반복 적용: V_{k+1}(s) = max_a Σ p(s′|s,a)[r + γ V_k(s′)]. 명시적 정책 없이 가치만 갱신.',
        inplace: 'In-place: 값 표를 하나만 두고, 갱신하자마자 바로 다음 칸 계산에 사용 (목표에 가까운 칸부터). 한 sweep(k=1) 만에 최적값이 다 채워져요!',
        pi: '정책 이터레이션: (1) 현재 정책을 끝까지 평가 → (2) 그 가치에 대해 그리디하게 개선. 초기 정책 = 전부 ←.',
      })[modeSel.value];
    }
    root.querySelector('.step').onclick = step;
    root.querySelector('.run').onclick = () => { for (let i = 0; i < 300; i++) { const c = step(); if (modeSel.value !== 'pi' && !c.length) break; if (modeSel.value === 'pi' && root.querySelector('.readout').textContent.includes('최적')) break; } };
    root.querySelector('.reset').onclick = reset;
    modeSel.onchange = reset;
    reset();
  };

  /* ---------- ch04: 정책 평가 · 정책 이터레이션 · 가치 이터레이션 · GPI 한 화면 비교 ---------- */
  W.dpcompare = (root) => {
    root.innerHTML = `<div class="w-title">직접 비교: 세 가지 DP + GPI (FrozenLake 4×4, γ = 0.9, 목표 보상 10)</div>
      <div class="controls" style="flex-wrap:wrap">
        <button class="pill small" data-m="eval">반복적 정책 평가</button>
        <button class="pill small" data-m="pi">정책 이터레이션</button>
        <button class="pill small" data-m="vi">가치 이터레이션</button>
        <button class="pill small" data-m="gpi">GPI: 평가 m번만</button>
        <label class="mwrap" style="font-family:var(--font-ui);font-size:14px">m = <select class="m"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="0">∞ (끝까지)</option></select></label>
      </div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
        <div class="gw grid" style="grid-template-columns:repeat(4,auto)"></div>
        <div style="flex:1;min-width:200px;font-family:var(--font-ui);font-size:14px;line-height:1.9">
          <div>지금 단계: <b class="ph"></b></div>
          <div>평가 sweep 누적: <b class="sw" style="font-family:var(--font-mono)"></b></div>
          <div>정책 개선 횟수: <b class="imp" style="font-family:var(--font-mono)"></b></div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <button class="pill small step">한 단계</button><button class="pill small play">자동 재생</button><button class="pill small end">끝까지</button><button class="pill small reset">처음부터</button>
          </div>
        </div>
      </div>
      <div class="readout"></div>`;
    const N = 16, gamma = 0.9, EPS = 1e-4, $ = c => root.querySelector(c);
    const qsa = (V, s, a) => { const [j, r] = FL.step(s, a); return r + gamma * V[j]; };
    let mode = 'eval', V, pi, st, timer = null;
    const greedyOne = s => { let b = 0, bv = -Infinity; for (let a = 0; a < 4; a++) { const v = qsa(V, s, a); if (v > bv + 1e-9) { bv = v; b = a; } } return b; };
    const argAll = s => { const q = [0, 1, 2, 3].map(a => qsa(V, s, a)), m = Math.max(...q); return [0, 1, 2, 3].filter(a => Math.abs(q[a] - m) < 1e-9); };
    function sweepEval() {
      const nv = V.map((_, s) => FL.terminal(s) ? 0 : pi[s] === null ? [0, 1, 2, 3].reduce((acc, a) => acc + 0.25 * qsa(V, s, a), 0) : qsa(V, s, pi[s]));
      const d = Math.max(...nv.map((x, i) => Math.abs(x - V[i]))); V = nv; st.sw++; st.k++; return d;
    }
    function sweepVI() {
      const nv = V.map((_, s) => FL.terminal(s) ? 0 : Math.max(...[0, 1, 2, 3].map(a => qsa(V, s, a))));
      const d = Math.max(...nv.map((x, i) => Math.abs(x - V[i]))); V = nv; st.sw++; return d;
    }
    const intro = {
      eval: '무작위 정책(상하좌우 각 1/4)을 평가만 해요. 정책은 끝까지 그대로, 숫자만 vπ 로 수렴 → “예측”.',
      pi: '무작위 정책에서 시작. ① 지금 정책을 수렴할 때까지 평가 → ② greedy 개선 → 정책이 안 바뀔 때까지 반복.',
      vi: '정책 없이 V₀ = 0 에서 시작. 매 sweep 마다 각 칸에서 max 를 취해요 (평가 1번 + 개선을 한 줄로). 정책은 마지막에 한 번만 뽑아요.',
      gpi: 'GPI = 평가 ↔ 개선을 번갈아 하는 틀. 평가를 m 번만 하고 바로 개선해요. m = ∞ 면 정책 이터레이션, m = 1 이면 가치 이터레이션과 같은 결과가 나와요.',
    };
    function reset() { V = Array(N).fill(0); pi = Array(N).fill(null); st = { phase: mode === 'vi' ? 'vi' : 'eval', sw: 0, imp: 0, k: 0, round: 1, done: false }; stop(); draw(intro[mode]); }
    const mVal = () => +$('.m').value;
    function improve() {
      const np = [...Array(N)].map((_, s) => FL.terminal(s) ? null : greedyOne(s));
      const same = pi.every((a, s) => a === np[s]); pi = np; st.imp++; return same;
    }
    function step() {
      if (st.done) return;
      if (mode === 'eval') {
        const d = sweepEval();
        if (d < EPS) { st.done = true; st.phase = '수렴'; draw(`sweep ${st.sw}: 변화가 거의 없음 → 수렴. 이 숫자가 무작위 정책의 vπ. 정책(무작위)은 한 번도 안 바뀌었어요.`); }
        else draw(`sweep ${st.sw}: V_{k+1}(s) = Σ_a π(a|s)[r + γV_k(s′)] 를 모든 칸에 적용 (최대 변화 ${d.toFixed(3)})`);
        return;
      }
      if (mode === 'vi') {
        if (st.phase === 'vi') { const d = sweepVI(); if (d < EPS) { st.phase = 'extract'; draw(`sweep ${st.sw}: 수렴 → V ≈ v*. 다음 단계에서 정책을 딱 한 번 뽑아요.`); } else draw(`sweep ${st.sw}: V_{k+1}(s) = max_a [r + γV_k(s′)]. 흐린 화살표는 참고용 — 아직 정책을 들고 있지 않아요. (최대 변화 ${d.toFixed(3)})`); return; }
        improve(); st.done = true; st.phase = '최적'; draw(`수렴한 V* 에서 greedy 로 정책을 한 번 뽑음 → π*. 평가 sweep 총 ${st.sw}번, 정책 뽑기 1번.`); return;
      }
      // pi, gpi
      const m = mode === 'pi' ? 0 : mVal();
      if (st.phase === 'eval') {
        const d = sweepEval();
        const enough = d < EPS || (m > 0 && st.k >= m);
        if (enough) { st.phase = 'improve'; draw(m > 0 && d >= EPS ? `평가 ${st.round}회차: ${m}번만 하고 끊음 (아직 vπ 아님!). 다음 단계에서 이 덜 된 V 로 개선해요.` : `평가 ${st.round}회차 수렴 (누적 sweep ${st.sw}). 지금 V = 현재 정책의 vπ. 다음 단계에서 greedy 개선.`); }
        else draw(`평가 ${st.round}회차 sweep ${st.k}${m ? ` / ${m}` : ''}: 정책은 고정, V 만 갱신 (최대 변화 ${d.toFixed(3)})`);
        return;
      }
      const same = improve();
      if (same && st.lastStableV != null && Math.max(...V.map((x, i) => Math.abs(x - st.lastStableV[i]))) < EPS) { st.done = true; st.phase = '최적'; draw(`개선해도 정책이 안 바뀌고 V 도 안정 → 최적 정책 π*. 평가 sweep 총 ${st.sw}번, 개선 ${st.imp}번.`); return; }
      if (same && (mode === 'pi' || m === 0)) { st.done = true; st.phase = '최적'; draw(`개선해도 정책이 안 바뀜 → 정책 안정 = 최적 정책 π*. 평가 sweep 총 ${st.sw}번, 개선 ${st.imp}번.`); return; }
      st.lastStableV = same ? V.slice() : null;
      st.phase = 'eval'; st.round++; st.k = 0;
      draw(`개선 ${st.imp}: 각 칸에서 argmax_a [r + γV(s′)] 로 정책을 바꿈. 이제 새 정책을 다시 평가${m ? ` (${m}번만)` : ' (끝까지)'}.`);
    }
    function draw(msg) {
      const fade = mode === 'vi' && st.phase === 'vi';
      $('.grid').innerHTML = V.map((v, s) => {
        const t = FL.type(s), cls = ['cell', t === 'H' ? 'hole' : '', t === 'G' ? 'goal' : '', t === 'S' ? 'start' : ''].join(' ');
        if (t === 'H' || t === 'G') return `<div class="${cls}"><span class="idx">${s}</span>${t}</div>`;
        let arr;
        if (mode === 'eval' || pi[s] === null) arr = fade && st.sw ? argAll(s).map(a => FL.acts[a][2]).join('') : '<span style="font-size:11px;color:var(--muted)">무작위</span>';
        else arr = FL.acts[pi[s]][2];
        if (mode === 'vi' && !st.sw) arr = '';
        const bg = `background:rgba(255,111,30,${Math.min(0.35, v / 10 * 0.35).toFixed(3)})`;
        return `<div class="${cls}" style="${bg}"><span class="idx">${s}</span><span class="arrow" style="${fade ? 'opacity:.4' : ''}">${arr}</span><span style="font-size:13px">${f2(v)}</span></div>`;
      }).join('');
      $('.ph').textContent = ({ eval: mode === 'eval' ? '평가' : `평가 (${st.round}회차)`, improve: '개선 대기', vi: 'max 갱신', extract: '정책 뽑기 대기', 수렴: '수렴', 최적: '최적 정책' })[st.phase];
      $('.sw').textContent = st.sw; $('.imp').textContent = st.imp;
      root.querySelectorAll('[data-m]').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === mode));
      $('.mwrap').style.display = mode === 'gpi' ? '' : 'none';
      $('.readout').textContent = msg || '';
    }
    function stop() { clearInterval(timer); timer = null; $('.play').textContent = '자동 재생'; }
    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; reset(); });
    $('.m').onchange = reset;
    $('.step').onclick = () => { stop(); step(); };
    $('.end').onclick = () => { stop(); for (let i = 0; i < 3000 && !st.done; i++) step(); };
    $('.reset').onclick = reset;
    $('.play').onclick = () => { if (timer) return stop(); $('.play').textContent = '멈춤'; timer = setInterval(() => { if (st.done) return stop(); step(); }, 420); };
    reset();
  };

  /* ---------- ch05: ε-greedy ---------- */
  W.egreedy = (root) => {
    root.innerHTML = `<div class="w-title">직접 해보기: ε-greedy 정책의 행동 확률</div>
      <div class="controls">
        <label>ε <input type="range" min="0" max="1" step="0.01" value="0.1" class="e"> <b class="ev"></b></label>
        <label>Q(s,←) <input type="number" class="q" value="-1.2" step="0.1" style="width:70px"></label>
        <label>Q(s,↓) <input type="number" class="q" value="0.5" step="0.1" style="width:70px"></label>
        <label>Q(s,→) <input type="number" class="q" value="0.3" step="0.1" style="width:70px"></label>
        <label>Q(s,↑) <input type="number" class="q" value="-0.4" step="0.1" style="width:70px"></label>
      </div>
      <div class="bars" style="height:140px"></div><div class="bars-x"></div>
      <div class="readout"></div>`;
    const e = root.querySelector('.e'), qs = [...root.querySelectorAll('.q')];
    const names = ['←', '↓', '→', '↑'];
    function upd() {
      const eps = +e.value, m = 4; root.querySelector('.ev').textContent = eps.toFixed(2);
      const q = qs.map(x => +x.value); const best = q.indexOf(Math.max(...q));
      const p = q.map((_, a) => eps / m + (a === best ? 1 - eps : 0));
      root.querySelector('.bars').innerHTML = p.map((x, a) => `<i class="${a === best ? '' : 'alt'}" style="height:${x * 100}%"></i>`).join('');
      root.querySelector('.bars-x').innerHTML = p.map((x, a) => `<span>${names[a]} ${x.toFixed(3)}</span>`).join('');
      root.querySelector('.readout').textContent =
        `그리디 행동 a* = ${names[best]} (Q 최대)\n` +
        `π(a*|s) = ε/m + 1 − ε = ${(eps / m).toFixed(3)} + ${(1 - eps).toFixed(3)} = ${p[best].toFixed(3)}\n` +
        `나머지   = ε/m = ${(eps / m).toFixed(3)}   (합계 = ${p.reduce((a, b) => a + b, 0).toFixed(3)})`;
    }
    e.oninput = upd; qs.forEach(x => x.oninput = upd); upd();
  };

  /* ---------- ch05: MC 에피소드 역방향 return ---------- */
  W.mcepisode = (root) => {
    const ep = [[1, 'D', -1], [4, 'D', -1], [7, 'R', -1], [8, 'L', -1], [7, 'R', -1], [8, 'R', 0]];
    root.innerHTML = `<div class="w-title">직접 해보기: 에피소드 끝에서부터 G 계산하기 (first-visit MC)</div>
      <div class="controls"><button class="pill small b">한 칸 거꾸로 →  g = γ·g + r</button><button class="pill small r">처음으로</button></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>t</th><th>S<sub>t</sub></th><th>A<sub>t</sub></th><th class="num">R<sub>t+1</sub></th><th class="num">G<sub>t</sub></th><th>first-visit?</th></tr></thead><tbody></tbody></table></div>
      <div class="readout"></div>`;
    let i, G;
    const firstIdx = {}; ep.forEach(([s, a], t) => { const k = s + a; if (!(k in firstIdx)) firstIdx[k] = t; });
    function reset() { i = ep.length; G = Array(ep.length).fill(null); draw(); }
    function draw() {
      root.querySelector('tbody').innerHTML = ep.map(([s, a, r], t) =>
        `<tr class="${t === i ? 'hl' : ''}"><td>${t}</td><td>${s}</td><td>${a}</td><td class="num">${r}</td><td class="num">${G[t] === null ? '' : f2(G[t])}</td><td>${G[t] === null ? '' : (firstIdx[s + a] === t ? '✓ Q(' + s + ',' + a + ') ← ' + f2(G[t]) : '× (더 앞에서 이미 방문)')}</td></tr>`).join('');
      root.querySelector('.readout').textContent = i === ep.length ? '버튼을 눌러 t=5 부터 거꾸로 계산해 보세요. (γ = 0.9)' :
        i === 0 ? '완료! 슬라이드 18의 Q 표와 비교해 보세요: Q(1,D)=-4.1, Q(4,D)=-3.44, Q(7,R)=-2.71, Q(8,L)=-1.9, Q(8,R)=0' :
          `G_${i} = R_${i + 1} + γ·G_${i + 1} = ${ep[i][2]} + 0.9×${i + 1 < ep.length ? f2(G[i + 1]) : '0'} = ${f2(G[i])}`;
    }
    root.querySelector('.b').onclick = () => { if (i <= 0) return; i--; G[i] = ep[i][2] + 0.9 * (i + 1 < ep.length ? G[i + 1] : 0); draw(); };
    root.querySelector('.r').onclick = reset; reset();
  };

  /* ---------- ch05: 표본평균 vs 지수이동평균 가중치 ---------- */
  W.ema = (root) => {
    root.innerHTML = `<div class="w-title">직접 해보기: 표본평균(1/n) vs 지수이동평균(α)의 가중치</div>
      <div class="controls"><label>α <input type="range" min="0.02" max="0.8" step="0.01" value="0.1" class="a"> <b class="av"></b></label><span>에피소드 수 n = 20</span></div>
      <div style="font-size:14px;font-family:var(--font-ui)">■ 주황 = EMA 가중치 α(1−α)<sup>n−i</sup> &nbsp; ■ 검정 = 표본평균 가중치 1/n</div>
      <div class="bars ema" style="gap:1px"></div><div class="bars-x"></div>
      <div class="readout"></div>`;
    const a = root.querySelector('.a'); const n = 20;
    function upd() {
      const al = +a.value; root.querySelector('.av').textContent = al.toFixed(2);
      const ema = [...Array(n)].map((_, i) => al * Math.pow(1 - al, n - 1 - i));
      const mean = Array(n).fill(1 / n);
      const mx = Math.max(...ema, 1 / n);
      root.querySelector('.ema').innerHTML = ema.map((w, i) => `<i style="height:${w / mx * 100}%"></i><i class="alt" style="height:${mean[i] / mx * 100}%"></i>`).join('');
      root.querySelector('.bars-x').innerHTML = ema.map((_, i) => `<span>${i + 1}</span><span></span>`).join('');
      root.querySelector('.readout').textContent = `가장 최근 G(${n})의 가중치: EMA ${ema[n - 1].toFixed(3)} vs 평균 ${(1 / n).toFixed(3)}\n` +
        `가장 오래된 G(1)의 가중치: EMA ${ema[0].toExponential(2)} vs 평균 ${(1 / n).toFixed(3)}\n→ EMA는 최근 return 을 더 믿음 ⇒ 정책이 계속 변하는 비정상(non-stationary) 문제에 적합`;
    }
    a.oninput = upd; upd();
  };

  /* ---------- ch06: SARSA vs Q-learning 1-step 계산기 ---------- */
  W.tdupdate = (root) => {
    root.innerHTML = `<div class="w-title">직접 해보기: SARSA vs Q-learning 한 스텝 업데이트</div>
      <div class="controls">
        <label>Q(S,A) <input type="number" class="qsa" value="-0.1" step="0.1" style="width:70px"></label>
        <label>R <input type="number" class="r" value="-1" step="0.5" style="width:60px"></label>
        <label>γ <input type="number" class="g" value="0.9" step="0.05" style="width:60px"></label>
        <label>α <input type="number" class="al" value="0.1" step="0.05" style="width:60px"></label>
      </div>
      <div class="controls">S′ 에서의 Q 값:
        <label>← <input type="number" class="q2" value="0" step="0.1" style="width:64px"></label>
        <label>↓ <input type="number" class="q2" value="-0.1" step="0.1" style="width:64px"></label>
        <label>→ <input type="number" class="q2" value="0" step="0.1" style="width:64px"></label>
        <label>↑ <input type="number" class="q2" value="0" step="0.1" style="width:64px"></label>
        <label>실제로 고른 A′ <select class="ap"><option value="0">←</option><option value="1" selected>↓</option><option value="2">→</option><option value="3">↑</option></select></label>
      </div>
      <div class="cols"><div class="box"><h4>SARSA (on-policy)</h4><div class="readout sa"></div></div><div class="box"><h4>Q-learning (off-policy)</h4><div class="readout ql"></div></div></div>`;
    const $ = s => root.querySelector(s); const names = ['←', '↓', '→', '↑'];
    function upd() {
      const q = +$('.qsa').value, r = +$('.r').value, g = +$('.g').value, al = +$('.al').value;
      const q2 = [...root.querySelectorAll('.q2')].map(x => +x.value); const ap = +$('.ap').value;
      const mx = Math.max(...q2), am = q2.indexOf(mx);
      const tS = r + g * q2[ap], tQ = r + g * mx;
      $('.sa').textContent = `target = R + γ Q(S′,A′=${names[ap]})\n       = ${r} + ${g}×${q2[ap]} = ${f3(tS)}\nQ ← ${q} + ${al}×(${f3(tS)} − ${q})\n  = ${f3(q + al * (tS - q))}`;
      $('.ql').textContent = `target = R + γ max_a Q(S′,a)  (a=${names[am]})\n       = ${r} + ${g}×${mx} = ${f3(tQ)}\nQ ← ${q} + ${al}×(${f3(tQ)} − ${q})\n  = ${f3(q + al * (tQ - q))}`;
    }
    root.querySelectorAll('input,select').forEach(x => x.oninput = upd); upd();
  };

  /* ---------- ch06: λ-return 가중치 ---------- */
  W.lambda = (root) => {
    root.innerHTML = `<div class="w-title">직접 해보기: λ-return 에서 n-step return 의 가중치 (1−λ)λ<sup>n−1</sup></div>
      <div class="controls"><label>λ <input type="range" min="0" max="1" step="0.01" value="0.7" class="l"> <b class="lv"></b></label><label>에피소드 남은 길이 T−t <input type="number" class="T" value="12" min="2" max="30" style="width:60px"></label></div>
      <div class="bars"></div><div class="bars-x"></div><div class="readout"></div>`;
    const l = root.querySelector('.l'), T = root.querySelector('.T');
    function upd() {
      const lam = +l.value, n = Math.max(2, Math.min(30, +T.value | 0)); root.querySelector('.lv').textContent = lam.toFixed(2);
      const w = [...Array(n)].map((_, i) => i < n - 1 ? (1 - lam) * Math.pow(lam, i) : Math.pow(lam, n - 1));
      const mx = Math.max(...w, 1e-9);
      root.querySelector('.bars').innerHTML = w.map((x, i) => `<i class="${i === n - 1 ? 'alt' : ''}" style="height:${x / mx * 100}%"></i>`).join('');
      root.querySelector('.bars-x').innerHTML = w.map((_, i) => `<span>${i === n - 1 ? 'G' : i + 1}</span>`).join('');
      root.querySelector('.readout').textContent = `검정 막대 = 끝까지 간 실제 return G_t 에 남는 가중치 λ^{T−t−1} = ${w[n - 1].toFixed(3)}\n가중치 합 = ${w.reduce((a, b) => a + b, 0).toFixed(3)}\n` +
        (lam === 0 ? '→ λ=0: 1-step TD 타깃만 사용 = TD(0)' : lam === 1 ? '→ λ=1: 실제 return 만 사용 = MC' : '');
    }
    l.oninput = upd; T.oninput = upd; upd();
  };

  /* ---------- ch06: AB 예제 batch MC vs TD ---------- */
  W.ab = (root) => {
    const eps = [[['A', 0], ['B', 0]], [['B', 1]], [['B', 1]], [['B', 1]], [['B', 1]], [['B', 1]], [['B', 1]], [['B', 0]]];
    root.innerHTML = `<div class="w-title">직접 해보기: AB 예제를 batch 로 반복 학습</div>
      <div class="controls"><button class="pill small go">8개 에피소드 100번 반복 학습</button><button class="pill small r">초기화</button><span>α = 0.01, γ = 1</span></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th></th><th class="num">V(A)</th><th class="num">V(B)</th></tr></thead><tbody></tbody></table></div><div class="readout"></div>`;
    let mc, td, sweeps;
    function reset() { mc = { A: 0, B: 0 }; td = { A: 0, B: 0 }; sweeps = 0; draw(); }
    function draw() {
      root.querySelector('tbody').innerHTML = `<tr><td>Batch MC</td><td class="num">${f3(mc.A)}</td><td class="num">${f3(mc.B)}</td></tr><tr><td>Batch TD(0)</td><td class="num">${f3(td.A)}</td><td class="num">${f3(td.B)}</td></tr>`;
      root.querySelector('.readout').textContent = `반복 횟수: ${sweeps}\nMC → 관측된 return 의 평균에 맞춤 (V(A)=0)\nTD → 데이터로 추정한 MDP(A→B 확률 1, 보상 0)에 맞춤 (V(A)=V(B)=0.75)`;
    }
    root.querySelector('.go').onclick = () => {
      const al = 0.01;
      for (let k = 0; k < 100; k++) {
        eps.forEach(ep => {
          // MC: 에피소드 끝 return
          let G = 0; const Gs = [];
          for (let t = ep.length - 1; t >= 0; t--) { G += ep[t][1]; Gs[t] = G; }
          ep.forEach(([s], t) => { mc[s] += al * (Gs[t] - mc[s]); });
          ep.forEach(([s, r], t) => { const nv = t + 1 < ep.length ? td[ep[t + 1][0]] : 0; td[s] += al * (r + nv - td[s]); });
        });
        sweeps++;
      }
      draw();
    };
    root.querySelector('.r').onclick = reset; reset();
  };

  /* ---------- ch06: Cliff Walking SARSA vs Q-learning ---------- */
  W.cliff = (root) => {
    const R = 4, C = 12, start = [3, 0], goal = [3, 11];
    root.innerHTML = `<div class="w-title">직접 해보기: Cliff Walking 에서 SARSA vs Q-learning</div>
      <div class="controls"><label>ε <input type="number" class="e" value="0.1" step="0.05" min="0" max="0.5" style="width:64px"></label><label>α <input type="number" class="a" value="0.5" step="0.1" style="width:64px"></label><label>에피소드 <input type="number" class="n" value="500" step="100" style="width:80px"></label>
      <button class="pill small go">학습 시작</button></div>
      <div style="font-family:var(--font-ui);font-size:14px">■ <span style="color:var(--orange)">주황 = Q-learning 의 그리디 경로</span> &nbsp; ■ <span style="color:#15803d">초록 = SARSA 의 그리디 경로</span> &nbsp; ■ <span style="color:var(--sky)">파랑 = 절벽(-100)</span></div>
      <div class="cliff" style="grid-template-columns:repeat(${C},auto);margin-top:8px"></div>
      <div class="readout">버튼을 눌러 두 에이전트를 같은 조건에서 학습시켜 보세요.</div>`;
    const grid = root.querySelector('.cliff');
    const isCliff = (r, c) => r === 3 && c > 0 && c < 11;
    const moves = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    function envStep([r, c], a) {
      let nr = Math.min(R - 1, Math.max(0, r + moves[a][0])), nc = Math.min(C - 1, Math.max(0, c + moves[a][1]));
      if (isCliff(nr, nc)) return [start.slice(), -100, false];
      return [[nr, nc], -1, nr === goal[0] && nc === goal[1]];
    }
    function train(kind, eps, al, n) {
      const Q = [...Array(R * C)].map(() => [0, 0, 0, 0]); const idx = ([r, c]) => r * C + c;
      const pick = s => { if (Math.random() < eps) return (Math.random() * 4) | 0; const q = Q[idx(s)]; const m = Math.max(...q); const b = [0, 1, 2, 3].filter(a => q[a] === m); return b[(Math.random() * b.length) | 0]; };
      let sumLast = 0;
      for (let e = 0; e < n; e++) {
        let s = start.slice(), a = pick(s), tot = 0;
        for (let t = 0; t < 1000; t++) {
          const [s2, r, done] = envStep(s, a); tot += r;
          const a2 = pick(s2);
          const target = done ? r : r + (kind === 'sarsa' ? Q[idx(s2)][a2] : Math.max(...Q[idx(s2)]));
          Q[idx(s)][a] += al * (target - Q[idx(s)][a]);
          if (done) break; s = s2; a = a2;
        }
        if (e >= n - 100) sumLast += tot;
      }
      // greedy path
      const path = new Set(); let s = start.slice();
      for (let t = 0; t < 60; t++) { path.add(idx(s)); if (s[0] === goal[0] && s[1] === goal[1]) break; const q = Q[idx(s)]; const a = q.indexOf(Math.max(...q)); const [s2, , ] = envStep(s, a); if (s2[0] === start[0] && s2[1] === start[1] && !(s[0] === start[0] && s[1] === start[1])) break; s = s2; }
      return { path, avg: sumLast / Math.min(100, n) };
    }
    function draw(qp, sp) {
      let h = '';
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const i = r * C + c; let cls = 'c';
        if (isCliff(r, c)) cls += ' cl'; else if (r === 3 && c === 0) cls += ' s'; else if (r === 3 && c === 11) cls += ' g';
        else if (qp && sp && qp.has(i) && sp.has(i)) cls += ' both'; else if (qp && qp.has(i)) cls += ' q'; else if (sp && sp.has(i)) cls += ' sa';
        h += `<div class="${cls}">${r === 3 && c === 0 ? 'S' : r === 3 && c === 11 ? 'G' : ''}</div>`;
      }
      grid.innerHTML = h;
    }
    draw();
    root.querySelector('.go').onclick = () => {
      const eps = +root.querySelector('.e').value, al = +root.querySelector('.a').value, n = Math.min(5000, +root.querySelector('.n').value | 0);
      const q = train('q', eps, al, n), s = train('sarsa', eps, al, n);
      draw(q.path, s.path);
      root.querySelector('.readout').textContent =
        `마지막 100 에피소드 평균 보상 (ε-greedy 로 행동하는 동안)\n  Q-learning: ${q.avg.toFixed(1)}\n  SARSA     : ${s.avg.toFixed(1)}\n` +
        `→ Q-learning 은 절벽 바로 옆 최단 경로(최적)를 배우지만, 탐험 중에 가끔 떨어져서 학습 중 보상은 오히려 낮아요.\n→ SARSA 는 자기 탐험까지 고려해 절벽에서 먼 안전한 경로를 배워요.`;
    };
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-widget]').forEach(node => {
      node.classList.add('widget');
      const fn = W[node.dataset.widget];
      if (fn) fn(node);
    });
  });
})();

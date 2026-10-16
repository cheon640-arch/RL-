/* 공통: 헤더/푸터, 목차, 학습 체크, 스티커, 수식 렌더 */
(function () {
  const CHAPTERS = [
    { id: '02', file: 'ch02-mdp.html', title: 'MDP' },
    { id: '03', file: 'ch03-bellman.html', title: 'Bellman' },
    { id: '04', file: 'ch04-dp.html', title: 'DP' },
    { id: '05', file: 'ch05-mc.html', title: 'Monte Carlo' },
    { id: '06', file: 'ch06-td.html', title: 'TD' },
  ];
  window.RL_CHAPTERS = CHAPTERS;

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('rlnote:' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('rlnote:' + k, JSON.stringify(v)); } catch (e) {} },
  };
  window.RL_STORE = store;

  const HAND = `<svg viewBox="0 0 40 40" fill="none" stroke="#171717" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="20" cy="20" r="17.5"/>
    <path d="M14 27c-2-2-3-5-2-8l1-3c.4-1.2 2.2-1 2.2.3V21"/>
    <path d="M15.2 21V11.5c0-1.4 2.3-1.4 2.3 0V19"/>
    <path d="M17.5 19v-8.8c0-1.4 2.3-1.4 2.3 0V19"/>
    <path d="M19.8 19v-7.2c0-1.4 2.3-1.4 2.3 0V20"/>
    <path d="M22.1 20v-4.6c0-1.4 2.3-1.4 2.3 0v6.4c0 3.6-2.4 6.4-6 6.4H17"/>
  </svg>`;

  const STICKERS = {
    bolt: `<svg viewBox="0 0 60 80"><path d="M34 3 8 46h18l-6 31 32-46H33z" fill="#3b82f6" stroke="#171717" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
    heart: `<svg viewBox="0 0 80 72"><path d="M40 68S5 46 5 23C5 12 13 5 23 5c7 0 13 4 17 10 4-6 10-10 17-10 10 0 18 7 18 18 0 23-35 45-35 45z" fill="#ff66cf" stroke="#171717" stroke-width="2.5"/><circle cx="29" cy="30" r="4" fill="#171717"/><circle cx="51" cy="30" r="4" fill="#171717"/><path d="M33 42q7 6 14 0" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    ghost: `<svg viewBox="0 0 70 80"><path d="M8 74V32C8 16 20 5 35 5s27 11 27 27v42l-9-7-9 7-9-7-9 7-9-7z" fill="#fdfbf9" stroke="#171717" stroke-width="2.5" stroke-linejoin="round"/><circle cx="26" cy="33" r="4" fill="#171717"/><circle cx="44" cy="33" r="4" fill="#171717"/><ellipse cx="35" cy="46" rx="4" ry="5" fill="#171717"/></svg>`,
    star: `<svg viewBox="0 0 70 70"><path d="M35 3c3 18 14 29 32 32-18 3-29 14-32 32-3-18-14-29-32-32C21 32 32 21 35 3z" fill="#22c55e" stroke="#171717" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
    bear: `<svg viewBox="0 0 80 76"><circle cx="16" cy="18" r="11" fill="#ff6f1e" stroke="#171717" stroke-width="2.5"/><circle cx="64" cy="18" r="11" fill="#ff6f1e" stroke="#171717" stroke-width="2.5"/><circle cx="40" cy="42" r="30" fill="#ff6f1e" stroke="#171717" stroke-width="2.5"/><circle cx="30" cy="38" r="3.5" fill="#171717"/><circle cx="50" cy="38" r="3.5" fill="#171717"/><ellipse cx="40" cy="52" rx="10" ry="8" fill="#fdfbf9" stroke="#171717" stroke-width="2"/><circle cx="40" cy="49" r="2.5" fill="#171717"/></svg>`,
    apple: `<svg viewBox="0 0 70 76"><path d="M35 20c-8-6-28-5-28 18 0 18 13 35 22 35 3 0 4-2 6-2s3 2 6 2c9 0 22-17 22-35 0-23-20-24-28-18z" fill="#ff6f1e" stroke="#171717" stroke-width="2.5"/><path d="M35 20c0-7 2-12 7-16" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/><path d="M38 12c6-6 14-5 16-3-3 6-10 7-16 3z" fill="#22c55e" stroke="#171717" stroke-width="2"/></svg>`,
  };
  window.RL_STICKERS = STICKERS;

  function header(current) {
    const tabs = CHAPTERS.map(c =>
      `<a href="${c.file}" class="${c.id === current ? 'active' : ''}">${c.id}. ${c.title}</a>`).join('') +
      `<a href="summary.html" class="extra ${current === 'sum' ? 'active' : ''}">한눈에 요약</a>` +
      `<a href="compare.html" class="extra ${current === 'cmp' ? 'active' : ''}">한눈에 비교</a>`;
    return `<header class="site-header">
      <a class="brand" href="index.html" aria-label="홈">${HAND}<span>rl notebook</span></a>
      <nav class="chapter-tabs">${tabs}</nav>
      <a class="pill small" href="index.html#review">공식 한 장</a>
    </header>`;
  }

  function footer() {
    return `<footer class="footer-band"><div class="wrap">
      <div class="big">keep going,<br>you got this.</div>
      <div class="small">강화학습개론 (부산대 산업공학과) 강의자료 기반 개인 학습 노트.<br>
      슬라이드 번호(p.xx)를 함께 적어 두었으니 원본 PDF와 같이 보면 좋아요.</div>
    </div></footer>`;
  }

  function placeStickers(root) {
    root.querySelectorAll('[data-sticker]').forEach(el => {
      const name = el.dataset.sticker;
      el.classList.add('sticker');
      el.innerHTML = STICKERS[name] || '';
      const rot = el.dataset.rot || ((Math.random() * 20 - 10) | 0);
      el.style.transform = `rotate(${rot}deg)`;
    });
  }

  function buildToc(chId) {
    const toc = document.querySelector('.toc');
    if (!toc) return;
    const sections = [...document.querySelectorAll('section.card[id]')];
    const done = store.get('done-' + chId) || {};
    const items = sections.map(s => {
      const t = s.dataset.toc || s.querySelector('h2')?.childNodes[0]?.textContent?.trim() || s.id;
      return `<li><a href="#${s.id}" data-id="${s.id}" class="${done[s.id] ? 'done' : ''}"><span class="dot"></span><span>${t}</span></a></li>`;
    }).join('');
    toc.innerHTML = `<div class="toc-title">이번 장 목차</div><ol>${items}</ol>
      <div class="progress"><span class="pct"></span><div class="bar"><i></i></div></div>`;

    // done toggles
    sections.forEach(s => {
      const b = document.createElement('button');
      b.className = 'done-toggle' + (done[s.id] ? ' on' : '');
      b.type = 'button';
      b.textContent = done[s.id] ? ' 이해했어요' : '이해했으면 체크';
      b.addEventListener('click', () => {
        const d = store.get('done-' + chId) || {};
        d[s.id] = !d[s.id];
        store.set('done-' + chId, d);
        b.classList.toggle('on', d[s.id]);
        b.textContent = d[s.id] ? ' 이해했어요' : '이해했으면 체크';
        toc.querySelector(`a[data-id="${s.id}"]`).classList.toggle('done', d[s.id]);
        updatePct();
      });
      const tools = document.createElement('div');
      tools.className = 'card-tools';
      tools.appendChild(b);
      s.appendChild(tools);
    });
    store.set('total-' + chId, sections.length);

    function updatePct() {
      const d = store.get('done-' + chId) || {};
      const n = sections.filter(s => d[s.id]).length;
      const pct = sections.length ? Math.round(n / sections.length * 100) : 0;
      toc.querySelector('.pct').textContent = `${n} / ${sections.length} 섹션 완료 (${pct}%)`;
      toc.querySelector('.bar i').style.width = pct + '%';
    }
    updatePct();

    // scroll spy
    const links = toc.querySelectorAll('a[data-id]');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(l => l.classList.toggle('current', l.dataset.id === e.target.id));
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.forEach(s => io.observe(s));
  }

  function chapterNav(chId) {
    const nav = document.querySelector('.ch-nav');
    if (!nav) return;
    const i = CHAPTERS.findIndex(c => c.id === chId);
    const prev = CHAPTERS[i - 1], next = CHAPTERS[i + 1];
    nav.innerHTML =
      (prev ? `<a class="pill" href="${prev.file}">← ${prev.id}. ${prev.title}</a>` : `<a class="pill" href="index.html">← 홈</a>`) +
      (next ? `<a class="pill" href="${next.file}">${next.id}. ${next.title} →</a>` : `<a class="pill" href="index.html">홈으로 →</a>`);
  }

  function renderMath() {
    if (window.renderMathInElement) {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        macros: {
          '\\E': '\\mathbb{E}',
          '\\R': '\\mathbb{R}',
          '\\S': '\\mathcal{S}',
          '\\A': '\\mathcal{A}',
          '\\P': '\\mathcal{P}',
          '\\Rc': '\\mathcal{R}',
          '\\argmax': '\\operatorname*{argmax}',
        },
      });
    }
  }
  window.RL_RENDER_MATH = renderMath;

  document.addEventListener('DOMContentLoaded', () => {
    const chId = document.body.dataset.ch || '';
    document.body.insertAdjacentHTML('afterbegin', header(chId));
    document.body.insertAdjacentHTML('beforeend', footer());
    placeStickers(document);
    if (chId) { buildToc(chId); if (CHAPTERS.some(c => c.id === chId)) chapterNav(chId); }
    renderMath();
  });
})();

// KOL Hi-Fi Dashboard — RN Base Design System
(async () => {
  const KOLS = (typeof __KOLS_DATA !== 'undefined') ? __KOLS_DATA : await fetch('kols.json').then(r => r.json());

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const el = (tag, props={}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(props||{})) {
      if (v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'data') Object.assign(n.dataset, v);
      else if (k === 'style') Object.assign(n.style, v);
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'required') { if (v) n.setAttribute(k, ''); }
      else n.setAttribute(k, v);
    }
    for (const k of kids.flat()) {
      if (k == null || k === false) continue;
      n.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
    }
    return n;
  };

  const initials = (name) => (name||'?').split(/\s+/).map(s=>s[0]||'').slice(0,2).join('').toUpperCase();
  const segClass = (s) => ({
    'Vocal Advocate': 'amplify',
    'Quiet Champion': 'activate',
    'Cautious Skeptic': 'strengthen',
    'Unconvinced Leader': 'realign',
  }[s] || 'activate');
  const segObj = (s) => ({
    'Vocal Advocate': 'Amplify',
    'Quiet Champion': 'Activate',
    'Cautious Skeptic': 'Strengthen',
    'Unconvinced Leader': 'Realign',
  }[s] || '—');
  const segPriority = (s) => ({ 'Vocal Advocate': 1, 'Quiet Champion': 2, 'Unconvinced Leader': 3, 'Cautious Skeptic': 4 }[s] || 5);

  // ── Influence helpers ──
  const INFL_DIMS = ['clinical', 'geographic', 'online'];
  const inflLabel = { clinical: 'Clinical', geographic: 'Geographic', online: 'Online' };
  const inflScore = (k, d) => k.influence?.[d]?.score ?? 0;
  const inflTrend = (k, d) => k.influence?.[d]?.trend || 'flat';
  const inflDetail = (k, d) => k.influenceDetail?.[d] || null;
  const trendArrow = (t) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
  const trendLabel = (t) => t === 'up' ? '12-mo rising' : t === 'down' ? '12-mo declining' : '12-mo flat';
  // Percentile of `k` within its specialty cohort for a dim
  function percentileWithinSpecialty(k, d) {
    const cohort = KOLS.filter(x => (x.specialty || '').trim() === (k.specialty || '').trim());
    if (cohort.length <= 1) return 50;
    const score = inflScore(k, d);
    const below = cohort.filter(x => inflScore(x, d) < score).length;
    return Math.round((below / (cohort.length - 1)) * 100);
  }
  // Peer-group label fragment, e.g. "top 10% in Ped Endo"
  function peerFragment(k, d) {
    const pct = percentileWithinSpecialty(k, d);
    const spec = (k.specialty || '').trim() || 'specialty';
    if (pct >= 90) return `top ${100 - pct}% in ${spec}`;
    if (pct >= 75) return `top quartile in ${spec}`;
    if (pct >= 50) return `above median in ${spec}`;
    if (pct >= 25) return `below median in ${spec}`;
    return `bottom quartile in ${spec}`;
  }
  // Top-quartile threshold across the FILTERED set
  function topQuartileThreshold(list, d) {
    const arr = list.map(k => inflScore(k, d)).sort((a,b) => a - b);
    if (!arr.length) return 0;
    const idx = Math.floor(arr.length * 0.75);
    return arr[Math.min(idx, arr.length - 1)];
  }

  // Toast
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.innerHTML = '';
    t.appendChild(el('i', { 'data-lucide': 'database' }));
    t.appendChild(el('span', {}, msg));
    if (window.lucide) lucide.createIcons();
    t.dataset.show = 'true';
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => { t.dataset.show = 'false'; }, 2400);
  }

  // ── State ──
  const state = {
    search: '',
    tier: new Set(),
    country: new Set(),
    segment: new Set(),
    planned: new Set(),
    influence: { clinical: [0,100], geographic: [0,100], online: [0,100] },
    selection: new Set(), // KOL names selected for compare
    sort: 'name',
    density: 'comfortable',
    theme: 'light',
    groupby: 'none',
  };
  const COMPARE_MAX = 5;
  // Index KOLs by name for selection lookup
  const KOL_BY_NAME = Object.fromEntries(KOLS.map(k => [k.name, k]));

  function filtered() {
    let list = KOLS.slice();
    if (state.tier.size) list = list.filter(k => state.tier.has(k.tier));
    if (state.country.size) list = list.filter(k => state.country.has(k.country));
    if (state.segment.size) list = list.filter(k => state.segment.has(k.segment));
    if (state.planned.size) list = list.filter(k => state.planned.has(k.plannedThisQuarter ? 'planned' : 'unplanned'));
    for (const d of INFL_DIMS) {
      const [lo, hi] = state.influence[d];
      if (lo > 0 || hi < 100) list = list.filter(k => {
        const s = inflScore(k, d);
        return s >= lo && s <= hi;
      });
    }
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter(k =>
        k.name.toLowerCase().includes(q) ||
        (k.institution||'').toLowerCase().includes(q) ||
        (k.specialty||'').toLowerCase().includes(q) ||
        (k.lead||'').toLowerCase().includes(q)
      );
    }
    list.sort((a,b) => {
      if (state.sort === 'name') return a.name.localeCompare(b.name);
      if (state.sort === 'engagements') return b.totalEngagements - a.totalEngagements;
      if (state.sort === 'recent') return (b.quarters[0]||'').localeCompare(a.quarters[0]||'');
      if (state.sort === 'specialty') return (a.specialty||'').localeCompare(b.specialty||'') || a.name.localeCompare(b.name);
      if (state.sort.startsWith('infl-')) {
        const d = state.sort.slice(5);
        return inflScore(b, d) - inflScore(a, d) || a.name.localeCompare(b.name);
      }
      return segPriority(a.segment) - segPriority(b.segment) || a.name.localeCompare(b.name);
    });
    return list;
  }

  // ── Sidebar filter setup ──
  function buildSidebar() {
    const all = KOLS;
    const optionsFor = (key) => {
      if (key === 'tier') return ['ME','Rising Star'];
      if (key === 'country') return [...new Set(all.map(k=>k.country))].sort();
      if (key === 'segment') return [...new Set(all.map(k=>k.segment).filter(Boolean))];
      if (key === 'planned') return ['planned','unplanned'];
      return [];
    };
    const labelFor = (key, v) => {
      if (key === 'planned') return v === 'planned' ? 'Planned this quarter' : 'No planned activity';
      if (key === 'tier' && v === 'ME') return 'Medical Expert';
      return v;
    };
    const countFor = (key, v) => {
      let pool = KOLS.slice();
      // Keep other filters applied; this one excluded so counts stay useful
      for (const k2 of ['tier','country','segment','planned']) {
        if (k2 === key) continue;
        const set = state[k2];
        if (!set.size) continue;
        pool = pool.filter(kol => k2 === 'planned'
          ? set.has(kol.plannedThisQuarter ? 'planned' : 'unplanned')
          : set.has(kol[k2]));
      }
      return pool.filter(kol => key === 'planned'
        ? (kol.plannedThisQuarter ? 'planned' : 'unplanned') === v
        : kol[key] === v).length;
    };

    for (const section of $$('.filter-section[data-key]')) {
      const key = section.dataset.key;
      const list = $('.check-list', section);
      if (!list) continue; // e.g. Influence section uses sliders, not checklist
      list.innerHTML = '';
      for (const v of optionsFor(key)) {
        const on = state[key].has(v);
        list.appendChild(el('div', {
          class: 'check', data: { on: String(on) },
          onClick: () => { on ? state[key].delete(v) : state[key].add(v); render(); }
        },
          el('span', { class: 'bx', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' }),
          el('span', { class: 'label' }, labelFor(key, v)),
          el('span', { class: 'ct' }, String(countFor(key, v))),
        ));
      }
    }
  }

  // Clear buttons
  $$('[data-clear]').forEach(b => b.addEventListener('click', () => {
    const key = b.dataset.clear;
    if (key === 'influence') {
      state.influence = { clinical: [0,100], geographic: [0,100], online: [0,100] };
    } else {
      state[key].clear();
    }
    render();
  }));

  // ── Influence sliders (sidebar) ──
  function buildInfluenceSliders() {
    const host = $('#influenceFilter .infl-list');
    if (!host) return;
    host.innerHTML = '';
    for (const d of INFL_DIMS) {
      const [lo, hi] = state.influence[d];
      const row = el('div', { class: 'infl-slider-row' });
      row.appendChild(el('div', { class: 'lbl' },
        el('span', { class: `dot dim-${d}` }), inflLabel[d]
      ));
      // Build dual-handle range
      const dual = el('div', { class: `range-dual dim-${d}` });
      const track = el('div', { class: 'track' });
      const fill = el('div', { class: 'fill', style: { left: `${lo}%`, right: `${100 - hi}%` } });
      const minIn = el('input', { type: 'range', min: 0, max: 100, step: 1, value: String(lo) });
      const maxIn = el('input', { type: 'range', min: 0, max: 100, step: 1, value: String(hi) });
      const valsDisplay = el('div', { class: 'vals' }, `${lo}–${hi}`);
      const onInput = () => {
        let a = +minIn.value, b = +maxIn.value;
        if (a > b) { [a, b] = [b, a]; }
        state.influence[d] = [a, b];
        fill.style.left = `${a}%`;
        fill.style.right = `${100 - b}%`;
        valsDisplay.textContent = `${a}–${b}`;
      };
      minIn.addEventListener('input', onInput);
      maxIn.addEventListener('input', onInput);
      const onChange = () => render();
      minIn.addEventListener('change', onChange);
      maxIn.addEventListener('change', onChange);
      dual.appendChild(track); dual.appendChild(fill);
      dual.appendChild(minIn); dual.appendChild(maxIn);
      row.appendChild(dual);
      row.appendChild(valsDisplay);
      host.appendChild(row);
    }
  }

  // Search input
  $('#search').addEventListener('input', e => { state.search = e.target.value; render(); });
  // Sort
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });

  // ── KPIs ──
  function renderKpis() {
    const list = filtered();
    const total = list.length;
    const me = list.filter(k => k.tier === 'ME').length;
    const rs = list.filter(k => k.tier === 'Rising Star').length;
    const eng = list.reduce((s,k) => s + (k.totalEngagements||0), 0);
    const planned = list.filter(k => k.plannedThisQuarter).length;
    const segCounts = {};
    for (const k of list) if (k.segment) segCounts[k.segment] = (segCounts[k.segment]||0)+1;

    const segOrder = ['Vocal Advocate','Quiet Champion','Unconvinced Leader','Cautious Skeptic'];
    const segTotal = Object.values(segCounts).reduce((a,b)=>a+b,0) || 1;

    const kpis = $('#kpis');
    kpis.innerHTML = '';
    kpis.appendChild(el('div', { class: 'kpi' },
      el('div', { class: 'l' }, el('i', { 'data-lucide': 'users' }), 'KOLs in view'),
      el('div', { class: 'v' }, String(total), el('span', { class: 'small' }, ` of ${KOLS.length}`)),
      el('div', { class: 'meta' },
        el('span', { class: 'tag tier-me' }, `Medical Expert · ${me}`),
        el('span', { class: 'tag tier-rs' }, `Rising Star · ${rs}`),
      ),
    ));

    kpis.appendChild(el('div', { class: 'kpi' },
      el('div', { class: 'l' }, el('i', { 'data-lucide': 'calendar-check' }), 'Engagements YTD'),
      el('div', { class: 'v' }, String(eng)),
      el('div', { class: 'meta' },
        el('span', { class: 'tag' }, 'planned + completed'),
      ),
    ));

    const pct = Math.round(planned / Math.max(total,1) * 100);
    kpis.appendChild(el('div', { class: 'kpi' },
      el('div', { class: 'l' }, el('i', { 'data-lucide': 'target' }), 'Planned this quarter'),
      el('div', { class: 'v' }, `${planned}`, el('span', { class: 'small' }, ` / ${total}`)),
      el('div', { class: 'meta' },
        el('span', { class: 'tag', style:{background:'rgba(19,211,119,.08)', borderColor:'rgba(19,211,119,.3)', color:'rgb(15,160,90)'} }, `${pct}% coverage`),
      ),
    ));

    const segBars = el('div', { class: 'seg-bars' });
    const segLegend = el('div', { class: 'seg-legend' });
    for (const s of segOrder) {
      const c = segCounts[s] || 0;
      if (!c) continue;
      const cls = segClass(s);
      segBars.appendChild(el('span', { class: `b ${cls}`, style: { flex: String(c) } }));
      segLegend.appendChild(el('span', {}, el('span', { class: `dot ${cls}` }), `${segObj(s)} · ${c}`));
    }
    // ── Influence Coverage (replaces Segment Mix) ──
    const cov = el('div', { class: 'infl-cov' });
    const dimCounts = {};
    let weakest = null, weakestPct = 100;
    for (const d of INFL_DIMS) {
      const thresh = topQuartileThreshold(list, d);
      const tq = list.filter(k => inflScore(k, d) >= thresh && inflScore(k, d) > 0).length;
      dimCounts[d] = tq;
      const pct = total ? Math.round(tq / total * 100) : 0;
      const isGap = tq <= 4 || pct < 20;
      if (pct < weakestPct) { weakestPct = pct; weakest = d; }
      cov.appendChild(el('div', { class: `infl-cov-row dim-${d}${isGap ? ' gap' : ''}` },
        el('div', { class: 'nm' }, el('span', { class: `dot dim-${d}` }), inflLabel[d]),
        el('div', { class: 'bar' }, el('div', { class: 'fill', style: { width: `${pct}%` } })),
        el('div', { class: 'ct' }, `${tq}/${total}`),
      ));
    }
    const headlineDim = weakest || 'online';
    const headlineCt = dimCounts[headlineDim];
    kpis.appendChild(el('div', { class: 'kpi' },
      el('div', { class: 'l' }, el('i', { 'data-lucide': 'target' }), 'Influence coverage'),
      el('div', { class: 'v', style: { fontSize: '24px', marginTop: '6px' } },
        `${inflLabel[headlineDim]}: ${headlineCt} of ${total}`,
        el('span', { class: 'small', style: { fontSize: '13px' } }, ' top-quartile'),
      ),
      cov,
    ));
  }

  // ── Active filter chips ──
  function renderActiveFilters() {
    const af = $('#activeFilters');
    af.innerHTML = '';
    const add = (key, val, lbl) => {
      af.appendChild(el('div', { class: 'filter-chip' },
        el('span', {}, lbl),
        el('button', { onClick: () => { state[key].delete(val); render(); } },
          el('i', { 'data-lucide': 'x' })),
      ));
    };
    for (const v of state.tier) add('tier', v, v);
    for (const v of state.country) add('country', v, v);
    for (const v of state.segment) add('segment', v, segObj(v));
    for (const v of state.planned) add('planned', v, v === 'planned' ? 'Has planned activity' : 'No planned activity');
    for (const d of INFL_DIMS) {
      const [lo, hi] = state.influence[d];
      if (lo > 0 || hi < 100) {
        af.appendChild(el('div', { class: 'filter-chip' },
          el('span', {}, el('span', { class: `dot dim-${d}`, style: { width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block', marginRight: '5px', verticalAlign: 'middle' } }),
            `${inflLabel[d]} ${lo}–${hi}`),
          el('button', { onClick: () => { state.influence[d] = [0, 100]; render(); } },
            el('i', { 'data-lucide': 'x' })),
        ));
      }
    }
    if (state.search) {
      af.appendChild(el('div', { class: 'filter-chip' },
        el('span', {}, `“${state.search}”`),
        el('button', { onClick: () => { state.search = ''; $('#search').value = ''; render(); } },
          el('i', { 'data-lucide': 'x' })),
      ));
    }
    if (af.children.length) {
      af.appendChild(el('button', { class: 'btn ghost', style: { height: '26px', padding: '0 10px', fontSize: '12px' },
        onClick: () => {
          state.tier.clear(); state.country.clear(); state.segment.clear(); state.planned.clear();
          state.influence = { clinical: [0,100], geographic: [0,100], online: [0,100] };
          state.search=''; $('#search').value=''; render();
        }
      }, 'Clear all'));
    }
  }

  // ── Influence cell (sortable + hover tooltip + click-to-open) ──
  function inflCell(k, d) {
    const score = inflScore(k, d);
    const trend = inflTrend(k, d);
    const cell = el('div', { class: `infl-cell dim-${d}`,
      onClick: (e) => { e.stopPropagation(); openProfile(k, d); },
      onMouseEnter: (e) => showInflTip(e.currentTarget, k, d),
      onMouseLeave: hideInflTip,
    },
      el('div', { class: 'infl-bar' }, el('div', { class: 'fill', style: { width: `${score}%` } })),
      el('span', { class: 'num' }, String(score)),
    );
    return cell;
  }
  let _inflTipNode = null;
  function showInflTip(target, k, d) {
    hideInflTip();
    const score = inflScore(k, d);
    const pct = percentileWithinSpecialty(k, d);
    const trend = inflTrend(k, d);
    const arrow = trendArrow(trend);
    const tip = el('div', { class: 'infl-tip' },
      el('div', { class: 'pct' }, el('strong', {}, `${score}`), ` — ${peerFragment(k, d)}`),
      el('div', { class: 'trend' },
        el('span', { class: `arrow ${trend}` }, arrow), trendLabel(trend),
      ),
    );
    document.body.appendChild(tip);
    const r = target.getBoundingClientRect();
    tip.style.left = `${r.left + r.width / 2}px`;
    tip.style.top = `${r.top + window.scrollY}px`;
    _inflTipNode = tip;
  }
  function hideInflTip() {
    if (_inflTipNode) { _inflTipNode.remove(); _inflTipNode = null; }
  }

  // ── Table ──
  function rowFor(k) {
    const isSel = state.selection.has(k.name);
    const atMax = state.selection.size >= COMPARE_MAX && !isSel;
    const tr = el('tr', {
      class: isSel ? 'sel' : '',
      onClick: (e) => { if (!e.target.closest('button') && !e.target.closest('.infl-cell') && !e.target.closest('.cb-cell')) openProfile(k); },
      style:{cursor:'pointer'}
    },
      el('td', { class: 'cb-cell', onClick: (e) => e.stopPropagation() },
        el('label', { class: `cb${atMax ? ' disabled' : ''}`, title: atMax ? `Max ${COMPARE_MAX} for compare` : 'Select to compare' },
          el('input', { type: 'checkbox', checked: isSel, disabled: atMax,
            onChange: (e) => toggleSelection(k.name, e.target.checked) }),
          el('span', { class: 'cb-box' }, el('i', { 'data-lucide': 'check' })),
        )
      ),
      el('td', { class: 'name-cell' },
        el('div', { class: 'wrap' },
          el('div', { class: 'avatar' }, initials(k.name)),
          el('div', {},
            el('div', { class: 'nm' }, k.name),
            el('div', { class: 'inst' }, k.institution),
          )
        )
      ),
      el('td', {}, el('span', { class: `tag tier-${k.tier === 'ME' ? 'me' : 'rs'}` }, k.tier === 'ME' ? 'Medical Expert' : k.tier)),
      el('td', {}, k.segment
        ? el('span', { class: `tag seg seg-${segClass(k.segment)}` }, segObj(k.segment))
        : el('span', { style:{ color: 'var(--gray-500)' } }, '—')),
      el('td', {}, el('span', {}, k.country)),
      el('td', {}, k.specialty || el('span', { style:{ color: 'var(--gray-500)' } }, '—')),
      el('td', {}, inflCell(k, 'clinical')),
      el('td', {}, inflCell(k, 'geographic')),
      el('td', {}, inflCell(k, 'online')),
      el('td', {}, k.lead || el('span', { style:{ color: 'var(--gray-500)' } }, '—')),
      el('td', {}, el('span', { style:{fontFamily:'var(--font-mono)', fontSize:'12px'} }, k.quarters[0] || '—')),
      el('td', {},
        el('div', { class: 'eng-cell' },
          el('div', { class: 'eng-bar' }, el('div', { class: 'fill', style:{ width: `${Math.min(k.totalEngagements/30*100, 100)}%` } })),
          el('span', { class: 'num' }, String(k.totalEngagements)),
        )
      ),
      el('td', { class: 'actions-cell' },
        el('button', { class: 'icon-btn', title: 'Open profile', onClick: () => openProfile(k) },
          el('i', { 'data-lucide': 'eye' })),
      ),
    );
    return tr;
  }

  function renderTable() {
    const list = filtered();
    $('#count').innerHTML = `<strong>${list.length}</strong> of ${KOLS.length} KOLs`;

    const card = $('#tableCard');
    card.innerHTML = '';

    if (!list.length) {
      card.appendChild(el('div', { class: 'empty' },
        el('i', { 'data-lucide': 'search-x', style:{width:'32px',height:'32px',color:'var(--gray-500)'} }),
        el('h3', {}, 'No KOLs match your filters'),
        el('p', {}, 'Try clearing some filters or adjusting your search.'),
        el('button', { class: 'btn outline', onClick: () => {
          state.tier.clear(); state.country.clear(); state.segment.clear(); state.planned.clear();
          state.search = ''; $('#search').value=''; render();
        }}, 'Clear all filters'),
      ));
      return;
    }

    const headers = [
      [{ html: '', plain: '' }, null], // checkbox column
      ['Name','name'], ['Tier','tier'], ['Segment','segment'], ['Country','country'],
      ['Specialty', 'specialty'],
      [{ html: '<span class="hdr-dot dim-clinical"></span>Clinical', plain: 'Clinical' }, 'infl-clinical'],
      [{ html: '<span class="hdr-dot dim-geographic"></span>Geographic', plain: 'Geographic' }, 'infl-geographic'],
      [{ html: '<span class="hdr-dot dim-online"></span>Online', plain: 'Online' }, 'infl-online'],
      ['Lead','lead'], ['Quarter','recent'], ['Engagements','engagements'], ['', null]
    ];
    const thead = el('thead', {}, el('tr', {},
      ...headers.map(([h, sortKey]) => {
        const isComplex = h && typeof h === 'object';
        return el('th', {},
          sortKey ? el('button', {
            class: state.sort === sortKey ? 'active' : '',
            onClick: () => { state.sort = sortKey; render(); },
            ...(isComplex ? { html: h.html } : {})
          },
            ...(isComplex ? [] : [h]),
            el('i', { 'data-lucide': state.sort === sortKey ? 'arrow-down' : 'chevrons-up-down' })
          )
          : (isComplex ? h.plain : h)
        );
      })
    ));

    const table = el('table', { class: 'kol' });
    table.appendChild(thead);

    if (state.groupby === 'none') {
      const tb = el('tbody');
      for (const k of list) tb.appendChild(rowFor(k));
      table.appendChild(tb);
    } else {
      const groups = {};
      for (const k of list) {
        const g = k[state.groupby] || '—';
        groups[g] = groups[g] || [];
        groups[g].push(k);
      }
      const order = Object.keys(groups).sort((a,b) => groups[b].length - groups[a].length);
      for (const g of order) {
        const tb = el('tbody');
        tb.appendChild(el('tr', { style: { background: 'var(--gray-50)' } },
          el('td', { colspan: 13, style: { padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gray-500)' } },
            `${g} · ${groups[g].length} KOL${groups[g].length>1?'s':''}`)
        ));
        for (const k of groups[g]) tb.appendChild(rowFor(k));
        table.appendChild(tb);
      }
    }
    card.appendChild(table);
  }

  // ── Drawer ──
  // Deterministic 12-point series for a sparkline based on a seed, ending near `score`
  function sparkSeries(seed, score, trend) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = (h * 16777619) >>> 0; }
    const rand = () => { h = (h * 1664525 + 1013904223) >>> 0; return (h >>> 0) / 4294967295; };
    const slope = trend === 'up' ? 1 : trend === 'down' ? -1 : 0;
    const start = clamp(score - slope * 14 + (rand() - 0.5) * 6, 5, 95);
    const arr = [];
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const base = start + (score - start) * t;
      const noise = (rand() - 0.5) * 8;
      arr.push(clamp(Math.round(base + noise), 0, 100));
    }
    arr[arr.length - 1] = score;
    return arr;
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function buildSparkline(arr, dim) {
    const W = 220, H = 36, pad = 2;
    const max = 100, min = 0;
    const stepX = (W - pad * 2) / (arr.length - 1);
    const pts = arr.map((v, i) => [pad + i * stepX, pad + (1 - (v - min) / (max - min)) * (H - pad * 2)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = `M${pts[0][0]},${H - pad} ` + pts.map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ` L${pts[pts.length - 1][0]},${H - pad} Z`;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', `sparkline dim-${dim}`);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const fill = document.createElementNS(ns, 'path');
    fill.setAttribute('d', area);
    fill.setAttribute('class', 'sl-fill');
    const line = document.createElementNS(ns, 'path');
    line.setAttribute('d', d);
    line.setAttribute('class', 'sl-line');
    line.setAttribute('fill', 'none');
    const dot = document.createElementNS(ns, 'circle');
    const last = pts[pts.length - 1];
    dot.setAttribute('cx', last[0]); dot.setAttribute('cy', last[1]);
    dot.setAttribute('r', '2.5');
    dot.setAttribute('class', 'sl-dot');
    svg.appendChild(fill); svg.appendChild(line); svg.appendChild(dot);
    // Wrap with caption
    const wrap = el('div', { class: 'spark-wrap' });
    wrap.appendChild(el('div', { class: 'spark-cap' }, '12-month trend'));
    wrap.appendChild(svg);
    return wrap;
  }

  function openProfile(k, expandedDim) {
    hideInflTip();
    const drawer = $('#drawer');
    drawer.innerHTML = '';

    // Head
    const head = el('div', { class: 'drawer-head' },
      el('button', { class: 'drawer-close', onClick: closeProfile }, el('i', { 'data-lucide': 'x' })),
      el('div', { class: 'head-row' },
        el('div', { class: 'photo' }, initials(k.name)),
        el('div', { style: { flex: 1, minWidth: 0 } },
          el('h2', {}, k.name),
          el('div', { class: 'meta' }, k.institution, k.specialty ? ` · ${k.specialty}` : ''),
          el('div', { class: 'tags' },
            el('span', { class: `tag tier-${k.tier === 'ME' ? 'me' : 'rs'}` }, k.tier),
            k.focusArea ? el('span', { class: 'tag' }, k.focusArea) : null,
            k.segment ? el('span', { class: `tag seg seg-${segClass(k.segment)}` }, segObj(k.segment)) : null,
            el('span', { class: 'tag' }, k.country),
            k.plannedThisQuarter ? el('span', { class: 'tag', style:{background:'rgba(19,211,119,.1)', borderColor:'rgba(19,211,119,.3)', color:'rgb(15,160,90)'} }, '● Planned this Q') : null,
          ),
        ),
      ),
    );
    drawer.appendChild(head);

    // Body
    const body = el('div', { class: 'drawer-body' });

    // Profile details
    body.appendChild(el('section', { class: 'section' },
      el('div', { class: 'section-head' }, 'Profile'),
      el('dl', { class: 'kv' },
        el('dt', {}, 'Lead'), el('dd', {}, k.lead || '—'),
        el('dt', {}, 'Research focus'), el('dd', {}, k.research || el('em', { style:{color:'var(--gray-500)'} }, 'Not specified')),
        el('dt', {}, 'Engagement plan'), el('dd', {}, `${k.totalEngagements} engagement${k.totalEngagements===1?'':'s'} across ${k.engagements.length} planned activit${k.engagements.length===1?'y':'ies'}`),
        el('dt', {}, 'Quarters'), el('dd', {}, k.quarters.join(' · ') || '—'),
      )
    ));

    // Influence section (expanded with sub-components, sparkline, completeness, source)
    const inflSec = el('section', { class: 'section', id: 'profile-influence' },
      el('div', { class: 'section-head' }, 'Influence',
        el('button', { class: 'src-link', title: 'How is this calculated?',
          onClick: (e) => { e.stopPropagation(); toast('Influence model: clinical = guideline authorship + trial leadership + citations · geographic = referral graph + multi-site reach · online = peer-reviewed mentions + conference presence. Refreshed weekly from public sources.'); } },
          el('i', { 'data-lucide': 'info' }), 'How is this calculated?'),
      ),
    );
    const inflScroll = el('div', { class: 'infl-detail-scroll' });
    const inflGrid = el('div', { class: 'infl-detail' });
    for (const d of INFL_DIMS) {
      const score = inflScore(k, d);
      const trend = inflTrend(k, d);
      const detail = inflDetail(k, d);
      const isExpanded = d === expandedDim;
      const card = el('div', { class: `card dim-${d}${isExpanded ? ' expanded' : ''}` });
      // Header line
      card.appendChild(el('div', { class: 'head-line' },
        el('span', { class: 'nm' }, inflLabel[d]),
        el('span', { class: `trend ${trend}` }, trendArrow(trend), trend === 'flat' ? 'flat' : trend === 'up' ? 'rising' : 'declining'),
      ));
      card.appendChild(el('div', { class: 'score' }, String(score)));
      card.appendChild(el('div', { class: 'pct' }, peerFragment(k, d)));
      card.appendChild(el('div', { class: 'bar' }, el('div', { class: 'fill', style: { width: `${score}%` } })));
      // Sparkline (12-mo) — use real trajectory if available, otherwise synthesize
      const traj = detail && detail.trajectory && detail.trajectory.length ? detail.trajectory : sparkSeries(k.name + ':' + d, score, trend);
      card.appendChild(buildSparkline(traj, d));
      // Sub-components
      const subs = detail && (detail.subs || detail.components);
      if (subs && subs.length) {
        const compList = el('ul', { class: 'sub-comp' });
        for (const c of subs) {
          const v = c.score != null ? c.score : c.value;
          compList.appendChild(el('li', {},
            el('span', { class: 'lbl' }, c.label),
            el('span', { class: 'mini-bar' }, el('span', { class: 'mfill', style: { width: `${v}%` } })),
            el('span', { class: 'val' }, String(v)),
          ));
        }
        card.appendChild(compList);
      }
      // Completeness + source
      if (detail) {
        const compRaw = detail.completeness;
        const compPct = typeof compRaw === 'number' ? compRaw : (compRaw === 'full' ? 95 : compRaw === 'partial' ? 65 : 40);
        const compLabel = typeof compRaw === 'string' ? compRaw : `${compPct}% complete`;
        const recCounts = detail.recordCounts;
        const recSummary = recCounts ? Object.entries(recCounts).map(([k,v]) => `${v} ${k.toLowerCase()}`).join(' \u00b7 ') : '';
        const metaWrap = el('div', { class: 'meta-wrap' });
        metaWrap.appendChild(el('div', { class: 'meta-line' },
          el('span', { class: 'completeness' },
            el('i', { 'data-lucide': compPct >= 75 ? 'check-circle-2' : compPct >= 50 ? 'alert-circle' : 'help-circle' }),
            compLabel,
          ),
          el('button', { class: 'src-btn', onClick: (e) => { e.stopPropagation(); toast(`${inflLabel[d]} pulls from ${recSummary || 'public sources'}. Refreshed weekly.`); } },
            el('i', { 'data-lucide': 'external-link' }),
            'Source'
          ),
        ));
        if (recSummary) {
          metaWrap.appendChild(el('div', { class: 'rec-summary' }, recSummary));
        }
        card.appendChild(metaWrap);
      }
      inflGrid.appendChild(card);
    }
    inflScroll.appendChild(inflGrid);
    inflSec.appendChild(inflScroll);
    body.appendChild(inflSec);

    // Outcomes & next steps
    if (k.outcomes || k.nextSteps) {
      const sec = el('section', { class: 'section' },
        el('div', { class: 'section-head' }, 'Outcomes & next steps'),
      );
      if (k.outcomes) {
        sec.appendChild(el('div', { class: 'insight' },
          el('div', { class: 'label' }, el('i', { 'data-lucide': 'lightbulb' }), 'Insights from this quarter'),
          el('p', {}, k.outcomes),
        ));
      }
      if (k.nextSteps) {
        sec.appendChild(el('div', { class: 'insight next' },
          el('div', { class: 'label' }, el('i', { 'data-lucide': 'arrow-right-circle' }), 'Next steps'),
          el('p', {}, k.nextSteps),
        ));
      }
      body.appendChild(sec);
    }

    // Timeline
    const tlSec = el('section', { class: 'section' }, el('div', { class: 'section-head' }, 'Engagement timeline'));
    const tl = el('div', { class: 'timeline' });
    const byQ = {};
    for (const e of k.engagements) {
      const q = (e.quarter || 'Unscheduled').split('\n')[0] || 'Unscheduled';
      byQ[q] = byQ[q] || [];
      byQ[q].push(e);
    }
    const sortedQs = Object.keys(byQ).sort();
    for (const q of sortedQs) {
      const events = el('div', { class: 'events' });
      byQ[q].forEach((e, idx) => {
        // Mock: if outcomes present, mark first 1-2 events as actual
        const isActual = !!k.outcomes && idx < 2;
        events.appendChild(el('div', { class: `tl-event ${isActual ? 'actual' : 'planned'}` },
          el('div', { class: 'top' },
            el('span', { class: 'status' }, isActual ? 'Completed' : 'Planned'),
            e.scope ? el('span', { class: 'tag', style:{height:'20px',fontSize:'10.5px'} }, e.scope.split('\n')[0]) : null,
          ),
          el('div', { class: 'objective' }, e.objective || e.type || '—'),
          e.channel ? el('div', { class: 'channel' },
            el('i', { 'data-lucide': 'message-circle' }),
            e.channel.split('\n')[0]
          ) : null,
        ));
      });
      tl.appendChild(el('div', { class: 'tl-q' },
        el('div', { class: 'qlabel' }, q),
        events,
      ));
    }
    tlSec.appendChild(tl);
    body.appendChild(tlSec);

    // Stakeholders
    if (k.stakeholders.length || k.lead) {
      const sec = el('section', { class: 'section' },
        el('div', { class: 'section-head' }, 'Stakeholders'),
        el('div', { class: 'stake-grid' },
          k.lead ? el('div', { class: 'stake lead' },
            el('span', { class: 'av' }, initials(k.lead)),
            k.lead,
            el('span', { class: 'role' }, 'Lead'),
          ) : null,
          ...k.stakeholders.slice(0, 12).map(s => el('div', { class: 'stake' },
            el('span', { class: 'av' }, initials(s)),
            s,
          ))
        ),
      );
      body.appendChild(sec);
    }

    // Mock activity feed
    const feedItems = mockFeed(k);
    if (feedItems.length) {
      body.appendChild(el('section', { class: 'section' },
        el('div', { class: 'section-head' }, 'Activity feed'),
        el('div', { class: 'feed' },
          ...feedItems.map(f => el('div', { class: 'feed-item' },
            el('div', { class: 'av' }, initials(f.who)),
            el('div', {},
              el('div', { class: 'meta' }, el('strong', {}, f.who), ' · ', f.when),
              el('div', { class: 'body' }, f.body),
            ),
          ))
        ),
      ));
    }

    drawer.appendChild(body);
    $('#scrim').dataset.open = 'true';
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
    if (expandedDim) {
      // Scroll the influence section into view inside the drawer (NOT scrollIntoView)
      requestAnimationFrame(() => {
        const sec = $('#profile-influence', drawer);
        if (sec) drawer.scrollTo({ top: sec.offsetTop - 12, behavior: 'smooth' });
      });
    }
  }
  window.openProfile = openProfile; // exposed for cross-script use

  function closeProfile() {
    $('#scrim').dataset.open = 'false';
    document.body.style.overflow = '';
  }
  $('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim') closeProfile(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProfile(); });

  function mockFeed(k) {
    const lead = k.lead || 'Lead';
    const out = [];
    if (k.outcomes) out.push({ who: lead, when: '2 days ago', body: 'Logged outcomes from this quarter\'s engagement; see Insights block above.' });
    if (k.engagements[0]) out.push({ who: lead, when: '1 week ago', body: `Confirmed ${(k.engagements[0].channel||'engagement').split('\n')[0]} for ${k.engagements[0].quarter}.` });
    out.push({ who: 'MSL Team', when: '3 weeks ago', body: 'Shared scientific exchange briefing with stakeholders ahead of upcoming touchpoint.' });
    if (k.segment) out.push({ who: lead, when: 'Last quarter', body: `Updated segment to ${segObj(k.segment)} (${k.segment}) based on most recent interactions.` });
    return out;
  }

  // ── Selection + Compare ──
  function toggleSelection(name, on) {
    if (on) {
      if (state.selection.size >= COMPARE_MAX) return;
      state.selection.add(name);
    } else {
      state.selection.delete(name);
    }
    render();
  }
  function renderSelectionBar() {
    const bar = $('#selectionBar');
    if (!bar) return;
    const n = state.selection.size;
    bar.dataset.show = n > 0 ? 'true' : 'false';
    $('#selectionCount').textContent = `${n} selected`;
    const hint = $('#selectionHint');
    if (n < 2) hint.textContent = `Pick ${2 - n} more to compare side-by-side`;
    else if (n >= COMPARE_MAX) hint.textContent = `Maximum ${COMPARE_MAX} \u2014 deselect to swap`;
    else hint.textContent = `Compare up to ${COMPARE_MAX} side-by-side`;
    const btn = $('#compareBtn');
    btn.disabled = n < 2;
  }
  $('#clearSelection').addEventListener('click', () => { state.selection.clear(); render(); });
  $('#compareBtn').addEventListener('click', () => openCompare());

  function openCompare() {
    const names = [...state.selection];
    const list = names.map(n => KOL_BY_NAME[n]).filter(Boolean);
    if (list.length < 2) return;
    const scrim = $('#compareScrim');
    const modal = $('#compareModal');
    modal.innerHTML = '';

    // Header
    modal.appendChild(el('div', { class: 'compare-head' },
      el('div', {},
        el('h2', {}, 'Compare KOLs'),
        el('div', { class: 'sub' }, `${list.length} KOLs side-by-side — influence breakdown, engagement history, and compliance signals.`),
      ),
      el('button', { class: 'x', onClick: closeCompare }, el('i', { 'data-lucide': 'x' })),
    ));

    // Body — per-KOL cards
    const body = el('div', { class: 'compare-body' });
    const grid = el('div', { class: 'compare-grid', style: { gridTemplateColumns: `repeat(${list.length}, minmax(260px, 1fr))` } });

    for (const k of list) {
      const card = el('div', { class: 'compare-card' });
      card.appendChild(el('div', { class: 'card-head' },
        el('div', { class: 'photo' }, initials(k.name)),
        el('div', { style: { flex: 1, minWidth: 0 } },
          el('div', { class: 'nm' }, k.name),
          el('div', { class: 'meta' }, k.institution),
        ),
        el('button', {
          title: 'Remove from compare',
          style: { width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' },
          onClick: () => {
            state.selection.delete(k.name);
            if (state.selection.size < 2) { closeCompare(); }
            else { openCompare(); }
            render();
          }
        }, el('i', { 'data-lucide': 'x', style: { width: '14px', height: '14px' } })),
      ));
      card.appendChild(el('div', { class: 'card-tags' },
        el('span', { class: `tag tier-${k.tier === 'ME' ? 'me' : 'rs'}` }, k.tier),
        k.segment ? el('span', { class: `tag seg seg-${segClass(k.segment)}` }, segObj(k.segment)) : null,
        el('span', { class: 'tag' }, k.country),
        k.specialty ? el('span', { class: 'tag' }, k.specialty) : null,
      ));

      // Influence section
      const inflSec = el('div', { class: 'compare-section' },
        el('div', { class: 'label' }, 'Influence'),
      );
      for (const d of INFL_DIMS) {
        const score = inflScore(k, d);
        const trend = inflTrend(k, d);
        inflSec.appendChild(el('div', { class: `infl-row dim-${d}` },
          el('span', { class: 'nm' }, el('span', { class: `dot dim-${d}` }), inflLabel[d]),
          el('span', { class: 'bar' }, el('span', { class: 'fill', style: { width: `${score}%` } })),
          el('span', { class: `v${score >= 80 ? ' high' : ''}`, title: peerFragment(k, d) }, `${score} ${trendArrow(trend)}`),
        ));
      }
      const bd = bestDim(k);
      inflSec.appendChild(el('div', { style: { fontSize: '11px', color: 'var(--gray-500)', marginTop: '10px', lineHeight: '1.45', fontStyle: 'italic' } },
        `Strongest: ${inflLabel[bd]} — ${peerFragment(k, bd)}`
      ));
      card.appendChild(inflSec);

      // Engagement history
      const engSec = el('div', { class: 'compare-section' },
        el('div', { class: 'label' }, 'Engagement history'),
      );
      const engHist = el('div', { class: 'eng-history' });
      engHist.appendChild(el('div', { class: 'eng-history-row' },
        el('span', { class: 'q' }, 'Total'),
        el('span', { class: 'what' }, `${k.engagements.length} planned activit${k.engagements.length === 1 ? 'y' : 'ies'}`),
        el('span', { class: 'ct' }, `${k.totalEngagements} engagements`),
      ));
      const byQ = {};
      for (const e of k.engagements) {
        const q = (e.quarter || '').split('\n')[0] || '—';
        byQ[q] = byQ[q] || [];
        byQ[q].push(e);
      }
      const sortedQs = Object.keys(byQ).sort();
      for (const q of sortedQs.slice(0, 5)) {
        const evs = byQ[q];
        const summary = evs[0].objective || evs[0].type || (evs[0].channel || '').split('\n')[0] || 'Activity';
        engHist.appendChild(el('div', { class: 'eng-history-row' },
          el('span', { class: 'q' }, q),
          el('span', { class: 'what', title: summary }, summary),
          el('span', { class: 'ct' }, `${evs.length}`),
        ));
      }
      if (sortedQs.length === 0) {
        engHist.appendChild(el('div', { style: { fontSize: '12px', color: 'var(--gray-500)', fontStyle: 'italic' } }, 'No engagements scheduled'));
      }
      engSec.appendChild(engHist);
      card.appendChild(engSec);

      // Compliance signals
      const cmpl = mockCompliance(k);
      const cmplSec = el('div', { class: 'compare-section' },
        el('div', { class: 'label' }, 'Compliance signals'),
        el('div', { class: 'compliance-stub' },
          el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' } },
            el('span', {}, 'Disclosures'), cmpl.disclosures),
          el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: '1px dashed var(--border)' } },
            el('span', {}, 'FMV bracket'), cmpl.fmv),
          el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: '1px dashed var(--border)' } },
            el('span', {}, 'Sunshine'), cmpl.sunshine),
          el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: '1px dashed var(--border)' } },
            el('span', {}, 'Last review'), cmpl.lastReview),
        ),
      );
      card.appendChild(cmplSec);

      card.appendChild(el('div', { class: 'compare-section', style: { padding: '12px 20px' } },
        el('button', { class: 'btn outline', style: { width: '100%', justifyContent: 'center' }, onClick: () => { closeCompare(); openProfile(k); } },
          el('i', { 'data-lucide': 'eye' }), 'Open full profile'),
      ));

      grid.appendChild(card);
    }

    body.appendChild(grid);
    modal.appendChild(body);

    // Footer
    modal.appendChild(el('div', { style: { padding: '14px 32px 20px', borderTop: '1px solid var(--border)', fontSize: '11.5px', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '6px' } },
      el('i', { 'data-lucide': 'info', style: { width: '13px', height: '13px' } }),
      'Compliance fields are illustrative — wired to your governance system in production.',
    ));

    scrim.dataset.open = 'true';
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
  }
  function bestDim(k) {
    let best = 'clinical', bestScore = -1;
    for (const d of INFL_DIMS) {
      const s = inflScore(k, d);
      if (s > bestScore) { bestScore = s; best = d; }
    }
    return best;
  }
  function closeCompare() {
    $('#compareScrim').dataset.open = 'false';
    if ($('#scrim').dataset.open !== 'true') document.body.style.overflow = '';
  }
  $('#compareScrim').addEventListener('click', e => { if (e.target.id === 'compareScrim') closeCompare(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#compareScrim').dataset.open === 'true') closeCompare();
  });
  // Mock compliance signals (deterministic per name)
  function mockCompliance(k) {
    let h = 5381;
    for (let i = 0; i < k.name.length; i++) h = ((h << 5) + h + k.name.charCodeAt(i)) >>> 0;
    const r = (n) => { h = (h * 1664525 + 1013904223) >>> 0; return h % n; };
    const disclosure = ['Current', 'Current', 'Current', 'Pending update'][r(4)];
    const fmv = ['Tier 1 ($1.5K/hr)', 'Tier 2 ($2.5K/hr)', 'Tier 3 ($3.5K/hr)'][r(3)];
    const sunshine = k.country === 'Japan' ? 'N/A (non-US)' : (r(2) ? 'Yes \u2014 reported' : 'No');
    const months = ['Jan', 'Mar', 'Apr', 'Jun', 'Aug', 'Oct'][r(6)];
    const review = `${months} 2025`;
    const dot = (txt, ok) => el('span', { class: `compl-dot ${ok ? 'ok' : 'warn'}` },
      el('i', { 'data-lucide': ok ? 'shield-check' : 'shield-alert' }), txt);
    return {
      disclosures: dot(disclosure, disclosure === 'Current'),
      fmv: el('span', { class: 'fmv' }, fmv),
      sunshine: dot(sunshine, sunshine !== 'Pending update'),
      lastReview: el('span', { style: { fontFamily: 'var(--font-mono)', fontSize: '12px' } }, review),
    };
  }

  // ── Tweaks ──
  const tweaks = $('#tweaks'), tweaksToggle = $('#tweaksToggle');
  tweaksToggle.addEventListener('click', () => {
    const open = tweaks.dataset.open !== 'true';
    tweaks.dataset.open = String(open);
  });
  $('#tweaksClose').addEventListener('click', () => tweaks.dataset.open = 'false');
  $$('.seg-ctrl').forEach(seg => {
    const key = seg.dataset.tweak;
    if (!key) return;
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach(b => b.dataset.on = 'false');
        btn.dataset.on = 'true';
        state[key] = btn.dataset.val;
        if (key === 'theme') document.body.dataset.theme = btn.dataset.val;
        else if (key === 'density') document.body.dataset.density = btn.dataset.val;
        else if (key === 'groupby') document.body.dataset.groupby = btn.dataset.val;
        render();
      });
    });
  });

  // ── Render ──
  function render() {
    document.body.dataset.density = state.density;
    document.body.dataset.theme = state.theme;
    buildSidebar();
    buildInfluenceSliders();
    renderKpis();
    renderActiveFilters();
    renderTable();
    renderSelectionBar();
    if (window.lucide) lucide.createIcons();
  }

  render();
})();

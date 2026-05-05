// Engagements / Insights / Settings screens
(async () => {
  const KOLS = (typeof __KOLS_DATA !== 'undefined') ? __KOLS_DATA : await fetch('kols.json').then(r => r.json());
  const $ = (s, r=document) => r.querySelector(s);
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
      else n.setAttribute(k, v);
    }
    for (const k of kids.flat()) {
      if (k == null || k === false) continue;
      n.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
    }
    return n;
  };
  const initials = (n) => (n||'?').split(/\s+/).map(s=>s[0]||'').slice(0,2).join('').toUpperCase();
  const segClass = (s) => ({'Vocal Advocate':'amplify','Quiet Champion':'activate','Cautious Skeptic':'strengthen','Unconvinced Leader':'realign'}[s]||'activate');
  const segObj = (s) => ({'Vocal Advocate':'Amplify','Quiet Champion':'Activate','Cautious Skeptic':'Strengthen','Unconvinced Leader':'Realign'}[s]||'—');

  // ── Routing ──
  const views = $$('.view');
  const filters = $('#filters');
  const engFiltersEl = $('#engFilters');
  function showView(name) {
    views.forEach(v => v.hidden = v.dataset.view !== name);
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === name));
    if (filters) filters.style.display = name === 'kols' ? '' : 'none';
    if (engFiltersEl) engFiltersEl.style.display = name === 'engagements' ? '' : 'none';
    if (name === 'engagements') renderEngagements();
    if (name === 'insights') renderInsights();
    if (name === 'settings') renderSettings();
    if (window.lucide) lucide.createIcons();
    window.scrollTo(0, 0);
  }
  $$('#nav a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    showView(a.dataset.view);
  }));

  // ── Quarter constants ──
  // QUARTERS = the 4 calendar-view columns; ALL_QUARTERS = full history for charts
  const QUARTERS = ["Q3 '25", "Q4 '25", "Q1 '26", "Q2 '26"];
  const CURRENT_QUARTER = "Q4 '25";
  const ALL_QUARTERS = [
    "Q1 '23","Q2 '23","Q3 '23","Q4 '23",
    "Q1 '24","Q2 '24","Q3 '24","Q4 '24",
    "Q1 '25","Q2 '25","Q3 '25","Q4 '25",
    "Q1 '26","Q2 '26",
  ];
  // Quarters whose events are completed (historical, before current)
  const COMPLETED_QUARTERS = new Set([
    "Q1 '23","Q2 '23","Q3 '23","Q4 '23",
    "Q1 '24","Q2 '24","Q3 '24","Q4 '24",
    "Q1 '25","Q2 '25","Q3 '25",
  ]);

  // ── Build flat events list from KOLs ──
  function normalizeQ(q) {
    if (!q) return null;
    const m = q.match(/Q([1-4])\s*['´]?\s*(\d{2})/);
    if (!m) return null;
    return `Q${m[1]} '${m[2]}`;
  }
  const ALL_EVENTS = [];
  KOLS.forEach(k => {
    (k.engagements || []).forEach((e, i) => {
      const lines = (e.quarter || '').split('\n').map(s => s.trim()).filter(Boolean);
      const targetQs = lines.length ? lines.map(normalizeQ).filter(Boolean) : [normalizeQ(e.quarter)].filter(Boolean);
      const qList = targetQs.length ? targetQs : [CURRENT_QUARTER];
      qList.forEach(q => {
        ALL_EVENTS.push({
          kol: k,
          quarter: q,
          channel: (e.channel || e.type || '').split('\n')[0] || '—',
          objective: (e.objective || e.type || '').split('\n')[0] || '—',
          completed: COMPLETED_QUARTERS.has(q) && !e.planned,
        });
      });
    });
  });

  // ── ENGAGEMENTS view ──
  let engMode = 'list';
  let engSort = { key: 'quarter', dir: 'desc' };
  const engFilter = { quarter: '', channel: '', status: 'all' };
  let engKpisBuilt = false;

  function quarterVal(q) {
    const m = (q || '').match(/Q([1-4])\s*'(\d{2})/);
    return m ? +m[2] * 10 + +m[1] : 0;
  }

  function buildEngFilters() {
    const host = $('#engFilters');
    if (!host) return;
    host.innerHTML = '';

    // Quarter dropdown
    const qSec = el('div', { class: 'filter-section' });
    qSec.appendChild(el('div', { class: 'heading' },
      el('span', {}, 'Quarter'),
      el('button', { onClick: () => { engFilter.quarter = ''; renderEngagements(); } }, 'Clear'),
    ));
    const uniqQuarters = [...new Set(ALL_EVENTS.map(e => e.quarter))].sort((a,b) => quarterVal(b) - quarterVal(a));
    const qSelect = el('select', { class: 'eng-filter-select',
      onChange: (ev) => { engFilter.quarter = ev.target.value; renderEngagements(); },
    },
      el('option', { value: '' }, 'All quarters'),
      ...uniqQuarters.map(q => {
        const opt = el('option', { value: q }, q);
        if (engFilter.quarter === q) opt.setAttribute('selected', '');
        return opt;
      }),
    );
    qSec.appendChild(qSelect);
    host.appendChild(qSec);

    // Channel dropdown
    const chSec = el('div', { class: 'filter-section' });
    chSec.appendChild(el('div', { class: 'heading' },
      el('span', {}, 'Channel'),
      el('button', { onClick: () => { engFilter.channel = ''; renderEngagements(); } }, 'Clear'),
    ));
    const uniqChannels = [...new Set(ALL_EVENTS.map(e => e.channel))].sort();
    const chSelect = el('select', { class: 'eng-filter-select',
      onChange: (ev) => { engFilter.channel = ev.target.value; renderEngagements(); },
    },
      el('option', { value: '' }, 'All channels'),
      ...uniqChannels.map(ch => {
        const label = ch.replace(/^[\-\s•]+/, '').trim() || ch;
        const opt = el('option', { value: ch }, label);
        if (engFilter.channel === ch) opt.setAttribute('selected', '');
        return opt;
      }),
    );
    chSec.appendChild(chSelect);
    host.appendChild(chSec);

    // Status toggle
    const stSec = el('div', { class: 'filter-section' });
    stSec.appendChild(el('div', { class: 'heading' },
      el('span', {}, 'Status'),
      el('button', { onClick: () => { engFilter.status = 'all'; renderEngagements(); } }, 'Clear'),
    ));
    const stToggle = el('div', { class: 'eng-status-toggle' });
    [{ val: 'completed', label: 'Completed' }, { val: 'planned', label: 'Planned' }].forEach(({ val, label }) => {
      const active = engFilter.status === val;
      stToggle.appendChild(el('button', {
        class: `eng-status-btn${active ? ' active' : ''}`,
        data: { val },
        onClick: () => { engFilter.status = active ? 'all' : val; renderEngagements(); },
      }, label));
    });
    stSec.appendChild(stToggle);
    host.appendChild(stSec);
  }

  function renderEngagements() {
    buildEngFilters();

    // KPI tiles are derived from static ALL_EVENTS — build once to avoid icon flicker
    if (!engKpisBuilt) {
      const kpis = $('#engKpis');
      const completed = ALL_EVENTS.filter(e => e.completed).length;
      const thisQ = ALL_EVENTS.filter(e => e.quarter === CURRENT_QUARTER).length;
      const channels = new Set(ALL_EVENTS.map(e => e.channel.toLowerCase().replace(/[^a-z]/g,'')));
      [
        { l: 'Total events', v: ALL_EVENTS.length, icon: 'calendar' },
        { l: 'Completed', v: completed, icon: 'check-circle-2' },
        { l: 'Planned this quarter', v: thisQ, icon: 'target' },
        { l: 'Channel types', v: channels.size, icon: 'layers' },
      ].forEach(({l,v,icon}) => {
        kpis.appendChild(el('div', { class: 'kpi' },
          el('div', { class: 'l' }, el('i', { 'data-lucide': icon }), l),
          el('div', { class: 'v' }, String(v)),
        ));
      });
      if (window.lucide) lucide.createIcons({ el: kpis });
      engKpisBuilt = true;
    }

    const body = $('#engBody');
    body.innerHTML = '';
    if (engMode === 'calendar') body.appendChild(renderCalendar());
    else body.appendChild(renderEngList());
  }

  function renderCalendar() {
    const grid = el('div', { class: 'cal-grid' });
    grid.appendChild(el('div', { class: 'cal-head' }, ''));
    QUARTERS.forEach(q => grid.appendChild(el('div', {
      class: 'cal-head q-head' + (q === CURRENT_QUARTER ? ' current' : ''),
    }, q + (q === CURRENT_QUARTER ? ' · current' : ''))));

    const rowKeys = ['Germany', 'Italy', 'Japan'];
    rowKeys.forEach(country => {
      const kolsIn = KOLS.filter(k => k.country === country);
      const row = el('div', { class: 'cal-row' });
      row.appendChild(el('div', { class: 'cal-row-label' },
        country,
        el('span', { class: 'ct' }, `${kolsIn.length} KOLs`)
      ));
      QUARTERS.forEach(q => {
        const cell = el('div', { class: 'cal-cell' + (q === CURRENT_QUARTER ? ' current' : '') });
        const events = ALL_EVENTS.filter(e => e.kol.country === country && e.quarter === q);
        events.slice(0, 5).forEach(e => {
          cell.appendChild(el('div', { class: `ev-pill ${segClass(e.kol.segment)} ${e.completed ? 'actual' : ''}`, title: `${e.kol.name} — ${e.objective}` },
            el('div', { class: 'who' }, e.kol.name.split(' ').slice(-1)[0]),
            el('div', { class: 'what' }, e.channel.replace(/^[\-\s•]+/, '').slice(0, 40)),
          ));
        });
        if (events.length > 5) {
          cell.appendChild(el('div', { style:{fontSize:'11px', color:'var(--gray-500)', fontFamily:'var(--font-mono)'}}, `+${events.length - 5} more`));
        }
        row.appendChild(cell);
      });
      grid.appendChild(row);
    });
    return grid;
  }

  function renderEngList() {
    const { key, dir } = engSort;

    let events = ALL_EVENTS.slice();
    if (engFilter.quarter) events = events.filter(e => e.quarter === engFilter.quarter);
    if (engFilter.channel) events = events.filter(e => e.channel === engFilter.channel);
    if (engFilter.status === 'completed') events = events.filter(e => e.completed);
    else if (engFilter.status === 'planned') events = events.filter(e => !e.completed);

    const sorted = events.sort((a, b) => {
      let cmp = 0;
      if (key === 'quarter') {
        cmp = quarterVal(a.quarter) - quarterVal(b.quarter) || a.kol.name.localeCompare(b.kol.name);
      } else if (key === 'kol') {
        cmp = a.kol.name.localeCompare(b.kol.name);
      } else if (key === 'activity') {
        cmp = (a.objective || '').localeCompare(b.objective || '');
      } else if (key === 'channel') {
        cmp = (a.channel || '').localeCompare(b.channel || '');
      } else if (key === 'status') {
        cmp = (a.completed ? 1 : 0) - (b.completed ? 1 : 0);
      }
      return dir === 'desc' ? -cmp : cmp;
    });

    const COLS = [
      { label: 'Quarter',  key: 'quarter'  },
      { label: 'KOL',      key: 'kol'      },
      { label: 'Activity', key: 'activity' },
      { label: 'Channel',  key: 'channel'  },
      { label: 'Status',   key: 'status'   },
    ];

    const list = el('div', { class: 'eng-list' });

    const headRow = el('div', { class: 'eng-list-row head' });
    COLS.forEach(col => {
      const isActive = key === col.key;
      const iconName = isActive
        ? (dir === 'asc' ? 'arrow-up' : 'arrow-down')
        : 'chevrons-up-down';
      const btn = el('button', {
        class: isActive ? 'active' : '',
        onClick: () => {
          if (engSort.key === col.key) {
            engSort.dir = engSort.dir === 'asc' ? 'desc' : 'asc';
          } else {
            engSort.key = col.key;
            engSort.dir = col.key === 'quarter' ? 'desc' : 'asc';
          }
          renderEngagements();
          if (window.lucide) lucide.createIcons();
        },
      },
        col.label,
        el('i', { 'data-lucide': iconName }),
      );
      headRow.appendChild(el('div', {}, btn));
    });
    list.appendChild(headRow);

    sorted.forEach(e => {
      const tierLabel = e.kol.tier === 'ME' ? 'Medical Expert' : 'Rising Star';
      list.appendChild(el('div', { class: 'eng-list-row' },
        el('div', { style:{fontFamily:'var(--font-mono)', fontSize:'12px'} }, e.quarter),
        el('div', { style:{display:'flex',alignItems:'center',gap:'10px',minWidth:0} },
          el('div', { class: 'avatar', style:{width:'28px',height:'28px',fontSize:'10px'} }, initials(e.kol.name)),
          el('div', { style:{minWidth:0} },
            el('span', {
              class: 'eng-kol-name',
              onClick: (ev) => { ev.stopPropagation(); window.openProfile && window.openProfile(e.kol); },
            }, e.kol.name),
            el('div', { style:{fontSize:'11px',color:'var(--gray-500)',marginTop:'2px'} }, tierLabel),
          ),
        ),
        el('div', { style:{fontSize:'13px'} }, e.objective.slice(0, 80)),
        el('div', { style:{fontSize:'12px', color:'var(--gray-500)'} }, e.channel.replace(/^[\-\s•]+/, '').slice(0, 30)),
        el('div', {}, el('span', { class: e.completed ? 'tag status-completed' : 'tag status-planned' },
          e.completed ? 'Completed' : 'Planned')),
      ));
    });
    return list;
  }

  $$('#engViewToggle button').forEach(b => b.addEventListener('click', () => {
    $$('#engViewToggle button').forEach(x => x.dataset.on = 'false');
    b.dataset.on = 'true';
    engMode = b.dataset.val;
    renderEngagements();
    if (window.lucide) lucide.createIcons();
  }));

  function renderInsights() {
    const body = $('#insightsBody');
    body.innerHTML = '';
    body.style.marginTop = '0';

    // KPI strip
    const kpis = el('section', { class: 'kpis' });
    const completed = ALL_EVENTS.filter(e => e.completed).length;
    const planRate = Math.round((ALL_EVENTS.length - completed) / Math.max(ALL_EVENTS.length, 1) * 100);
    [
      { l: 'Coverage', v: `${Math.round(KOLS.filter(k=>k.plannedThisQuarter).length / KOLS.length * 100)}%`, icon: 'target', sub: 'KOLs with planned engagement' },
      { l: 'Plan velocity', v: `${planRate}%`, icon: 'gauge', sub: 'planned vs total events' },
      { l: 'Active leads', v: String(new Set(KOLS.map(k=>k.lead).filter(Boolean)).size), icon: 'user-check', sub: 'BMRN team members' },
      { l: 'Countries', v: String(new Set(KOLS.map(k=>k.country)).size), icon: 'globe', sub: 'regions in scope' },
    ].forEach(k => kpis.appendChild(el('div', { class: 'kpi' },
      el('div', { class: 'l' }, el('i', { 'data-lucide': k.icon }), k.l),
      el('div', { class: 'v' }, k.v),
      el('div', { class: 'meta' }, el('span', { style:{fontSize:'12px',color:'var(--gray-500)'} }, k.sub)),
    )));
    body.appendChild(kpis);

    // ── Row 1: Segment quadrant | Engagements over time | Most engaged KOLs ──
    const row1 = el('div', { class: 'grid-3', style:{marginTop:'24px'} });

    // ── Segment quadrant with time slider ──────────────────────────
    const segPos = {
      'Vocal Advocate':    { x: [.65, .9],  y: [.1, .35] },
      'Quiet Champion':    { x: [.1, .35],  y: [.1, .35] },
      'Unconvinced Leader':{ x: [.65, .9],  y: [.65, .9] },
      'Cautious Skeptic':  { x: [.1, .35],  y: [.65, .9] },
    };
    const filteredKols = KOLS.filter(k => k.segment);

    // Compute KOL position at a given quarter index
    function kolPosAt(kol, idx, qIdx) {
      const Q  = ALL_QUARTERS[qIdx];
      const qv = quarterVal(Q);
      // Determine segment at this quarter from segmentHistory
      let seg = kol.segment;
      if (kol.segmentHistory) {
        let best = null;
        for (const h of kol.segmentHistory) {
          if (quarterVal(h.quarter) <= qv) best = h;
        }
        if (best) seg = best.segment;
      }
      const p     = segPos[seg];
      const seed  = (kol.name.length * 17 + idx * 31) % 100 / 100;
      const seed2 = (kol.name.charCodeAt(0) * 13) % 100 / 100;
      let x = p.x[0] + seed  * (p.x[1] - p.x[0]);
      let y = p.y[0] + seed2 * (p.y[1] - p.y[0]);
      // Drift evolvers toward the QC/VA boundary before their transition
      if (kol.segmentHistory && kol.segmentHistory.length >= 2) {
        const initSeg   = kol.segmentHistory[0].segment;
        const transEntry = kol.segmentHistory.find(h => h.segment !== initSeg);
        if (transEntry && seg === initSeg) {
          const initQv  = quarterVal(kol.segmentHistory[0].quarter);
          const transQv = quarterVal(transEntry.quarter);
          const progress = Math.max(0, Math.min(1, (qv - initQv) / Math.max(transQv - initQv, 1)));
          x = x + (0.47 - x) * progress * 0.78;
        }
      }
      return { x, y, seg };
    }

    const quadPanel = el('div', { class: 'panel' },
      el('h3', {}, 'Segment quadrant'),
      el('div', { class: 'sub' }, 'Vocality × belief — drag the slider to explore segment evolution over time'),
    );
    const quad = el('div', { class: 'quad' });
    quad.appendChild(el('div', { class: 'q-cell tl' }, el('span', { class: 'seg-name' }, 'Quiet Champion'),    el('span', { class: 'obj' }, 'Objective: Activate')));
    quad.appendChild(el('div', { class: 'q-cell tr' }, el('span', { class: 'seg-name' }, 'Vocal Advocate'),   el('span', { class: 'obj' }, 'Objective: Amplify')));
    quad.appendChild(el('div', { class: 'q-cell bl' }, el('span', { class: 'seg-name' }, 'Cautious Skeptic'), el('span', { class: 'obj' }, 'Objective: Strengthen')));
    quad.appendChild(el('div', { class: 'q-cell br' }, el('span', { class: 'seg-name' }, 'Unconvinced Leader'),el('span', { class: 'obj' }, 'Objective: Realign')));

    // Build dots at default quarter (rightmost = Q2 '26)
    const initQIdx = ALL_QUARTERS.length - 1;
    const dotMap   = {};
    filteredKols.forEach((k, i) => {
      const { x, y, seg } = kolPosAt(k, i, initQIdx);
      const dot = el('div', {
        class: `pt ${segClass(seg)}`,
        style: { left: `${x*100}%`, top: `${y*100}%` },
        title: `${k.name} — ${k.country}`,
      }, initials(k.name));
      dotMap[k.name] = dot;
      quad.appendChild(dot);
    });

    // Slider controls
    const sliderQLabel = el('div', { class: 'quad-slider-q' }, 'Segment evolution over time');
    const slider = el('input', {
      type: 'range', min: '0', max: String(ALL_QUARTERS.length - 1),
      value: String(initQIdx), class: 'quad-slider-input',
    });
    slider.addEventListener('input', () => {
      const qIdx = +slider.value;
      filteredKols.forEach((k, i) => {
        const dot = dotMap[k.name];
        if (!dot) return;
        const { x, y, seg } = kolPosAt(k, i, qIdx);
        dot.style.left = `${x*100}%`;
        dot.style.top  = `${y*100}%`;
        const nc = `pt ${segClass(seg)}`;
        if (dot.className !== nc) dot.className = nc;
        dot.title = `${k.name} — ${k.country}`;
      });
    });
    const sliderWrap = el('div', { class: 'quad-slider-wrap' },
      el('span', { class: 'quad-slider-edge' }, ALL_QUARTERS[0]),
      el('div', { class: 'quad-slider-inner' }, slider, sliderQLabel),
      el('span', { class: 'quad-slider-edge' }, ALL_QUARTERS[ALL_QUARTERS.length - 1]),
    );

    const quadWrap = el('div', { class: 'quad-wrap' },
      el('div', { class: 'quad-axis-y' }, '← low belief        high belief →'),
      el('div', { class: 'quad-matrix' }, quad),
      el('div', { class: 'quad-axis-x-spacer' }),
      el('div', { class: 'quad-axis-x' }, '← low vocality        high vocality →'),
    );
    quadPanel.appendChild(quadWrap);
    quadPanel.appendChild(sliderWrap);

    // Engagements over time — 10 most recent quarters, newest first
    const timelinePanel = el('div', { class: 'panel' },
      el('h3', {}, 'Engagements over time'),
      el('div', { class: 'sub' }, 'Planned (light) vs completed (filled) per quarter'),
    );
    const tlBars = el('div', { class: 'bars', style:{marginTop:'16px'} });
    const timelineQs = [...ALL_QUARTERS].reverse();
    const tlMax = Math.max(...timelineQs.map(q => ALL_EVENTS.filter(e => e.quarter === q).length), 1);
    timelineQs.forEach(q => {
      const evs  = ALL_EVENTS.filter(e => e.quarter === q);
      const done  = evs.filter(e => e.completed).length;
      const total = evs.length;
      tlBars.appendChild(el('div', { class: 'bar-row' },
        el('div', { class: 'lbl', style:{fontFamily:'var(--font-mono)', fontSize:'12px'} }, q),
        el('div', { class: 'track', style:{position:'relative'} },
          el('div', { class: 'fill', style:{width: `${total/tlMax*100}%`, background:'var(--gray-300)'} }),
          el('div', { class: 'fill', style:{width: `${done/tlMax*100}%`, background:'var(--rn-mint)', position:'absolute', top:0, left:0} }),
        ),
        el('div', { class: 'val' }, `${done}/${total}`),
      ));
    });
    timelinePanel.appendChild(tlBars);

    // Most engaged KOLs
    const topPanel = el('div', { class: 'panel' },
      el('h3', {}, 'Most engaged KOLs'),
      el('div', { class: 'sub' }, 'Ranked by total planned + completed engagements'),
    );
    const ranks = el('div', { class: 'rank-list' });
    KOLS.slice().sort((a,b) => b.totalEngagements - a.totalEngagements).slice(0, 6).forEach((k, i) => {
      ranks.appendChild(el('div', { class: 'rank-row', onClick: () => window.openProfile && window.openProfile(k) },
        el('div', { class: 'pos' }, String(i+1).padStart(2,'0')),
        el('div', { class: 'avatar', style:{width:'30px',height:'30px',fontSize:'11px'} }, initials(k.name)),
        el('div', {},
          el('div', { class: 'nm' }, k.name),
          el('div', { class: 'meta' }, `${k.country} · ${segObj(k.segment)}`),
        ),
        el('div', { class: 'ct' }, `${k.totalEngagements}`),
      ));
    });
    topPanel.appendChild(ranks);

    row1.appendChild(quadPanel);
    row1.appendChild(timelinePanel);
    row1.appendChild(topPanel);
    body.appendChild(row1);

    // ── Row 2: Most influential by type | Channel mix | KOLs by country ──
    const row2 = el('div', { class: 'grid-3', style:{marginTop:'20px'} });

    // Most influential by type
    const INFL_DIMS = [
      { key: 'clinical',   label: 'Clinical',   color: 'var(--infl-clinical)',   soft: 'var(--infl-clinical-soft)' },
      { key: 'geographic', label: 'Geographic', color: 'var(--infl-geographic)', soft: 'var(--infl-geographic-soft)' },
      { key: 'online',     label: 'Online',     color: 'var(--infl-online)',     soft: 'var(--infl-online-soft)' },
    ];
    const inflPanel = el('div', { class: 'panel' },
      el('h3', {}, 'Most influential by type'),
      el('div', { class: 'sub' }, 'Ranked in comparison to median'),
    );
    const inflGrid = el('div', { class: 'infl-type-grid' });
    INFL_DIMS.forEach(dim => {
      const col = el('div', { class: 'infl-type-col' });
      col.appendChild(el('div', { class: 'infl-type-head' },
        el('span', { class: 'dot', style:{background: dim.color, display:'inline-block'} }),
        dim.label,
      ));
      KOLS.slice()
        .filter(k => k.influence && k.influence[dim.key])
        .sort((a, b) => b.influence[dim.key].score - a.influence[dim.key].score)
        .slice(0, 5)
        .forEach((k, i) => {
          col.appendChild(el('div', {
            class: 'infl-type-row',
            style: { cursor: 'pointer' },
            onClick: () => window.openProfile && window.openProfile(k),
          },
            el('span', { class: 'pos' }, String(i + 1).padStart(2, '0')),
            el('span', { class: 'nm' }, k.name.split(' ').pop()),
            el('span', { class: 'infl-type-score', style:{background: dim.soft, color: dim.color} }, String(k.influence[dim.key].score)),
          ));
        });
      inflGrid.appendChild(col);
    });
    inflPanel.appendChild(inflGrid);

    // Channel mix
    const channelMap = {};
    ALL_EVENTS.forEach(e => {
      const c = e.channel.replace(/^[\-\s•]+/, '').toLowerCase();
      let key = 'Other';
      if (/1:1|exchange|msl/i.test(c)) key = '1:1 / MSL exchange';
      else if (/symp|congress|speaker|lecture/i.test(c)) key = 'Congress / Speaker';
      else if (/ad-?board|advisory|adboard/i.test(c)) key = 'Advisory boards';
      else if (/round/i.test(c)) key = 'Roundtable';
      else if (/webinar|virtual/i.test(c)) key = 'Webinar / virtual';
      else if (/trial|study|pi|111|212|211/i.test(c)) key = 'Clinical trial';
      else if (/workgroup|expert/i.test(c)) key = 'Working group';
      channelMap[key] = (channelMap[key]||0) + 1;
    });
    const colors = ['var(--rn-deep-teal)', 'var(--rn-mint)', 'var(--rn-dark-teal)', 'var(--segment-strengthen)', 'var(--segment-realign)', 'var(--rn-sage)', 'var(--gray-400)'];
    const channelTotal = Object.values(channelMap).reduce((a,b)=>a+b,0);
    const channelPanel = el('div', { class: 'panel' },
      el('h3', {}, 'Channel mix'),
      el('div', { class: 'sub' }, 'Where engagements happen'),
    );
    const donutWrap = el('div', { class: 'donut-wrap' });
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 42 42');
    svg.setAttribute('class', 'donut');
    const bg = document.createElementNS(SVG_NS, 'circle');
    bg.setAttribute('cx', '21'); bg.setAttribute('cy', '21'); bg.setAttribute('r', '15.915');
    bg.setAttribute('fill', 'transparent'); bg.setAttribute('stroke', 'var(--gray-100)'); bg.setAttribute('stroke-width', '6');
    svg.appendChild(bg);
    let offset = 25;
    Object.entries(channelMap).sort((a,b)=>b[1]-a[1]).forEach(([k,v], i) => {
      const pct = v/channelTotal*100;
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', '21'); c.setAttribute('cy', '21'); c.setAttribute('r', '15.915');
      c.setAttribute('fill', 'transparent');
      c.setAttribute('stroke', colors[i % colors.length]);
      c.setAttribute('stroke-width', '6');
      c.setAttribute('stroke-dasharray', `${pct} ${100-pct}`);
      c.setAttribute('stroke-dashoffset', String(offset));
      svg.appendChild(c);
      offset = (offset - pct + 100) % 100;
    });
    donutWrap.appendChild(svg);
    const legend = el('div', { class: 'donut-legend' });
    Object.entries(channelMap).sort((a,b)=>b[1]-a[1]).forEach(([k,v], i) => {
      legend.appendChild(el('div', { class: 'row' },
        el('div', { class: 'sw', style:{background: colors[i % colors.length]} }),
        el('div', {}, k),
        el('div', { class: 'v' }, String(v)),
      ));
    });
    donutWrap.appendChild(legend);
    channelPanel.appendChild(donutWrap);

    // KOLs by country
    const countryPanel = el('div', { class: 'panel' },
      el('h3', {}, 'KOLs by country'),
      el('div', { class: 'sub' }, 'Coverage and tier breakdown'),
    );
    const bars = el('div', { class: 'bars' });
    const countries = [...new Set(KOLS.map(k=>k.country))];
    const maxC = Math.max(...countries.map(c => KOLS.filter(k=>k.country===c).length));
    countries.forEach(c => {
      const ct = KOLS.filter(k=>k.country===c).length;
      const me = KOLS.filter(k=>k.country===c && k.tier==='ME').length;
      bars.appendChild(el('div', { class: 'bar-row' },
        el('div', { class: 'lbl' }, c),
        el('div', { class: 'track' },
          el('div', { class: 'fill', style:{width: `${ct/maxC*100}%`} })
        ),
        el('div', { class: 'val' }, `${ct} · ${me} ME`),
      ));
    });
    countryPanel.appendChild(bars);

    row2.appendChild(inflPanel);
    row2.appendChild(channelPanel);
    row2.appendChild(countryPanel);
    body.appendChild(row2);
  }

  // ── SETTINGS view ──
  function renderSettings() {
    const body = $('#settingsBody');
    body.innerHTML = '';

    const grid = el('div', { class: 'settings-grid' });
    const nav = el('div', { class: 'settings-nav' });
    const sections = [
      { id: 'workspace', label: 'Workspace' },
      { id: 'team', label: 'Team & access' },
      { id: 'taxonomy', label: 'Segment taxonomy' },
      { id: 'channels', label: 'Channels & tags' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'data', label: 'Data & integrations' },
    ];
    sections.forEach((s, i) => nav.appendChild(el('a', {
      class: i === 0 ? 'active' : '',
      href: `#${s.id}`,
      onClick: (e) => {
        e.preventDefault();
        $$('.settings-nav a').forEach(a => a.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.getElementById(s.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }, s.label)));
    grid.appendChild(nav);

    const main = el('div');

    // Workspace
    main.appendChild(el('section', { id: 'workspace', class: 'settings-section' },
      el('h2', {}, 'Workspace'),
      el('p', { class: 'desc' }, 'Basic information about this engagement tracker workspace.'),
      formRow('Workspace name', el('input', { type: 'text', value: 'BMRN — Skeletal Dysplasia Medical' })),
      formRow('Therapeutic area', el('input', { type: 'text', value: 'Achondroplasia, Hypochondroplasia' })),
      formRow('Reporting cycle',
        el('select', {},
          el('option', { selected: '' }, 'Quarterly (default)'),
          el('option', {}, 'Monthly'),
          el('option', {}, 'Annual'),
        ),
        'Drives KPI windows and planning cadence.'
      ),
      formRow('Time zone',
        el('select', {},
          el('option', {}, '(GMT+01:00) Central European Time'),
          el('option', { selected: '' }, '(GMT+09:00) Japan Standard Time'),
          el('option', {}, '(GMT-05:00) Eastern Time'),
        ),
      ),
    ));

    // Team & access
    const team = [
      { name: 'Stefanie Gross-Layh', role: 'Lead — Germany', email: 'stefanie@example.com', kols: 3, perm: 'Admin' },
      { name: 'Antje Arnold', role: 'MSL — Germany', email: 'antje@example.com', kols: 4, perm: 'Editor' },
      { name: 'Chiaki Tanabe', role: 'Lead — Japan', email: 'chiaki@example.com', kols: 5, perm: 'Editor' },
      { name: 'Maria Tommasi', role: 'Lead — Italy', email: 'maria@example.com', kols: 6, perm: 'Editor' },
      { name: 'Marco Stadler', role: 'Global Medical Affairs', email: 'marco@example.com', kols: 8, perm: 'Editor' },
      { name: 'Jeanne Pimenta', role: 'RWE / Registries', email: 'jeanne@example.com', kols: 4, perm: 'Viewer' },
    ];
    const teamTbl = el('table', { class: 'team-tbl' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Name'), el('th', {}, 'Role'), el('th', {}, 'KOLs'), el('th', {}, 'Permission'), el('th', {}, ''))),
      el('tbody', {}, ...team.map(t => el('tr', {},
        el('td', {}, el('div', { class: 'who' },
          el('div', { class: 'avatar', style:{width:'30px',height:'30px',fontSize:'11px'} }, initials(t.name)),
          el('div', {},
            el('div', { style:{fontWeight:500} }, t.name),
            el('div', { style:{fontSize:'12px', color:'var(--gray-500)'} }, t.email),
          ),
        )),
        el('td', {}, t.role),
        el('td', { style:{fontFamily:'var(--font-mono)', fontSize:'12px'} }, String(t.kols)),
        el('td', {}, el('select', { style:{padding:'5px 10px',fontSize:'12px',border:'1px solid var(--border-strong)',borderRadius:'var(--radius-md)',background:'#fff',color:'inherit'} },
          ['Admin','Editor','Viewer'].map(p => el('option', { selected: p === t.perm ? '' : null }, p)))),
        el('td', { style:{textAlign:'right'} }, el('button', { class: 'icon-btn', title: 'Remove' }, el('i', { 'data-lucide': 'trash-2' }))),
      )))
    );
    main.appendChild(el('section', { id: 'team', class: 'settings-section' },
      el('h2', {}, 'Team & access'),
      el('p', { class: 'desc' }, '6 members across Germany, Italy, Japan, and Global. Invite teammates by email.'),
      el('div', { class: 'panel', style:{padding:'4px 0'} }, teamTbl),
      el('div', { style:{marginTop:'16px',display:'flex',gap:'8px'} },
        el('button', { class: 'btn primary' }, el('i', { 'data-lucide': 'mail' }), 'Invite teammate'),
        el('button', { class: 'btn outline' }, el('i', { 'data-lucide': 'shield' }), 'Manage permissions'),
      ),
    ));

    // Segment taxonomy
    const segs = [
      { name: 'Vocal Advocate', obj: 'Amplify', desc: 'High vocality, high belief — actively shape consensus.', cls: 'amplify' },
      { name: 'Quiet Champion', obj: 'Activate', desc: 'Low vocality, high belief — supportive but not leading the conversation.', cls: 'activate' },
      { name: 'Unconvinced Leader', obj: 'Realign', desc: 'High vocality, low belief — visible skeptics that shift opinions.', cls: 'realign' },
      { name: 'Cautious Skeptic', obj: 'Strengthen', desc: 'Low vocality, low belief — re-engage with evidence and education.', cls: 'strengthen' },
    ];
    main.appendChild(el('section', { id: 'taxonomy', class: 'settings-section' },
      el('h2', {}, 'Segment taxonomy'),
      el('p', { class: 'desc' }, 'How KOLs are classified along the vocality × belief axes. Used for sorting, filtering, and quadrant visualizations.'),
      el('div', { class: 'panel' },
        el('div', { style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'} },
          ...segs.map(s => el('div', { style:{padding:'14px',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',display:'flex',gap:'12px',alignItems:'flex-start'} },
            el('span', { class: `tag seg seg-${s.cls}`, style:{flexShrink:0,marginTop:'2px'} }, s.obj),
            el('div', {},
              el('div', { style:{fontWeight:500,marginBottom:'4px'} }, s.name),
              el('div', { style:{fontSize:'12.5px',color:'var(--rn-sage)',lineHeight:1.5} }, s.desc),
            ),
            el('button', { class: 'icon-btn', style:{marginLeft:'auto',flexShrink:0}, title: 'Edit' }, el('i', { 'data-lucide': 'pencil' })),
          ))
        ),
      ),
    ));

    // Channels & tags
    const channels = ['1:1 meeting', 'MSL scientific exchange', 'Advisory board', 'Roundtable', 'Symposium / Congress', 'Webinar', 'Working group', 'Clinical trial site', 'Publication co-authorship'];
    main.appendChild(el('section', { id: 'channels', class: 'settings-section' },
      el('h2', {}, 'Channels & tags'),
      el('p', { class: 'desc' }, 'Engagement channels available in dropdowns. Drag to reorder, click × to remove.'),
      el('div', { class: 'panel' },
        el('div', { class: 'tag-pool' },
          ...channels.map(c => el('span', { class: 'tag' }, c,
            el('span', { class: 'x' }, el('i', { 'data-lucide': 'x', style: { width: '10px', height: '10px' } }))
          )),
        ),
        el('div', { style:{marginTop:'14px',display:'flex',gap:'8px'} },
          el('input', { type: 'text', placeholder: 'Add new channel…', style:{flex:1,maxWidth:'320px',border:'1px solid var(--border-strong)',borderRadius:'var(--radius-md)',padding:'8px 12px',fontFamily:'inherit',fontSize:'13px'} }),
          el('button', { class: 'btn outline' }, el('i', { 'data-lucide': 'plus' }), 'Add'),
        ),
      ),
    ));

    // Notifications
    const notifs = [
      { l: 'Quarterly planning reminder', d: 'Email me 2 weeks before each quarter starts to confirm planned engagements.', on: true },
      { l: 'KOL outcome reminder', d: 'Remind me to log outcomes within 7 days of any completed engagement.', on: true },
      { l: 'Coverage drop alert', d: 'Alert when coverage % falls below 60% for any country.', on: false },
      { l: 'New KOL added by team', d: 'Notify me when teammates add or modify KOLs.', on: true },
      { l: 'Weekly digest', d: 'Monday morning summary of upcoming engagements.', on: false },
    ];
    main.appendChild(el('section', { id: 'notifications', class: 'settings-section' },
      el('h2', {}, 'Notifications'),
      el('p', { class: 'desc' }, 'Email & in-app alerts.'),
      el('div', { class: 'panel' },
        ...notifs.map((n, i) => el('div', { class: 'form-row', style: i === 0 ? {paddingTop:0,borderTop:0} : {} },
          el('div', {},
            el('div', { style:{fontWeight:500,fontSize:'13.5px'} }, n.l),
            el('div', { class: 'hint' }, n.d),
          ),
          el('label', { class: 'toggle' },
            el('input', { type: 'checkbox', ...(n.on ? { checked: '' } : {}) }),
            el('span', { class: 'sw' }),
            el('span', { class: 'txt', style:{color:'var(--gray-500)',fontSize:'12px'} }, n.on ? 'On' : 'Off'),
          ),
        )),
      ),
    ));

    // Data & integrations
    main.appendChild(el('section', { id: 'data', class: 'settings-section' },
      el('h2', {}, 'Data & integrations'),
      el('p', { class: 'desc' }, 'Import sources and connected tools.'),
      el('div', { class: 'panel' },
        ...[
          { name: 'Veeva CRM', desc: 'Sync HCP master records and call activity', status: 'Connected', icon: 'link' },
          { name: 'Within3', desc: 'Virtual advisory boards & roundtable platform', status: 'Connected', icon: 'link' },
          { name: 'CrescNet registry', desc: 'Real-world data on growth outcomes', status: 'Connected', icon: 'link' },
          { name: 'Excel import', desc: 'Bulk upload KOL data from spreadsheets', status: 'Available', icon: 'upload' },
          { name: 'Salesforce', desc: 'Sales activity and account ownership', status: 'Not connected', icon: 'plug' },
        ].map((it, i) => el('div', { class: 'form-row', style: i === 0 ? {paddingTop:0,borderTop:0} : {} },
          el('div', { style:{display:'flex',alignItems:'center',gap:'12px'} },
            el('div', { style:{width:'36px',height:'36px',borderRadius:'var(--radius-md)',background:'var(--gray-100)',display:'flex',alignItems:'center',justifyContent:'center'} },
              el('i', { 'data-lucide': it.icon, style: { width: '16px', height: '16px', color: 'var(--rn-dark-teal)' } })),
            el('div', {},
              el('div', { style:{fontWeight:500} }, it.name),
              el('div', { class: 'hint', style:{marginTop:0} }, it.desc),
            ),
          ),
          el('div', {},
            el('span', {
              class: 'tag',
              style: it.status === 'Connected'
                ? {background:'rgba(19,211,119,.08)',borderColor:'rgba(19,211,119,.3)',color:'rgb(15,160,90)'}
                : it.status === 'Available' ? {} : {color:'var(--gray-500)'}
            }, it.status),
            el('button', { class: 'btn ghost', style:{marginLeft:'8px'} }, it.status === 'Connected' ? 'Configure' : 'Connect'),
          )
        )),
      ),
      el('div', { style:{marginTop:'24px',padding:'18px',border:'1px solid rgba(192,79,79,.2)',borderRadius:'var(--radius-md)',background:'rgba(192,79,79,.04)'} },
        el('div', { style:{fontWeight:500,color:'var(--segment-realign)',marginBottom:'4px',fontSize:'14px'} }, 'Danger zone'),
        el('div', { style:{fontSize:'13px',color:'var(--gray-700)',marginBottom:'12px'} }, 'Permanently delete this workspace and all its data. This cannot be undone.'),
        el('button', { class: 'btn outline', style:{borderColor:'var(--segment-realign)',color:'var(--segment-realign)'} }, el('i', { 'data-lucide': 'trash-2' }), 'Delete workspace'),
      ),
    ));

    grid.appendChild(main);
    body.appendChild(grid);
  }

  function formRow(label, control, hint) {
    return el('div', { class: 'form-row' },
      el('label', {}, label),
      el('div', {},
        control,
        hint ? el('div', { class: 'hint' }, hint) : null,
      ),
    );
  }

  if (window.lucide) lucide.createIcons();
  window.renderInsights = renderInsights;
})();

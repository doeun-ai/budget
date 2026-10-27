import { html, render, useState, useEffect, useRef } from './vendor/standalone.module.js';
import { call, getToken, setToken, DEMO, warm, readCache, writeCache } from './api.js';

/* ───────── 공통 ───────── */

const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString('ko-KR');
const fmt1 = (n) => (Math.floor((Number(n) || 0) * 10 + 1e-9) / 10).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const digits = (s) => { const v = String(s == null ? '' : s).replace(/[^0-9]/g, ''); return v ? Number(v) : null; };
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const dimOf = (y, m) => new Date(y, m, 0).getDate();
const WK = ['일', '월', '화', '수', '목', '금', '토'];
const short = (s) => (s ? s.slice(2).replace(/-/g, '.') : '');
const man = (v) => (v === 0 ? '0' : String(Math.ceil(v / 1000) / 10) + '만');
const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
const newId = (p) => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);

const LIFE = ['약속', '생활', '기타', '관리', '경조사'];
const LIFE_DESC = { 약속: '약속 · 외식 · 배달 · 카페', 생활: '식비 · 마트 · 생필품', 기타: '', 관리: '옷 · 화장품 · 피부 · 운동', 경조사: '' };
const LIFE_COLOR = { 약속: '#0062CC', 생활: '#2E9C7E', 기타: '#8E7CF0', 관리: '#E07BB0', 경조사: '#9AA0A6' };
const CATS = [
  ['save', '적금', '#0050C8'], ['invest', '투자', '#64A8FF'], ['use', '사용적금', '#7B61E8'],
  ['house', '주거비', '#2E9C7E'], ['fixed', '고정비', '#F08A00'], ['meet', '모임비', '#FFC85C'], ['life', '생활비', '#C7C7CC']
];
const LINKABLE = { save: 1, invest: 1, use: 1 };
const PALETTE = ['#E07BB0', '#9AA0A6', '#C2A000', '#8E7CF0', '#2E9C7E', '#0050C8', '#F08A00', '#64A8FF', '#7B61E8'];

const I = {
  back: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
  next: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
  chev: (open, size = 14) => html`<svg class=${'chev' + (open ? ' open' : '')} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`
};
const TABS = [
  ['spend', '지출', html`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>`],
  ['budget', '예산', html`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.4"/></svg>`],
  ['assets', '자산', html`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`],
  ['settings', '설정', html`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>`]
];

/* ───────── 공용 부품 ───────── */

function Swipe({ id, openId, setOpenId, actions, onTap, bg = '#fff', fgClass = 'line', fgStyle = {}, children }) {
  const open = openId === id;
  const sx = useRef(null);
  const w = actions.length * 72;
  return html`<div class=${'swipe' + (open ? ' open' : '')}>
    <div class="acts">${actions.map((a) => html`<button type="button" class=${a.cls} onClick=${() => { setOpenId(null); a.on(); }}>${a.label}</button>`)}</div>
    <div class=${'fg ' + fgClass} style=${Object.assign({ background: bg, transform: `translateX(${open ? -w : 0}px)` }, fgStyle)}
      onPointerDown=${(e) => { sx.current = e.clientX; }}
      onPointerCancel=${() => { sx.current = null; }}
      onPointerUp=${(e) => {
        const dx = sx.current == null ? 0 : e.clientX - sx.current;
        sx.current = null;
        if (dx < -30) setOpenId(id);
        else if (dx > 30) setOpenId(null);
        else if (Math.abs(dx) < 6) { if (open) setOpenId(null); else if (onTap) onTap(); }
      }}>${children}</div>
  </div>`;
}

function Sheet({ title, onClose, onSave, children }) {
  return html`<button type="button" class="dim" aria-label="닫기" onClick=${onClose}></button>
  <div class="sheet" role="dialog" aria-label=${title}>
    <div class="grab"></div>
    <div class="sheet-h">
      <button type="button" onClick=${onClose}>취소</button>
      <b>${title}</b>
      ${onSave ? html`<button type="button" class="ok" onClick=${onSave}>저장</button>` : html`<span style="width:34px"></span>`}
    </div>
    ${children}
  </div>`;
}

function AmtInput({ value, onChange, unit = '원', label = '금액', autofocus }) {
  const ref = useRef(null);
  useEffect(() => { if (autofocus && ref.current) ref.current.focus(); }, []);
  return html`<label class="amt">
    <span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${label}</span>
    <input ref=${ref} type="text" inputmode="numeric" placeholder="0" value=${value == null ? '' : fmt(value)}
      onInput=${(e) => { const v = digits(e.target.value); onChange(v); e.target.value = v == null ? '' : fmt(v); }} />
    <span>${unit}</span>
  </label>`;
}

function Seg({ opts, value, onChange, cols, sm }) {
  return html`<div class=${'seg' + (sm ? ' sm' : '')} role="tablist" style=${{ gridTemplateColumns: `repeat(${cols || opts.length}, minmax(0, 1fr))` }}>
    ${opts.map(([k, l]) => html`<button type="button" role="tab" aria-selected=${value === k} class=${value === k ? 'on' : ''} onClick=${() => onChange(k)}>${l}</button>`)}
  </div>`;
}

function PinPad({ title, msg, onDone, onCancel, busy }) {
  const [v, setV] = useState('');
  const [shake, setShake] = useState(false);
  useEffect(() => { setV(''); }, [title]);
  useEffect(() => { if (msg) { setV(''); setShake(true); const t = setTimeout(() => setShake(false), 400); return () => clearTimeout(t); } }, [msg]);
  const press = (k) => {
    if (busy) return;
    if (k === 'del') { setV(v.slice(0, -1)); return; }
    if (v.length >= 4) return;
    const nv = v + k;
    setV(nv);
    if (nv.length === 4) setTimeout(() => { onDone(nv); setV(''); }, 120);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return html`<div class="pin" role="dialog" aria-label=${title}>
    <div class="top">${onCancel ? html`<button type="button" class="link" onClick=${onCancel}>취소</button>` : ''}</div>
    <div class="mid">
      <span class="title">${title}</span>
      <div class=${'dots' + (shake ? ' shake' : '')} aria-label=${v.length + '자리 입력됨'}>${[0, 1, 2, 3].map((i) => html`<span class=${i < v.length ? 'f' : ''}></span>`)}</div>
      <span class="msg">${busy ? html`<span class="muted">확인 중…</span>` : msg || ''}</span>
    </div>
    <div class="keys">${keys.map((k) => k === '' ? html`<span></span>` : html`<button type="button" class=${k === 'del' ? 'ghost' : ''} aria-label=${k === 'del' ? '지우기' : k} onClick=${() => press(k)}>${k === 'del' ? '⌫' : k}</button>`)}</div>
  </div>`;
}

/* ───────── ① 지출 ───────── */

function Spend({ data, api }) {
  const now = new Date();
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth() + 1]);
  const [view, setView] = useState('list');
  const [q, setQ] = useState({ amt: null, cat: '약속', memo: '', date: todayStr() });
  const [more, setMore] = useState(1);
  const [selCat, setSelCat] = useState(null);
  const [selDay, setSelDay] = useState(null);
  const [tf, setTf] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [sumOpen, setSumOpen] = useState(false);

  const [y, m] = ym;
  const prefix = `${y}-${pad(m)}`;
  const D = dimOf(y, m);
  const isCur = y === now.getFullYear() && m === now.getMonth() + 1;
  const isPast = y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1);
  const upto = isCur ? now.getDate() : isPast ? D : 0;
  const budgets = LIFE.map((n) => ({ name: n, amt: (data.items.find((i) => i.cat === 'life' && i.name === n) || { amt: 0 }).amt }));
  const monthBudget = sum(budgets, (b) => b.amt);
  const rows = data.spend.filter((s) => s.date.startsWith(prefix));
  const byDay = {};
  rows.forEach((r) => { const d = Number(r.date.slice(8)); (byDay[d] = byDay[d] || []).push(r); });
  Object.keys(byDay).forEach((k) => byDay[k].reverse());
  const dayTotal = (d) => sum(byDay[d] || [], (r) => r.amt);
  const spent = sum(rows, (r) => r.amt);
  const daily = Math.floor(monthBudget / D);
  const dateLabel = (d) => `${m}.${d} (${WK[new Date(y, m - 1, d).getDay()]})`;

  const moveMonth = (dm) => {
    let nm = m + dm, ny = y;
    if (nm < 1) { nm = 12; ny--; } if (nm > 12) { nm = 1; ny++; }
    setYm([ny, nm]); setMore(1); setSelDay(null); setSelCat(null); setOpenId(null);
  };

  const add = () => {
    if (!q.amt) { api.toast('금액을 입력해 주세요'); return; }
    api.upsert('spend', { id: newId('s'), date: q.date || todayStr(), cat: q.cat, amt: q.amt, memo: q.memo.trim(), created: '' });
    const dt = q.date || todayStr();
    setQ({ amt: null, cat: q.cat, memo: '', date: q.date });
    if (!dt.startsWith(prefix)) setYm([Number(dt.slice(0, 4)), Number(dt.slice(5, 7))]);
  };

  const row = (r, left) => html`<${Swipe} key=${r.id} id=${r.id} openId=${openId} setOpenId=${setOpenId}
      actions=${[{ label: '수정', cls: 'b-blue', on: () => setEdit(Object.assign({}, r)) }, { label: '삭제', cls: 'b-red', on: () => api.remove('spend', r.id) }]}>
      ${left}
      <span style="font-size:15px;font-weight:600">${fmt(r.amt)}</span>
    <//>`;
  const catRow = (r) => row(r, html`<span style="width:48px;flex:none;font-size:15px;font-weight:600">${r.cat}</span><span class="ell" style="flex:1;font-size:14px;color:var(--muted)">${r.memo}</span>`);
  const totStyle = (t) => ({ fontSize: '13px', fontWeight: 700, color: t > daily ? 'var(--warn)' : t === 0 ? 'var(--muted)' : 'var(--text2)' });

  // 요약
  const bDiff = monthBudget - spent;
  const pDiff = Math.floor(monthBudget * upto / D) - spent;
  const box = (over) => ({ box: { borderRadius: '12px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '2px', background: over ? 'var(--warn-bg)' : 'var(--blue-bg)' }, lab: { fontSize: '12px', color: over ? 'var(--warn)' : '#0A3C80' }, val: { fontSize: '17px', fontWeight: 700, color: over ? 'var(--warn)' : 'var(--blue-d)' } });
  const bb = box(bDiff < 0), pb = box(pDiff < 0);
  const left = D - upto;
  const restText = !isCur ? (isPast ? `하루 평균 ${fmt(spent / D)}원 썼어요` : '아직 시작 전인 달이에요')
    : left === 0 ? '오늘이 이번 달 마지막 날이에요'
      : bDiff <= 0 ? `예산을 이미 다 썼어요. 남은 ${left}일은 아껴봐요`
        : `남은 ${left}일은 하루 ${fmt(Math.floor(bDiff / left))}원까지 쓸 수 있어요`;

  // 지출내역
  const lowest = Math.max(1, upto - 7 * more + 1);
  const days = [];
  for (let d = upto; d >= lowest; d--) days.push(d);

  // 달력
  const first = new Date(y, m - 1, 1).getDay();
  let overDays = 0, zeroDays = 0;
  const cal = [];
  for (let b = 0; b < first; b++) cal.push(html`<span></span>`);
  for (let d = 1; d <= D; d++) {
    const on = d === selDay;
    const base = { width: '100%', height: '50px', border: 0, padding: 0, borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: on ? 'inset 0 0 0 2px #1C1C1E' : 'none' };
    if (d > upto) { cal.push(html`<span style=${Object.assign({}, base, { border: '1px dashed var(--line)', color: 'var(--faint)', fontSize: '12px' })}>${d}</span>`); continue; }
    const v = dayTotal(d);
    let st, amtColor;
    if (v === 0) { zeroDays++; st = { background: 'var(--bg)', color: 'var(--muted)' }; amtColor = 'var(--muted)'; }
    else if (v > 100000) { overDays++; st = { background: '#D92D20', color: '#fff', fontWeight: 700 }; amtColor = '#fff'; }
    else if (v > daily) { overDays++; st = { background: 'var(--orange)', color: '#fff', fontWeight: 700 }; amtColor = '#fff'; }
    else { st = { background: '#D6E6FF', color: '#0A3C80', fontWeight: 600 }; amtColor = '#0A3C80'; }
    cal.push(html`<button type="button" aria-pressed=${on} aria-label=${`${m}월 ${d}일 ${v}원`} style=${Object.assign({}, base, st)} onClick=${() => setSelDay(selDay === d ? null : d)}>
      <span style="font-size:12px;line-height:14px">${d}</span><span style=${{ fontSize: '10px', lineHeight: '12px', letterSpacing: '-0.03em', color: amtColor }}>${v ? man(v) : '0'}</span></button>`);
  }

  // 추이: 최근 6개월
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let mm = m - i, yy = y;
    while (mm < 1) { mm += 12; yy--; }
    const pf = `${yy}-${pad(mm)}`;
    const rs = data.spend.filter((s) => s.date.startsWith(pf));
    months.push({ label: mm + '월', has: rs.length > 0, cur: yy === now.getFullYear() && mm === now.getMonth() + 1, vals: LIFE.map((n) => sum(rs.filter((r) => r.cat === n), (r) => r.amt)) });
  }
  const tBudget = tf === 'all' ? monthBudget : budgets.find((b) => b.name === tf).amt;
  const tVal = (mo) => (tf === 'all' ? sum(mo.vals) : mo.vals[LIFE.indexOf(tf)]);
  const tMax = Math.max(tBudget, ...months.map(tVal), 1);
  const H = 150;
  const pastM = months.slice(0, 5).filter((mo) => mo.has);
  const tAvg = pastM.length ? Math.floor(sum(pastM, tVal) / pastM.length) : null;
  const linePos = 20 + Math.floor(tBudget / tMax * H);

  return html`<div class="page">
    <div class="topbar" style="padding:0">
      <div class="row" style="gap:2px">
        <button type="button" class="link" aria-label="이전 달" style="width:44px;height:44px;padding:0;display:flex;align-items:center;justify-content:center" onClick=${() => moveMonth(-1)}>${I.back}</button>
        <span style="font-size:17px;font-weight:600">${y}년 ${m}월</span>
        <button type="button" class="link" aria-label="다음 달" style="width:44px;height:44px;padding:0;display:flex;align-items:center;justify-content:center" onClick=${() => moveMonth(1)}>${I.next}</button>
      </div>
      ${!isCur ? html`<button type="button" class="link" style="font-size:15px" onClick=${() => moveMonth((now.getFullYear() - y) * 12 + now.getMonth() + 1 - m)}>이번 달</button>` : ''}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin:6px 4px 16px">
      <h1 class="h1" style="margin:0">생활비</h1>
      <button type="button" aria-expanded=${sumOpen} onClick=${() => setSumOpen(!sumOpen)} class="row" style="gap:4px;border:0;background:#fff;border-radius:16px;padding:0 12px;height:32px;font-size:14px;font-weight:600;color:var(--text2)">
        ${sumOpen ? '요약 접기' : '요약 보기'}${I.chev(sumOpen, 12)}
      </button>
    </div>

    ${sumOpen && html`<section class="card pad" style="margin-bottom:28px">
      <div style="display:flex;align-items:flex-end;justify-content:space-between">
        <div style="display:flex;flex-direction:column;gap:4px">
          <span class="lbl">${isCur ? '이번 달 쓴 돈' : m + '월 쓴 돈'}</span>
          <span class="big">${fmt(spent)}<small>원</small></span>
        </div>
        <span style="font-size:14px;color:var(--muted);padding-bottom:6px">/ ${fmt(monthBudget)}</span>
      </div>
      <div style="position:relative;height:10px;border-radius:5px;background:#EDEDF0;overflow:hidden">
        <div style=${{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.min(100, monthBudget ? Math.floor(spent / monthBudget * 100) : 0) + '%', background: bDiff < 0 ? 'var(--orange)' : 'var(--blue)' }}></div>
      </div>
      <div class="grid2">
        <div style=${bb.box}><span style=${bb.lab}>${isCur ? '이번 달 생활비' : m + '월 생활비'}</span><span style=${bb.val}>${fmt(Math.abs(bDiff))}원 ${bDiff < 0 ? '초과' : '남음'}</span></div>
        ${isCur
          ? html`<div style=${pb.box}><span style=${pb.lab}>오늘(${upto}일) 현황</span><span style=${pb.val}>${fmt(Math.abs(pDiff))}원 ${pDiff < 0 ? '초과' : '남음'}</span></div>`
          : html`<div style=${box(false).box}><span style=${box(false).lab}>하루 예산</span><span style=${box(false).val}>${fmt(daily)}원</span></div>`}
      </div>
      <div class="row" style="gap:8px;font-size:13px;color:var(--text2)">
        ${isCur ? html`<span style="flex:none;font-size:12px;font-weight:700;background:var(--bg);border-radius:6px;padding:3px 7px">D-${left}</span>` : ''}
        <span>${restText}</span>
      </div>
    </section>`}

    <section class="card" style="padding:16px;display:flex;flex-direction:column;gap:14px">
      <${AmtInput} value=${q.amt} onChange=${(v) => setQ(Object.assign({}, q, { amt: v }))} />
      <div class="chips" role="radiogroup" aria-label="항목" style="grid-template-columns:repeat(5,minmax(0,1fr))">
        ${LIFE.map((n) => html`<button type="button" role="radio" aria-checked=${q.cat === n} class=${'chip' + (q.cat === n ? ' on' : '')} style="padding:0" onClick=${() => setQ(Object.assign({}, q, { cat: n }))}>${n}</button>`)}
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 140px;gap:8px">
        <label class="field"><span>메모 (선택)</span><input type="text" placeholder="예: 저녁 약속" value=${q.memo} onInput=${(e) => setQ(Object.assign({}, q, { memo: e.target.value }))} onKeyDown=${(e) => { if (e.key === 'Enter') add(); }} /></label>
        <label class="field"><span>날짜</span><input type="date" value=${q.date} onInput=${(e) => setQ(Object.assign({}, q, { date: e.target.value }))} /></label>
      </div>
      <button type="button" class="btn" onClick=${add}>추가</button>
    </section>

    <div style="margin-top:28px"><${Seg} opts=${[['list', '지출내역'], ['cat', '항목별'], ['cal', '달력'], ['trend', '추이']]} value=${view} onChange=${(v) => { setView(v); setOpenId(null); }} /></div>

    ${view === 'list' && html`<section class="card" style="margin-top:12px">
      ${upto === 0 ? html`<div class="empty">아직 기록이 없어요</div>` : days.map((d) => html`<div key=${d}>
        <div class="band"><span>${dateLabel(d)}</span><span style=${totStyle(dayTotal(d))}>${fmt(dayTotal(d))}원</span></div>
        ${(byDay[d] || []).map(catRow)}
      </div>`)}
      ${lowest > 1 ? html`<button type="button" class="addrow" style="text-align:center;border-top:0.5px solid var(--line)" onClick=${() => setMore(more + 1)}>이전 기록 더 보기</button>` : ''}
    </section>`}

    ${view === 'cat' && html`<section class="card" style="margin-top:12px">
      ${budgets.map((b, i) => {
        const used = sum(rows.filter((r) => r.cat === b.name), (r) => r.amt);
        const over = used > b.amt;
        const pct = b.amt ? Math.min(100, Math.floor(used / b.amt * 100)) : (used ? 100 : 0);
        const state = over ? `${fmt(used - b.amt)}원 초과` : used === b.amt && used > 0 ? '예산 소진' : `${fmt(b.amt - used)}원 남음`;
        const on = selCat === b.name;
        return html`<button type="button" aria-pressed=${on} onClick=${() => setSelCat(on ? null : b.name)} style=${{ width: '100%', border: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 16px', background: on ? '#EEF4FF' : '#fff', borderBottom: i < budgets.length - 1 ? '0.5px solid var(--line)' : 0 }}>
          <span style="display:flex;align-items:baseline;gap:8px;width:100%"><span style="flex:1;font-size:15px;font-weight:600">${b.name}</span><span style=${{ fontSize: '15px', fontWeight: 700, color: over ? 'var(--warn)' : 'var(--text)' }}>${fmt(used)}</span><span style="font-size:13px;color:var(--muted)">/ ${fmt(b.amt)}</span></span>
          <span style="display:block;width:100%;height:8px;border-radius:4px;background:#EDEDF0;overflow:hidden"><span style=${{ display: 'block', height: '8px', borderRadius: '4px', width: pct + '%', background: over ? 'var(--orange)' : 'var(--blue)' }}></span></span>
          <span class="sub">${state}${LIFE_DESC[b.name] ? ' · ' + LIFE_DESC[b.name] : ''}</span>
        </button>`;
      })}
    </section>
    ${selCat && (() => {
      const rs = rows.filter((r) => r.cat === selCat).sort((a, b) => (a.date < b.date ? 1 : -1));
      return html`<section class="card" style="margin-top:12px">
        <div class="band" style="height:38px"><span>${selCat} · ${rs.length}건</span><span>${fmt(sum(rs, (r) => r.amt))}원</span></div>
        ${rs.map((r) => row(r, html`<span style="width:44px;flex:none;font-size:13px;color:var(--muted)">${Number(r.date.slice(5, 7))}.${Number(r.date.slice(8))}</span><span class="ell" style="flex:1;font-size:15px;font-weight:600">${r.memo || '-'}</span>`))}
        ${rs.length === 0 ? html`<div class="empty">이번 달 기록 없음</div>` : ''}
      </section>`;
    })()}`}

    ${view === 'cal' && html`<section class="card" style="margin-top:12px;padding:16px 12px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;padding:0 4px;font-size:13px;color:var(--text2)">
        <span>하루 예산 넘은 날 <b style="color:var(--warn)">${overDays}일</b> / ${upto}일</span><span>무지출 <b>${zeroDays}일</b></span>
      </div>
      <div style="padding:0 4px" class="sub">${m}월 하루 예산 ${fmt(daily)}원 (${fmt(monthBudget)}원 ÷ ${D}일)</div>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;font-size:11px;color:var(--muted);text-align:center">${WK.map((w) => html`<span>${w}</span>`)}</div>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">${cal}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;color:var(--text2);padding:2px 4px 0">
        <span class="row" style="gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#D6E6FF"></span>하루 예산 이하</span>
        <span class="row" style="gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:var(--orange)"></span>초과</span>
        <span class="row" style="gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#D92D20"></span>10만원 넘음</span>
        <span class="row" style="gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:var(--bg);border:1px solid var(--line)"></span>무지출</span>
      </div>
    </section>
    ${selDay && html`<section class="card" style="margin-top:12px">
      <div class="band" style="height:38px"><span>${dateLabel(selDay)}</span><span style=${totStyle(dayTotal(selDay))}>${fmt(dayTotal(selDay))}원</span></div>
      ${(byDay[selDay] || []).map(catRow)}
      ${(byDay[selDay] || []).length === 0 ? html`<div class="empty">지출 없음</div>` : ''}
    </section>`}`}

    ${view === 'trend' && html`
      <div class="chips" style="margin-top:12px;grid-template-columns:repeat(6,minmax(0,1fr))">
        ${[['all', '전체']].concat(LIFE.map((n) => [n, n])).map(([k, l]) => html`<button type="button" class=${'chip sm dark' + (tf === k ? ' on' : '')} style="padding:0" onClick=${() => setTf(k)}>${l}</button>`)}
      </div>
      <section class="card" style="margin-top:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:15px;font-weight:700">${tf === 'all' ? '생활비 전체' : tf} · 최근 6개월</span><span class="sub">${tAvg == null ? '이전 달 기록이 아직 없어요' : `지난 ${pastM.length}개월 평균 ${fmt(tAvg)}원`}</span></div>
          <span class="row" style="flex:none;gap:6px;font-size:12px;font-weight:700;color:var(--warn);padding-top:2px"><span style="width:16px;border-top:1.5px dashed var(--warn)"></span>예산 ${man(tBudget)}</span>
        </div>
        <div role="img" aria-label="최근 6개월 지출 막대" style="position:relative;height:190px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-items:end">
          <div style=${{ position: 'absolute', left: 0, right: 0, bottom: linePos + 'px', borderTop: '1.5px dashed var(--warn)', zIndex: 2 }}></div>
          ${months.map((mo) => {
            const v = tVal(mo);
            return html`<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
              <span style=${{ position: 'relative', zIndex: 3, background: '#fff', padding: '0 2px', borderRadius: '3px', fontSize: '11px', fontWeight: 700, color: v > tBudget ? 'var(--warn)' : 'var(--text2)' }}>${v ? man(v) : '0'}</span>
              <div style="width:26px;display:flex;flex-direction:column-reverse;border-radius:6px;overflow:hidden">
                ${LIFE.map((n, i) => { if (tf !== 'all' && n !== tf) return ''; const h = Math.floor(mo.vals[i] / tMax * H); return h > 0 ? html`<div style=${{ height: h + 'px', background: LIFE_COLOR[n], opacity: mo.cur ? 0.6 : 1 }}></div>` : ''; })}
              </div>
              <span style="height:16px;line-height:16px;font-size:12px;color:var(--muted)">${mo.label}</span>
            </div>`;
          })}
        </div>
        ${tf === 'all' && html`<div class="wrap" style="gap:12px;font-size:12px;color:var(--text2)">${LIFE.map((n) => html`<span class="row" style="gap:5px"><span style=${{ width: '10px', height: '10px', borderRadius: '3px', background: LIFE_COLOR[n] }}></span>${n}</span>`)}</div>`}
      </section>
      <section class="card" style="margin-top:12px">
        ${months.slice().reverse().map((mo, i) => {
          const v = tVal(mo); const d = tBudget - v;
          return html`<div class="line" style=${{ minHeight: '44px', borderBottom: i < 5 ? '0.5px solid var(--line)' : 0 }}>
            <span style="flex:1;font-size:15px;font-weight:600">${mo.label}${mo.cur ? ' (진행 중)' : ''}</span>
            <span style="font-size:15px;font-weight:600">${fmt(v)}원</span>
            ${mo.has || mo.cur
              ? html`<span style=${{ width: '104px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: d < 0 ? 'var(--warn)' : 'var(--blue-d)' }}>${fmt(Math.abs(d))}원 ${d < 0 ? '초과' : '남음'}</span>`
              : html`<span style="width:104px;text-align:right;font-size:13px;color:var(--faint)">기록 없음</span>`}
          </div>`;
        })}
      </section>`}

    ${edit && html`<${Sheet} title="기록 수정" onClose=${() => setEdit(null)} onSave=${() => { if (!edit.amt) { api.toast('금액을 입력해 주세요'); return; } api.upsert('spend', edit); setEdit(null); }}>
      <${AmtInput} value=${edit.amt} onChange=${(v) => setEdit(Object.assign({}, edit, { amt: v }))} />
      <div class="chips" style="grid-template-columns:repeat(5,minmax(0,1fr))">
        ${LIFE.map((n) => html`<button type="button" class=${'chip' + (edit.cat === n ? ' on' : '')} style="padding:0" onClick=${() => setEdit(Object.assign({}, edit, { cat: n }))}>${n}</button>`)}
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 140px;gap:8px">
        <label class="field"><span>메모</span><input type="text" placeholder="메모 없음" value=${edit.memo} onInput=${(e) => setEdit(Object.assign({}, edit, { memo: e.target.value }))} /></label>
        <label class="field"><span>날짜</span><input type="date" value=${edit.date} onInput=${(e) => setEdit(Object.assign({}, edit, { date: e.target.value }))} /></label>
      </div>
      <button type="button" class="btn danger" onClick=${() => { api.remove('spend', edit.id); setEdit(null); }}>이 기록 삭제</button>
    <//>`}
  </div>`;
}

/* ───────── ② 월 예산 ───────── */

function Budget({ data, api }) {
  const now = new Date();
  const [open, setOpen] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [openDay, setOpenDay] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [incomeDraft, setIncomeDraft] = useState(null);

  const items = data.items.slice().sort(byOrder);
  const of = (k) => items.filter((x) => x.cat === k);
  const sumOf = (k) => sum(of(k), (x) => x.amt);
  const total = sum(CATS, (c) => sumOf(c[0]));
  const ceil10k = (n) => Math.ceil(n / 10000) * 10000;
  const acctA = ceil10k(sumOf('save') + sumOf('invest'));
  const acctB = ceil10k(sumOf('use') + sumOf('house') + sumOf('fixed') + sumOf('meet'));
  const lifeSum = sumOf('life');
  const income = data.config.income;
  const diff = income == null ? null : income - acctA - acctB - lifeSum;
  const accounts = data.accounts.filter((a) => !a.closed).sort(byOrder);
  const D = dimOf(now.getFullYear(), now.getMonth() + 1);
  const today = now.getDate();
  const CUR_YM = `${String(now.getFullYear()).slice(2)}.${pad(now.getMonth() + 1)}`;

  // 출금 일정
  const byDay = {};
  const undated = [];
  CATS.forEach(([k, label, color]) => {
    if (k === 'life') return;
    of(k).forEach((x) => {
      const r = { name: x.name, cat: label, amt: x.amt, color };
      if (x.day) { const d = Math.min(x.day, D); (byDay[d] = byDay[d] || []).push(r); } else undated.push(r);
    });
  });
  const amounts = {};
  Object.keys(byDay).forEach((k) => { amounts[k] = sum(byDay[k], (r) => r.amt); });
  const maxA = Math.max(1, ...Object.values(amounts));
  let remain = 0;
  const bars = [];
  for (let i = 1; i <= D; i++) {
    const a = amounts[i] || 0;
    if (i >= today) remain += a;
    const h = a ? Math.max(6, Math.round(52 * Math.sqrt(a / maxA))) : 4;
    const isT = i === today;
    const show = isT || ((i === 1 || i === 10 || i === 20 || i === D) && Math.abs(i - today) > 2);
    bars.push(html`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:72px">
      <div style=${{ width: '100%', height: h + 'px', borderRadius: '2px', background: i < today ? '#C9DAF2' : '#4A8FE7' }}></div>
      <span style=${{ fontSize: '10px', height: '12px', lineHeight: '12px', whiteSpace: 'nowrap', color: isT ? 'var(--blue-d)' : 'var(--muted)', fontWeight: isT ? 700 : 500 }}>${show ? i : ''}</span>
    </div>`);
  }
  const sorted = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  let groups = sorted.filter((d) => d >= today).map((d) => [d, byDay[d]]);
  if (undated.length) groups.push([0, undated]);
  groups = groups.concat(sorted.filter((d) => d < today).map((d) => [d, byDay[d]]));

  const reviews = items.filter((x) => x.review).sort((a, b) => (a.review < b.review ? -1 : 1));

  const openItem = (k, x) => setSheet({ cat: k, id: x ? x.id : null, name: x ? x.name : '', amt: x ? x.amt : null, day: x && x.day ? String(x.day) : '', memo: x ? x.memo : '', review: x ? x.review : '', hasReview: !!(x && x.review), link: x ? x.link || '' : '', order: x ? x.order : 0 });
  const saveItem = () => {
    const s = sheet;
    if (s.cat !== 'life' && !s.name.trim()) { api.toast('항목명을 입력해 주세요'); return; }
    const maxOrder = Math.max(0, ...data.items.map((x) => x.order || 0));
    api.upsert('items', {
      id: s.id || newId('i'), cat: s.cat, name: s.name.trim(), amt: s.amt || 0,
      day: Math.min(31, digits(s.day) || 0), memo: (s.memo || '').trim(),
      review: s.hasReview ? (s.review || '').trim() : '', link: LINKABLE[s.cat] ? s.link : '',
      order: s.id ? s.order : maxOrder + 1
    });
    setSheet(null);
  };
  const lastEdit = data.config.budgetEdited ? short(data.config.budgetEdited) : '';

  return html`<div class="page">
    <div class="topbar"><span class="meta">${lastEdit ? lastEdit + ' 기준' : ''}</span></div>
    <h1 class="h1">월 예산</h1>

    <section class="card pad" style="gap:16px">
      <div style="display:flex;flex-direction:column;gap:4px"><span class="lbl">이번 달 예산 합계</span><span class="big">${fmt(acctA + acctB + lifeSum)}<small>원</small></span></div>
      <div class="grid2">
        <button type="button" onClick=${() => setIncomeDraft(income == null ? undefined : income)} style="border:0;text-align:left;background:var(--bg);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px">
          <span class="sub">실수령</span><span style="font-size:15px;font-weight:600">${income == null ? '입력하기 ›' : fmt(income) + '원'}</span>
        </button>
        <div style="background:var(--bg);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px">
          <span class="sub">남는 돈</span><span style="font-size:15px;font-weight:600">${diff == null ? '—' : (diff >= 0 ? '+' : '−') + fmt(Math.abs(diff)) + '원'}</span>
        </div>
      </div>
      <div role="img" aria-label="카테고리별 예산 비율" style="display:flex;height:14px;border-radius:7px;overflow:hidden">
        ${CATS.map(([k, , c]) => html`<div style=${{ width: (total ? sumOf(k) / total * 100 : 0) + '%', background: c }}></div>`)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px;row-gap:8px;font-size:13px">
        ${CATS.map(([k, l, c]) => html`<div class="row" style="gap:6px"><span class="dot" style=${{ background: c }}></span><span style="flex:1">${l}</span><span class="muted">${total ? Math.floor(sumOf(k) / total * 1000) / 10 : 0}%</span></div>`)}
      </div>
      <div style="border-top:0.5px solid var(--line);padding-top:12px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between"><span style="font-size:14px;color:var(--text2)">적금·투자 합계</span><span style="font-size:15px;font-weight:700;color:var(--blue-d)">${fmt(acctA)}원</span></div>
        <div style="display:flex;justify-content:space-between"><span style="font-size:14px;color:var(--text2)">자동이체 합계</span><span style="font-size:15px;font-weight:700;color:var(--blue-d)">${fmt(acctB)}원</span></div>
        <div style="display:flex;justify-content:space-between"><span style="font-size:14px;color:var(--text2)">생활비</span><span style="font-size:15px;font-weight:700;color:var(--text)">${fmt(lifeSum)}원</span></div>
      </div>
    </section>

    <h2 class="h2">카테고리</h2>
    <section class="card">
      ${CATS.map(([k, label, color], ci) => {
        const list = of(k);
        const isOpen = open === k;
        const names = list.map((x) => x.name);
        const sub = k === 'life' ? `하루 ${fmt(sumOf(k) / D)}원 · 지출 탭과 연동` : list.length ? names.slice(0, 3).join(' · ') + (names.length > 3 ? ` 외 ${names.length - 3}건` : '') : '항목 없음';
        return html`<div style=${{ borderBottom: ci < CATS.length - 1 ? '0.5px solid var(--line)' : 0 }}>
          <button type="button" aria-expanded=${isOpen} onClick=${() => { setOpen(isOpen ? null : k); setOpenId(null); }} style="width:100%;border:0;background:#fff;text-align:left;display:flex;align-items:center;gap:12px;padding:12px 16px;min-height:60px">
            <span style=${{ width: '32px', height: '32px', borderRadius: '9px', flex: 'none', background: color }}></span>
            <span style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:16px;font-weight:600">${label}</span><span class="ell" style="font-size:13px;color:var(--muted)">${sub}</span></span>
            <span style="font-size:16px;font-weight:600">${fmt(sumOf(k))}</span>
            ${I.chev(isOpen, 16)}
          </button>
          ${isOpen && html`<div style="background:#F7F7FA;border-top:0.5px solid var(--line)">
            ${list.map((x) => {
              const when = k === 'life' ? '지출 탭과 연동' : x.day ? `매월 ${x.day}일` : '날짜 미정';
              return html`<div style="border-bottom:0.5px solid #ECECF0"><${Swipe} id=${x.id} openId=${openId} setOpenId=${setOpenId} bg="#F7F7FA" fgClass="" fgStyle=${{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px 8px 60px', minHeight: '52px' }}
                actions=${k === 'life' ? [{ label: '수정', cls: 'b-blue', on: () => openItem(k, x) }] : [{ label: '수정', cls: 'b-blue', on: () => openItem(k, x) }, { label: '삭제', cls: 'b-red', on: () => api.remove('items', x.id) }]}>
                <span style="flex:1;display:flex;flex-direction:column;gap:1px;min-width:0"><span style="font-size:15px;font-weight:600">${x.name}</span><span class="sub">${when}${x.review ? ` · ${x.review} 검토` : ''}${x.memo ? ' · ' + x.memo : ''}</span></span>
                <span style="font-size:15px;font-weight:600">${fmt(x.amt)}</span>
              <//></div>`;
            })}
            ${k !== 'life' && html`<button type="button" class="addrow" style="background:transparent;padding:0 60px" onClick=${() => openItem(k, null)}>+ ${label} 항목 추가</button>`}
          </div>`}
        </div>`;
      })}
    </section>

    <h2 class="h2">출금 일정</h2>
    <section class="card" style="padding:18px 16px 16px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px">
        <span class="row" style="gap:7px;font-weight:700;color:var(--blue-d)"><span style="width:8px;height:8px;border-radius:4px;background:var(--blue-d);box-shadow:0 0 0 3px #D6E6FF"></span>오늘 ${now.getMonth() + 1}.${today}</span>
        <span style="color:var(--text2)">남은 출금 <b style="color:var(--text)">${fmt(remain)}원</b></span>
      </div>
      <div role="img" aria-label="날짜별 출금액" style="display:flex;align-items:flex-end;gap:3px;height:72px">${bars}</div>
      <div style="display:flex;gap:14px;font-size:12px;color:var(--text2)">
        <span class="row" style="gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#C9DAF2"></span>지난 날</span>
        <span class="row" style="gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#4A8FE7"></span>남은 날 (오늘 포함)</span>
      </div>
      <div>
        ${groups.map(([d, rs], gi) => {
          const key = String(d);
          const isO = openDay === key;
          const past = d && d < today; const isT = d === today;
          const names = rs.map((r) => r.name);
          return html`<div style=${{ borderBottom: gi < groups.length - 1 ? '0.5px solid var(--line)' : 0 }}>
            <button type="button" aria-expanded=${isO} onClick=${() => setOpenDay(isO ? null : key)} style="width:100%;border:0;padding:0;background:transparent;text-align:left;display:flex;align-items:center;gap:12px;min-height:44px">
              <span style=${{ width: '40px', flex: 'none', fontSize: '15px', fontWeight: isT ? 700 : 600, color: isT ? 'var(--blue-d)' : past ? 'var(--faint)' : 'var(--text)' }}>${d ? d + '일' : '미정'}</span>
              <span class="ell" style="flex:1;font-size:14px;color:var(--text2)">${names.slice(0, 2).join(' · ')}${names.length > 2 ? ` 외 ${names.length - 2}건` : ''}</span>
              <span style=${{ fontSize: '15px', fontWeight: isT ? 700 : 600, color: past ? 'var(--faint)' : 'var(--text)' }}>${fmt(sum(rs, (r) => r.amt))}</span>
              ${I.chev(isO)}
            </button>
            ${isO && html`<div style="background:#F7F7FA;border-radius:10px;margin:0 0 10px;padding:4px 12px">
              ${rs.map((r) => html`<div class="row" style="gap:8px;min-height:36px;font-size:14px"><span class="dot" style=${{ background: r.color }}></span><span style="flex:1;min-width:0">${r.name}</span><span class="sub">${r.cat}</span><span style="width:76px;text-align:right;font-weight:600">${fmt(r.amt)}</span></div>`)}
            </div>`}
          </div>`;
        })}
      </div>
    </section>

    <h2 class="h2">검토 항목</h2>
    <section class="card">
      ${reviews.map((x, i) => {
        const overdue = x.review < CUR_YM;
        return html`<div class="row" style=${{ gap: '12px', padding: '14px 16px', borderBottom: i < reviews.length - 1 ? '0.5px solid var(--line)' : 0 }}>
          <span style=${{ fontSize: '12px', fontWeight: 700, borderRadius: '6px', padding: '4px 7px', flex: 'none', color: overdue ? 'var(--red)' : '#A85A00', background: overdue ? 'var(--red-bg)' : 'var(--warn-bg)' }}>${x.review} 검토</span>
          <span style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:15px;font-weight:600">${x.name}</span>${x.memo ? html`<span style="font-size:13px;color:var(--muted)">${x.memo}</span>` : ''}</span>
          <span style="flex:none;font-size:14px;font-weight:600;color:var(--text2)">${x.day ? x.day + '일' : '미정'} · ${fmt(x.amt)}</span>
        </div>`;
      })}
      ${reviews.length === 0 ? html`<div class="empty">예정된 검토가 없어요</div>` : ''}
    </section>

    ${incomeDraft !== null && html`<${Sheet} title="실수령" onClose=${() => setIncomeDraft(null)} onSave=${() => { api.setConfig('income', incomeDraft || ''); setIncomeDraft(null); }}>
      <${AmtInput} value=${incomeDraft === undefined ? null : incomeDraft} onChange=${(v) => setIncomeDraft(v == null ? undefined : v)} autofocus />
    <//>`}

    ${sheet && html`<${Sheet} title=${sheet.id ? '항목 수정' : CATS.find((c) => c[0] === sheet.cat)[1] + ' 항목 추가'} onClose=${() => setSheet(null)} onSave=${saveItem}>
      ${sheet.cat === 'life'
        ? html`<div class="field"><span>생활비 항목</span><span style="font-size:18px;font-weight:700;color:var(--text)">${sheet.name}</span></div>`
        : html`<label class="field"><span>항목명</span><input class="lg" type="text" placeholder="예: 청년미래적금" value=${sheet.name} onInput=${(e) => setSheet(Object.assign({}, sheet, { name: e.target.value }))} /></label>`}
      <${AmtInput} value=${sheet.amt} onChange=${(v) => setSheet(Object.assign({}, sheet, { amt: v }))} />
      ${sheet.cat !== 'life' && html`
        <div style="display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px">
          <label class="field"><span>출금일 (매월)</span><input type="text" inputmode="numeric" placeholder="예: 26" value=${sheet.day} onInput=${(e) => setSheet(Object.assign({}, sheet, { day: e.target.value.replace(/[^0-9]/g, '') }))} /></label>
          <label class="field"><span>메모 (선택)</span><input type="text" value=${sheet.memo} onInput=${(e) => setSheet(Object.assign({}, sheet, { memo: e.target.value }))} /></label>
        </div>
        ${LINKABLE[sheet.cat] && html`<label class="field"><span>입금 계좌 (선택)</span>
          <select value=${sheet.link} onChange=${(e) => setSheet(Object.assign({}, sheet, { link: e.target.value }))}>
            <option value="">연결 안 함</option>
            ${accounts.map((a) => html`<option value=${a.id}>${a.name}</option>`)}
          </select></label>`}
        <div class="field"><span>검토 (선택)</span>
          <${Seg} sm opts=${[['n', '없음'], ['y', '검토']]} value=${sheet.hasReview ? 'y' : 'n'} onChange=${(v) => setSheet(Object.assign({}, sheet, { hasReview: v === 'y' }))} />
          ${sheet.hasReview && html`<div style="display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px;margin-top:6px"><label class="field"><input type="text" aria-label="검토할 달" placeholder="예: 27.04" value=${sheet.review} onInput=${(e) => setSheet(Object.assign({}, sheet, { review: e.target.value }))} /></label></div>`}
        </div>
        ${sheet.id && html`<button type="button" class="btn danger" onClick=${() => { api.remove('items', sheet.id); setSheet(null); }}>이 항목 삭제</button>`}
      `}
    <//>`}
  </div>`;
}

/* ───────── ③ 자산 ───────── */

function assetModel(data) {
  const dates = Array.from(new Set(data.checks.map((c) => c.date))).sort();
  const L = dates[dates.length - 1] || null;
  const P = dates[dates.length - 2] || null;
  const at = {};
  data.checks.forEach((c) => { (at[c.date] = at[c.date] || {})[c.accountId] = Number(c.amount) || 0; });
  const amt = (date, id) => (date && at[date] && at[date][id] != null ? at[date][id] : 0);
  return { dates, L, P, at, amt };
}

function Assets({ data, api, goCheck }) {
  const [openId, setOpenId] = useState(null);
  const [openBucket, setOpenBucket] = useState(null);
  const [sheet, setSheet] = useState(null);
  const { dates, L, P, amt } = assetModel(data);
  const buckets = data.buckets.slice().sort(byOrder);
  const all = data.accounts.slice().sort(byOrder);
  const accounts = all.filter((a) => !a.closed);
  const cur = (a) => amt(L, a.id);
  const prev = (a) => amt(P, a.id);
  const inB = (b) => accounts.filter((a) => a.bucket === b.id);
  const sumB = (b) => sum(inB(b), cur);
  const total = sum(accounts, cur);
  const prevTotal = sum(accounts, prev);
  const delta = total - prevTotal;
  const exTotal = total - sum(buckets.filter((b) => b.exclude), sumB);
  const hasEx = buckets.some((b) => b.exclude);
  const today = todayStr();
  const since = L ? diffDays(L, today) : null;
  const overdue = !L || since > 31;
  const changed = !!data.config.acctChanged;
  const checkedIds = new Set(data.checks.map((c) => c.accountId));

  // 도넛
  let acc = 0;
  const stops = buckets.map((b) => { const p = total ? sumB(b) / total * 100 : 0; const s = `${b.color} ${acc.toFixed(2)}% ${(acc + p).toFixed(2)}%`; acc += p; return s; });
  const pct = (v) => (total ? Math.floor(v / total * 1000) / 10 : 0) + '%';

  // 만기
  const now = new Date();
  const tY = now.getFullYear() % 100, tM = now.getMonth() + 1;
  const dueInfo = (due) => {
    if (!due) return null;
    const p = due.split('.');
    const diff = (Number(p[0]) * 12 + Number(p[1])) - (tY * 12 + tM);
    if (isNaN(diff)) return { t: due + ' 만기', c: 'var(--muted)', w: 400 };
    if (diff < 0) return { t: due + ' 만기 지남', c: 'var(--red)', w: 600 };
    if (diff === 0) return { t: '이번 달 만기', c: '#C25E00', w: 600 };
    if (diff === 1) return { t: '다음 달 만기 · ' + due, c: '#C25E00', w: 600 };
    return { t: due + ' 만기', c: 'var(--muted)', w: 400 };
  };

  // 점검별 추이
  const last6 = dates.slice(-6);
  const bucketOf = {};
  all.forEach((a) => { bucketOf[a.id] = a.bucket; });
  const colTotals = last6.map((d) => sum(all, (a) => amt(d, a.id)));
  const tMax = Math.max(1, ...colTotals);

  const closeAcc = (a) => {
    if (checkedIds.has(a.id)) api.upsert('accounts', Object.assign({}, a, { closed: true }));
    else api.remove('accounts', a.id);
    api.setConfig('acctChanged', '1');
  };
  const saveBucket = () => {
    const s = sheet;
    if (!s.name.trim()) { api.toast('버킷 이름을 입력해 주세요'); return; }
    if (s.id) api.upsert('buckets', Object.assign({}, buckets.find((b) => b.id === s.id), { name: s.name.trim(), when: s.when.trim() }));
    else api.upsert('buckets', { id: newId('b'), name: s.name.trim(), color: PALETTE[buckets.length % PALETTE.length], when: s.when.trim(), exclude: false, order: Math.max(0, ...buckets.map((b) => b.order || 0)) + 1 });
    setSheet(null);
  };
  const saveAccount = () => {
    const s = sheet;
    if (!s.name.trim()) { api.toast('계좌 이름을 입력해 주세요'); return; }
    if (s.id) api.upsert('accounts', Object.assign({}, all.find((a) => a.id === s.id), { name: s.name.trim(), bucket: s.bucket, target: s.target || 0, due: s.due.trim() }));
    else {
      api.upsert('accounts', { id: newId('a'), name: s.name.trim(), bucket: s.bucket, target: s.target || 0, due: s.due.trim(), closed: false, order: Math.max(0, ...all.map((a) => a.order || 0)) + 1 });
      api.setConfig('acctChanged', '1');
      setOpenBucket(s.bucket);
    }
    setSheet(null);
  };

  const headText = !L ? '아직 점검 기록이 없어요' : overdue ? `점검 지난 지 ${since}일` : short(L) + ' 점검 기준' + (changed ? ' · 계좌 변경 있음' : '');
  const headColor = overdue && L ? 'var(--red)' : changed ? '#C25E00' : 'var(--muted)';
  const need = overdue || changed;

  return html`<div class="page">
    <div class="topbar">
      <span style=${{ fontSize: '15px', color: headColor, fontWeight: need && L ? 600 : 400 }}>${headText}</span>
      <button type="button" class="link row" style="gap:6px" onClick=${goCheck}>${need ? html`<span class="dot" style=${{ background: overdue ? '#D92D20' : 'var(--orange)' }}></span>` : ''}점검하기</button>
    </div>
    <h1 class="h1">자산 현황</h1>

    <section class="card pad" style="gap:18px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="display:flex;flex-direction:column;gap:4px">
          <span class="lbl">총자산</span>
          <span class="big">${fmt(total)}<small>만원</small></span>
          ${hasEx ? html`<span style="font-size:13px;color:var(--text2)">${buckets.filter((b) => b.exclude).map((b) => b.name).join('·')} 제외 <b>${fmt(exTotal)}만원</b></span>` : ''}
        </div>
        ${P ? html`<span style=${{ fontSize: '13px', fontWeight: 700, borderRadius: '8px', padding: '5px 8px', whiteSpace: 'nowrap', color: delta >= 0 ? 'var(--green)' : 'var(--red)', background: delta >= 0 ? 'var(--green-bg)' : 'var(--red-bg)' }}>${delta >= 0 ? '▲ ' : '▼ '}${fmt1(Math.abs(delta))}만 · ${short(P).slice(3)} 대비</span>` : ''}
      </div>
      <div class="row" style="gap:18px">
        <div role="img" aria-label="버킷별 자산 비중" style=${{ flex: 'none', width: '150px', height: '150px', borderRadius: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: total ? `conic-gradient(${stops.join(', ')})` : '#EDEDF0' }}>
          <div style="width:94px;height:94px;border-radius:47px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px"><span class="sub">버킷</span><span style="font-size:18px;font-weight:800">${buckets.length}개</span></div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:9px;font-size:13px;min-width:0">
          ${buckets.map((b) => html`<div class="row" style="gap:6px"><span class="dot" style=${{ background: b.color }}></span><span class="ell" style="flex:1">${b.name}</span><b style="font-weight:600">${pct(sumB(b))}</b></div>`)}
        </div>
      </div>
    </section>

    <h2 class="h2">버킷 목표</h2>
    <section class="card">
      ${buckets.map((b) => {
        const list = inB(b);
        const c = sumB(b);
        const target = sum(list, (a) => a.target || 0);
        const has = target > 0;
        const pc = has ? Math.min(100, Math.floor(c / target * 100)) : 0;
        const isOpen = openBucket === b.id;
        const acts = [{ label: '수정', cls: 'b-blue', on: () => setSheet({ kind: 'bucket', id: b.id, name: b.name, when: b.when || '' }) }];
        if (!list.length) acts.push({ label: '삭제', cls: 'b-red', on: () => api.remove('buckets', b.id) });
        return html`<div style="border-bottom:0.5px solid var(--line)">
          <${Swipe} id=${'b:' + b.id} openId=${openId} setOpenId=${setOpenId} fgClass="" fgStyle=${{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 16px', cursor: 'pointer' }}
            actions=${acts} onTap=${() => setOpenBucket(isOpen ? null : b.id)}>
            <span class="row" style="gap:8px"><span class="dot" style=${{ background: b.color }}></span><span style="flex:1;font-size:15px;font-weight:600">${b.name}</span><span style="font-size:13px;color:var(--text2)">${has ? `${fmt1(c)}만 / ${fmt(target)}만` : fmt1(c) + '만'}</span>${I.chev(isOpen)}</span>
            <span style="display:block;height:8px;border-radius:4px;background:#EDEDF0;overflow:hidden"><span style=${{ display: 'block', height: '8px', borderRadius: '4px', background: b.color, width: pc + '%' }}></span></span>
            <span class="sub">${has ? `${pc}% 달성 · ${fmt1(Math.max(0, target - c))}만원 남음${b.when ? ' · ' + b.when + '까지' : ''}` : '목표 미설정' + (b.when ? ' · ' + b.when + '까지' : '')}</span>
          <//>
          ${isOpen && html`<div style="background:#F7F7FA;border-top:0.5px solid var(--line)">
            ${list.map((a) => {
              const di = dueInfo(a.due);
              return html`<div style="border-bottom:0.5px solid #ECECF0"><${Swipe} id=${'a:' + a.id} openId=${openId} setOpenId=${setOpenId} bg="#F7F7FA" fgClass="" fgStyle=${{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px 6px 32px', minHeight: '46px' }}
                actions=${[{ label: '수정', cls: 'b-blue', on: () => setSheet({ kind: 'account', id: a.id, name: a.name, bucket: a.bucket, target: a.target || null, due: a.due || '' }) }, { label: checkedIds.has(a.id) ? '해지' : '삭제', cls: 'b-red', on: () => closeAcc(a) }]}>
                <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:15px">${a.name}</span>${di ? html`<span style=${{ fontSize: '12px', color: di.c, fontWeight: di.w }}>${di.t}</span>` : ''}</span>
                <span style="font-size:15px"><b style="font-weight:600">${fmt1(cur(a))}만</b>${a.target ? html`<span style="font-size:12px;color:var(--faint)"> / ${fmt(a.target)}만</span>` : ''}</span>
              <//></div>`;
            })}
            <button type="button" class="addrow" style="background:transparent;padding:0 32px;height:46px" onClick=${() => setSheet({ kind: 'account', id: null, name: '', bucket: b.id, target: null, due: '' })}>+ 계좌 추가</button>
          </div>`}
        </div>`;
      })}
      <button type="button" class="addrow" onClick=${() => setSheet({ kind: 'bucket', id: null, name: '', when: '' })}>+ 버킷 추가</button>
    </section>

    <h2 class="h2">점검별 추이 (만원)</h2>
    <section class="card" style="padding:18px 16px 14px">
      <div role="img" aria-label="점검별 총자산 누적 막대" style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-items:end;height:190px">
        ${[0, 1, 2, 3, 4, 5].map((i) => {
          const d = last6[i];
          if (!d) return html`<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><div style="width:34px;height:60px;border:1.5px dashed #C7C7CC;border-radius:6px"></div><span style="font-size:12px;color:#C7C7CC">–</span></div>`;
          const isLast = i === last6.length - 1;
          return html`<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
            <span style=${{ fontSize: '12px', fontWeight: isLast ? 700 : 600, whiteSpace: 'nowrap' }}>${fmt(colTotals[i])}</span>
            <div style="width:34px;display:flex;flex-direction:column-reverse;border-radius:6px;overflow:hidden">
              ${buckets.map((b) => { const v = sum(all.filter((a) => bucketOf[a.id] === b.id), (a) => amt(d, a.id)); const h = Math.round(v / tMax * 140); return h > 0 ? html`<div style=${{ height: h + 'px', background: b.color }}></div>` : ''; })}
            </div>
            <span style=${{ fontSize: '12px', color: isLast ? 'var(--text)' : 'var(--muted)', fontWeight: isLast ? 600 : 400 }}>${short(d).slice(3)}</span>
          </div>`;
        })}
      </div>
    </section>

    <h2 class="h2">계좌별 (지난 점검 대비)</h2>
    <section class="card" style="font-size:15px">
      ${buckets.filter((b) => inB(b).length).map((b) => {
        const list = inB(b);
        const g = sumB(b); const gd = g - sum(list, prev);
        return html`<div>
          <div style=${{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', background: b.color + '1F', borderBottom: '0.5px solid ' + b.color + '33' }}>
            <span class="dot" style=${{ background: b.color }}></span><span style="flex:1;font-size:13px;font-weight:700;color:var(--text2)">${b.name}</span>
            <span style="font-size:13px;font-weight:700;color:var(--text2)">${fmt1(g)}만</span>
            <span style=${{ width: '56px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: gd === 0 ? 'var(--faint)' : gd > 0 ? 'var(--green)' : '#C2410C' }}>${gd === 0 ? '—' : (gd > 0 ? '+' : '−') + fmt1(Math.abs(gd)) + '만'}</span>
          </div>
          ${list.map((a) => { const dv = cur(a) - prev(a); return html`<div class="row" style="gap:8px;padding:0 16px;min-height:44px;border-bottom:0.5px solid #F0F0F3">
            <span style="flex:1;min-width:0">${a.name}</span><b style="font-weight:600">${fmt1(cur(a))}만</b>
            <span style=${{ width: '56px', textAlign: 'right', fontSize: '13px', fontWeight: dv ? 600 : 400, color: dv === 0 ? 'var(--muted)' : dv > 0 ? 'var(--green)' : '#C2410C' }}>${dv === 0 ? '—' : (dv > 0 ? '+' : '−') + fmt1(Math.abs(dv)) + '만'}</span>
          </div>`; })}
        </div>`;
      })}
      ${accounts.length === 0 ? html`<div class="empty">계좌가 없어요</div>` : ''}
    </section>

    ${sheet && sheet.kind === 'bucket' && html`<${Sheet} title=${sheet.id ? '버킷 수정' : '버킷 추가'} onClose=${() => setSheet(null)} onSave=${saveBucket}>
      <label class="field"><span>버킷 이름</span><input class="lg" type="text" placeholder="예: 여행자금" value=${sheet.name} onInput=${(e) => setSheet(Object.assign({}, sheet, { name: e.target.value }))} /></label>
      <label class="field"><span>목표 시점 (선택)</span><input type="text" placeholder="예: 29.12" value=${sheet.when} onInput=${(e) => setSheet(Object.assign({}, sheet, { when: e.target.value }))} /></label>
    <//>`}
    ${sheet && sheet.kind === 'account' && html`<${Sheet} title=${sheet.id ? '계좌 수정' : '계좌 추가'} onClose=${() => setSheet(null)} onSave=${saveAccount}>
      <label class="field"><span>계좌 이름</span><input class="lg" type="text" placeholder="예: 파킹통장" value=${sheet.name} onInput=${(e) => setSheet(Object.assign({}, sheet, { name: e.target.value }))} /></label>
      <label class="field"><span>목표 금액 (만원, 선택)</span><input type="text" inputmode="numeric" placeholder="예: 500" value=${sheet.target == null ? '' : fmt(sheet.target)} onInput=${(e) => { const v = digits(e.target.value); setSheet(Object.assign({}, sheet, { target: v })); e.target.value = v == null ? '' : fmt(v); }} /></label>
      <label class="field"><span>만기 (선택)</span><input type="text" placeholder="예: 27.03" value=${sheet.due} onInput=${(e) => setSheet(Object.assign({}, sheet, { due: e.target.value }))} /></label>
      <div class="field"><span>버킷</span><div class="wrap">${buckets.map((b) => html`<button type="button" class=${'chip sm dark' + (sheet.bucket === b.id ? ' on' : '')} onClick=${() => setSheet(Object.assign({}, sheet, { bucket: b.id }))}>${b.name}</button>`)}</div></div>
    <//>`}
  </div>`;
}

/* ───────── ④ 자산 점검 ───────── */

function Checkup({ data, api, onDone, onCancel }) {
  const { L, amt } = assetModel(data);
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState(false);
  const today = todayStr();
  const buckets = data.buckets.slice().sort(byOrder);
  const accounts = data.accounts.filter((a) => !a.closed).sort(byOrder);
  const hasPrev = (a) => !!L && data.checks.some((c) => c.date === L && c.accountId === a.id);

  // 지난 점검 다음날 ~ 오늘 사이 자동이체 횟수
  const countDay = (day) => {
    if (!L || !day) return 0;
    let n = 0;
    const d = new Date(L + 'T00:00:00'); d.setDate(d.getDate() + 1);
    const end = new Date(today + 'T00:00:00');
    while (d <= end) {
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      if (d.getDate() === Math.min(day, last)) n++;
      d.setDate(d.getDate() + 1);
    }
    return n;
  };
  const autoOf = (a) => sum(data.items.filter((i) => i.link === a.id), (i) => i.amt * countDay(i.day)) / 10000;
  const num = (s) => { const v = parseFloat(String(s == null ? '' : s).replace(/[^0-9.]/g, '')); return isNaN(v) ? 0 : v; };
  const r1 = (n) => Math.floor(n * 10 + 1e-9) / 10;
  const rowOf = (a) => {
    const prev = amt(L, a.id);
    const add = autoOf(a);
    const touched = Object.prototype.hasOwnProperty.call(vals, a.id);
    const isNew = !hasPrev(a);
    const value = touched ? vals[a.id] : isNew && !add ? '' : String(r1(prev + add));
    return { a, prev, add, touched, isNew, value };
  };
  const rows = accounts.map(rowOf);
  const total = sum(rows, (r) => num(r.value));
  const prevTotal = sum(rows, (r) => r.prev);
  const delta = total - prevTotal;

  const save = async () => {
    setBusy(true);
    const ok = await api.saveCheck(today, rows.map((r) => ({ accountId: r.a.id, amount: r1(num(r.value)) })));
    setBusy(false);
    if (ok) { api.toast('점검을 저장했어요'); onDone(); }
  };

  return html`<div class="page">
    <div class="topbar"><button type="button" class="link" onClick=${onCancel}>취소</button><span class="meta">${L ? '지난 점검 ' + short(L) : '첫 점검'}</span></div>
    <h1 class="h1">자산 점검</h1>
    <div class="grid2" style="margin-bottom:20px">
      <div class="card" style="border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:4px"><span class="sub">점검일</span><span style="font-size:16px;font-weight:700">${short(today)} <span style="font-size:13px;font-weight:500;color:var(--muted)">오늘</span></span></div>
      <div class="card" style="border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:4px"><span class="sub">합계</span><span style="font-size:16px;font-weight:700">${fmt1(total)}만 <span style=${{ fontSize: '13px', color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>${delta >= 0 ? '▲' : '▼'}${fmt1(Math.abs(delta))}</span></span></div>
    </div>
    <h2 class="h2" style="margin-top:0">계좌 금액 (만원)</h2>
    <section class="card">
      ${buckets.map((b) => {
        const rs = rows.filter((r) => r.a.bucket === b.id);
        if (!rs.length) return '';
        return html`<div>
          <div style=${{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', background: b.color + '1F', borderBottom: '0.5px solid ' + b.color + '33' }}>
            <span class="dot" style=${{ background: b.color }}></span><span style="flex:1;font-size:13px;font-weight:700;color:var(--text2)">${b.name}</span><span style="font-size:13px;font-weight:700;color:var(--text2)">${fmt1(sum(rs, (r) => num(r.value)))}만</span>
          </div>
          ${rs.map((r) => {
            const filled = !r.touched && r.add > 0;
            return html`<label class="row" style="padding:8px 12px 8px 16px;min-height:58px;border-bottom:0.5px solid #F0F0F3">
              <span style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0">
                <span style="font-size:15px;font-weight:600">${r.a.name}</span>
                <span class="sub">${r.isNew ? '새 계좌' : '지난 ' + fmt1(r.prev)}${r.add > 0 ? html`<span style="color:var(--blue-d);font-weight:600"> · 자동이체 +${fmt1(r.add)} 반영</span>` : ''}</span>
              </span>
              <input type="text" inputmode="decimal" aria-label=${r.a.name + ' 금액 (만원)'} value=${r.value}
                onInput=${(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); setVals(Object.assign({}, vals, { [r.a.id]: v })); }}
                style=${{ width: '96px', height: '40px', border: 0, borderRadius: '10px', padding: '0 12px', textAlign: 'right', fontSize: '16px', fontWeight: 600, background: filled ? 'var(--blue-bg)' : r.isNew && !r.touched ? '#FFF6E9' : 'var(--bg)', color: filled ? 'var(--blue-d)' : 'var(--text)' }} />
            </label>`;
          })}
        </div>`;
      })}
      ${accounts.length === 0 ? html`<div class="empty">자산 탭에서 계좌를 먼저 추가해 주세요</div>` : ''}
    </section>
    <button type="button" class="btn big2" style="margin-top:24px" disabled=${busy || !accounts.length} onClick=${save}>${busy ? '저장 중…' : '점검 저장'}</button>
  </div>`;
}

/* ───────── ⑤ 설정 ───────── */

const LOCK_KEY = 'budget.lockMin';
const getLockMin = () => { try { const v = localStorage.getItem(LOCK_KEY); return v == null ? 5 : Number(v); } catch (e) { return 5; } };

function Settings({ data, api, lockNow }) {
  const [lock, setLock] = useState(getLockMin());
  const [pin, setPin] = useState(null); // {step, cur, first, msg}
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const TITLES = { cur: '현재 PIN 입력', next: '새 PIN 입력', again: '새 PIN 한 번 더' };

  const onPin = async (v) => {
    if (pin.step === 'cur') { setPin({ step: 'next', cur: v, first: '', msg: '' }); return; }
    if (pin.step === 'next') { setPin({ step: 'again', cur: pin.cur, first: v, msg: '' }); return; }
    if (v !== pin.first) { setPin({ step: 'next', cur: pin.cur, first: '', msg: 'PIN이 서로 달라요. 다시 입력해 주세요.' }); return; }
    setBusy(true);
    let r;
    try { r = await call('changePin', { cur: pin.cur, next: v }); } catch (e) { r = { ok: false, error: 'network' }; }
    setBusy(false);
    if (r.ok) { if (r.token) setToken(r.token); setPin(null); setNote('변경됨'); api.toast('PIN을 바꿨어요'); }
    else if (r.error === 'pin') setPin({ step: 'cur', cur: '', first: '', msg: '현재 PIN이 맞지 않아요' });
    else setPin({ step: 'cur', cur: '', first: '', msg: '연결에 실패했어요. 다시 시도해 주세요.' });
  };
  const icon = (bg, path) => html`<span style=${{ width: '30px', height: '30px', borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
  const rowBtn = 'width:100%;display:flex;align-items:center;gap:12px;padding:0 16px;min-height:52px;border:0;background:transparent;font-size:16px;text-align:left;text-decoration:none;color:var(--text)';

  return html`<div class="page">
    <div class="topbar"></div>
    <h1 class="h1" style="margin-bottom:20px">설정</h1>
    ${DEMO && html`<div class="card" style="padding:14px 16px;margin-bottom:16px;font-size:14px;color:var(--text2);line-height:1.5"><b>데모 모드</b> · 아직 구글 시트와 연결 전이라 이 기기 안에서 가짜 데이터로 움직여요.</div>`}

    <h2 class="h2" style="margin-top:0">보안</h2>
    <section class="card">
      <button type="button" style=${rowBtn + ';border-bottom:0.5px solid var(--line)'} onClick=${() => setPin({ step: 'cur', cur: '', first: '', msg: '' })}>
        ${icon('#0062CC', html`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`)}
        <span style="flex:1">PIN 변경</span><span style="font-size:14px;color:var(--faint)">${note}</span>${I.chev(false)}
      </button>
      <div style="display:flex;flex-direction:column;gap:10px;padding:12px 16px 14px;border-bottom:0.5px solid var(--line)">
        <div class="row" style="gap:12px">${icon('#8E8E93', html`<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>`)}<span style="flex:1;font-size:16px">자동 잠금</span></div>
        <${Seg} sm opts=${[['0', '바로'], ['5', '5분 후'], ['30', '30분 후']]} value=${String(lock)} onChange=${(v) => { setLock(Number(v)); try { localStorage.setItem(LOCK_KEY, v); } catch (e) {} }} />
      </div>
      <button type="button" style=${rowBtn} onClick=${lockNow}>
        ${icon('#3A3A3C', html`<path d="M12 3v9"/><path d="M6.3 7.5a8 8 0 1 0 11.4 0"/>`)}<span style="flex:1">지금 잠그기</span>
      </button>
    </section>

    ${data.config.sheetUrl && html`<h2 class="h2">데이터</h2>
    <section class="card">
      <a href=${data.config.sheetUrl} target="_blank" rel="noopener" style=${rowBtn}>
            ${icon('#1F8A4C', html`<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>`)}<span style="flex:1">구글 시트 열기</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></a>
    </section>`}
    <p style="margin:16px 4px;font-size:12px;color:var(--faint)">가계부 v1.0</p>

    ${pin && html`<${PinPad} title=${TITLES[pin.step]} msg=${pin.msg} busy=${busy} onDone=${onPin} onCancel=${() => setPin(null)} />`}
  </div>`;
}

/* ───────── 앱 ───────── */

function App() {
  const [phase, setPhase] = useState(() => {
    if (!getToken()) return 'pin';
    try {
      const at = Number(localStorage.getItem('budget.hiddenAt') || 0);
      if (!at || Date.now() - at >= getLockMin() * 60000) return 'relock';
    } catch (e) {}
    return readCache() ? 'ready' : 'loading';
  });
  const [data, setData] = useState(() => readCache());
  const [tab, setTab] = useState('spend');
  const [checkup, setCheckup] = useState(false);
  const [pinMsg, setPinMsg] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(0);
  const toastT = useRef(null);

  const showToast = (t) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 2200); };

  // silent: 저장해둔 화면을 먼저 보여주고 뒤에서 최신 데이터로 바꾸기
  const load = async (silent) => {
    try {
      const r = await call('load');
      if (!r.ok) {
        if (r.error === 'auth') { setToken(''); setPhase('pin'); return; }
        throw new Error(r.error);
      }
      setData(r.data);
      setPhase((p) => (p === 'loading' || p === 'error' ? 'ready' : p));
    } catch (e) {
      if (silent) showToast('최신 데이터를 못 불러왔어요');
      else setPhase('error');
    }
  };
  useEffect(() => { if (phase === 'loading') load(); }, [phase]);
  useEffect(() => { warm(); if (phase === 'ready' && data) load(true); }, []);
  useEffect(() => { if (data) writeCache(data); }, [data]);

  // 자동 잠금
  useEffect(() => {
    const KEY = 'budget.hiddenAt';
    const onVis = () => {
      try {
        if (document.visibilityState === 'hidden') localStorage.setItem(KEY, String(Date.now()));
        else {
          const at = Number(localStorage.getItem(KEY) || 0);
          if (at && getToken() && Date.now() - at >= getLockMin() * 60000) setPhase((p) => (p === 'ready' ? 'relock' : p));
        }
      } catch (e) {}
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const login = async (pin) => {
    setPinBusy(true);
    let r;
    try { r = await call('login', { pin }); } catch (e) { r = { ok: false, error: 'network' }; }
    setPinBusy(false);
    if (r.ok) {
      setToken(r.token); setPinMsg('');
      if (r.data) { setData(r.data); setPhase('ready'); }
      else if (data) { setPhase('ready'); load(true); }
      else setPhase('loading');
    } else if (r.error === 'locked') setPinMsg(`여러 번 틀려서 ${r.wait}분 동안 잠겼어요`);
    else if (r.error === 'pin') setPinMsg('PIN이 맞지 않아요' + (r.left != null && r.left <= 2 ? ` (${r.left}번 남음)` : ''));
    else setPinMsg('연결에 실패했어요. 인터넷을 확인해 주세요.');
  };

  const run = async (localFn, action, payload) => {
    setData((d) => localFn(JSON.parse(JSON.stringify(d))));
    setSaving((n) => n + 1);
    try {
      const r = await call(action, payload);
      if (!r.ok) {
        if (r.error === 'auth') { setToken(''); setPhase('pin'); return false; }
        throw new Error(r.error);
      }
      return true;
    } catch (e) {
      showToast('저장하지 못했어요. 다시 불러올게요.');
      load();
      return false;
    } finally {
      setSaving((n) => n - 1);
    }
  };

  const api = {
    toast: showToast,
    upsert: (table, row) => run((d) => { const i = d[table].findIndex((x) => x.id === row.id); if (i >= 0) d[table][i] = row; else d[table].push(row); if (table === 'items') d.config.budgetEdited = todayStr(); return d; }, 'upsert', { table, row }),
    remove: (table, id) => run((d) => { d[table] = d[table].filter((x) => x.id !== id); if (table === 'items') d.config.budgetEdited = todayStr(); return d; }, 'remove', { table, id }),
    setConfig: (key, value) => run((d) => { if (key === 'income') d.config.income = value === '' || value == null ? null : Number(value); else if (key === 'acctChanged') d.config.acctChanged = value === '1'; else d.config[key] = value; return d; }, 'setConfig', { key, value: value == null ? '' : String(value) }),
    saveCheck: (date, entries) => run((d) => { d.checks = d.checks.filter((c) => c.date !== date).concat(entries.map((e) => ({ date, accountId: e.accountId, amount: e.amount }))); d.config.acctChanged = false; return d; }, 'saveCheck', { date, entries })
  };

  const goTab = (t) => { setCheckup(false); setTab(t); window.scrollTo(0, 0); };

  if (phase === 'pin' || phase === 'relock') {
    return html`<${PinPad} title=${phase === 'relock' ? 'PIN 입력' : '가계부 PIN 입력'} msg=${pinMsg} busy=${pinBusy} onDone=${login} />`;
  }
  if (phase === 'loading' || !data) {
    if (phase === 'error') return html`<div class="loading" style="flex-direction:column;gap:14px"><span>불러오지 못했어요</span><button type="button" class="btn" style="width:auto;padding:0 24px" onClick=${() => setPhase('loading')}>다시 시도</button></div>`;
    return html`<div class="loading">불러오는 중…</div>`;
  }

  const screen = checkup
    ? html`<${Checkup} data=${data} api=${api} onDone=${() => { setCheckup(false); window.scrollTo(0, 0); }} onCancel=${() => { setCheckup(false); window.scrollTo(0, 0); }} />`
    : tab === 'spend' ? html`<${Spend} data=${data} api=${api} />`
      : tab === 'budget' ? html`<${Budget} data=${data} api=${api} />`
        : tab === 'assets' ? html`<${Assets} data=${data} api=${api} goCheck=${() => { setCheckup(true); window.scrollTo(0, 0); }} />`
          : html`<${Settings} data=${data} api=${api} lockNow=${() => setPhase('relock')} />`;

  return html`
    ${screen}
    <nav class="tabbar" aria-label="메인 탭"><div class="in">
      ${TABS.map(([k, l, icon]) => html`<button type="button" class=${(checkup ? k === 'assets' : tab === k) ? 'on' : ''} aria-current=${tab === k ? 'page' : null} onClick=${() => goTab(k)}>${icon}${l}</button>`)}
    </div></nav>
    ${saving > 0 ? html`<span class="saving" aria-label="저장 중"></span>` : ''}
    ${toast ? html`<div class="toast" role="status">${toast}</div>` : ''}
  `;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

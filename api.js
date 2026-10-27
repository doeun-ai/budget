import { API_URL } from './config.js';

export const DEMO = !API_URL;
const TOKEN_KEY = 'budget.token';

export function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
export function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

// 앱을 열자마자 구글 서버를 미리 깨워두기 (PIN 누르는 동안 준비)
export function warm() { if (!DEMO) fetch(API_URL).catch(() => {}); }

// PIN을 이 기기에서 바로 확인하기 위한 값 (PIN 자체는 저장하지 않고 암호화된 값만)
const LOCAL_PIN = 'budget.localPin';
async function digest(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function rememberPin(pin) {
  try {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(LOCAL_PIN, JSON.stringify({ salt, hash: await digest(salt + ':' + pin) }));
  } catch (e) {}
}
export function forgetPin() { try { localStorage.removeItem(LOCAL_PIN); } catch (e) {} }
// true: 맞음, false: 틀림, null: 이 기기에 저장된 값이 없음
export async function checkPinLocal(pin) {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL_PIN) || 'null');
    if (!v || !crypto.subtle) return null;
    return (await digest(v.salt + ':' + pin)) === v.hash;
  } catch (e) { return null; }
}

const CACHE_KEY = 'budget.cache';
export function readCache() { try { const s = localStorage.getItem(CACHE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
export function writeCache(d) { try { d ? localStorage.setItem(CACHE_KEY, JSON.stringify(d)) : localStorage.removeItem(CACHE_KEY); } catch (e) {} }

export async function call(action, payload = {}) {
  if (DEMO) return mock(action, payload);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(Object.assign({ action, token: getToken() }, payload)),
      redirect: 'follow',
      signal: ctrl.signal
    });
  } finally { clearTimeout(timer); }
  if (!res.ok) throw new Error('network');
  return res.json();
}

/* ───────── 데모 모드: 주소(API_URL)를 넣기 전까지 이 기기 안에서만 가짜 데이터로 동작 ───────── */

const MOCK_KEY = 'budget.demo';

function demoSeed() {
  const t = new Date();
  const ym = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
  const day = t.getDate();
  const items = [];
  let o = 0;
  const add = (cat, name, amt, d, memo = '', review = '', link = '') => { o++; items.push({ id: 'i' + o, cat, name, amt, day: d, memo, review, link, order: o }); };
  add('save', '청년미래적금', 240000, 26, '', '', 'a5');
  add('save', '청약', 20000, 26);
  add('save', '연금계좌', 40000, 26, '', '', 'a8');
  add('invest', 'ISA', 32500, 26, '', '', 'a9');
  add('invest', '해외주식', 25000, 26, '', '', 'a3');
  add('invest', '한투주식', 25000, 26, '', '', 'a6');
  add('use', '리프레쉬 적금', 50000, 26, '', '27.04', 'a1');
  add('use', '스페인 적금', 150000, 26, '', '', 'a2');
  add('house', '월세', 120000, 26);
  add('house', '관리비', 50000, 30, '대략');
  add('house', '도시가스', 12000, 10, '겨울 요금 올리기', '26.09');
  add('fixed', '보험', 35000, 25);
  add('fixed', '교통비', 27000, 25);
  add('fixed', '핸드폰', 18000, 26);
  add('fixed', '멜론', 4000, 7);
  add('meet', '여행경비(가족)', 50000, 1);
  add('meet', '모임통장', 15000, 1);
  add('life', '약속', 200000, 0);
  add('life', '생활', 60000, 0);
  add('life', '기타', 30000, 0);
  add('life', '관리', 160000, 0);
  add('life', '경조사', 50000, 0);
  const sp = [];
  const raw = [[1, '생활', '편의점', 6000], [3, '약속', '저녁 약속', 22500], [3, '기타', '인형뽑기', 6500], [4, '약속', '배달', 11500], [7, '관리', '옷', 47000], [8, '약속', '카페', 7500], [10, '약속', '점심 약속', 15500], [12, '생활', '마트', 13500], [13, '경조사', '친구 결혼식', 50000], [15, '약속', '저녁 약속', 24000], [16, '약속', '배달', 9000], [19, '관리', '헬스', 22500], [20, '약속', '카페', 10500], [22, '관리', '화장품', 29000], [23, '생활', '휴지 · 세제', 8000], [24, '약속', '점심 약속', 19000], [25, '관리', '피부관리', 50000], [26, '약속', '저녁 약속', 25000], [27, '생활', '마트', 41250]];
  raw.forEach((r, i) => { if (r[0] <= day) sp.push({ id: 's' + i, date: ym + '-' + String(r[0]).padStart(2, '0'), cat: r[1], amt: r[3], memo: r[2], created: '' }); });
  return {
    pin: '0000',
    config: { income: 1600000, budgetEdited: ym + '-01', acctChanged: false, sheetUrl: '' },
    items,
    spend: sp,
    buckets: [
      { id: 'b1', name: '사용적금', color: '#7B61E8', when: '', exclude: false, order: 1 },
      { id: 'b2', name: '비상자금', color: '#F08A00', when: '', exclude: false, order: 2 },
      { id: 'b3', name: '33세까지 쓰지마', color: '#0050C8', when: '', exclude: false, order: 3 },
      { id: 'b4', name: '주거자금', color: '#2E9C7E', when: '', exclude: false, order: 4 },
      { id: 'b5', name: '노후자금', color: '#64A8FF', when: '', exclude: true, order: 5 }
    ],
    accounts: [
      { id: 'a1', name: '리프레쉬적금', bucket: 'b1', target: 50, due: '27.04', closed: false, order: 1 },
      { id: 'a2', name: '스페인적금', bucket: 'b1', target: 36, due: '', closed: false, order: 2 },
      { id: 'a3', name: '해외주식(토스)', bucket: 'b2', target: 100, due: '', closed: false, order: 3 },
      { id: 'a4', name: '셀프예금', bucket: 'b2', target: 100, due: '27.01', closed: false, order: 4 },
      { id: 'a5', name: '청년미래적금', bucket: 'b3', target: 500, due: '28.06', closed: false, order: 5 },
      { id: 'a6', name: '한투주식', bucket: 'b3', target: 300, due: '', closed: false, order: 6 },
      { id: 'a7', name: '보증금', bucket: 'b4', target: 2000, due: '', closed: false, order: 7 },
      { id: 'a8', name: '연금계좌', bucket: 'b5', target: 300, due: '', closed: false, order: 8 },
      { id: 'a9', name: 'ISA', bucket: 'b5', target: 300, due: '', closed: false, order: 9 }
    ],
    checks: [].concat(
      [20, 0, 43, 90, 40, 130, 877, 80, 86].map((v, i) => ({ date: '2026-09-20', accountId: 'a' + (i + 1), amount: v })),
      [24, 12, 45, 90, 60, 130, 877, 81, 85].map((v, i) => ({ date: '2026-10-09', accountId: 'a' + (i + 1), amount: v }))
    )
  };
}

function db() {
  try {
    const s = localStorage.getItem(MOCK_KEY);
    if (s) return JSON.parse(s);
  } catch (e) {}
  const d = demoSeed();
  save(d);
  return d;
}
function save(d) { try { localStorage.setItem(MOCK_KEY, JSON.stringify(d)); } catch (e) {} }
const today = () => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };

async function mock(action, p) {
  await new Promise(r => setTimeout(r, 120));
  const d = db();
  const out = (o) => JSON.parse(JSON.stringify(o));
  if (action === 'login') { if (p.pin !== d.pin) return { ok: false, error: 'pin', left: 4 }; const { pin, ...rest } = d; return { ok: true, token: 'demo', data: out(rest) }; }
  switch (action) {
    case 'load': {
      const { pin, ...rest } = d;
      return { ok: true, data: out(rest) };
    }
    case 'upsert': {
      const list = d[p.table];
      const row = Object.assign({}, p.row);
      if (!row.id) row.id = p.table.charAt(0) + Math.random().toString(36).slice(2, 10);
      const i = list.findIndex(x => x.id === row.id);
      if (i >= 0) list[i] = row; else list.push(row);
      if (p.table === 'items') d.config.budgetEdited = today();
      save(d);
      return { ok: true, row };
    }
    case 'remove': {
      d[p.table] = d[p.table].filter(x => x.id !== p.id);
      if (p.table === 'items') d.config.budgetEdited = today();
      save(d);
      return { ok: true };
    }
    case 'saveCheck': {
      d.checks = d.checks.filter(x => x.date !== p.date).concat(p.entries.map(e => ({ date: p.date, accountId: e.accountId, amount: Number(e.amount) || 0 })));
      d.config.acctChanged = false;
      save(d);
      return { ok: true };
    }
    case 'setConfig': {
      if (p.key === 'income') d.config.income = p.value === '' || p.value == null ? null : Number(p.value);
      else if (p.key === 'acctChanged') d.config.acctChanged = p.value === '1';
      else d.config[p.key] = p.value;
      save(d);
      return { ok: true };
    }
    case 'changePin': {
      if (p.cur !== d.pin) return { ok: false, error: 'pin' };
      d.pin = p.next; save(d);
      return { ok: true, token: 'demo' };
    }
    case 'logout': return { ok: true };
  }
  return { ok: false, error: 'unknown_action' };
}

export function resetDemo() { try { localStorage.removeItem(MOCK_KEY); } catch (e) {} }

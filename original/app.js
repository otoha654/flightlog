/* =========================================================
   Flight Log — アプリ本体
   データはすべてブラウザの localStorage に保存します。
   ========================================================= */
(function () {
  'use strict';

  // ---------- 定数 ----------
  const STORAGE_KEY = 'flightlog.flights.v1';
  const DRAFT_KEY = 'flightlog.draft.v1';
  const BACKUP_KEY = 'flightlog.lastBackup';

  // 保存する項目（CSVの列順もこの順番）
  const FIELDS = [
    'date', 'airline', 'flightNo', 'aircraft', 'registration',
    'from', 'to', 'blockOut', 'takeoff', 'landing', 'blockIn',
    'rwyTakeoff', 'rwyLanding', 'seat', 'notes',
  ];
  const CSV_COLUMNS = ['id', ...FIELDS, 'createdAt', 'updatedAt'];

  const LABELS = {
    date: '日付', airline: '航空会社', flightNo: '便名', aircraft: '機種',
    registration: '登録記号', from: '出発地', to: '到着地',
    blockOut: 'ブロックアウト', takeoff: 'オフ（離陸）', landing: 'オン（着陸）', blockIn: 'ブロックイン',
    rwyTakeoff: '離陸滑走路', rwyLanding: '着陸滑走路', seat: '座席', notes: '備考',
  };

  // ---------- 要素の取得 ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const form = $('#flight-form');

  // ---------- データの読み書き ----------
  let flights = loadFlights();

  function loadFlights() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error(e);
      alert('保存データの読み込みに失敗しました。');
      return [];
    }
  }

  function saveFlights() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flights));
      return true;
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました。ブラウザの容量やプライベートモードの設定を確認してください。');
      return false;
    }
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // 新しい順に並べる（日付 → 時刻 → 作成日時）
  function sortKey(f) {
    const t = f.blockOut || f.takeoff || f.landing || f.blockIn || '';
    return (f.date || '') + ' ' + t + ' ' + (f.createdAt || '');
  }
  function sortedFlights() {
    return flights.slice().sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  }

  function findFlight(id) {
    return flights.find((f) => f.id === id);
  }

  // ---------- ユーティリティ ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowTime() {
    const d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  function formatDate(s, withWeek) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return s || '';
    const base = m[1] + '.' + m[2] + '.' + m[3];
    if (!withWeek) return base;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return base + '（' + WEEK[d.getDay()] + '）';
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // ---------- 画面の切り替え（URLの # で管理） ----------
  // #list / #new / #edit/ID / #detail/ID / #stats / #data
  function route() {
    const hash = location.hash.replace(/^#/, '') || 'list';
    const [name, id] = hash.split('/');

    let view = 'list';
    if (name === 'new') { view = 'form'; openForm(null); }
    else if (name === 'edit' && findFlight(id)) { view = 'form'; openForm(findFlight(id)); }
    else if (name === 'detail' && findFlight(id)) { view = 'detail'; renderDetail(findFlight(id)); }
    else if (name === 'stats') { view = 'stats'; renderStats(); }
    else if (name === 'data') { view = 'data'; renderDataInfo(); }
    else { view = 'list'; renderList(); }

    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    $$('.tab').forEach((t) => {
      const tab = t.dataset.tab;
      const active = (tab === view) || (tab === 'list' && view === 'detail');
      t.classList.toggle('active', active);
    });
    window.scrollTo(0, 0);
  }

  function go(hash, replace) {
    if (replace) location.replace('#' + hash);
    else location.hash = hash;
  }

  $$('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      const tab = t.dataset.tab;
      const target = tab === 'form' ? 'new' : tab;
      if (location.hash === '#' + target) route(); // 同じタブを再タップ
      else go(target);
    });
  });

  window.addEventListener('hashchange', route);

  // ---------- 一覧 ----------
  $('#search').addEventListener('input', renderList);

  function renderList() {
    const q = $('#search').value.trim().toLowerCase();
    const all = sortedFlights();
    const list = q
      ? all.filter((f) => FIELDS.some((k) => String(f[k] || '').toLowerCase().includes(q)))
      : all;

    $('#list-count').textContent = q
      ? list.length + ' / ' + all.length + ' flights'
      : all.length + (all.length === 1 ? ' flight' : ' flights');
    $('#empty').hidden = all.length > 0;

    let html = '';
    let lastYear = null;
    list.forEach((f) => {
      const year = (f.date || '').slice(0, 4);
      if (year !== lastYear) {
        html += '<li class="year-sep" aria-hidden="true">' + esc(year || '----') + '</li>';
        lastYear = year;
      }
      const md = (f.date || '').slice(5).replace('-', '/');
      const route = esc(f.from || '---') + '<span class="to-arrow">→</span>' + esc(f.to || '---');
      const meta = [f.airline, f.flightNo, f.aircraft, f.registration].filter(Boolean).join(' · ');
      const time = f.takeoff || f.blockOut || '';
      html +=
        '<li><button type="button" class="flight-item" data-id="' + esc(f.id) + '">' +
          '<span class="fi-date"><b>' + esc(md) + '</b>' + esc(year) + '</span>' +
          '<span class="fi-route">' + route + '</span>' +
          '<span class="fi-time">' + esc(time) + '</span>' +
          '<span class="fi-meta">' + esc(meta || '—') + '</span>' +
        '</button></li>';
    });
    $('#flight-list').innerHTML = html;
  }

  $('#flight-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.flight-item');
    if (btn) go('detail/' + btn.dataset.id);
  });

  // ---------- 詳細 ----------
  let currentId = null;

  function renderDetail(f) {
    currentId = f.id;
    const cell = (key, wide) => {
      const v = f[key];
      const cls = key === 'notes' ? 'notes' : '';
      return '<div' + (wide ? ' class="wide"' : '') + '><dt>' + esc(LABELS[key]) + '</dt>' +
        '<dd class="' + cls + (v ? '' : ' blank') + '">' + (v ? esc(v) : '—') + '</dd></div>';
    };
    const sub = [f.airline, f.flightNo].filter(Boolean).join(' ');
    $('#detail').innerHTML =
      '<div class="detail-hero">' +
        '<div class="date">' + esc(formatDate(f.date, true)) + '</div>' +
        '<div class="route">' + esc(f.from || '---') + ' → ' + esc(f.to || '---') + '</div>' +
        (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') +
      '</div>' +
      '<dl class="kv">' +
        cell('airline') + cell('flightNo') +
        cell('aircraft') + cell('registration') +
        cell('blockOut') + cell('takeoff') +
        cell('landing') + cell('blockIn') +
        cell('rwyTakeoff') + cell('rwyLanding') +
        cell('seat', true) +
        cell('notes', true) +
      '</dl>';
  }

  $('#btn-back').addEventListener('click', () => go('list'));
  $('#btn-edit').addEventListener('click', () => { if (currentId) go('edit/' + currentId); });
  $('#btn-delete').addEventListener('click', () => {
    const f = findFlight(currentId);
    if (!f) return;
    const label = formatDate(f.date) + ' ' + (f.from || '') + '→' + (f.to || '');
    if (!confirm('このフライトを削除しますか？\n' + label + '\n\n※元に戻せません')) return;
    flights = flights.filter((x) => x.id !== currentId);
    saveFlights();
    toast('削除しました');
    go('list', true);
  });

  // ---------- 入力フォーム ----------
  let editingId = null;
  let formDirty = false;

  function openForm(f) {
    form.reset();
    formDirty = false;
    editingId = f ? f.id : null;
    $('#form-title').textContent = f ? 'Edit Entry' : 'New Entry';
    updateSuggestions();

    if (f) {
      FIELDS.forEach((k) => { form.elements[k].value = f[k] || ''; });
    } else {
      // 新規：入力途中の下書きがあれば復元、なければ日付に今日を入れる
      const draft = loadDraft();
      if (draft) {
        FIELDS.forEach((k) => { form.elements[k].value = draft[k] || ''; });
        formDirty = true;
        toast('入力途中の下書きを復元しました');
      } else {
        form.elements.date.value = todayStr();
      }
    }
  }

  function readForm() {
    const data = {};
    FIELDS.forEach((k) => {
      let v = (form.elements[k].value || '').trim();
      if (form.elements[k].hasAttribute('data-upper')) v = v.toUpperCase();
      data[k] = v;
    });
    return data;
  }

  // 大文字にする項目は、入力欄から離れたときに変換
  form.querySelectorAll('[data-upper]').forEach((el) => {
    el.addEventListener('blur', () => { el.value = el.value.trim().toUpperCase(); });
  });

  // 「今」ボタン：現在時刻を入れる
  form.querySelectorAll('.now-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      form.elements[btn.dataset.now].value = nowTime();
      onFormInput();
    });
  });

  // 新規入力中は自動で下書き保存（アプリが閉じても消えない）
  function onFormInput() {
    formDirty = true;
    if (!editingId) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(readForm())); } catch (e) { /* 無視 */ }
    }
  }
  form.addEventListener('input', onFormInput);

  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      return d && FIELDS.some((k) => d[k]) ? d : null;
    } catch (e) { return null; }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* 無視 */ }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = readForm();
    if (!data.date) {
      alert('日付を入力してください。');
      form.elements.date.focus();
      return;
    }
    const now = new Date().toISOString();
    let id;
    if (editingId && findFlight(editingId)) {
      const f = findFlight(editingId);
      Object.assign(f, data, { updatedAt: now });
      id = f.id;
    } else {
      id = newId();
      flights.push(Object.assign({ id }, data, { createdAt: now, updatedAt: now }));
    }
    if (!saveFlights()) return;
    clearDraft();
    formDirty = false;
    toast('保存しました');
    // 編集時は詳細へ、新規は一覧へ（戻るボタンでフォームに戻らないよう置き換え）
    go(editingId ? 'detail/' + id : 'list', true);
  });

  $('#btn-cancel').addEventListener('click', () => {
    if (formDirty && !confirm('入力内容を破棄しますか？')) return;
    if (!editingId) clearDraft();
    formDirty = false;
    go(editingId ? 'detail/' + editingId : 'list', true);
  });

  // 過去の入力値を候補に（よく使う順）
  function updateSuggestions() {
    const fill = (id, keys) => {
      const count = new Map();
      flights.forEach((f) => keys.forEach((k) => {
        const v = (f[k] || '').trim();
        if (v) count.set(v, (count.get(v) || 0) + 1);
      }));
      const values = Array.from(count.entries()).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
      $(id).innerHTML = values.map((v) => '<option value="' + esc(v) + '"></option>').join('');
    };
    fill('#dl-airline', ['airline']);
    fill('#dl-aircraft', ['aircraft']);
    fill('#dl-registration', ['registration']);
    fill('#dl-airport', ['from', 'to']);
  }

  // ---------- 集計 ----------
  const expanded = {};

  function tally(keys) {
    const m = new Map();
    flights.forEach((f) => {
      keys.forEach((k) => {
        const v = (f[k] || '').trim();
        if (v) m.set(v, (m.get(v) || 0) + 1);
      });
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function tallyBlock(id, title, note, rows) {
    if (!rows.length) {
      return '<div class="sheet"><h3 class="sheet-h">' + esc(title) + '</h3><p class="muted">データなし</p></div>';
    }
    const max = rows[0][1];
    const limit = expanded[id] ? rows.length : 10;
    let html = '<div class="sheet"><h3 class="sheet-h">' + esc(title) +
      ' <small class="muted">（' + rows.length + '種）</small></h3>';
    if (note) html += '<p class="muted small" style="margin:0">' + esc(note) + '</p>';
    html += '<ul class="tally">';
    rows.slice(0, limit).forEach(([name, n]) => {
      html += '<li><span class="name">' + esc(name) + '</span><span class="count">' + n + '</span>' +
        '<span class="bar"><i style="width:' + Math.max(4, (n / max) * 100) + '%"></i></span></li>';
    });
    html += '</ul>';
    if (rows.length > 10) {
      html += '<button type="button" class="more-btn" data-more="' + id + '">' +
        (expanded[id] ? '閉じる' : 'すべて表示（' + rows.length + '件）') + '</button>';
    }
    return html + '</div>';
  }

  function renderStats() {
    const total = flights.length;
    const year = String(new Date().getFullYear());
    const thisYear = flights.filter((f) => (f.date || '').startsWith(year)).length;
    const airports = tally(['from', 'to']);
    const airlines = tally(['airline']);
    const aircraft = tally(['aircraft']);

    $('#stats-body').innerHTML =
      '<div class="sheet stat-total">' +
        '<div class="num">' + total + '</div>' +
        '<div class="label">TOTAL FLIGHTS</div>' +
        '<div class="extra">' + year + '年：' + thisYear + '回 ／ 訪れた空港：' + airports.length + 'か所</div>' +
      '</div>' +
      tallyBlock('airline', '航空会社別', '', airlines) +
      tallyBlock('aircraft', '機種別', '', aircraft) +
      tallyBlock('airport', '空港別', '出発・到着それぞれを1回として数えています', airports);
  }

  $('#stats-body').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-more]');
    if (!btn) return;
    expanded[btn.dataset.more] = !expanded[btn.dataset.more];
    renderStats();
  });

  // ---------- エクスポート ----------
  function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function stamp() {
    const d = new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
  }

  function markBackup() {
    try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch (e) { /* 無視 */ }
    renderDataInfo();
  }

  $('#btn-export-json').addEventListener('click', () => {
    if (!flights.length) { toast('記録がありません'); return; }
    const payload = {
      app: 'flightlog',
      version: 1,
      exportedAt: new Date().toISOString(),
      flights: sortedFlights(),
    };
    download('flightlog-' + stamp() + '.json', JSON.stringify(payload, null, 2), 'application/json');
    markBackup();
  });

  $('#btn-export-csv').addEventListener('click', () => {
    if (!flights.length) { toast('記録がありません'); return; }
    const csvCell = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [CSV_COLUMNS.join(',')];
    sortedFlights().forEach((f) => lines.push(CSV_COLUMNS.map((k) => csvCell(f[k])).join(',')));
    // 先頭のBOMはExcelで文字化けしないため
    download('flightlog-' + stamp() + '.csv', '﻿' + lines.join('\r\n') + '\r\n', 'text/csv');
    markBackup();
  });

  // ---------- インポート ----------
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', i = 0, inQuotes = false;
    text = text.replace(/^﻿/, '');
    while (i < text.length) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else { inQuotes = false; }
        } else { cell += c; }
      } else if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else { cell += c; }
      i++;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
    if (!nonEmpty.length) return [];
    const header = nonEmpty[0].map((h) => h.trim());
    return nonEmpty.slice(1).map((r) => {
      const o = {};
      header.forEach((h, idx) => { o[h] = r[idx] != null ? r[idx] : ''; });
      return o;
    });
  }

  // 日付を YYYY-MM-DD にそろえる（2024/1/5 などにも対応）
  function normalizeDate(s) {
    const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(String(s || '').trim());
    return m ? m[1] + '-' + pad(m[2]) + '-' + pad(m[3]) : '';
  }
  function normalizeTime(s) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '').trim());
    return m ? pad(m[1]) + ':' + m[2] : '';
  }

  function normalizeRecord(r) {
    if (!r || typeof r !== 'object') return null;
    const date = normalizeDate(r.date);
    if (!date) return null;
    const f = { id: String(r.id || '').trim() || newId() };
    FIELDS.forEach((k) => { f[k] = String(r[k] == null ? '' : r[k]).trim(); });
    f.date = date;
    ['blockOut', 'takeoff', 'landing', 'blockIn'].forEach((k) => { f[k] = normalizeTime(f[k]); });
    const now = new Date().toISOString();
    f.createdAt = r.createdAt || now;
    f.updatedAt = r.updatedAt || now;
    return f;
  }

  // 古いSafariでも動くよう FileReader でファイルを読む
  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, 'utf-8');
    });
  }

  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // 同じファイルをもう一度選べるように
    if (!file) return;

    let records;
    try {
      const text = await readFileText(file);
      const isJSON = /\.json$/i.test(file.name) || /^\s*[[{]/.test(text);
      if (isJSON) {
        const data = JSON.parse(text);
        records = Array.isArray(data) ? data : data.flights;
      } else {
        records = parseCSV(text);
      }
      if (!Array.isArray(records)) throw new Error('形式が違います');
    } catch (err) {
      console.error(err);
      alert('ファイルを読み込めませんでした。\nFlight Log でエクスポートした JSON / CSV を選んでください。');
      return;
    }

    const valid = records.map(normalizeRecord).filter(Boolean);
    const skipped = records.length - valid.length;
    if (!valid.length) {
      alert('取り込める記録がありませんでした（日付のない行は取り込みません）。');
      return;
    }

    const byId = new Map(flights.map((f) => [f.id, f]));
    let added = 0, updated = 0;
    valid.forEach((r) => { if (byId.has(r.id)) updated++; else added++; });

    const msg = valid.length + '件の記録を取り込みます。\n' +
      '・新規追加：' + added + '件\n' +
      '・上書き（同じ記録）：' + updated + '件' +
      (skipped ? '\n・日付がなく読み飛ばす行：' + skipped + '件' : '') +
      '\n\nよろしいですか？';
    if (!confirm(msg)) return;

    valid.forEach((r) => byId.set(r.id, r));
    flights = Array.from(byId.values());
    if (saveFlights()) toast('取り込みました（' + valid.length + '件）');
    renderDataInfo();
  });

  // ---------- 全削除・情報表示 ----------
  $('#btn-clear').addEventListener('click', () => {
    if (!flights.length) { toast('記録がありません'); return; }
    if (!confirm('全' + flights.length + '件の記録を削除します。\n本当によろしいですか？')) return;
    if (!confirm('最終確認：元に戻せません。削除しますか？')) return;
    flights = [];
    saveFlights();
    clearDraft();
    toast('すべて削除しました');
    renderDataInfo();
  });

  function renderDataInfo() {
    let last = null;
    try { last = localStorage.getItem(BACKUP_KEY); } catch (e) { /* 無視 */ }
    $('#last-backup').textContent = last
      ? '最後のエクスポート：' + new Date(last).toLocaleString('ja-JP')
      : 'まだエクスポートしていません';
    $('#storage-info').textContent = 'この端末に ' + flights.length + ' 件の記録が保存されています';
  }

  // 別のタブでデータが変わったら読み直す（古いデータで上書きしないため）
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    flights = loadFlights();
    if (!$('#view-form').hidden) return; // 入力中の画面はそのまま
    route();
  });

  // ---------- 起動 ----------
  // ブラウザに「このデータは消さないで」とお願いする（対応ブラウザのみ）
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  // ※ この初期版は比較用の保存版です。今の版（1つ上のフォルダ）とオフライン用の
  //   キャッシュがぶつからないよう、Service Worker の登録だけ止めています。

  route();
})();

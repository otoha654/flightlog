/* =========================================================
   Flight Log — アプリ本体
   データはすべてブラウザの localStorage に保存します。
   ========================================================= */
(function () {
  'use strict';

  // ---------- 航空会社リスト ----------
  // 新規記録フォームの「航空会社」プルダウンに、この順番で表示されます。
  // 会社を追加・修正するときは、ここに { name: '表示名', code: '便名の頭' } を1行足すだけでOKです。
  // code を '' にすると、選んでも便名は自動入力されません。
  // 「その他（手入力）」はリストの最後に自動で付きます。
  const AIRLINES = [
    { name: '日本航空', code: 'JL' },
    { name: '全日本空輸', code: 'NH' },
    { name: '日本トランスオーシャン航空', code: 'NU' },
    { name: 'エアージャパン', code: 'NQ' },
    { name: 'スカイマーク', code: 'BC' },
    { name: 'AIRDO', code: 'HD' },
    { name: 'ANAウイングス', code: 'EH' },
    { name: 'ソラシドエア', code: '6J' },
    { name: 'スターフライヤー', code: '7G' },
    { name: 'Peach Aviation', code: 'MM' },
    { name: 'ジェットスター・ジャパン', code: 'GK' },
    { name: 'スプリング・ジャパン', code: 'IJ' },
    { name: 'ZIPAIR Tokyo', code: 'ZG' },
    { name: 'オリエンタルエアブリッジ', code: 'OC' },
    { name: '日本エアコミューター', code: 'JC' },
    { name: '琉球エアーコミューター', code: 'NU' },
    { name: 'ジェイエア', code: 'JL' },
    { name: '北海道エアシステム', code: 'JL' },
    { name: '天草エアライン', code: 'MZ' },
    { name: 'アイベックスエアラインズ', code: 'FW' },
    { name: 'フジドリームエアラインズ', code: 'JH' },
    { name: 'トキエア', code: 'BV' },
  ];
  const AIRLINE_OTHER = { value: '__other__', label: 'その他（手入力）' };

  // ---------- 定数 ----------
  // URL に ?demo を付けると「サンプルモード」になり、本番とは別の場所に保存します。
  // （動作確認用。本番の記録とは混ざりません）
  const DEMO = new URLSearchParams(location.search).has('demo');
  const KEY_PREFIX = DEMO ? 'flightlog.demo.' : 'flightlog.';
  const STORAGE_KEY = KEY_PREFIX + 'flights.v1';
  const DRAFT_KEY = KEY_PREFIX + 'draft.v1';
  const BACKUP_KEY = DEMO ? 'flightlog.demo.lastBackup' : 'flightlog.lastBackup';

  // 年間まとめ画像の色（端末がダークモードでも画像は常にこの配色）
  const SUMMARY_COLORS = {
    paper: '#f4ecd8',
    rule: '#d9cbaa',
    ruleStrong: '#b09f80',
    ink: '#1e3456',
    inkSoft: '#4a5a72',
    muted: '#7a6f5c',
    accent: '#b2483a',   // 赤茶色（ノートのマージン線と同じ）
  };

  // 年間まとめ画像のサイズ
  const SUMMARY_SIZES = {
    story: { w: 1080, h: 1920 },  // 縦長：Instagram ストーリー向け
    post: { w: 1080, h: 1350 },   // 4:5：投稿向け
  };

  // サンプルモードで最初に入れる記録（本番データには入りません）
  function demoFlights() {
    const rows = [
      ['2026-01-08', '日本航空', 'JL501', 'B767-300ER', 'HND', 'CTS'],
      ['2026-01-11', '日本航空', 'JL510', 'A350-900', 'CTS', 'HND'],
      ['2026-02-20', '全日本空輸', 'NH241', 'B787-9', 'HND', 'FUK'],
      ['2026-02-23', '全日本空輸', 'NH260', 'B787-9', 'FUK', 'HND'],
      ['2026-04-03', 'Peach Aviation', 'MM502', 'A320neo', 'KIX', 'CTS'],
      ['2026-04-06', 'Peach Aviation', 'MM505', 'A320neo', 'CTS', 'KIX'],
      ['2026-05-02', '日本トランスオーシャン航空', 'NU5', 'B737-800', 'HND', 'OKA'],
      ['2026-05-05', '日本航空', 'JL914', '', 'OKA', 'HND'],
      ['2026-07-19', 'Delta Air Lines', 'DL7', 'A350-900', 'HND', 'SEA'],
      ['2026-07-28', '', '', '', 'SEA', 'HND'],
      ['2026-09-14', 'スカイマーク', 'BC3', 'B737-800', 'HND', 'FUK'],
      ['2025-03-10', '全日本空輸', 'NH15', 'B777-200', 'HND', 'ITM'],
      ['2025-03-12', '全日本空輸', 'NH38', 'B787-8', 'ITM', 'HND'],
      ['2025-12-30', 'ソラシドエア', '6J33', 'B737-800', 'HND', 'KMI'],
    ];
    return rows.map((r, i) => ({
      id: 'demo-' + i,
      date: r[0], airline: r[1], flightNo: r[2], aircraft: r[3], registration: '',
      from: r[4], to: r[5], blockOut: '', takeoff: '', landing: '', blockIn: '',
      rwyTakeoff: '', rwyLanding: '', seat: '', notes: 'サンプルデータ',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }));
  }
  if (DEMO) {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify(demoFlights()));
    } catch (e) { /* 無視 */ }
  }

  // 保存する項目（CSVの列順もこの順番）
  const FIELDS = [
    'date', 'airline', 'flightNo', 'aircraft', 'registration',
    'from', 'to', 'schedDep', 'schedArr', 'blockOut', 'takeoff', 'landing', 'blockIn',
    'rwyTakeoff', 'rwyLanding', 'seat', 'notes',
  ];
  const CSV_COLUMNS = ['id', ...FIELDS, 'createdAt', 'updatedAt'];

  const LABELS = {
    date: '日付', airline: '航空会社', flightNo: '便名', aircraft: '機種',
    registration: '登録記号', from: '出発地', to: '到着地',
    schedDep: '定刻（出発）', schedArr: '定刻（到着）',
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
    const t = f.blockOut || f.takeoff || f.schedDep || f.landing || f.blockIn || '';
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
    else if (name === 'summary') { view = 'summary'; openSummary(); }
    else if (name === 'data') { view = 'data'; renderDataInfo(); }
    else { view = 'list'; renderList(); }

    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    $$('.tab').forEach((t) => {
      const tab = t.dataset.tab;
      const active = (tab === view) || (tab === 'list' && view === 'detail') ||
        (tab === 'stats' && view === 'summary');
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
        cell('schedDep') + cell('schedArr') +
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
    // 保存済みの航空会社名に合わせてプルダウンを合わせる（便名は書き換えない）
    syncAirlineSelect();
  }

  // ---------- 航空会社プルダウン ----------
  const airlineSelect = $('#airline-select');
  const airlineOther = $('#airline-other');
  const airlineInput = form.elements.airline;   // 実際に保存される航空会社名
  const flightNoInput = form.elements.flightNo;
  let currentAirlineCode = '';                  // いま選ばれている会社の便名の頭

  function findAirline(name) {
    return AIRLINES.find((a) => a.name === name) || null;
  }

  // 選択肢を作る（AIRLINES の順番どおり＋最後に「その他」）
  airlineSelect.innerHTML =
    '<option value="">選択してください</option>' +
    AIRLINES.map((a, i) => '<option value="' + i + '">' + esc(a.name) + '</option>').join('') +
    '<option value="' + AIRLINE_OTHER.value + '">' + esc(AIRLINE_OTHER.label) + '</option>';

  function showOtherInput(show) {
    airlineOther.hidden = !show;
  }

  function updateSelectLook() {
    airlineSelect.classList.toggle('is-empty', airlineSelect.value === '');
  }

  // 航空会社名（保存値）→ プルダウンの状態を合わせる。
  // リストにない名前（過去に自由入力したもの）は「その他」として手入力欄に表示する。
  function syncAirlineSelect() {
    const name = airlineInput.value.trim();
    const idx = AIRLINES.findIndex((a) => a.name === name);
    if (!name) {
      airlineSelect.value = '';
      showOtherInput(false);
      currentAirlineCode = '';
    } else if (idx >= 0) {
      airlineSelect.value = String(idx);
      showOtherInput(false);
      currentAirlineCode = AIRLINES[idx].code;
    } else {
      airlineSelect.value = AIRLINE_OTHER.value;
      showOtherInput(true);
      currentAirlineCode = '';
    }
    updateSelectLook();
  }

  // ユーザーがプルダウンを選んだとき
  airlineSelect.addEventListener('change', () => {
    const v = airlineSelect.value;
    const prevCode = currentAirlineCode;
    let newCode = '';

    if (v === AIRLINE_OTHER.value) {
      // その他：リストの会社名が入っていたら消して、手入力欄を出す
      if (findAirline(airlineInput.value.trim())) airlineInput.value = '';
      showOtherInput(true);
      airlineInput.focus();
    } else if (v === '') {
      airlineInput.value = '';
      showOtherInput(false);
    } else {
      const a = AIRLINES[Number(v)];
      airlineInput.value = a.name;
      showOtherInput(false);
      newCode = a.code;
    }
    currentAirlineCode = newCode;
    updateSelectLook();

    // 便名の頭を自動入力（ユーザーが打った内容はできるだけ残す）
    const cur = flightNoInput.value.trim().toUpperCase();
    if (cur === '' || cur === prevCode) {
      flightNoInput.value = newCode;                       // 空 or 頭だけ → 差し替え
    } else if (prevCode && newCode && cur.startsWith(prevCode)) {
      flightNoInput.value = newCode + cur.slice(prevCode.length); // JL501 → NH501
    }
    onFormInput();
  });

  // 便名欄にカーソルを置いたら、文字の末尾から続けて打てるようにする
  flightNoInput.addEventListener('focus', () => {
    setTimeout(() => {
      const n = flightNoInput.value.length;
      try { flightNoInput.setSelectionRange(n, n); } catch (e) { /* 無視 */ }
    }, 30);
  });

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
    const fill = (id, keys, exclude) => {
      const count = new Map();
      flights.forEach((f) => keys.forEach((k) => {
        const v = (f[k] || '').trim();
        if (v && !(exclude && exclude(v))) count.set(v, (count.get(v) || 0) + 1);
      }));
      const values = Array.from(count.entries()).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
      $(id).innerHTML = values.map((v) => '<option value="' + esc(v) + '"></option>').join('');
    };
    // 手入力欄の候補には、プルダウンにない会社名（外国の会社など）だけを出す
    fill('#dl-airline', ['airline'], (v) => !!findAirline(v));
    fill('#dl-aircraft', ['aircraft']);
    fill('#dl-registration', ['registration']);
    fill('#dl-airport', ['from', 'to']);
  }

  // ---------- 集計 ----------
  const expanded = {};

  // 回数を数えて、多い順に並べる。
  // 同じ回数のときは名前の50音・アルファベット順（毎回同じ順になる）。
  // 空欄（未入力）は数えない。
  function tally(keys, list) {
    const m = new Map();
    (list || flights).forEach((f) => {
      keys.forEach((k) => {
        const v = (f[k] || '').trim();
        if (v) m.set(v, (m.get(v) || 0) + 1);
      });
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
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
      '<a href="#summary" class="btn btn-primary btn-block sum-open">まとめ画像を作る</a>' +
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

  // ---------- 年間まとめ画像 ----------
  const sumYear = $('#sum-year');
  const sumCanvas = $('#sum-canvas');
  const sumShareBtn = $('#btn-sum-share');
  let sumBlob = null;     // 共有ボタン用に、あらかじめ作っておく画像データ
  let sumRenderId = 0;

  // フォントは style.css の :root にある指定（--serif / --round）をそのまま使う。
  // → 画面と画像で同じフォントになり、指定は1か所にまとまる。
  function cssFont(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // 記録がある年（新しい順）
  function flightYears() {
    const set = new Set();
    flights.forEach((f) => {
      const y = (f.date || '').slice(0, 4);
      if (/^\d{4}$/.test(y)) set.add(y);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }

  // その年の集計（各ランキングは上位3件まで。未入力は除く）
  function summaryData(year) {
    const list = flights.filter((f) => (f.date || '').startsWith(year + '-'));
    return {
      year,
      total: list.length,
      airports: tally(['from', 'to'], list).slice(0, 3),  // 出発・到着の両方を数える
      airlines: tally(['airline'], list).slice(0, 3),
      aircraft: tally(['aircraft'], list).slice(0, 3),
    };
  }

  function summarySize() {
    const r = document.querySelector('input[name="sum-size"]:checked');
    return r ? r.value : 'story';
  }

  function summaryFileName() {
    return 'flightlog_' + sumYear.value + '.png';
  }

  // 画像ファイルを共有できるブラウザか（主にスマホ）
  function canShareImages() {
    try {
      if (!navigator.share || !navigator.canShare) return false;
      const test = new File([new Blob([''], { type: 'image/png' })], 'test.png', { type: 'image/png' });
      return navigator.canShare({ files: [test] });
    } catch (e) {
      return false;
    }
  }

  function openSummary() {
    const years = flightYears();
    const prev = sumYear.value;
    const thisYear = String(new Date().getFullYear());
    sumYear.innerHTML = years.map((y) => '<option value="' + y + '">' + y + '年</option>').join('');
    sumYear.disabled = !years.length;
    if (years.includes(prev)) sumYear.value = prev;
    else if (years.includes(thisYear)) sumYear.value = thisYear;
    else if (years.length) sumYear.value = years[0];
    renderSummary();
  }

  function renderSummary() {
    const year = sumYear.value;
    const data = year ? summaryData(year) : null;
    const empty = !data || data.total === 0;
    $('#sum-empty').hidden = !empty;
    $('#sum-result').hidden = empty;
    sumBlob = null;
    if (empty) return;

    drawSummary(sumCanvas, data, summarySize());
    sumShareBtn.hidden = !canShareImages();
    // 共有ボタンを押した瞬間に共有シートを開けるよう、画像データを先に作っておく
    const id = ++sumRenderId;
    sumCanvas.toBlob((b) => { if (id === sumRenderId) sumBlob = b; }, 'image/png');
  }

  sumYear.addEventListener('change', renderSummary);
  $$('input[name="sum-size"]').forEach((r) => r.addEventListener('change', renderSummary));
  $('#btn-sum-back').addEventListener('click', () => go('stats'));

  $('#btn-sum-save').addEventListener('click', () => {
    const save = (b) => {
      if (!b) { toast('画像を作れませんでした'); return; }
      downloadBlob(summaryFileName(), b);
    };
    if (sumBlob) save(sumBlob);
    else sumCanvas.toBlob(save, 'image/png');
  });

  sumShareBtn.addEventListener('click', async () => {
    if (!sumBlob) { toast('画像を準備中です。もう一度押してください'); return; }
    const file = new File([sumBlob], summaryFileName(), { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: 'FLIGHT LOG ' + sumYear.value });
    } catch (e) {
      if (e && e.name === 'AbortError') return; // 共有シートを閉じただけ
      console.warn(e);
      toast('共有できませんでした。「画像を保存」をお使いください');
    }
  });

  // --- 画像の描画（Canvas） ---
  function drawSummary(canvas, d, sizeKey) {
    const isStory = sizeKey !== 'post';
    const S = isStory ? SUMMARY_SIZES.story : SUMMARY_SIZES.post;
    const C = SUMMARY_COLORS;
    const F = { serif: cssFont('--serif', 'serif'), round: cssFont('--round', 'sans-serif') };
    canvas.width = S.w;
    canvas.height = S.h;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    // 文字の大きさ・余白（サイズごと）
    const M = isStory ? {
      top: 190, bottom: 200, h1: 50, sub: 28, year: 170, totalLabel: 32, total: 250, unit: 48,
      secTitle: 36, secJa: 28, rowH: 82, rowName: 50, rank: 44, count: 50, countUnit: 30,
      minGap: 24, maxGap: 90,
    } : {
      top: 90, bottom: 90, h1: 42, sub: 24, year: 130, totalLabel: 26, total: 170, unit: 38,
      secTitle: 30, secJa: 24, rowH: 72, rowName: 44, rank: 36, count: 44, countUnit: 26,
      minGap: 20, maxGap: 60,
    };
    const L = 150;            // 左端（赤いマージン線の右）
    const R = S.w - 100;      // 右端
    const CX = (L + R) / 2;   // 中央

    // --- 描画の小道具 ---
    const setFont = (size, family, weight, italic) => {
      ctx.font = (italic ? 'italic ' : '') + (weight || 400) + ' ' + size + 'px ' + family;
    };
    // 字間をあけて書く（古いSafariでも同じ見た目になるよう1文字ずつ描く）
    const spaced = (text, x, y, spacing, align) => {
      const chars = Array.from(text);
      const widths = chars.map((c) => ctx.measureText(c).width);
      const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
      let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
      ctx.textAlign = 'left';
      chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
      return total;
    };
    const hline = (x1, x2, y, color, width, dash) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      ctx.restore();
    };
    // 幅に収まるよう文字を小さくし、それでも長ければ「…」で省略
    const fitText = (text, maxW, size, family, weight) => {
      let s = size;
      setFont(s, family, weight);
      while (ctx.measureText(text).width > maxW && s > size * 0.6) {
        s -= 2;
        setFont(s, family, weight);
      }
      let t = Array.from(text);
      if (ctx.measureText(text).width > maxW) {
        while (t.length > 1 && ctx.measureText(t.join('') + '…').width > maxW) t.pop();
        return t.join('') + '…';
      }
      return text;
    };
    // 右端に「12 回」と書き、使った幅を返す
    const drawCount = (n, baseline, numSize, unitSize) => {
      ctx.textAlign = 'right';
      setFont(unitSize, F.round, 400);
      ctx.fillStyle = C.muted;
      ctx.fillText('回', R, baseline);
      const uw = ctx.measureText('回').width;
      setFont(numSize, F.round, 700);
      ctx.fillStyle = C.ink;
      ctx.fillText(String(n), R - uw - 8, baseline);
      return uw + 8 + ctx.measureText(String(n)).width;
    };

    // --- 背景（ログブックの紙） ---
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, S.w, S.h);
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let y = 96; y < S.h - 40; y += 48) hline(112, S.w - 40, y, C.rule, 1.5);
    ctx.restore();
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, S.w - 72, S.h - 72);
    ctx.fillStyle = C.accent;
    ctx.fillRect(92, 36, 4, S.h - 72);          // 赤いマージン線
    ctx.globalAlpha = 0.5;
    ctx.fillRect(104, 36, 2, S.h - 72);
    ctx.globalAlpha = 1;

    // --- 各ブロック（高さ h と、描画関数 draw） ---
    const blocks = [];

    // 見出し：FLIGHT LOG / 年
    const headLines = (y, align, x) => {
      const b1 = y + M.h1 * 0.8;
      const b2 = b1 + M.sub * 1.6;
      const b3 = b2 + M.year * 0.95;
      ctx.fillStyle = C.ink;
      setFont(M.h1, F.serif, 600);
      spaced('FLIGHT LOG', x, b1, M.h1 * 0.32, align);
      ctx.fillStyle = C.muted;
      setFont(M.sub, F.serif, 400, true);
      spaced("Passenger's Logbook  ·  Annual Summary", x, b2, 1, align);
      ctx.fillStyle = C.ink;
      setFont(M.year, F.serif, 500);
      spaced(d.year, x, b3, M.year * 0.04, align);
      return b3;
    };
    const doubleRule = (y) => {
      hline(L, R, y, C.ruleStrong, 2);
      hline(L, R, y + 8, C.ruleStrong, 2);
    };
    const headH = M.h1 * 0.8 + M.sub * 1.6 + M.year * 0.95 + 40 + 8;

    if (isStory) {
      blocks.push({ h: headH, draw: (y) => { const b = headLines(y, 'center', CX); doubleRule(b + 40); } });
      // 総フライト数（大きく中央に）
      blocks.push({
        h: M.totalLabel * 0.8 + 30 + M.total * 0.78 + 10,
        draw: (y) => {
          const b1 = y + M.totalLabel * 0.8;
          const b2 = b1 + 30 + M.total * 0.78;  // ラベルと数字がくっつかないよう30pxあける
          ctx.fillStyle = C.muted;
          setFont(M.totalLabel, F.round, 400);
          spaced('TOTAL FLIGHTS', CX, b1, M.totalLabel * 0.25, 'center');
          const num = String(d.total);
          setFont(M.total, F.round, 700);
          const nw = ctx.measureText(num).width;
          setFont(M.unit, F.round, 400);
          const uw = ctx.measureText('回').width;
          const x0 = CX - (nw + 16 + uw) / 2;
          ctx.textAlign = 'left';
          ctx.fillStyle = C.ink;
          setFont(M.total, F.round, 700);
          ctx.fillText(num, x0, b2);
          ctx.fillStyle = C.inkSoft;
          setFont(M.unit, F.round, 400);
          ctx.fillText('回', x0 + nw + 16, b2);
        },
      });
    } else {
      // 4:5 は高さが足りないので、見出し（左）と総フライト数（右）を横に並べる
      blocks.push({
        h: headH,
        draw: (y) => {
          const b = headLines(y, 'left', L);
          ctx.fillStyle = C.muted;
          setFont(M.totalLabel, F.round, 400);
          spaced('TOTAL FLIGHTS', R, y + M.totalLabel * 0.8, M.totalLabel * 0.25, 'right');
          const num = String(d.total);
          ctx.textAlign = 'right';
          setFont(M.unit, F.round, 400);
          const uw = ctx.measureText('回').width;
          ctx.fillStyle = C.inkSoft;
          ctx.fillText('回', R, b);
          ctx.fillStyle = C.ink;
          ctx.fillText(fitText(num, 420, M.total, F.round, 700), R - uw - 12, b);
          doubleRule(b + 40);
        },
      });
    }

    // ランキング（上位3件。0件の項目は出さない）
    const section = (title, ja, rows) => {
      if (!rows.length) return;
      const titleH = M.secTitle * 0.8 + 18;
      blocks.push({
        h: titleH + rows.length * M.rowH,
        draw: (y) => {
          const tb = y + M.secTitle * 0.8;
          ctx.fillStyle = C.accent;
          setFont(M.secTitle, F.serif, 600);
          const tw = spaced(title, L, tb, M.secTitle * 0.22);
          ctx.fillStyle = C.muted;
          setFont(M.secJa, F.round, 400);
          ctx.textAlign = 'left';
          ctx.fillText(ja, L + tw + 20, tb);
          setFont(M.secJa, F.serif, 400, true);
          ctx.textAlign = 'right';
          ctx.fillText('Top ' + rows.length, R, tb);
          const top = y + titleH;
          hline(L, R, top, C.ruleStrong, 2);
          rows.forEach(([name, n], i) => {
            const rowTop = top + i * M.rowH;
            const base = rowTop + M.rowH * 0.68;
            ctx.fillStyle = C.accent;
            setFont(M.rank, F.serif, 600, true);
            ctx.textAlign = 'left';
            ctx.fillText(String(i + 1), L + 4, base);
            const used = drawCount(n, base, M.count, M.countUnit);
            const nameX = L + M.rank * 1.4;
            const maxW = R - used - 28 - nameX;
            const t = fitText(name, maxW, M.rowName, F.round, 500);
            ctx.fillStyle = C.ink;
            ctx.textAlign = 'left';
            ctx.fillText(t, nameX, base);
            if (i < rows.length - 1) hline(L, R, rowTop + M.rowH, C.ruleStrong, 1.5, [3, 7]);
          });
        },
      });
    };
    section('AIRPORTS', '空港', d.airports);
    section('AIRLINES', '航空会社', d.airlines);
    section('AIRCRAFT', '機種', d.aircraft);

    // --- 縦の配置：ブロックの間を均等にあけ、余れば上下中央に寄せる ---
    const sum = blocks.reduce((a, b) => a + b.h, 0);
    const gaps = Math.max(1, blocks.length - 1);
    const avail = S.h - M.top - M.bottom - sum;
    const gap = Math.max(8, Math.min(M.maxGap, Math.max(M.minGap, avail / gaps)));
    const used = sum + gap * (blocks.length - 1);
    let y = M.top + Math.max(0, (S.h - M.top - M.bottom - used) / 2);
    blocks.forEach((b) => { b.draw(y); y += b.h + gap; });

    // フッター
    ctx.fillStyle = C.muted;
    setFont(isStory ? 26 : 22, F.serif, 400, true);
    spaced('— my flight log —', CX, S.h - (isStory ? 120 : 62), 2, 'center');
  }

  // ---------- エクスポート ----------
  function download(filename, text, type) {
    downloadBlob(filename, new Blob([text], { type }));
  }

  function downloadBlob(filename, blob) {
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
    ['schedDep', 'schedArr', 'blockOut', 'takeoff', 'landing', 'blockIn'].forEach((k) => { f[k] = normalizeTime(f[k]); });
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
  if (DEMO) {
    $('#demo-banner').hidden = false;
    document.body.classList.add('is-demo');
  }

  // ブラウザに「このデータは消さないで」とお願いする（対応ブラウザのみ）
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  // オフライン対応（Service Worker の登録）
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW登録失敗', err));
  }

  route();
})();

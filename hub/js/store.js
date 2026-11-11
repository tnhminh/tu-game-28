/* Lưu trữ: toàn bộ tiến trình nằm trong MỘT khoá localStorage (TG.CONFIG.STORAGE_KEY),
 * có trường schema "v" và chuỗi migration. Mọi truy cập đều bọc try/catch:
 * nếu localStorage bị chặn, app vẫn chạy bằng bộ nhớ tạm. */
(function () {
  'use strict';
  var TG = window.TG, U = TG.util;
  var KEY = TG.CONFIG.STORAGE_KEY;
  var SCHEMA = 2;

  function defaults() {
    return {
      v: SCHEMA,
      createdAt: U.now(),
      profile: { name: 'Rio', avatar: 'cat', wording: 'con', onboarded: false },
      settings: { sound: true, fx: 'high' },
      parental: { limitMin: 0, breakReminder: true, extraToday: { day: '', min: 0 } },
      xp: 0,
      coins: 0,
      coinsEarned: 0,
      stats: {
        rounds: 0, wins: 0, records: 0, milestones: 0, playSec: 0,
        missionsDone: 0, breaksTaken: 0, unlocks: 0,
        perGame: {},   // id -> {rounds, wins, records, best, playSec, last}
        perGenre: {}   // genre -> {rounds, wins}
      },
      daily: {},       // 'YYYY-MM-DD' -> {playSec, rounds, wins, records, milestones, games:{id:sec}, genreRounds:{}, genreWins:{}, freeCoins}
      checkin: { last: '', streak: 0, best: 0, cycle: 0, doubled: '', freezeWeek: '', freezesUsed: 0 },
      missions: { day: '', list: [], rerolled: false },
      ach: {},         // id -> timestamp
      unlocked: {},    // id -> 'level' | 'coins' | ...
      owned: {},       // remove_ads, vip_lifetime -> true
      txDone: {},      // transaction id -> true (chống cộng xu 2 lần)
      ads: { lastInterstitial: 0, roundsSince: 0, shown: 0 },
      recent: []
    };
  }

  /* Chuỗi migration: MIGRATIONS[n] nâng dữ liệu từ schema n lên n+1. */
  var MIGRATIONS = {
    // v0: dữ liệu chưa có trường v (bản thử nghiệm sớm) → v1
    0: function (d) { d.v = 1; return d; },
    // v1 → v2: thêm cài đặt nhắc nghỉ và bộ đếm quảng cáo; đổi "vip" boolean thành owned.vip_lifetime
    1: function (d) {
      d.parental = d.parental || {};
      if (d.parental.breakReminder == null) d.parental.breakReminder = true;
      if (d.vip) { d.owned = d.owned || {}; d.owned.vip_lifetime = true; delete d.vip; }
      d.v = 2; return d;
    }
  };

  function fill(target, def) {
    for (var k in def) {
      if (!(k in target) || target[k] === undefined || target[k] === null && def[k] !== null) target[k] = def[k];
      else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) &&
               target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) fill(target[k], def[k]);
    }
    return target;
  }

  function migrate(d) {
    var v = typeof d.v === 'number' ? d.v : 0;
    while (v < SCHEMA && MIGRATIONS[v]) { d = MIGRATIONS[v](d) || d; v = d.v; }
    d.v = SCHEMA;
    return fill(d, defaults());
  }

  var memoryOnly = false;
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { memoryOnly = true; }
    if (!raw) return defaults();
    try {
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return defaults();
      return migrate(d);
    } catch (e) {
      // Dữ liệu hỏng: giữ bản sao để không mất hẳn, rồi bắt đầu lại.
      try { localStorage.setItem(KEY + '.corrupt', raw); } catch (e2) {}
      return defaults();
    }
  }

  var store = TG.store = {
    SCHEMA: SCHEMA,
    state: load(),
    memoryOnly: function () { return memoryOnly; },
    save: function () {
      clearTimeout(store._t); store._t = 0;
      try { localStorage.setItem(KEY, JSON.stringify(store.state)); }
      catch (e) { memoryOnly = true; }
    },
    saveSoon: function () {
      if (store._t) return;
      store._t = setTimeout(store.save, 400);
    },
    reset: function () {
      var keep = { onboarded: false };
      store.state = defaults();
      store.state.profile.onboarded = keep.onboarded;
      store.save();
    },
    /** Bản ghi của ngày (tạo nếu chưa có), dọn các ngày cũ hơn 21 ngày. */
    today: function () {
      var k = U.dayKey(), d = store.state.daily;
      if (!d[k]) {
        d[k] = { playSec: 0, rounds: 0, wins: 0, records: 0, milestones: 0, games: {}, genreRounds: {}, genreWins: {}, freeCoins: 0 };
        Object.keys(d).forEach(function (x) { if (U.dayDiff(x, k) > 21) delete d[x]; });
      }
      return d[k];
    },
    isVip: function () { return !!store.state.owned.vip_lifetime; },
    adsRemoved: function () { return !!(store.state.owned.vip_lifetime || store.state.owned.remove_ads); },
    _migrate: migrate,
    _defaults: defaults
  };
  window.addEventListener('pagehide', store.save);
  document.addEventListener('visibilitychange', function () { if (document.hidden) store.save(); });
})();

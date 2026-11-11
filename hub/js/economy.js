/* Kinh tế & vòng giữ chân: XP/cấp, xu, điểm danh, nhiệm vụ, thành tựu, mở khoá game.
 * Mọi thay đổi ghi vào TG.store.state và phát sự kiện qua TG.bus cho giao diện. */
(function () {
  'use strict';
  var TG = window.TG, U = TG.util, S = TG.store, C = TG.catalog;

  /* ---------- Bus sự kiện ---------- */
  var handlers = {};
  TG.bus = {
    on: function (n, f) { (handlers[n] = handlers[n] || []).push(f); },
    emit: function (n, d) { (handlers[n] || []).forEach(function (f) { try { f(d); } catch (e) { console.error(e); } }); }
  };
  var bus = TG.bus;
  function st() { return S.state; }

  var E = TG.econ = {};

  /* ---------- Cấp độ ---------- */
  /** XP cần để đi từ cấp L lên L+1. */
  E.need = function (L) { return 80 + 40 * (L - 1) + 5 * (L - 1) * (L - 1); };
  E.levelInfo = function (xp) {
    xp = xp == null ? st().xp : xp;
    var L = 1, rest = xp;
    while (rest >= E.need(L) && L < 99) { rest -= E.need(L); L++; }
    return { level: L, into: rest, need: E.need(L), pct: Math.min(1, rest / E.need(L)) };
  };
  E.level = function () { return E.levelInfo().level; };

  E.addXp = function (n) {
    if (!n) return;
    var before = E.level();
    st().xp += Math.round(n);
    var after = E.level();
    if (after > before) {
      var reward = 0, unlockedNow = [];
      for (var L = before + 1; L <= after; L++) reward += 25 + 5 * L;
      C.games.forEach(function (g) {
        if (!g.free && !st().unlocked[g.id] && g.reqLevel <= after) {
          st().unlocked[g.id] = 'level'; st().stats.unlocks++; unlockedNow.push(g);
        }
      });
      E.addCoins(reward, false);
      bus.emit('levelup', { level: after, coins: reward, games: unlockedNow });
    }
    S.saveSoon(); bus.emit('change');
  };

  /* ---------- Xu ---------- */
  /** Cộng xu. vipBoost=true: VIP được x2. Trả về số xu thực nhận. */
  E.addCoins = function (n, vipBoost) {
    n = Math.round(n);
    if (n <= 0) return 0;
    if (vipBoost && S.isVip()) n *= 2;
    st().coins += n; st().coinsEarned += n;
    S.saveSoon(); bus.emit('change'); bus.emit('coins', n);
    return n;
  };
  E.spend = function (n) {
    if (st().coins < n) return false;
    st().coins -= n; S.saveSoon(); bus.emit('change'); return true;
  };

  /* ---------- Mở khoá ---------- */
  E.isUnlocked = function (g) {
    if (typeof g === 'string') g = C.get(g);
    if (!g) return false;
    return g.free || !!st().unlocked[g.id] || S.isVip() || E.level() >= g.reqLevel;
  };
  E.buyUnlock = function (id) {
    var g = C.get(id);
    if (!g || E.isUnlocked(g)) return false;
    if (!E.spend(g.price)) return false;
    st().unlocked[id] = 'coins'; st().stats.unlocks++;
    S.save(); E.checkAch(); bus.emit('change');
    return true;
  };
  /** Đồng bộ mở khoá theo cấp (khi khởi động / sau migration). */
  E.syncLevelUnlocks = function () {
    var L = E.level();
    C.games.forEach(function (g) { if (!g.free && !st().unlocked[g.id] && g.reqLevel <= L) st().unlocked[g.id] = 'level'; });
  };

  /* ---------- Sự kiện từ game ---------- */
  var lastEnd = {}, lastMs = {};
  function perGame(id) {
    var p = st().stats.perGame;
    return p[id] || (p[id] = { rounds: 0, wins: 0, records: 0, best: null, playSec: 0, last: 0 });
  }
  function perGenre(gid) {
    var p = st().stats.perGenre;
    return p[gid] || (p[gid] = { rounds: 0, wins: 0 });
  }

  /** Xử lý một sự kiện ghEmit. Trả về {xp, coins} đã thưởng (để hiện toast) hoặc null. */
  E.onGameEvent = function (gameId, msg) {
    var g = C.get(gameId); if (!g) return null;
    var now = U.now(), s = st(), T = S.today();
    var type = msg && msg.type;
    if (type === 'start') { perGame(gameId).last = now; S.saveSoon(); return null; }

    if (type === 'end') {
      // chống spam: tối đa 1 ván / 2,5 giây mỗi game
      if (lastEnd[gameId] && now - lastEnd[gameId] < 2500) return null;
      lastEnd[gameId] = now;
      var win = msg.win === true, best = msg.best === true;
      var pg = perGame(gameId), gr = perGenre(g.genre);
      s.stats.rounds++; pg.rounds++; gr.rounds++; T.rounds++;
      T.genreRounds[g.genre] = (T.genreRounds[g.genre] || 0) + 1;
      if (win) { s.stats.wins++; pg.wins++; gr.wins++; T.wins++; T.genreWins[g.genre] = (T.genreWins[g.genre] || 0) + 1; }
      if (best) { s.stats.records++; pg.records++; T.records++; }
      if (typeof msg.score === 'number' && isFinite(msg.score)) pg.best = pg.best == null ? msg.score : Math.max(pg.best, msg.score);
      pg.last = now;
      s.ads.roundsSince++;
      var xp = 10 + (win ? 12 : 0) + (best ? 18 : 0);
      var coins = 4 + (win ? 4 : 0) + (best ? 8 : 0);
      coins = E.addCoins(coins, true);
      E.addXp(xp);
      afterProgress();
      return { xp: xp, coins: coins, win: win, best: best };
    }

    if (type === 'milestone') {
      if (lastMs[gameId] && now - lastMs[gameId] < 1500) return null;
      lastMs[gameId] = now;
      s.stats.milestones++; T.milestones++;
      var mc = E.addCoins(2, true);
      E.addXp(4);
      afterProgress();
      return { xp: 4, coins: mc, milestone: true };
    }
    return null;
  };

  /** Gọi mỗi giây khi đang chơi (trang hiển thị). */
  E.tickPlay = function (gameId) {
    var s = st(), T = S.today(), pg = perGame(gameId);
    s.stats.playSec++; pg.playSec++; T.playSec++;
    T.games[gameId] = (T.games[gameId] || 0) + 1;
    if (T.playSec % 60 === 0) { E.addXp(2); afterProgress(); }
    else S.saveSoon();
  };

  function afterProgress() { E.refreshMissions(true); E.checkAch(); }

  /* ---------- Điểm danh 7 ngày ---------- */
  E.CHECKIN = [20, 30, 40, 50, 70, 90, 150];
  /** Trạng thái điểm danh hôm nay (không thay đổi dữ liệu). */
  E.checkinStatus = function () {
    var c = st().checkin, today = U.dayKey();
    var claimed = c.last === today;
    var gap = c.last ? U.dayDiff(c.last, today) : 99;
    var week = U.weekKey(today);
    var freezeLeft = c.freezeWeek !== week;
    var willFreeze = !claimed && gap === 2 && freezeLeft && c.streak > 0;
    var keeps = claimed || gap === 1 || willFreeze;
    var streak = claimed ? c.streak : (keeps ? c.streak : 0);
    // vị trí trong vòng 7 ngày: ngày đã nhận hôm nay hoặc ngày sẽ nhận
    var idx = claimed ? (c.cycle + 6) % 7 : (keeps ? c.cycle % 7 : 0);
    return {
      claimed: claimed, streak: streak, index: idx, reward: E.CHECKIN[idx],
      willFreeze: willFreeze, freezeLeft: freezeLeft, broken: !keeps && c.streak > 0 && !claimed,
      doubled: c.doubled === today, best: c.best
    };
  };
  E.claimCheckin = function () {
    var c = st().checkin, today = U.dayKey();
    var info = E.checkinStatus();
    if (info.claimed) return null;
    if (info.willFreeze) { c.freezeWeek = U.weekKey(today); c.freezesUsed++; }
    if (info.broken || !c.last) { c.streak = 0; c.cycle = 0; }
    else if (!info.willFreeze && U.dayDiff(c.last, today) !== 1) { c.streak = 0; c.cycle = 0; }
    var idx = c.cycle % 7;
    c.streak++; c.best = Math.max(c.best, c.streak);
    c.cycle = (idx + 1) % 7;
    c.last = today;
    var coins = E.addCoins(E.CHECKIN[idx], true);
    if (idx === 6) E.addXp(50);
    S.save(); E.checkAch(); bus.emit('change');
    return { coins: coins, day: idx + 1, streak: c.streak, froze: info.willFreeze };
  };
  /** Nhân đôi phần thưởng hôm nay (sau quảng cáo có thưởng). */
  E.doubleCheckin = function () {
    var c = st().checkin, today = U.dayKey();
    if (c.last !== today || c.doubled === today) return 0;
    c.doubled = today;
    var idx = (c.cycle + 6) % 7;
    var n = E.addCoins(E.CHECKIN[idx], true);
    S.save(); return n;
  };

  /* ---------- Nhiệm vụ hằng ngày ---------- */
  var WIN_GENRES = ['board', 'puzzle', 'action', 'multiplayer'];
  var TEMPLATES = {
    genre_rounds: { n: 3, coins: 40, xp: 30, label: function (m) { return 'Chơi ' + m.n + ' ván game ' + C.genre(m.genre).short; },
      prog: function (m, T) { return T.genreRounds[m.genre] || 0; } },
    genre_wins: { n: 2, coins: 50, xp: 35, label: function (m) { return 'Thắng ' + m.n + ' ván ' + C.genre(m.genre).short; },
      prog: function (m, T) { return T.genreWins[m.genre] || 0; } },
    record: { n: 1, coins: 45, xp: 30, label: function () { return 'Lập 1 kỷ lục mới'; },
      prog: function (m, T) { return T.records; } },
    minutes: { n: 10, coins: 35, xp: 25, label: function (m) { return 'Chơi ' + m.n + ' phút'; },
      prog: function (m, T) { return Math.floor(T.playSec / 60); } },
    milestones: { n: 3, coins: 35, xp: 25, label: function (m) { return 'Qua ' + m.n + ' màn hoặc mốc'; },
      prog: function (m, T) { return T.milestones; } },
    rounds: { n: 5, coins: 40, xp: 30, label: function (m) { return 'Hoàn thành ' + m.n + ' ván bất kỳ'; },
      prog: function (m, T) { return T.rounds; } },
    variety: { n: 3, coins: 40, xp: 30, label: function (m) { return 'Chơi ' + m.n + ' game khác nhau'; },
      prog: function (m, T) { return Object.keys(T.games).filter(function (k) { return T.games[k] >= 20; }).length; } },
    wins: { n: 3, coins: 45, xp: 30, label: function (m) { return 'Thắng ' + m.n + ' ván bất kỳ'; },
      prog: function (m, T) { return T.wins; } }
  };
  E.TEMPLATES = TEMPLATES;

  /** Danh sách ứng viên nhiệm vụ cho ngày — xác định hoàn toàn từ ngày. */
  E.missionCandidates = function (day) {
    var r = U.rng(U.hash('tg28-missions-' + day));
    var types = Object.keys(TEMPLATES);
    for (var i = types.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = types[i]; types[i] = types[j]; types[j] = t; }
    return types.map(function (type) {
      var m = { type: type, n: TEMPLATES[type].n };
      if (type === 'genre_rounds') m.genre = C.genres[Math.floor(r() * C.genres.length)].id;
      if (type === 'genre_wins') m.genre = WIN_GENRES[Math.floor(r() * WIN_GENRES.length)];
      m.id = type + (m.genre ? ':' + m.genre : '');
      return m;
    });
  };
  E.ensureMissions = function () {
    var M = st().missions, today = U.dayKey();
    if (M.day !== today || !M.list.length) {
      M.day = today; M.rerolled = false;
      M.list = E.missionCandidates(today).slice(0, 3).map(function (m) { m.claimed = false; m.notified = false; return m; });
      S.saveSoon();
    }
    return M;
  };
  E.missionView = function (m) {
    var t = TEMPLATES[m.type], T = S.today();
    var p = Math.min(m.n, t.prog(m, T));
    return { m: m, label: t.label(m), progress: p, target: m.n, done: p >= m.n, claimed: m.claimed, coins: t.coins, xp: t.xp };
  };
  E.refreshMissions = function (notify) {
    var M = E.ensureMissions();
    M.list.forEach(function (m) {
      var v = E.missionView(m);
      if (v.done && !m.claimed && !m.notified) { m.notified = true; if (notify) bus.emit('mission', v); }
    });
  };
  E.claimMission = function (i) {
    var M = E.ensureMissions(), m = M.list[i];
    if (!m || m.claimed) return null;
    var v = E.missionView(m); if (!v.done) return null;
    m.claimed = true; st().stats.missionsDone++;
    var coins = E.addCoins(v.coins, true);
    E.addXp(v.xp);
    S.save(); E.checkAch();
    return { coins: coins, xp: v.xp };
  };
  /** Đổi 1 nhiệm vụ (mỗi ngày 1 lần, sau quảng cáo có thưởng). */
  E.rerollMission = function (i) {
    var M = E.ensureMissions();
    if (M.rerolled || !M.list[i] || M.list[i].claimed) return false;
    var used = M.list.map(function (m) { return m.type; });
    var next = E.missionCandidates(M.day).filter(function (m) { return used.indexOf(m.type) < 0; })[0];
    if (!next) return false;
    next.claimed = false; next.notified = false;
    M.list[i] = next; M.rerolled = true;
    S.save(); bus.emit('change');
    return true;
  };

  /* ---------- Thành tựu ---------- */
  function genresPlayed() { var p = st().stats.perGenre; return Object.keys(p).filter(function (k) { return p[k].rounds > 0; }).length; }
  function gamesPlayed() { var p = st().stats.perGame; return Object.keys(p).filter(function (k) { return p[k].rounds > 0 || p[k].playSec >= 60; }).length; }
  function genre(k, f) { var g = st().stats.perGenre[k]; return g ? g[f] : 0; }
  var ACH = [
    ['first_round', '🎮', 'Khởi động', 'Hoàn thành ván đầu tiên', 20, function (s) { return [s.stats.rounds, 1]; }],
    ['first_win', '🏅', 'Chiến thắng đầu tiên', 'Thắng 1 ván bất kỳ', 30, function (s) { return [s.stats.wins, 1]; }],
    ['rounds_25', '🔁', 'Chăm chỉ', 'Hoàn thành 25 ván', 60, function (s) { return [s.stats.rounds, 25]; }],
    ['rounds_100', '💯', 'Tay chơi lão luyện', 'Hoàn thành 100 ván', 150, function (s) { return [s.stats.rounds, 100]; }],
    ['wins_10', '🥈', 'Mười trận thắng', 'Thắng 10 ván', 60, function (s) { return [s.stats.wins, 10]; }],
    ['wins_50', '🥇', 'Nhà vô địch', 'Thắng 50 ván', 150, function (s) { return [s.stats.wins, 50]; }],
    ['record_1', '⭐', 'Kỷ lục đầu tiên', 'Lập 1 kỷ lục mới', 30, function (s) { return [s.stats.records, 1]; }],
    ['record_10', '🌟', 'Săn kỷ lục', 'Lập 10 kỷ lục mới', 100, function (s) { return [s.stats.records, 10]; }],
    ['genres_7', '🧭', 'Nhà thám hiểm', 'Chơi đủ 7 thể loại', 120, function () { return [genresPlayed(), 7]; }],
    ['games_10', '🗂️', 'Sưu tầm', 'Chơi 10 game khác nhau', 80, function () { return [gamesPlayed(), 10]; }],
    ['games_28', '🏆', 'Trọn bộ 28', 'Chơi tất cả 28 game', 300, function () { return [gamesPlayed(), 28]; }],
    ['streak_3', '🔥', 'Ba ngày liền', 'Điểm danh 3 ngày liên tiếp', 40, function (s) { return [s.checkin.best, 3]; }],
    ['streak_7', '📅', 'Tròn một tuần', 'Điểm danh 7 ngày liên tiếp', 100, function (s) { return [s.checkin.best, 7]; }],
    ['streak_30', '🗓️', 'Bền bỉ', 'Điểm danh 30 ngày liên tiếp', 300, function (s) { return [s.checkin.best, 30]; }],
    ['level_5', '🚀', 'Cấp 5', 'Đạt cấp 5', 60, function () { return [E.level(), 5]; }],
    ['level_10', '🛸', 'Cấp 10', 'Đạt cấp 10', 120, function () { return [E.level(), 10]; }],
    ['level_20', '🌌', 'Cấp 20', 'Đạt cấp 20', 250, function () { return [E.level(), 20]; }],
    ['mission_1', '✅', 'Nhiệm vụ đầu tiên', 'Hoàn thành 1 nhiệm vụ', 20, function (s) { return [s.stats.missionsDone, 1]; }],
    ['mission_30', '📜', 'Người giữ lời', 'Hoàn thành 30 nhiệm vụ', 200, function (s) { return [s.stats.missionsDone, 30]; }],
    ['coins_1000', '💰', 'Hũ xu đầy', 'Kiếm tổng cộng 1.000 xu', 80, function (s) { return [s.coinsEarned, 1000]; }],
    ['unlock_1', '🔓', 'Mở cửa mới', 'Mở khoá 1 game', 30, function (s) { return [s.stats.unlocks, 1]; }],
    ['playtime_60', '⏱️', 'Một giờ vui vẻ', 'Chơi tổng cộng 60 phút', 60, function (s) { return [Math.floor(s.stats.playSec / 60), 60]; }],
    ['healthy_eyes', '👀', 'Đôi mắt khoẻ', 'Nghỉ mắt khi được nhắc', 40, function (s) { return [s.stats.breaksTaken, 1]; }],
    ['milestones_25', '🪜', 'Leo màn', 'Qua 25 màn hoặc mốc', 80, function (s) { return [s.stats.milestones, 25]; }],
    ['board_wins_5', '♟️', 'Kỳ thủ nhí', 'Thắng 5 ván Cờ & Bài', 80, function () { return [genre('board', 'wins'), 5]; }],
    ['casual_10', '📚', 'Ham học hỏi', 'Chơi 10 ván Học & Chơi', 60, function () { return [genre('casual', 'rounds'), 10]; }],
    ['multi_5', '🤝', 'Vui cùng bạn bè', 'Chơi 5 ván Chơi chung', 50, function () { return [genre('multiplayer', 'rounds'), 5]; }],
    ['arcade_records_3', '👾', 'Huyền thoại Arcade', 'Lập 3 kỷ lục ở game Arcade', 80, function (s) {
      var n = 0; Object.keys(s.stats.perGame).forEach(function (k) { if (k.indexOf('arcade/') === 0) n += s.stats.perGame[k].records; }); return [n, 3]; }]
  ].map(function (a) { return { id: a[0], icon: a[1], name: a[2], desc: a[3], coins: a[4], test: a[5] }; });
  E.ACH = ACH;

  E.achView = function (a) {
    var r = a.test(st()); var cur = Math.min(r[0] || 0, r[1]);
    return { a: a, cur: cur, target: r[1], done: !!st().ach[a.id], pct: cur / r[1] };
  };
  var checking = false;
  E.checkAch = function () {
    if (checking) return; checking = true;
    try {
      var s = st(), got = [];
      ACH.forEach(function (a) {
        if (s.ach[a.id]) return;
        var r = a.test(s);
        if (r[0] >= r[1]) { s.ach[a.id] = U.now(); got.push(a); }
      });
      got.forEach(function (a) { E.addCoins(a.coins, false); bus.emit('achievement', a); });
      if (got.length) S.save();
    } finally { checking = false; }
  };
})();

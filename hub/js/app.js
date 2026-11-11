/* Ứng dụng hub: onboarding, điều hướng, các màn hình (Trang chủ, Thành tựu, Cửa hàng, Cài đặt),
 * nút Back Android, service worker và móc kiểm thử window.__hub. */
(function () {
  'use strict';
  var TG = window.TG, U = TG.util, S = TG.store, E = TG.econ, C = TG.catalog, ui = TG.ui, esc = ui.esc;
  var CFG = TG.CONFIG;
  var view, screen = 'home', dirty = false, celebrations = [];

  var AVATARS = [
    ['cat', 'Mèo cam'], ['fox', 'Cáo lửa'], ['panda', 'Gấu trúc'],
    ['robot', 'Rô-bốt'], ['astro', 'Phi hành gia'], ['dino', 'Khủng long']
  ];
  function avatarSrc(id) { return 'assets/avatars/' + (AVATARS.some(function (a) { return a[0] === id; }) ? id : 'cat') + '.svg'; }
  function isNative() { try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; } }

  /* ---------- Lời chào ---------- */
  TG.word = function (w) {
    var ban = S.state.profile.wording === 'ban';
    if (!ban) return w;
    return w === 'Con' ? 'Bạn' : w === 'con' ? 'bạn' : w;
  };
  TG.greeting = function (wording, name) {
    var p = S.state.profile;
    return (name || p.name || 'Rio') + ' ơi, chơi game giữ gìn sức khoẻ ' + ((wording || p.wording) === 'ban' ? 'bạn' : 'con') + ' nhé!';
  };

  /* ================= Điều hướng ================= */
  var TABS = [
    ['home', 'Trang chủ', 'home'], ['ach', 'Thành tựu', 'trophy'], ['shop', 'Cửa hàng', 'bag'], ['settings', 'Cài đặt', 'gear']
  ];
  function go(s, opt) {
    opt = opt || {};
    if (s === screen && !opt.force) { if (s === 'home') window.scrollTo({ top: 0, behavior: U.reducedMotion() ? 'auto' : 'smooth' }); return; }
    if (!opt.fromPop) {
      try {
        if (s === 'home') { if (history.state && history.state.s && history.state.s !== 'home') { history.back(); return; } }
        else if (screen === 'home') history.pushState({ tg: 'screen', s: s }, '', '#' + s);
        else history.replaceState({ tg: 'screen', s: s }, '', '#' + s);
      } catch (e) {}
    }
    screen = s;
    render(true);
  }
  TG.go = go;

  window.addEventListener('popstate', function (e) {
    if (ignoreNext) { ignoreNext = false; return; }
    if (TG.player.onPop()) return;
    if (docOpen) { closeDoc(true); return; }
    ui.closeAll();
    var st = e.state || {};
    var s = st.tg === 'screen' && st.s ? st.s : 'home';
    if (st.tg === 'game') s = 'home';
    go(s, { fromPop: true, force: true });
  });

  /* ================= Hiển thị ================= */
  function render(scrollTop) {
    if (!view) return;
    if (TG.player.isOpen()) { dirty = true; return; }
    dirty = false;
    var a = document.activeElement, key = a && a.getAttribute && a.getAttribute('data-act') ? a.getAttribute('data-act') + '|' + (a.getAttribute('data-id') || '') : null;
    document.getElementById('topbar').innerHTML = header();
    var html = '<main class="screen screen-' + screen + '" id="main">' + ({ home: homeHTML, ach: achHTML, shop: shopHTML, settings: settingsHTML }[screen] || homeHTML)() + '</main>';
    view.innerHTML = html;
    renderTabs();
    if (scrollTop) window.scrollTo(0, 0);
    if (key) {
      var p = key.split('|');
      var el = view.querySelector('[data-act="' + p[0] + '"]' + (p[1] ? '[data-id="' + p[1] + '"]' : ''));
      if (el) try { el.focus({ preventScroll: true }); } catch (e) {}
    }
    if (screen === 'settings') bindSettings();
  }
  TG.render = render;

  function renderTabs() {
    var nav = document.getElementById('tabbar');
    nav.innerHTML = TABS.map(function (t) {
      var on = t[0] === screen;
      var badge = t[0] === 'home' ? homeBadge() : t[0] === 'ach' ? '' : '';
      return '<button type="button" class="tab' + (on ? ' on' : '') + '" data-act="tab" data-id="' + t[0] + '"' + (on ? ' aria-current="page"' : '') + '>' +
        ui.icon(t[2]) + '<span>' + t[1] + '</span>' + (badge ? '<i class="dot" aria-label="có phần thưởng"></i>' : '') + '</button>';
    }).join('');
  }
  function homeBadge() {
    if (!E.checkinStatus().claimed) return true;
    return E.ensureMissions().list.some(function (m) { var v = E.missionView(m); return v.done && !v.claimed; });
  }

  function header() {
    var p = S.state.profile, L = E.levelInfo();
    var vip = S.isVip();
    return '<div class="topbar-in">' +
      '<button type="button" class="me" data-act="tab" data-id="settings" aria-label="Hồ sơ: ' + esc(p.name) + ', cấp ' + L.level + '">' +
        '<span class="ava-ring" style="--p:' + Math.round(L.pct * 100) + '"><img src="' + avatarSrc(p.avatar) + '" alt="" width="44" height="44"></span>' +
        '<span class="lvl-chip">' + L.level + '</span></button>' +
      '<div class="me-info"><div class="me-name"><span class="nm">' + esc(p.name) + '</span>' + (vip ? '<span class="vip-tag">VIP</span>' : '') + '</div>' +
        '<div class="xp" role="progressbar" aria-label="Kinh nghiệm" aria-valuemin="0" aria-valuemax="' + L.need + '" aria-valuenow="' + L.into + '">' +
        '<span class="xp-l">Cấp ' + L.level + '</span><span class="xp-bar"><i style="width:' + (L.pct * 100).toFixed(1) + '%"></i></span><span class="xp-n">' + L.into + '/' + L.need + '</span></div></div>' +
      '<button type="button" class="coins" id="coin-pill" data-act="tab" data-id="shop" aria-label="' + U.fmt(S.state.coins) + ' xu, mở cửa hàng">' + ui.coinSvg + '<b>' + U.fmt(S.state.coins) + '</b><span class="plus" aria-hidden="true">+</span></button>' +
      '</header>';
  }

  /* ---------- Trang chủ ---------- */
  function homeHTML() {
    var T = S.today(), lim = TG.parental.limitSec();
    var sub = 'Hôm nay đã chơi ' + U.minutes(T.playSec) + (lim ? ' · còn ' + U.minutes(TG.parental.remainingSec()) : '');
    var out = '<section class="greet card" aria-label="Lời chào"><div class="greet-ico" aria-hidden="true">💚</div><div><p class="greet-t" id="greet-text">' + esc(TG.greeting()) + '</p><p class="greet-s">' + sub + '</p></div></section>';
    out += checkinHTML() + missionsHTML();
    if (!S.isVip()) out += '<button type="button" class="vip-banner" data-act="tab" data-id="shop"><span class="vb-crown" aria-hidden="true">👑</span><span class="vb-t"><b>VIP trọn đời</b><span>Mở mọi game · không quảng cáo · x2 xu</span></span>' + ui.icon('chev') + '</button>';
    out += recentHTML();
    out += '<nav class="genre-nav" aria-label="Thể loại">' + C.genres.map(function (g) {
      return '<a href="#g-' + g.id + '" class="gchip" data-act="jump" data-id="' + g.id + '" style="--g:' + g.color + '">' + esc(g.short) + '</a>';
    }).join('') + '</nav>';
    out += C.genres.map(genreHTML).join('');
    out += '<footer class="foot"><button type="button" class="linkish" data-act="privacy">Chính sách bảo mật</button><span>' + esc(CFG.APP_NAME) + ' · v' + CFG.APP_VERSION + '</span></footer>';
    return out;
  }

  function checkinHTML() {
    var c = E.checkinStatus();
    var cells = E.CHECKIN.map(function (r, i) {
      var cls = i < c.index || (c.claimed && i === c.index) ? 'got' : i === c.index ? 'today' : '';
      return '<li class="ci ' + cls + (i === 6 ? ' big' : '') + '"><span class="ci-d">' + 'N' + (i + 1) + '</span>' +
        '<span class="ci-i" aria-hidden="true">' + (cls === 'got' ? '✓' : i === 6 ? '🎁' : ui.coinSvg) + '</span><span class="ci-r">' + r + '</span></li>';
    }).join('');
    var btn;
    if (!c.claimed) btn = '<button type="button" class="btn btn-primary btn-glow" data-act="checkin" id="btn-checkin">Nhận ' + E.CHECKIN[c.index] * (S.isVip() ? 2 : 1) + ' xu</button>';
    else if (!c.doubled) btn = '<button type="button" class="btn btn-ad" data-act="checkin-double" id="btn-double">' + ui.icon('play') + 'Xem QC · nhân đôi</button>';
    else btn = '<span class="done-pill">✓ Đã nhận hôm nay</span>';
    var freeze = c.freezeLeft ? '<span class="freeze" title="Băng giữ chuỗi: tự dùng nếu lỡ 1 ngày">🧊 1</span>' : '<span class="freeze off" title="Đã dùng băng tuần này">🧊 0</span>';
    var note = c.willFreeze ? 'Hôm qua con quên điểm danh — băng giữ chuỗi sẽ cứu chuỗi!' : c.broken ? 'Chuỗi đã bắt đầu lại, cố lên nhé!' : (c.claimed ? 'Quay lại ngày mai để nhận tiếp nhé.' : 'Điểm danh để giữ chuỗi ngày.');
    return '<section class="card checkin" aria-labelledby="ci-h"><div class="card-h"><h2 id="ci-h">Điểm danh mỗi ngày</h2>' +
      '<div class="streak"><span class="flame" aria-hidden="true">🔥</span><b>' + c.streak + '</b><span> ngày</span>' + freeze + '</div></div>' +
      '<ol class="ci-row">' + cells + '</ol><div class="ci-foot"><p class="muted small">' + esc(note.replace('con quên', TG.word('con') + ' quên')) + '</p>' + btn + '</div></section>';
  }

  function missionsHTML() {
    var M = E.ensureMissions();
    var hrs = Math.max(1, 24 - new Date(U.now()).getHours());
    var rows = M.list.map(function (m, i) {
      var v = E.missionView(m);
      var act;
      if (v.claimed) act = '<span class="m-ok" aria-label="Đã nhận">✓</span>';
      else if (v.done) act = '<button type="button" class="btn btn-primary btn-sm btn-glow" data-act="mclaim" data-id="' + i + '">Nhận</button>';
      else if (!M.rerolled) act = '<button type="button" class="btn btn-ghost btn-sm btn-reroll" data-act="mreroll" data-id="' + i + '" aria-label="Đổi nhiệm vụ: ' + esc(v.label) + ' (xem quảng cáo)">' + ui.icon('dice') + '<span>Đổi</span></button>';
      else act = '';
      return '<li class="mission' + (v.claimed ? ' claimed' : v.done ? ' ready' : '') + '">' +
        '<div class="m-main"><p class="m-t">' + esc(v.label) + '</p>' +
        '<div class="m-prog"><span class="bar"><i style="width:' + (v.progress / v.target * 100) + '%"></i></span><span class="m-n">' + v.progress + '/' + v.target + '</span></div></div>' +
        '<div class="m-side"><span class="m-r">' + ui.coinSvg + v.coins + '</span>' + act + '</div></li>';
    }).join('');
    return '<section class="card missions" aria-labelledby="ms-h"><div class="card-h"><h2 id="ms-h">Nhiệm vụ hôm nay</h2><span class="muted small">Làm mới sau ' + hrs + ' giờ</span></div><ul class="m-list">' + rows + '</ul>' +
      (!M.rerolled ? '<p class="muted small hint">' + ui.icon('play', 'tiny') + 'Được đổi 1 nhiệm vụ mỗi ngày bằng một quảng cáo ngắn.</p>' : '') + '</section>';
  }

  function recentHTML() {
    var r = S.state.recent.map(C.get).filter(Boolean).slice(0, 6);
    if (!r.length) return '';
    return '<section class="recent" aria-labelledby="rc-h"><div class="sec-h"><h2 id="rc-h">Tiếp tục chơi</h2></div><div class="rc-row">' +
      r.map(function (g) {
        var locked = !E.isUnlocked(g);
        return '<button type="button" class="rc" data-act="game" data-id="' + g.id + '" style="--g:' + g.color + '"><span class="rc-art" aria-hidden="true">' + g.emoji + '</span><span class="rc-n">' + esc(g.name) + '</span>' + (locked ? '<span class="rc-lock" aria-label="Đang khoá">🔒</span>' : '') + '</button>';
      }).join('') + '</div></section>';
  }

  function cardHTML(g) {
    var un = E.isUnlocked(g), L = E.level();
    var pg = S.state.stats.perGame[g.id];
    var meta = '';
    if (!un) meta = '<span class="gc-lock">' + ui.icon('lock', 'tiny') + 'Cấp ' + g.reqLevel + ' · ' + ui.coinSvg + g.price + '</span>';
    else if (pg && pg.best != null) meta = '<span class="gc-best">Kỷ lục ' + U.fmt(pg.best) + '</span>';
    else if (!g.free && S.state.unlocked[g.id]) meta = '<span class="gc-new">Mới mở</span>';
    return '<button type="button" class="gcard' + (un ? '' : ' locked') + '" data-act="game" data-id="' + g.id + '" style="--g:' + g.color + '" aria-label="' + esc(g.name) + (un ? '' : ' (đang khoá, cần cấp ' + g.reqLevel + ' hoặc ' + g.price + ' xu)') + '">' +
      '<span class="gc-art" aria-hidden="true"><span class="gc-emo">' + g.emoji + '</span>' + (un ? '' : '<span class="gc-padlock">' + ui.icon('lock') + '</span>') + '</span>' +
      '<span class="gc-body"><span class="gc-name">' + esc(g.name) + '</span><span class="gc-desc">' + esc(g.desc) + '</span>' + meta + '</span></button>';
    void L;
  }
  function genreHTML(g) {
    var n = g.games.filter(function (x) { return E.isUnlocked(x); }).length;
    return '<section class="genre" id="g-' + g.id + '" style="--g:' + g.color + '" aria-labelledby="gh-' + g.id + '"><div class="sec-h"><h2 id="gh-' + g.id + '">' + esc(g.name) + '</h2><span class="muted small">' + n + '/' + g.games.length + ' đã mở</span></div>' +
      '<p class="genre-note">' + esc(g.note) + '</p><div class="grid">' + g.games.map(cardHTML).join('') + '</div></section>';
  }

  /* ---------- Thành tựu ---------- */
  function achHTML() {
    var s = S.state, list = E.ACH.map(E.achView);
    var done = list.filter(function (v) { return v.done; }).length;
    list.sort(function (a, b) { return (a.done - b.done) || (b.pct - a.pct); });
    var T = S.today();
    var stats = [['Ván đã chơi', U.fmt(s.stats.rounds)], ['Chiến thắng', U.fmt(s.stats.wins)], ['Kỷ lục', U.fmt(s.stats.records)], ['Hôm nay', U.minutes(T.playSec)]];
    return '<h1 class="page-h">Thành tựu</h1>' +
      '<section class="card ach-sum"><div class="ach-ring" style="--p:' + Math.round(done / list.length * 100) + '"><b>' + done + '</b><span>/' + list.length + '</span></div>' +
      '<div class="stat-grid">' + stats.map(function (x) { return '<div class="stat"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div></section>' +
      '<ul class="ach-list">' + list.map(function (v) {
        return '<li class="ach' + (v.done ? ' done' : '') + '"><span class="ach-i" aria-hidden="true">' + v.a.icon + '</span><div class="ach-m"><p class="ach-n">' + esc(v.a.name) + '</p><p class="ach-d">' + esc(v.a.desc) + '</p>' +
          (v.done ? '' : '<div class="m-prog"><span class="bar"><i style="width:' + (v.pct * 100).toFixed(1) + '%"></i></span><span class="m-n">' + U.fmt(v.cur) + '/' + U.fmt(v.target) + '</span></div>') +
          '</div><span class="ach-r">' + (v.done ? '<span class="m-ok" aria-label="Đã đạt">✓</span>' : ui.coinSvg + v.a.coins) + '</span></li>';
      }).join('') + '</ul>';
  }

  /* ---------- Cửa hàng ---------- */
  function shopHTML() {
    var s = S.state, vip = S.isVip(), noads = S.adsRemoved();
    var sim = TG.iap.mode === 'sim';
    var left = CFG.ADS.freeCoinsPerDay - (S.today().freeCoins || 0);
    var out = '<h1 class="page-h">Cửa hàng</h1>';
    if (sim) out += '<p class="sim-note">🧪 Chế độ thử — mua hàng và quảng cáo đều là giả lập, không mất tiền thật.</p>';
    out += '<section class="vip-card' + (vip ? ' owned' : '') + '"><div class="vip-top"><span class="vip-crown" aria-hidden="true">👑</span><div><h2>VIP trọn đời</h2><p>Mua một lần, dùng mãi mãi</p></div></div>' +
      '<ul class="perks"><li>🔓 Mở khoá tất cả 28 game</li><li>🚫 Không còn quảng cáo</li><li>💎 Nhân đôi xu từ mọi ván chơi và nhiệm vụ</li><li>⚡ Nhận thưởng ngay, không cần xem quảng cáo</li></ul>' +
      (vip ? '<span class="done-pill gold">✓ Bạn đã là VIP</span>' : '<button type="button" class="btn btn-gold" data-act="buy" data-id="vip_lifetime" id="buy-vip">Mua VIP · ' + esc(TG.iap.price('vip_lifetime')) + '</button>') + '</section>';
    out += '<section class="card shop-row"><span class="sr-i" aria-hidden="true">🚫</span><div class="sr-m"><h2>Gỡ quảng cáo</h2><p class="muted small">Tắt quảng cáo xen giữa vĩnh viễn. Quảng cáo có thưởng vẫn tuỳ ' + TG.word('con') + ' chọn.</p></div>' +
      (noads ? '<span class="done-pill">✓ Đã có</span>' : '<button type="button" class="btn btn-primary" data-act="buy" data-id="remove_ads" id="buy-noads">' + esc(TG.iap.price('remove_ads')) + '</button>') + '</section>';
    out += '<div class="sec-h"><h2>Gói xu</h2></div><div class="packs">' +
      [['coins_small', '💰', 'Túi xu'], ['coins_large', '🪙', 'Rương xu']].map(function (p) {
        var c = CFG.IAP.products[p[0]].coins;
        return '<button type="button" class="pack" data-act="buy" data-id="' + p[0] + '"><span class="pk-i" aria-hidden="true">' + p[1] + '</span><span class="pk-n">' + p[2] + '</span><span class="pk-c">' + ui.coinSvg + U.fmt(c) + '</span><span class="pk-p">' + esc(TG.iap.price(p[0])) + '</span></button>';
      }).join('') +
      '<button type="button" class="pack free" data-act="freecoins"' + (left > 0 ? '' : ' disabled') + '><span class="pk-i" aria-hidden="true">🎁</span><span class="pk-n">Quà miễn phí</span><span class="pk-c">' + ui.coinSvg + '25</span><span class="pk-p">' + (left > 0 ? (vip ? 'Nhận ngay' : '📺 Xem QC') + ' · còn ' + left : 'Hết lượt hôm nay') + '</span></button></div>';
    out += '<button type="button" class="btn btn-ghost wide" data-act="restore">' + ui.icon('restore') + 'Khôi phục giao dịch</button>';
    out += '<p class="muted small center">Mọi giao dịch cần phụ huynh xác nhận. Thanh toán qua Google Play / App Store.</p>';
    void s;
    return out;
  }

  /* ---------- Cài đặt ---------- */
  function seg(name, val, opts) {
    return '<div class="seg" role="radiogroup">' + opts.map(function (o) {
      return '<button type="button" role="radio" aria-checked="' + (o[0] === val) + '" class="' + (o[0] === val ? 'on' : '') + '" data-act="' + name + '" data-id="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function toggle(act, on, label) {
    return '<button type="button" class="switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + on + '" data-act="' + act + '" aria-label="' + esc(label) + '"><i></i></button>';
  }
  function settingsHTML() {
    var s = S.state, p = s.profile, par = s.parental;
    var lim = par.limitMin ? par.limitMin + ' phút/ngày' : 'Tắt';
    return '<h1 class="page-h">Cài đặt</h1>' +
      '<section class="card set"><h2>Hồ sơ</h2>' +
        '<label class="fld"><span>Tên người chơi</span><div class="fld-row"><input id="set-name" maxlength="16" autocomplete="off" value="' + esc(p.name) + '"><button type="button" class="btn btn-primary btn-sm" data-act="savename">Lưu</button></div></label>' +
        '<div class="fld"><span>Hình đại diện</span><div class="ava-grid">' + AVATARS.map(function (a) {
          return '<button type="button" class="ava-opt' + (a[0] === p.avatar ? ' on' : '') + '" data-act="avatar" data-id="' + a[0] + '" aria-pressed="' + (a[0] === p.avatar) + '" aria-label="' + a[1] + '"><img src="' + avatarSrc(a[0]) + '" alt="" width="56" height="56"></button>';
        }).join('') + '</div></div>' +
        '<div class="fld"><span>Cách xưng hô trong lời chào</span>' + seg('wording', p.wording, [['con', '“con”'], ['ban', '“bạn”']]) + '<p class="preview">💚 ' + esc(TG.greeting()) + '</p></div>' +
      '</section>' +
      '<section class="card set"><h2>Âm thanh & hiển thị</h2>' +
        '<div class="row"><span>Âm thanh giao diện</span>' + toggle('sound', s.settings.sound, 'Âm thanh giao diện') + '</div>' +
        '<div class="row"><span>Hiệu ứng <small class="muted">(gợi ý cho cả game)</small></span>' + seg('fx', s.settings.fx, [['high', 'Cao'], ['low', 'Tiết kiệm']]) + '</div>' +
      '</section>' +
      '<section class="card set parent"><h2>' + ui.icon('shield', 'tiny') + 'Phụ huynh</h2>' +
        '<div class="row"><span>Giới hạn thời gian chơi<small class="muted">Hôm nay: ' + U.minutes(S.today().playSec) + '</small></span><button type="button" class="btn btn-ghost btn-sm" data-act="limit" id="btn-limit">' + lim + ' ' + ui.icon('lock', 'tiny') + '</button></div>' +
        '<div class="row"><span>Nhắc nghỉ mắt mỗi 30 phút</span>' + toggle('breakrem', par.breakReminder, 'Nhắc nghỉ mắt') + '</div>' +
        '<p class="muted small">Thay đổi mục này cần trả lời câu hỏi dành cho phụ huynh.</p>' +
      '</section>' +
      '<section class="card set"><h2>Mua hàng</h2><div class="row"><span>Đã mua: ' + (s.owned.vip_lifetime ? 'VIP trọn đời' : s.owned.remove_ads ? 'Gỡ quảng cáo' : 'chưa có') + '</span><button type="button" class="btn btn-ghost btn-sm" data-act="restore">Khôi phục</button></div></section>' +
      '<section class="card set"><h2>Thông tin</h2>' +
        '<div class="row"><span>Chính sách bảo mật</span><button type="button" class="btn btn-ghost btn-sm" data-act="privacy">Xem</button></div>' +
        '<div class="row"><span>Liên hệ hỗ trợ</span><button type="button" class="btn btn-ghost btn-sm" data-act="contact">Gửi email</button></div>' +
        '<div class="row"><span>Phiên bản</span><span class="muted">' + CFG.APP_VERSION + (window.TG_BUILD ? ' (' + esc(window.TG_BUILD) + ')' : '') + '</span></div>' +
      '</section>' +
      '<section class="card set danger"><h2>Vùng nguy hiểm</h2><div class="row"><span>Xoá toàn bộ tiến trình trong hub<small class="muted">Cấp, xu, nhiệm vụ, thành tựu. Giao dịch đã mua có thể khôi phục.</small></span><button type="button" class="btn btn-danger btn-sm" data-act="reset" id="btn-reset">Xoá</button></div></section>';
  }
  function bindSettings() {
    var inp = document.getElementById('set-name');
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
  }
  function cleanName(v) { v = String(v || '').replace(/[<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16); return v || 'Rio'; }
  function saveName() {
    var inp = document.getElementById('set-name'); if (!inp) return;
    S.state.profile.name = cleanName(inp.value); S.save(); render();
    ui.toast('Đã lưu tên: ' + S.state.profile.name, { icon: '✅' });
  }
  function setFx(v) {
    S.state.settings.fx = v; S.save();
    document.documentElement.setAttribute('data-fx', v);
    // Gợi ý chung cho các game (các game tự đọc khoá của mình; khoá tg28.fx dành cho game đọc chung)
    try {
      localStorage.setItem('tg28.fx', v);
      localStorage.setItem('arcade-fx-quality', v);
      localStorage.setItem('board_fx_v1', v);
    } catch (e) {}
  }

  /* ================= Hành động ================= */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
    if (act !== 'jump') U.sound('tap');
    switch (act) {
      case 'tab': go(id); break;
      case 'jump': {
        e.preventDefault();
        var sec = document.getElementById('g-' + id);
        if (sec) sec.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
        break;
      }
      case 'game': openGame(id); break;
      case 'checkin': doCheckin(); break;
      case 'checkin-double': doDouble(); break;
      case 'mclaim': {
        var r = E.claimMission(+id);
        if (r) { U.sound('claim'); ui.toast('Nhiệm vụ hoàn thành! +' + r.coins + ' xu · +' + r.xp + ' XP', { icon: '✅', kind: 'reward' }); ui.bump('#coin-pill'); }
        render(); break;
      }
      case 'mreroll':
        TG.ads.rewarded().then(function (ok) { if (ok && E.rerollMission(+id)) { ui.toast('Đã đổi nhiệm vụ mới', { icon: '🎲' }); render(); } });
        break;
      case 'buy': TG.iap.buy(id).then(function (ok) { if (ok) { onPurchased(id); } render(); }); break;
      case 'restore': TG.parental.gate('để khôi phục giao dịch').then(function (ok) { if (ok) TG.iap.restore().then(function () { render(); }); }); break;
      case 'freecoins': {
        var T = S.today();
        if ((T.freeCoins || 0) >= CFG.ADS.freeCoinsPerDay) break;
        TG.ads.rewarded().then(function (ok) {
          if (!ok) return;
          T.freeCoins = (T.freeCoins || 0) + 1;
          var n = E.addCoins(25, false); S.save();
          ui.toast('+' + n + ' xu', { icon: '🎁', kind: 'reward' }); U.sound('coin'); render();
        });
        break;
      }
      case 'privacy': openDoc('privacy.html', 'Chính sách bảo mật'); break;
      case 'contact': TG.parental.openExternal('mailto:' + CFG.CONTACT_EMAIL + '?subject=' + encodeURIComponent(CFG.APP_NAME + ' ' + CFG.APP_VERSION)); break;
      case 'savename': saveName(); break;
      case 'avatar': S.state.profile.avatar = id; S.save(); render(); break;
      case 'wording': S.state.profile.wording = id; S.save(); render(); break;
      case 'sound': S.state.settings.sound = !S.state.settings.sound; S.save(); render(); break;
      case 'fx': setFx(id); render(); break;
      case 'limit': editLimit(); break;
      case 'breakrem':
        TG.parental.gate('để đổi cài đặt phụ huynh').then(function (ok) {
          if (ok) { S.state.parental.breakReminder = !S.state.parental.breakReminder; S.save(); render(); }
        });
        break;
      case 'reset':
        ui.confirm({ title: 'Xoá toàn bộ tiến trình?', icon: '⚠️', text: 'Cấp độ, xu, chuỗi điểm danh, nhiệm vụ và thành tựu sẽ bị xoá. Không thể hoàn tác.', ok: 'Xoá hết', danger: true })
          .then(function (ok) {
            if (!ok) return;
            var owned = S.state.owned, name = S.state.profile.name, ava = S.state.profile.avatar;
            S.reset();
            S.state.owned = owned; // giao dịch đã mua là của người dùng, giữ lại
            S.state.profile.name = name; S.state.profile.avatar = ava; S.state.profile.onboarded = true;
            S.save(); ui.toast('Đã xoá tiến trình', { icon: '🧹' }); go('home'); render();
          });
        break;
    }
  });

  function onPurchased(key) {
    if (key === 'vip_lifetime') { ui.confetti(); ui.toast('Chào mừng VIP! Đã mở mọi game và tắt quảng cáo', { icon: '👑', ms: 4000 }); }
    else if (key === 'remove_ads') ui.toast('Đã gỡ quảng cáo. Cảm ơn bạn!', { icon: '🚫' });
    else { ui.toast('+' + U.fmt(CFG.IAP.products[key].coins) + ' xu', { icon: '💰', kind: 'reward' }); ui.bump('#coin-pill'); }
  }

  function editLimit() {
    TG.parental.gate('để đổi cài đặt phụ huynh').then(function (ok) {
      if (!ok) return;
      var cur = S.state.parental.limitMin;
      var body = U.h('div.limit-opts');
      CFG.HEALTH.limitOptions.forEach(function (m) {
        var b = U.h('button.btn.' + (m === cur ? 'btn-primary' : 'btn-ghost'), { type: 'button', 'data-min': m, text: m ? m + ' phút' : 'Tắt' });
        b.addEventListener('click', function () {
          S.state.parental.limitMin = m; S.save(); md.close(); render();
          ui.toast(m ? 'Giới hạn ' + m + ' phút mỗi ngày' : 'Đã tắt giới hạn thời gian', { icon: '⏱️' });
        });
        body.appendChild(b);
      });
      var md = ui.modal({ title: 'Giới hạn mỗi ngày', icon: '⏱️', body: body, cls: 'limit-card' });
    });
  }

  /* ---------- Điểm danh ---------- */
  function doCheckin() {
    var r = E.claimCheckin();
    if (!r) return;
    U.sound('claim'); ui.bump('#coin-pill');
    ui.toast((r.froze ? 'Đã dùng băng giữ chuỗi! ' : '') + 'Điểm danh ngày ' + r.day + ': +' + r.coins + ' xu · chuỗi ' + r.streak + ' ngày', { icon: '📅', kind: 'reward' });
    if (r.day === 7) ui.confetti();
    render();
  }
  function doDouble() {
    TG.ads.rewarded().then(function (ok) {
      if (!ok) return;
      var n = E.doubleCheckin();
      if (n) { U.sound('coin'); ui.toast('Nhân đôi! +' + n + ' xu', { icon: '✨', kind: 'reward' }); ui.bump('#coin-pill'); }
      render();
    });
  }

  /* ---------- Mở game ---------- */
  function openGame(id, opts) {
    var g = C.get(id); if (!g) return;
    opts = opts || {};
    if (!opts.trial && !E.isUnlocked(g)) { unlockDialog(g); return; }
    if (TG.parental.overLimit()) {
      TG.parental.showLimit().then(function (more) { if (more) openGame(id, opts); });
      return;
    }
    ui.closeAll();
    TG.player.open(g, opts);
  }
  TG.openGame = openGame;

  function unlockDialog(g) {
    var L = E.level(), coins = S.state.coins, enough = coins >= g.price;
    var body = '<div class="unlock" style="--g:' + g.color + '"><div class="ul-art" aria-hidden="true">' + g.emoji + '</div><p class="ul-n">' + esc(g.name) + '</p><p class="muted small">' + esc(g.desc) + '</p>' +
      '<div class="ul-ways"><div class="ul-way"><span>🏅 Đạt cấp ' + g.reqLevel + '</span><span class="bar"><i style="width:' + Math.min(100, L / g.reqLevel * 100) + '%"></i></span><span class="muted small">Con đang ở cấp ' + L + '</span></div></div></div>';
    var m = ui.modal({
      title: 'Game đang khoá', body: body.replace('Con đang', TG.word('Con') + ' đang'), cls: 'unlock-card',
      actions: [
        { label: enough ? 'Mở khoá · ' + g.price + ' xu' : 'Cần ' + g.price + ' xu (thiếu ' + (g.price - coins) + ')', kind: 'primary', id: 'ul-coins', onClick: function () {
          if (!enough) { go('shop'); return; }
          if (E.buyUnlock(g.id)) {
            U.sound('claim'); ui.toast('Đã mở khoá ' + g.name + '!', { icon: '🔓', kind: 'reward' }); render();
            setTimeout(function () { openGame(g.id); }, 250);
          }
        } },
        { label: (S.isVip() ? '' : '📺 ') + 'Chơi thử 1 lần', kind: 'ad', id: 'ul-trial', onClick: function () {
          TG.ads.rewarded().then(function (ok) { if (ok) openGame(g.id, { trial: true }); });
        } },
        { label: '👑 VIP: mở mọi game', id: 'ul-vip', onClick: function () { go('shop'); } }
      ]
    });
    void m;
  }

  /* ---------- Trình xem tài liệu trong app (chính sách bảo mật) ---------- */
  var docOpen = false, ignoreNext = false;
  function openDoc(url, title) {
    var el = document.getElementById('doc');
    el.innerHTML = '<div class="doc-bar"><button type="button" class="btn btn-ghost btn-sm" id="doc-close">' + ui.icon('back') + 'Quay lại</button><b>' + esc(title) + '</b></div><iframe class="doc-frame" title="' + esc(title) + '" src="' + url + '"></iframe>';
    el.hidden = false; docOpen = true;
    document.documentElement.classList.add('doc-open');
    try { history.pushState({ tg: 'doc' }, '', '#doc'); } catch (e) {}
    document.getElementById('doc-close').addEventListener('click', function () { closeDoc(false); });
    setTimeout(function () { var b = document.getElementById('doc-close'); b && b.focus(); }, 50);
  }
  function closeDoc(fromPop) {
    if (!docOpen) return;
    docOpen = false;
    var el = document.getElementById('doc'); el.hidden = true; el.innerHTML = '';
    document.documentElement.classList.remove('doc-open');
    if (!fromPop && history.state && history.state.tg === 'doc') { ignoreNext = true; history.back(); }
  }

  /* ================= Ăn mừng & thông báo ================= */
  TG.bus.on('change', function () { if (!TG.player.isOpen() && !onboarding) scheduleRender(); });
  var rt = 0;
  function scheduleRender() { if (rt) return; rt = requestAnimationFrame(function () { rt = 0; render(); }); }
  TG.bus.on('levelup', function (d) {
    if (TG.player.isOpen()) { ui.toast('Lên cấp ' + d.level + '! +' + d.coins + ' xu', { icon: '🚀', kind: 'reward' }); celebrations.push(d); }
    else levelUpModal(d);
  });
  TG.bus.on('achievement', function (a) { ui.toast('Thành tựu: ' + a.name + ' · +' + a.coins + ' xu', { icon: a.icon, kind: 'ach', ms: 3800 }); U.sound('claim'); });
  TG.bus.on('mission', function (v) { ui.toast('Xong nhiệm vụ: ' + v.label + ' — về trang chủ nhận thưởng', { icon: '🎯', kind: 'reward', ms: 3600 }); });
  TG.bus.on('gameclosed', function () { render(); });
  // quyền lợi đến ngoài luồng bấm mua (giao dịch chờ thanh toán đã xong, mở lại app, khôi phục)
  TG.bus.on('purchase', function (d) { if (d && d.late) onPurchased(d.key); });
  TG.bus.on('afterclose', function () {
    var d = celebrations.splice(0);
    if (d.length) {
      var last = d[d.length - 1];
      levelUpModal({ level: last.level, coins: d.reduce(function (s, x) { return s + x.coins; }, 0), games: [].concat.apply([], d.map(function (x) { return x.games; })) });
    }
  });
  function levelUpModal(d) {
    U.sound('level'); ui.confetti();
    var games = d.games && d.games.length ? '<p class="lu-unl">Mở khoá mới:</p><div class="lu-games">' + d.games.map(function (g) { return '<span class="lu-g" style="--g:' + g.color + '">' + g.emoji + ' ' + esc(g.name) + '</span>'; }).join('') + '</div>' : '';
    ui.modal({
      title: 'Lên cấp ' + d.level + '!', cls: 'levelup',
      icon: '<div class="lu-badge"><span>' + d.level + '</span></div>',
      body: '<p>Giỏi quá! Phần thưởng <b class="gold">+' + d.coins + ' xu</b>.</p>' + games,
      actions: [{ label: 'Tuyệt vời!', kind: 'primary' }]
    });
  }

  /* ================= Onboarding ================= */
  var onboarding = false;
  var SLIDES = [
    { art: ['🕹️', '🧩', '♟️'], t: '28 game, 7 thể loại', d: 'Arcade, giải đố, cờ bài, hành động, chiến thuật, học vui và chơi chung — chơi được cả khi không có mạng.' },
    { art: ['📅', '🎯', '🏆'], t: 'Nhiệm vụ & phần thưởng', d: 'Điểm danh mỗi ngày, làm 3 nhiệm vụ để nhận xu, lên cấp để mở khoá game mới.' },
    { art: ['👀', '💧', '⏱️'], t: 'Chơi vui, khoẻ mạnh', d: 'Cứ 30 phút app nhắc nghỉ mắt 20 giây. Bố mẹ có thể đặt giới hạn thời gian chơi mỗi ngày.' }
  ];
  function startOnboarding() {
    onboarding = true; TG.ads.suspended = true;
    document.documentElement.classList.add('onboarding');
    var el = document.getElementById('onboard'); el.hidden = false;
    var step = 0, name = S.state.profile.name || 'Rio', ava = S.state.profile.avatar || 'cat';
    function draw() {
      var html;
      if (step === 0) {
        html = '<div class="ob-step ob-name"><img class="ob-logo" src="assets/logo.svg" alt="" width="96" height="96"><p class="eyebrow">Chào mừng đến</p><h1 class="ob-title">Tủ Game <span>28</span></h1>' +
          '<label class="ob-fld"><span>Con tên là gì nhỉ?</span><input id="ob-name" maxlength="16" autocomplete="off" enterkeyhint="next" value="' + esc(name) + '"></label>' +
          '<div class="ob-fld"><span>Chọn hình đại diện</span><div class="ava-grid">' + AVATARS.map(function (a) {
            return '<button type="button" class="ava-opt' + (a[0] === ava ? ' on' : '') + '" data-ob-ava="' + a[0] + '" aria-pressed="' + (a[0] === ava) + '" aria-label="' + a[1] + '"><img src="' + avatarSrc(a[0]) + '" alt="" width="56" height="56"></button>';
          }).join('') + '</div></div></div>';
      } else {
        var s = SLIDES[step - 1];
        html = '<div class="ob-step ob-slide"><div class="ob-art" aria-hidden="true">' + s.art.map(function (x, i) { return '<span class="oa oa' + i + '">' + x + '</span>'; }).join('') + '</div>' +
          '<h1 class="ob-h">' + esc(s.t) + '</h1><p class="ob-d">' + esc(s.d) + '</p></div>';
      }
      var dots = '<div class="ob-dots" aria-hidden="true">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i === step ? 'on' : '') + '"></i>'; }).join('') + '</div>';
      var nav = '<div class="ob-nav">' + (step > 0 && step < 3 ? '<button type="button" class="btn btn-ghost" id="ob-skip">Bỏ qua</button>' : step === 3 ? '<button type="button" class="btn btn-ghost" id="ob-prev">Quay lại</button>' : '<span></span>') +
        '<button type="button" class="btn btn-primary btn-glow" id="ob-next">' + (step === 0 ? 'Tiếp tục' : step === 3 ? 'Bắt đầu chơi!' : 'Tiếp') + '</button></div>';
      el.innerHTML = '<div class="ob-wrap">' + html + dots + nav + '</div>';
      var inp = document.getElementById('ob-name');
      if (inp) {
        inp.addEventListener('input', function () { name = inp.value; });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); next(); } });
      }
      el.querySelectorAll('[data-ob-ava]').forEach(function (b) {
        b.addEventListener('click', function () { ava = b.getAttribute('data-ob-ava'); U.sound('tap'); el.querySelectorAll('[data-ob-ava]').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); });
      });
      document.getElementById('ob-next').addEventListener('click', next);
      var sk = document.getElementById('ob-skip'); if (sk) sk.addEventListener('click', function () { step = 3; draw(); });
      var pv = document.getElementById('ob-prev'); if (pv) pv.addEventListener('click', function () { step--; draw(); });
      setTimeout(function () { var f = document.getElementById('ob-next'); if (f && step > 0) try { f.focus({ preventScroll: true }); } catch (e) {} }, 30);
    }
    function next() {
      U.sound('tap');
      if (step === 0) { S.state.profile.name = cleanName(name); S.state.profile.avatar = ava; S.save(); }
      if (step < 3) { step++; draw(); return; }
      finish();
    }
    function finish() {
      var p = S.state.profile; p.onboarded = true;
      S.state.createdAt = U.now();
      S.save();
      el.hidden = true; el.innerHTML = '';
      onboarding = false; TG.ads.suspended = false;
      TG.ads.sessionStart = U.now(); // 5 phút không quảng cáo tính từ lúc vào trang chủ
      document.documentElement.classList.remove('onboarding');
      E.addCoins(100, false);
      render(true);
      ui.toast(TG.greeting(), { icon: '💚', ms: 4500, kind: 'greet' });
      setTimeout(function () { ui.toast('Quà chào mừng: +100 xu', { icon: '🎁', kind: 'reward' }); }, 600);
    }
    draw();
  }

  /* ================= Nút Back (Android/Capacitor) ================= */
  function setupBack() {
    var App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!App || !App.addListener) return;
    App.addListener('backButton', function () {
      if (TG.ads._simOpen || TG.ads.isBusy()) return;
      if (ui.modalOpen()) { ui.closeTop(); return; }
      if (TG.player.isOpen()) { TG.player.close('hardware'); return; }
      if (docOpen) { closeDoc(false); return; }
      if (onboarding) { App.minimizeApp ? App.minimizeApp() : App.exitApp(); return; }
      if (screen !== 'home') { go('home'); return; }
      App.exitApp();
    });
    App.addListener('appStateChange', function (st) { if (!st.isActive) S.save(); });
  }

  /* ================= Service worker ================= */
  function setupSW() {
    if (isNative() || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('SW', e && e.message); });
    });
  }

  /* ================= Móc kiểm thử ================= */
  window.__hub = {
    get state() { return S.state; },
    store: S, econ: E, ads: TG.ads, iap: TG.iap, player: TG.player, parental: TG.parental, catalog: C,
    timeTravel: function (ms) { U.offset += ms; render(); return U.offset; },
    setAdSeconds: function (n) { CFG.ADS.simSeconds = n; },
    triggerBreak: function () { TG.parental._setCont(CFG.HEALTH.breakEveryMin * 60 - 1); },
    skipBreak: function () { TG.parental._skipBreak && TG.parental._skipBreak(); },
    gateAnswer: function () { return TG.parental._answer; },
    openGame: openGame, go: go, render: render,
    get screen() { return screen; }
  };

  /* ================= Khởi động ================= */
  function boot() {
    view = document.getElementById('view');
    document.documentElement.setAttribute('data-fx', S.state.settings.fx);
    if (isNative()) document.documentElement.classList.add('native');
    E.syncLevelUnlocks();
    E.ensureMissions(); E.refreshMissions(false);
    try { history.replaceState({ tg: 'screen', s: 'home' }, '', location.pathname + location.search); } catch (e) {}
    render(true);
    setupBack(); setupSW();
    TG.ads.init(); TG.iap.init();
    TG.bus.on('prices', function () { if (screen === 'shop') render(); });
    if (!S.state.profile.onboarded) startOnboarding();
    else setTimeout(function () { ui.toast(TG.greeting(), { icon: '💚', ms: 4000, kind: 'greet' }); }, 400);
    // ngày mới khi app vẫn mở: làm mới nhiệm vụ/điểm danh
    var day = U.dayKey();
    setInterval(function () { if (U.dayKey() !== day) { day = U.dayKey(); E.ensureMissions(); render(); } }, 30000);
    document.documentElement.classList.add('ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

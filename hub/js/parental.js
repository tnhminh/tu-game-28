/* Sức khoẻ & phụ huynh: cổng phụ huynh (phép nhân), nhắc nghỉ mắt 30 phút, giới hạn thời gian/ngày. */
(function () {
  'use strict';
  var TG = window.TG, U = TG.util, S = TG.store, H = TG.CONFIG.HEALTH, h = U.h;
  var P = TG.parental = {};

  /* ---------- Cổng phụ huynh ---------- */
  /** Hỏi một phép nhân. Promise<boolean>. reason: "để mua hàng", "để mở liên kết"... */
  P.gate = function (reason) {
    return new Promise(function (resolve) {
      var tries = 0, done = false, a, b;
      var q = h('p.gate-q');
      var input = h('input.gate-input', { type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', maxlength: '3', 'aria-label': 'Kết quả phép nhân' });
      var err = h('p.gate-err', { 'aria-live': 'polite' });
      function next() {
        a = 3 + Math.floor(Math.random() * 7); b = 4 + Math.floor(Math.random() * 6);
        P._answer = a * b;
        q.innerHTML = 'Nhập kết quả <b>' + a + ' × ' + b + '</b>';
        input.value = '';
      }
      next();
      var body = h('div.gate', null,
        h('p.muted', { text: 'Phần này dành cho phụ huynh' + (reason ? ' (' + reason + ')' : '') + '.' }),
        q, input, err);
      var m = TG.ui.modal({
        title: 'Hỏi bố mẹ nhé!', icon: '👨‍👩‍👧', body: body, cls: 'gate-card',
        actions: [
          { label: 'Huỷ', onClick: function () { done = true; resolve(false); } },
          { label: 'Xác nhận', kind: 'primary', id: 'gate-ok', keep: true, onClick: check }
        ],
        onClose: function () { if (!done) resolve(false); }
      });
      function check() {
        if (parseInt(input.value, 10) === a * b) { done = true; m.close('ok'); resolve(true); return; }
        tries++; U.sound('error');
        body.classList.remove('shake'); void body.offsetWidth; body.classList.add('shake');
        if (tries >= 3) { done = true; m.close('fail'); TG.ui.toast('Chưa đúng — hãy nhờ bố mẹ giúp nhé', { icon: '🔒' }); resolve(false); return; }
        err.textContent = 'Chưa đúng, thử phép tính khác nhé.';
        next(); input.focus();
      }
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    });
  };

  /** Mở liên kết ra ngoài app — luôn qua cổng phụ huynh. */
  P.openExternal = function (url) {
    return P.gate('để mở liên kết bên ngoài').then(function (ok) {
      if (!ok) return;
      try {
        var B = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
        if (B && /^https?:/.test(url)) B.open({ url: url }); else window.open(url, '_blank', 'noopener');
      } catch (e) { location.href = url; }
    });
  };

  /* ---------- Thời gian chơi ---------- */
  var cont = 0, lastTick = 0, breakOpen = false;
  P.limitSec = function () {
    var p = S.state.parental;
    if (!p.limitMin) return 0;
    var extra = p.extraToday && p.extraToday.day === U.dayKey() ? p.extraToday.min : 0;
    return (p.limitMin + extra) * 60;
  };
  P.overLimit = function () { var L = P.limitSec(); return L > 0 && S.today().playSec >= L; };
  P.remainingSec = function () { var L = P.limitSec(); return L ? Math.max(0, L - S.today().playSec) : Infinity; };
  P.breakOpen = function () { return breakOpen; };
  P.continuous = function () { return cont; };
  P._setCont = function (n) { cont = n; lastTick = U.now(); };

  /** Gọi mỗi giây trong lúc chơi. Trả về 'break' | 'limit' | null. */
  P.tick = function () {
    var now = U.now();
    if (lastTick && now - lastTick > H.continuityGapMin * 60000) cont = 0;
    lastTick = now;
    cont++;
    if (P.overLimit()) return 'limit';
    if (S.state.parental.breakReminder && cont >= H.breakEveryMin * 60 && !breakOpen) return 'break';
    return null;
  };
  /** Khi rời game: giữ bộ đếm liên tục, nếu quay lại trong 5 phút thì cộng tiếp. */
  P.paused = function () { lastTick = U.now(); };

  /** Hiện nhắc nghỉ mắt 20 giây. Promise<'continue'|'home'>. */
  P.showBreak = function () {
    if (breakOpen) return Promise.resolve('continue');
    breakOpen = true;
    return new Promise(function (resolve) {
      var secs = H.breakSeconds, left = secs;
      var num = h('b.break-num', { text: String(left) });
      var ring = h('div.break-ring', { html: '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" class="trk"/><circle cx="50" cy="50" r="44" class="val" pathLength="100"/></svg>' }, num);
      var body = h('div.break', null, ring,
        h('p', { text: TG.word('Con') + ' đã chơi ' + H.breakEveryMin + ' phút rồi. Nhìn ra xa (khoảng 6 mét) trong 20 giây, chớp mắt vài lần và uống ngụm nước nhé!' }));
      var m = P._breakModal = TG.ui.modal({
        title: 'Nghỉ mắt 20 giây nhé', icon: '👀', body: body, closable: false, cls: 'break-card',
        actions: [
          { label: 'Về trang chính', id: 'break-home', onClick: function () { fin('home'); } },
          { label: 'Chơi tiếp', kind: 'primary', id: 'break-go', onClick: function () { fin('continue'); } }
        ]
      });
      var btns = m.el.querySelectorAll('.modal-actions .btn');
      btns.forEach(function (b) { b.disabled = true; });
      var t0 = performance.now();
      ring.querySelector('.val').style.animationDuration = secs + 's';
      var iv = setInterval(function () {
        left = Math.max(0, secs - Math.floor((performance.now() - t0) / 1000));
        num.textContent = String(left);
        if (left <= 0) {
          clearInterval(iv); num.textContent = '✓'; ring.classList.add('done');
          btns.forEach(function (b) { b.disabled = false; }); btns[1].focus();
        }
      }, 250);
      P._skipBreak = function () { t0 = -1e9; };
      P._endBreak = function () { if (breakOpen) { fin('home'); m.close('force'); } };
      function fin(r) {
        clearInterval(iv); breakOpen = false; cont = 0; P._endBreak = null;
        S.state.stats.breaksTaken++; S.save(); TG.econ.checkAch();
        resolve(r);
      }
    });
  };

  /** Hộp thoại hết giờ chơi. Promise<boolean> (true = phụ huynh cho thêm thời gian). */
  P.showLimit = function () {
    return new Promise(function (resolve) {
      var done = false;
      TG.ui.modal({
        title: 'Hết giờ chơi hôm nay rồi', icon: '🌙',
        body: '<p>Hôm nay ' + TG.word('con') + ' đã chơi đủ ' + U.minutes(S.today().playSec) + ' theo giới hạn bố mẹ đặt. Mai mình chơi tiếp nhé!</p>',
        actions: [
          { label: 'Phụ huynh: thêm 15 phút', onClick: function () {
            done = true;
            P.gate('để thêm thời gian chơi').then(function (ok) {
              if (ok) {
                var p = S.state.parental, d = U.dayKey();
                if (p.extraToday.day !== d) p.extraToday = { day: d, min: 0 };
                p.extraToday.min += 15; S.save();
                TG.ui.toast('Đã thêm 15 phút cho hôm nay', { icon: '⏱️' });
              }
              resolve(ok);
            });
          } },
          { label: 'Đồng ý', kind: 'primary', onClick: function () { done = true; resolve(false); } }
        ],
        onClose: function () { if (!done) resolve(false); }
      });
    });
  };
})();

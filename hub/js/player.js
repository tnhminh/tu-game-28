/* Trình chơi game: iframe toàn màn hình, nhận sự kiện ghEmit và {tg28:'close'},
 * đếm thời gian chơi mỗi game mỗi ngày, nhắc nghỉ mắt / giới hạn giờ, interstitial khi đóng. */
(function () {
  'use strict';
  var TG = window.TG, U = TG.util, S = TG.store, E = TG.econ, P = TG.parental, h = U.h;

  var cur = null; // {game, frame, iv, trial, openedAt}
  var ignorePop = false;
  var player = TG.player = {
    current: function () { return cur ? cur.game.id : null; },
    isOpen: function () { return !!cur; }
  };

  player.open = function (game, opts) {
    opts = opts || {};
    if (cur) player.close('switch', true);
    var root = document.getElementById('player');
    var frame = h('iframe.game-frame', {
      src: game.url, title: game.name, allow: 'autoplay; fullscreen; gamepad',
      referrerpolicy: 'same-origin'
    });
    var loader = h('div.player-loading', { 'aria-hidden': 'true' },
      h('div.pl-emoji', { text: game.emoji }), h('div.pl-name', { text: game.name }), h('div.pl-spin'));
    U.clear(root).appendChild(loader);
    root.appendChild(frame);
    root.style.setProperty('--g', game.color);
    root.hidden = false;
    document.documentElement.classList.add('playing');
    frame.addEventListener('load', function () {
      loader.classList.add('gone'); setTimeout(function () { loader.remove(); }, 400);
      try { frame.focus(); frame.contentWindow.focus(); } catch (e) {}
    });
    cur = { game: game, frame: frame, trial: !!opts.trial, openedAt: U.now(), iv: 0 };
    try { history.pushState({ tg: 'game', id: game.id }, '', '#play/' + game.id); } catch (e) {}

    // gần đây
    var r = S.state.recent.filter(function (x) { return x !== game.id; });
    r.unshift(game.id); S.state.recent = r.slice(0, 8); S.saveSoon();

    U.sound('open');
    setTimeout(function () { if (cur && cur.game === game) TG.ui.toast(TG.greeting(), { icon: '💚', ms: 4500, kind: 'greet' }); }, 700);
    if (opts.trial) setTimeout(function () { if (cur && cur.game === game) TG.ui.toast('Chơi thử 1 lần — mở khoá để chơi mãi nhé', { icon: '🎟️' }); }, 2200);

    cur.iv = setInterval(tick, 1000);
  };

  function tick() {
    if (!cur || document.hidden || P.breakOpen() || TG.ads._simOpen) return;
    E.tickPlay(cur.game.id);
    var r = P.tick();
    if (r === 'break') {
      P.showBreak().then(function (choice) { if (choice === 'home' && cur) player.close('break'); });
    } else if (r === 'limit') {
      player.close('limit');
      P.showLimit();
    }
  }

  /** reason: 'link' | 'back' | 'hardware' | 'break' | 'limit' | 'switch'. fromPop=true khi đã do popstate. */
  player.close = function (reason, fromPop) {
    if (!cur) return Promise.resolve(false);
    var c = cur; cur = null;
    clearInterval(c.iv);
    if (P._endBreak) P._endBreak();
    var root = document.getElementById('player');
    U.clear(root); root.hidden = true;
    document.documentElement.classList.remove('playing');
    P.paused();
    S.save();
    if (!fromPop && history.state && history.state.tg === 'game') { ignorePop = true; history.back(); }
    TG.bus.emit('gameclosed', { id: c.game.id, reason: reason });
    if (reason === 'switch' || reason === 'limit') return Promise.resolve(false);
    return TG.ads.maybeInterstitial().then(function (shown) {
      TG.bus.emit('afterclose', { id: c.game.id, adShown: shown });
      return shown;
    });
  };

  /** popstate: trả về true nếu đã xử lý (đóng game). */
  player.onPop = function () {
    if (ignorePop) { ignorePop = false; return true; }
    if (cur) { player.close('back', true); return true; }
    return false;
  };

  window.addEventListener('message', function (e) {
    if (!cur || e.source !== cur.frame.contentWindow) return;
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.tg28 === 'close') { player.close('link'); return; }
    if (d.gh !== 1) return;
    var res = E.onGameEvent(cur.game.id, d);
    if (res && (res.xp || res.coins)) {
      var t = (res.best ? 'Kỷ lục mới! ' : res.win ? 'Thắng rồi! ' : '') + '+' + res.xp + ' XP · +' + res.coins + ' xu';
      TG.ui.toast(t, { icon: res.best ? '🌟' : res.win ? '🏆' : res.milestone ? '🪜' : '✨', ms: 2400, kind: 'reward' });
      U.sound('coin');
    }
  });
})();

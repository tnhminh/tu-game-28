/* Lớp giao diện dùng chung: toast, hộp thoại (thay cho alert/confirm), pháo giấy ăn mừng. */
(function () {
  'use strict';
  var TG = window.TG, U = TG.util, h = U.h;
  var ui = TG.ui = {};

  ui.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- Toast ---------- */
  var queue = [], showing = 0, MAX = 2;
  ui.toast = function (text, opt) {
    opt = opt || {};
    queue.push({ text: text, icon: opt.icon || '', kind: opt.kind || '', ms: opt.ms || 3200 });
    // không để toast dồn lâu: bỏ bớt toast phần thưởng cũ nhất khi hàng đợi dài
    while (queue.length > 2) {
      var i = queue.findIndex(function (q) { return q.kind === 'reward'; });
      queue.splice(i >= 0 && i < queue.length - 1 ? i : 0, 1);
    }
    pump();
  };
  function pump() {
    var box = document.getElementById('toasts');
    if (!box) return;
    while (showing < MAX && queue.length) {
      var t = queue.shift(); showing++;
      var el = h('div.toast' + (t.kind ? '.t-' + t.kind : ''), { role: 'status' },
        t.icon ? h('span.toast-ico', { 'aria-hidden': 'true', text: t.icon }) : null,
        h('span.toast-text', { text: t.text }));
      box.appendChild(el);
      requestAnimationFrame(function (e) { return function () { requestAnimationFrame(function () { e.classList.add('show'); }); }; }(el));
      setTimeout(function (e) {
        return function () {
          e.classList.remove('show'); e.classList.add('hide');
          setTimeout(function () { e.remove(); showing--; pump(); }, 320);
        };
      }(el), t.ms);
    }
  }

  /* ---------- Hộp thoại ---------- */
  var stack = [];
  ui.modalOpen = function () { return stack.length > 0; };
  /**
   * ui.modal({title, icon, body: Node|string(html), actions:[{label, kind, onClick(close) , keep}], closable, cls, onClose})
   */
  ui.modal = function (o) {
    var layer = document.getElementById('modals');
    var prevFocus = document.activeElement;
    var card = h('div.modal-card' + (o.cls ? '.' + o.cls : ''), { role: 'dialog', 'aria-modal': 'true', tabindex: '-1' });
    var back = h('div.modal-back', null, card);
    var m = { el: card, closed: false, closable: o.closable !== false };
    if (o.icon) card.appendChild(h('div.modal-icon', { 'aria-hidden': 'true', html: o.icon }));
    if (o.title) {
      var tid = 'mt' + Math.random().toString(36).slice(2, 8);
      card.setAttribute('aria-labelledby', tid);
      card.appendChild(h('h2.modal-title#' + tid, { text: o.title }));
    }
    if (o.body) {
      var b = h('div.modal-body');
      if (typeof o.body === 'string') b.innerHTML = o.body; else b.appendChild(o.body);
      card.appendChild(b);
    }
    if (o.actions && o.actions.length) {
      var row = h('div.modal-actions');
      o.actions.forEach(function (a) {
        var btn = h('button.btn' + (a.kind ? '.btn-' + a.kind : '.btn-ghost'), { type: 'button', text: a.label });
        if (a.id) btn.id = a.id;
        btn.addEventListener('click', function () {
          U.sound('tap');
          var r = a.onClick ? a.onClick(m) : undefined;
          if (!a.keep && r !== false) m.close('action');
        });
        row.appendChild(btn); a.el = btn;
      });
      card.appendChild(row);
    }
    if (m.closable) {
      var x = h('button.modal-x', { type: 'button', 'aria-label': 'Đóng', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' });
      x.addEventListener('click', function () { m.close('x'); });
      card.appendChild(x);
      back.addEventListener('click', function (e) { if (e.target === back) m.close('backdrop'); });
    }
    m.close = function (why) {
      if (m.closed) return; m.closed = true;
      var i = stack.indexOf(m); if (i >= 0) stack.splice(i, 1);
      back.classList.remove('show');
      setTimeout(function () { back.remove(); }, U.reducedMotion() ? 0 : 220);
      if (o.onClose) o.onClose(why || 'close');
      try { if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus(); } catch (e) {}
    };
    layer.appendChild(back);
    stack.push(m);
    requestAnimationFrame(function () { back.classList.add('show'); });
    setTimeout(function () {
      var f = card.querySelector('input,[data-autofocus]') || card.querySelector('.btn-primary') || card;
      try { f.focus({ preventScroll: true }); } catch (e) {}
    }, 30);
    return m;
  };
  /** Đóng hộp thoại trên cùng (nút Back Android / Esc). Trả về true nếu đã xử lý. */
  ui.closeTop = function () {
    var m = stack[stack.length - 1];
    if (!m) return false;
    if (m.closable) m.close('back');
    return true; // hộp thoại không đóng được (QC) vẫn "nuốt" phím back
  };
  ui.closeAll = function () { stack.slice().forEach(function (m) { if (m.closable) m.close('all'); }); };
  ui.confirm = function (o) {
    return new Promise(function (res) {
      var done = false;
      ui.modal({
        title: o.title, icon: o.icon, body: o.text ? '<p>' + ui.esc(o.text) + '</p>' : o.body,
        actions: [
          { label: o.cancel || 'Huỷ', kind: 'ghost', onClick: function () { done = true; res(false); } },
          { label: o.ok || 'Đồng ý', kind: o.danger ? 'danger' : 'primary', onClick: function () { done = true; res(true); } }
        ],
        onClose: function () { if (!done) res(false); }
      });
    });
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && stack.length) { e.preventDefault(); ui.closeTop(); }
    // giữ tiêu điểm bàn phím trong hộp thoại
    if (e.key === 'Tab' && stack.length) {
      var card = stack[stack.length - 1].el;
      var f = card.querySelectorAll('button:not([disabled]),input,select,a[href],[tabindex="0"]');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!card.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Pháo giấy ---------- */
  ui.confetti = function () {
    if (U.reducedMotion() || TG.store.state.settings.fx === 'low') return;
    var cv = h('canvas.confetti', { 'aria-hidden': 'true' });
    document.body.appendChild(cv);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    var c = cv.getContext('2d');
    var cols = ['#ffd84a', '#ff5d8f', '#4ad8ff', '#7dff8a', '#c28bff', '#ff9a4a'];
    var P = [];
    for (var i = 0; i < 140; i++) P.push({
      x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 16 * dpr, vy: (-Math.random() * 14 - 4) * dpr,
      s: (4 + Math.random() * 6) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[i % cols.length]
    });
    var t0 = performance.now();
    (function f(t) {
      c.clearRect(0, 0, W, H);
      P.forEach(function (p) {
        p.vy += .35 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.c; c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); c.restore();
      });
      if (t - t0 < 2600) requestAnimationFrame(f); else cv.remove();
    })(t0);
  };

  /** Hiệu ứng "bay số" nhỏ khi nhận xu. */
  ui.bump = function (sel) {
    var el = document.querySelector(sel);
    if (!el || U.reducedMotion()) return;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  };

  ui.coinSvg = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-coin"/></svg>';
  ui.icon = function (name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; };
})();

/* Tiện ích chung: ngày, số ngẫu nhiên theo hạt giống, DOM, âm thanh giao diện. */
(function () {
  'use strict';
  var TG = window.TG;
  var U = TG.util = {};

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** Khoá ngày theo giờ địa phương: YYYY-MM-DD. */
  U.dayKey = function (d) {
    d = d || new Date(U.now());
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  U.parseDay = function (k) {
    var p = String(k).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  };
  /** Số ngày giữa hai khoá ngày (b - a). */
  U.dayDiff = function (a, b) {
    return Math.round((U.parseDay(b) - U.parseDay(a)) / 86400000);
  };
  U.addDays = function (k, n) {
    var d = U.parseDay(k); d.setDate(d.getDate() + n); return U.dayKey(d);
  };
  /** Khoá tuần ISO: YYYY-Www (tuần bắt đầu thứ Hai). */
  U.weekKey = function (k) {
    var d = U.parseDay(k || U.dayKey());
    var day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day + 3);
    var firstThu = new Date(d.getFullYear(), 0, 4);
    var w = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
    return d.getFullYear() + '-W' + pad(w);
  };
  // Đồng hồ có thể "tua" khi kiểm thử (window.__hub.timeTravel)
  U.offset = 0;
  U.now = function () { return Date.now() + U.offset; };

  /** Băm chuỗi → số nguyên 32-bit (FNV-1a). */
  U.hash = function (s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  /** Bộ sinh số ngẫu nhiên mulberry32 theo hạt giống. */
  U.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.fmt = function (n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  U.minutes = function (sec) {
    var m = Math.floor(sec / 60);
    if (m < 60) return m + ' phút';
    return Math.floor(m / 60) + ' giờ ' + (m % 60 ? (m % 60) + ' phút' : '');
  };

  /** Tạo phần tử: h('div.cls#id', {attrs}, children...) */
  U.h = function (sel, attrs) {
    var m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    var el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) m[2].replace(/([.#])([\w-]+)/g, function (_, t, v) {
      if (t === '.') el.classList.add(v); else el.id = v;
    });
    var start = 1;
    if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
      start = 2;
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (var i = start; i < arguments.length; i++) U.append(el, arguments[i]);
    return el;
  };
  U.append = function (el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { U.append(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  U.$ = function (s, r) { return (r || document).querySelector(s); };
  U.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  U.reducedMotion = function () {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  };

  /* ---- Âm thanh giao diện (WebAudio, không cần file) ---- */
  var actx = null;
  function ctx() {
    if (!actx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { actx = new C(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
    return actx;
  }
  var SOUNDS = {
    tap: [[660, 0.04, 'sine', 0.05]],
    open: [[523, 0.06, 'triangle', 0.07], [784, 0.08, 'triangle', 0.06]],
    coin: [[988, 0.06, 'square', 0.035], [1319, 0.12, 'square', 0.035]],
    claim: [[523, 0.07, 'triangle', 0.08], [659, 0.07, 'triangle', 0.08], [784, 0.14, 'triangle', 0.08]],
    level: [[523, 0.1, 'triangle', 0.09], [659, 0.1, 'triangle', 0.09], [784, 0.1, 'triangle', 0.09], [1047, 0.3, 'triangle', 0.09]],
    error: [[220, 0.12, 'sawtooth', 0.04]]
  };
  U.sound = function (name) {
    if (!TG.store || !TG.store.state.settings.sound) return;
    var c = ctx(); if (!c) return;
    var t = c.currentTime;
    (SOUNDS[name] || SOUNDS.tap).forEach(function (n) {
      try {
        var o = c.createOscillator(), g = c.createGain();
        o.type = n[2]; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(n[3], t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + n[1]);
        o.connect(g); g.connect(c.destination);
        o.start(t); o.stop(t + n[1] + 0.02);
        t += n[1] * 0.85;
      } catch (e) {}
    });
  };
  U.vibrate = function (ms) {
    try {
      var H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
      if (H && H.impact) { H.impact({ style: 'LIGHT' }); return; }
      if (navigator.vibrate) navigator.vibrate(ms || 12);
    } catch (e) {}
  };
})();

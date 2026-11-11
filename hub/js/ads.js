/* Quảng cáo — lớp nhà cung cấp (provider interface):
 *   provider = { name, init(): Promise, showInterstitial(): Promise<boolean>,
 *                showRewarded(): Promise<boolean> (true = đã nhận thưởng; reject = không có QC / lỗi hiển thị) }
 * - Native: @capacitor-community/admob (window.Capacitor.Plugins.AdMob) — luôn không cá nhân hoá (npa),
 *   tagForChildDirectedTreatment + tagForUnderAgeOfConsent, nội dung tối đa 'General'.
 * - Web/dev: lớp phủ giả lập "Quảng cáo thử nghiệm" có đếm ngược.
 * Quy tắc (TG.ads.maybeInterstitial): chỉ khi đóng game, sau mỗi 3 ván hoàn thành, cách nhau ≥3 phút,
 * không trong 5 phút đầu phiên, không bao giờ cho VIP / đã mua gỡ quảng cáo, không trong onboarding. */
(function () {
  'use strict';
  var TG = window.TG, U = TG.util, S = TG.store, CFG = TG.CONFIG.ADS, h = U.h;

  function platform() {
    try { return (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || 'web'; } catch (e) { return 'web'; }
  }

  /* ---------- Provider: AdMob (native) ----------
   * Theo đúng API @capacitor-community/admob 8.x (đã đối chiếu mã Android của plugin):
   *  - initialize() một lần, cấu hình trẻ em (tagForChildDirectedTreatment / tagForUnderAgeOfConsent /
   *    maxAdContentRating) chỉ có tác dụng ở initialize (RequestConfiguration toàn cục);
   *    npa:true đặt ở từng yêu cầu prepare*.
   *  - prepare*() resolve {adUnitId} khi tải xong, reject (code = mã lỗi dạng chuỗi, vd. '3' = no fill)
   *    và phát *FailedToLoad khi lỗi.
   *  - showInterstitial() resolve NGAY sau khi gọi show (không phải lúc đóng) → chờ sự kiện
   *    interstitialAdDismissed / interstitialAdFailedToShow.
   *  - showRewardVideoAd() CHỈ resolve khi người xem nhận thưởng (cùng lúc với onRewardedVideoAdReward);
   *    nếu đóng sớm hoặc lỗi hiển thị thì promise không bao giờ resolve → không được chờ nó.
   *  - Mỗi quảng cáo chỉ hiện được một lần; phải prepare lại sau khi đóng / lỗi. */
  var LOAD_TIMEOUT_MS = 12000;          // chờ tải QC có thưởng khi người chơi bấm
  var REWARD_GRACE_MS = 1000;           // một số mạng phát Reward ngay sau Dismissed
  var RETRY_MIN_MS = 30000, RETRY_MAX_MS = 10 * 60000; // tải lại nền khi no-fill (lùi dần)
  function admobProvider(A) {
    var units = CFG.units[platform() === 'ios' ? 'ios' : 'android'];
    function reqOpts(id) { return { adId: id, isTesting: !!CFG.testing, npa: true, immersiveMode: true }; }
    function off(h) { Promise.resolve(h).then(function (x) { x && x.remove && x.remove(); }, function () {}); }
    function delay(ms, v) { return new Promise(function (r) { setTimeout(function () { r(v); }, ms); }); }
    var slot = {
      interstitial: { fn: 'prepareInterstitial', unit: units.interstitial, ready: false, loading: null, fails: 0, retry: 0 },
      rewarded: { fn: 'prepareRewardVideoAd', unit: units.rewarded, ready: false, loading: null, fails: 0, retry: 0 }
    };
    var inited = null;
    function init() {
      if (!inited) {
        inited = Promise.resolve().then(function () {
          return A.initialize({
            initializeForTesting: !!CFG.testing,
            tagForChildDirectedTreatment: true,
            tagForUnderAgeOfConsent: true,
            maxAdContentRating: 'General'
          });
        });
        inited.catch(function () { inited = null; }); // lần sau thử initialize lại
      }
      return inited;
    }
    /** Tải một quảng cáo. Promise<boolean> (không bao giờ reject). */
    function prep(kind) {
      var s = slot[kind];
      if (s.ready) return Promise.resolve(true);
      if (s.loading) return s.loading;
      // Đã mua gỡ QC / VIP: không xin interstitial; VIP nhận thưởng không cần xem → không xin rewarded.
      if (kind === 'interstitial' ? S.adsRemoved() : S.isVip()) return Promise.resolve(false);
      clearTimeout(s.retry); s.retry = 0;
      s.loading = init().then(function () { return A[s.fn](reqOpts(s.unit)); }).then(function () {
        s.ready = true; s.loading = null; s.fails = 0; return true;
      }, function (e) {
        s.ready = false; s.loading = null; s.fails++;
        ads.lastError = { kind: kind, code: e && e.code, message: e && e.message };
        // no-fill / lỗi mạng: thử lại sau, giãn dần (không dồn yêu cầu liên tục)
        var wait = Math.min(RETRY_MAX_MS, RETRY_MIN_MS * Math.pow(2, s.fails - 1));
        s.retry = setTimeout(function () { s.retry = 0; prep(kind); }, wait);
        return false;
      });
      return s.loading;
    }
    /** Đăng ký các listener trước khi show. Trả về {ready: Promise, remove()} */
    function listen(map) {
      var hs = Object.keys(map).map(function (n) { return A.addListener(n, map[n]); });
      return {
        ready: Promise.all(hs.map(function (h) { return Promise.resolve(h).catch(function () {}); })),
        remove: function () { hs.forEach(off); }
      };
    }
    return {
      name: 'admob',
      init: function () {
        return init().then(function () { prep('interstitial'); prep('rewarded'); });
      },
      _slot: slot,
      showInterstitial: function () {
        var s = slot.interstitial;
        // Chưa có QC sẵn: không bắt người chơi chờ tải — bỏ lượt này, tải nền cho lần sau.
        if (!s.ready) { prep('interstitial'); return Promise.resolve(false); }
        s.ready = false;
        return new Promise(function (res) {
          var done = false, tm = 0;
          function fin(shown) {
            if (done) return; done = true; clearTimeout(tm); L.remove();
            prep('interstitial'); // QC đã dùng → tải cái mới
            res(shown);
          }
          var L = listen({
            interstitialAdDismissed: function () { fin(true); },
            interstitialAdFailedToShow: function () { fin(false); }
          });
          tm = setTimeout(function () { fin(false); }, 120000);
          L.ready.then(function () { return A.showInterstitial(); }).catch(function () { fin(false); });
        });
      },
      /** Promise<boolean>: true = đã nhận thưởng, false = đóng sớm. Reject khi không có QC (no-fill/lỗi). */
      showRewarded: function () {
        var s = slot.rewarded;
        var load = s.ready ? Promise.resolve(true)
          : Promise.race([prep('rewarded'), delay(LOAD_TIMEOUT_MS, false)]);
        return load.then(function (ok) {
          if (!ok || !s.ready) { var e = new Error('no-fill'); e.code = 'no-fill'; throw e; }
          s.ready = false;
          return new Promise(function (res, rej) {
            var done = false, rewarded = false, tm = 0, grace = 0;
            function fin(err) {
              if (done) return; done = true; clearTimeout(tm); clearTimeout(grace); L.remove();
              prep('rewarded');
              if (err && !rewarded) rej(err); else res(rewarded);
            }
            var L = listen({
              onRewardedVideoAdReward: function (item) {
                rewarded = true;
                ads.lastReward = item || null;
                if (grace) fin(); // thưởng đến sau khi đã đóng
              },
              onRewardedVideoAdDismissed: function () {
                if (rewarded) fin(); else grace = setTimeout(function () { fin(); }, REWARD_GRACE_MS);
              },
              onRewardedVideoAdFailedToShow: function (err) {
                var e = new Error((err && err.message) || 'failed-to-show'); e.code = 'failed-to-show'; fin(e);
              }
            });
            tm = setTimeout(function () { fin(); }, 300000);
            L.ready.then(function () {
              // Promise chỉ resolve khi nhận thưởng (cùng callback với sự kiện Reward) — không chờ nó.
              A.showRewardVideoAd().then(function (item) {
                if (item && typeof item.amount === 'number') { rewarded = true; ads.lastReward = item; }
              }, function (err) { var e = new Error((err && err.message) || 'show-failed'); e.code = 'show-failed'; fin(e); });
            });
          });
        });
      }
    };
  }

  /* ---------- Provider: không có quảng cáo (native nhưng thiếu plugin / lỗi) ---------- */
  function noneProvider() {
    return {
      name: 'none',
      init: function () { return Promise.resolve(); },
      showInterstitial: function () { return Promise.resolve(false); },
      showRewarded: function () { var e = new Error('unavailable'); e.code = 'unavailable'; return Promise.reject(e); }
    };
  }

  /* ---------- Provider: giả lập (web/dev) ---------- */
  function simProvider() {
    function overlay(kind) {
      return new Promise(function (res) {
        var secs = Math.max(0, CFG.simSeconds);
        var rewarded = kind === 'rewarded';
        var num = h('b.ad-count', { text: String(secs) });
        var closeBtn = h('button.btn.btn-ghost.ad-close', { type: 'button', disabled: true, text: rewarded ? 'Đóng (không nhận thưởng)' : 'Bỏ qua sau ' + secs + 's' });
        var getBtn = rewarded ? h('button.btn.btn-primary.ad-get', { type: 'button', disabled: true, text: 'Nhận thưởng' }) : null;
        if (rewarded) closeBtn.disabled = false;
        var bar = h('div.ad-bar', null, h('i'));
        var box = h('div.ad-sim', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Quảng cáo thử nghiệm' },
          h('div.ad-tag', { text: 'Quảng cáo thử nghiệm' }),
          h('div.ad-art', { 'aria-hidden': 'true', html: '<svg viewBox="0 0 120 120"><defs><linearGradient id="adg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#4ad8ff"/><stop offset="1" stop-color="#c28bff"/></linearGradient></defs><rect x="10" y="10" width="100" height="100" rx="28" fill="url(#adg)"/><path d="M48 40l34 20-34 20z" fill="#fff"/></svg>' }),
          h('p.ad-title', { text: rewarded ? 'Xem hết để nhận thưởng' : 'Quảng cáo' }),
          h('p.ad-note', { text: 'Đây là quảng cáo giả lập (chế độ thử). Bản trên cửa hàng dùng Google AdMob, không cá nhân hoá, nội dung phù hợp trẻ em.' }),
          h('div.ad-timer', null, num, h('span', { text: ' giây' })), bar,
          h('div.ad-actions', null, closeBtn, getBtn));
        var layer = h('div.ad-layer', null, box);
        document.body.appendChild(layer);
        TG.ads._simOpen = true;
        requestAnimationFrame(function () { layer.classList.add('show'); });
        var left = secs, start = performance.now();
        bar.firstChild.style.transitionDuration = secs + 's';
        requestAnimationFrame(function () { requestAnimationFrame(function () { bar.firstChild.style.width = '100%'; }); });
        function finish(ok) {
          clearInterval(iv); TG.ads._simOpen = false;
          layer.classList.remove('show'); setTimeout(function () { layer.remove(); }, 200);
          res(ok);
        }
        function tick() {
          left = Math.max(0, secs - Math.floor((performance.now() - start) / 1000));
          num.textContent = String(left);
          if (left <= 0) {
            clearInterval(iv);
            num.parentNode.classList.add('done');
            if (rewarded) { getBtn.disabled = false; getBtn.focus(); closeBtn.textContent = 'Đóng'; }
            else { closeBtn.disabled = false; closeBtn.textContent = 'Đóng quảng cáo'; closeBtn.focus(); }
          } else if (!rewarded) closeBtn.textContent = 'Bỏ qua sau ' + left + 's';
        }
        var iv = setInterval(tick, 200); tick();
        closeBtn.addEventListener('click', function () { finish(rewarded ? false : true); });
        if (getBtn) getBtn.addEventListener('click', function () { finish(true); });
      });
    }
    return {
      name: 'sim',
      init: function () { return Promise.resolve(); },
      showInterstitial: function () { return overlay('interstitial'); },
      showRewarded: function () { return overlay('rewarded'); }
    };
  }

  function isNative() { try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; } }
  var A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;
  // Bản native không bao giờ dùng QC giả lập (sẽ cho thưởng miễn phí / hiện "chế độ thử" trên store).
  var provider = A ? admobProvider(A) : isNative() ? noneProvider() : simProvider();
  var busy = false;

  var ads = TG.ads = {
    provider: provider,
    sessionStart: U.now(),
    suspended: false, // true trong onboarding
    init: function () {
      return provider.init().catch(function (e) {
        // Giữ provider AdMob — initialize() được thử lại ở lần tải QC sau (không chuyển sang giả lập).
        console.warn('Ads init failed', e && e.message);
      });
    },
    /** Lý do không được hiện interstitial (null = được phép). */
    interstitialBlock: function () {
      var s = S.state, now = U.now();
      if (S.adsRemoved()) return 'no-ads';
      if (ads.suspended || !s.profile.onboarded) return 'onboarding';
      if (now - ads.sessionStart < CFG.noAdsFirstMs) return 'session-start';
      if (s.ads.lastInterstitial && now - s.ads.lastInterstitial < CFG.interstitialMinGapMs) return 'gap';
      if (s.ads.roundsSince < CFG.interstitialEveryRounds) return 'rounds';
      if (busy) return 'busy';
      return null;
    },
    /** Gọi khi người chơi đóng game. Trả về Promise<boolean> (đã hiện QC hay chưa). */
    maybeInterstitial: function () {
      var why = ads.interstitialBlock();
      ads.lastDecision = why || 'shown';
      if (why) return Promise.resolve(false);
      busy = true;
      var s = S.state;
      return provider.showInterstitial().then(function (shown) {
        busy = false;
        if (shown !== false) { s.ads.lastInterstitial = U.now(); s.ads.roundsSince = 0; s.ads.shown++; S.save(); }
        return !!shown;
      }, function () { busy = false; return false; });
    },
    /** Quảng cáo có thưởng — luôn do người chơi chủ động bấm. VIP nhận thưởng ngay không cần xem. */
    rewarded: function () {
      if (S.isVip()) { TG.ui.toast('VIP: nhận thưởng ngay, không cần xem quảng cáo', { icon: '👑' }); return Promise.resolve(true); }
      if (busy) return Promise.resolve(false);
      busy = true;
      return provider.showRewarded().then(function (ok) {
        busy = false;
        if (!ok) TG.ui.toast('Chưa xem hết quảng cáo nên chưa nhận thưởng', { icon: 'ℹ️' });
        return !!ok;
      }, function () {
        busy = false; TG.ui.toast('Chưa có quảng cáo, thử lại sau nhé', { icon: '📡' }); return false;
      });
    },
    isBusy: function () { return busy; }
  };
})();

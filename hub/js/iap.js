/* Mua trong ứng dụng — lớp nhà cung cấp:
 *   provider = { name, init(): Promise, price(key): string|null, order(key): Promise<'ok'|'cancel'|'error'>, restore(): Promise }
 * - Native: cordova-plugin-purchase v13 (window.CdvPurchase) — Google Play / App Store.
 * - Web/dev: mua giả lập ghi rõ "Chế độ thử".
 * Mọi giao dịch đều qua cổng phụ huynh (TG.parental.gate) trước khi mở hộp thoại thanh toán.
 * Sản phẩm: remove_ads, vip_lifetime (vĩnh viễn) · coins_small, coins_large (tiêu hao). */
(function () {
  'use strict';
  var TG = window.TG, U = TG.util, S = TG.store, P = TG.CONFIG.IAP.products;

  var TITLES = {
    remove_ads: 'Gỡ quảng cáo', vip_lifetime: 'VIP trọn đời',
    coins_small: 'Túi 500 xu', coins_large: 'Rương 2.000 xu'
  };
  function keyOf(productId) { for (var k in P) if (P[k].id === productId) return k; return null; }

  /** Trao quyền lợi. txId dùng để không cộng xu hai lần cho cùng giao dịch.
   *  late=true: quyền lợi đến ngoài luồng bấm mua (giao dịch chờ đã xong, mở lại app, khôi phục). */
  function grant(key, txId, late) {
    var p = P[key]; if (!p) return false;
    var s = S.state;
    if (p.kind === 'non_consumable') {
      if (s.owned[key]) return false;
      s.owned[key] = true;
      if (key === 'vip_lifetime') TG.econ && TG.econ.syncLevelUnlocks();
    } else {
      if (txId && s.txDone[txId]) return false;
      if (txId) s.txDone[txId] = true;
      s.coins += p.coins; // xu mua không nhân VIP
      TG.bus.emit('coins', p.coins);
    }
    S.save(); TG.bus.emit('change'); TG.bus.emit('purchase', { key: key, late: !!late });
    return true;
  }

  /* ---------- Provider: cordova-plugin-purchase v13 ----------
   * Đối chiếu www/store.js 13.20 + PurchasePlugin.java:
   *  - store.order(offer) resolve undefined khi luồng thanh toán xong (kể cả giao dịch "đang chờ"),
   *    hoặc resolve một IError (KHÔNG reject) — huỷ = ErrorCode.PAYMENT_CANCELLED (code có thể là chuỗi).
   *  - Sau đó (debounce ~500 ms) mới có approved(tx). Google Play: giao dịch chờ thanh toán có
   *    state INITIATED + isPending (sự kiện initiated, không phải pending); App Store: pending().
   *  - approved → tx.verify() → verified(receipt) → giao quyền lợi → receipt.finish()
   *    (Google: consume hàng tiêu hao / acknowledge hàng vĩnh viễn). Không có validator thì plugin
   *    coi biên lai là hợp lệ sau ~200 ms.
   *  - approved được phát lại mỗi lần mở app cho giao dịch chưa finish và cho hàng vĩnh viễn đã
   *    acknowledge → giao lại là an toàn: hàng vĩnh viễn idempotent, xu chống trùng bằng txDone.
   *  - store.owned(id) chỉ đúng sau khi tải biên lai → chỉ dùng để CẤP (khôi phục), không dùng để thu hồi. */
  function cdvProvider(Cdv) {
    var store = Cdv.store;
    var TS = Cdv.TransactionState || {};
    var plat = (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios')
      ? Cdv.Platform.APPLE_APPSTORE : Cdv.Platform.GOOGLE_PLAY;
    var pending = null; // đơn đang mua {key, resolve, timer}
    function settle(r) { if (pending) { var p = pending; pending = null; clearTimeout(p.timer); p.resolve(r); } }
    function forPending(tx) { return !!(pending && (tx.products || []).some(function (pr) { return keyOf(pr.id) === pending.key; })); }
    /** Cấp quyền lợi; nếu đúng gói đang mua thì kết thúc đơn đó là 'ok'. */
    function give(k, txId) {
      var mine = !!(pending && pending.key === k);
      var g = grant(k, txId, !mine);
      if (mine && (g || P[k].kind === 'non_consumable')) settle('ok');
    }
    function syncOwned() {
      ['remove_ads', 'vip_lifetime'].forEach(function (k) {
        try { if (store.owned({ id: P[k].id, platform: plat })) give(k, null); } catch (e) {}
      });
    }
    /** Giao quyền lợi của một giao dịch đã duyệt. */
    function deliver(tx) {
      if (!tx || tx.isPending) return;
      var st = tx.state;
      (tx.products || []).forEach(function (pr) {
        var k = keyOf(pr.id); if (!k) return;
        var cons = P[k].kind === 'consumable';
        // xu chỉ cộng khi giao dịch đang APPROVED (chưa consume); FINISHED = đã giao trước đó
        if (cons ? st !== TS.APPROVED : (st !== TS.APPROVED && st !== TS.FINISHED)) return;
        give(k, cons ? tx.transactionId + ':' + pr.id : null);
      });
    }
    var pricesT = 0;
    function pricesChanged() { clearTimeout(pricesT); pricesT = setTimeout(function () { TG.bus.emit('prices'); }, 50); }
    return {
      name: 'store',
      init: function () {
        store.register(Object.keys(P).map(function (k) {
          return {
            id: P[k].id, platform: plat,
            type: P[k].kind === 'consumable' ? Cdv.ProductType.CONSUMABLE : Cdv.ProductType.NON_CONSUMABLE
          };
        }));
        store.when()
          .approved(function (tx) { return tx.verify(); })
          .verified(function (receipt) {
            var src = receipt && receipt.sourceReceipt;
            ((src && src.transactions) || []).forEach(deliver);
            return receipt.finish();
          })
          .unverified(function (r) {
            // chỉ xảy ra khi có cấu hình store.validator
            console.warn('IAP unverified', r && r.payload && r.payload.message);
            if (pending && r && r.receipt && (r.receipt.transactions || []).some(forPending)) settle('error');
          })
          .finished(function (tx) {
            // hàng vĩnh viễn đã acknowledge từ trước (cài lại / máy khác) → cấp lại; không đụng tới xu
            (tx.products || []).forEach(function (pr) {
              var k = keyOf(pr.id);
              if (k && P[k].kind === 'non_consumable') give(k, null);
            });
          })
          .initiated(function (tx) { if (tx.isPending && forPending(tx)) settle('pending'); })
          .pending(function (tx) { if (forPending(tx)) settle('pending'); })
          .productUpdated(function () { pricesChanged(); })
          .receiptUpdated(function () { syncOwned(); });
        store.error(function (err) { console.warn('IAP error', err && err.code, err && err.message); });
        return store.initialize([plat]).then(function (errs) {
          (errs || []).forEach(function (e) { console.warn('IAP init', e && e.code, e && e.message); });
          syncOwned(); pricesChanged();
        });
      },
      price: function (key) {
        try {
          var pr = store.get(P[key].id, plat);
          var ph = pr && (pr.pricing || (pr.offers && pr.offers[0] && pr.offers[0].pricingPhases && pr.offers[0].pricingPhases[0]));
          return (ph && ph.price) || null;
        } catch (e) { return null; }
      },
      order: function (key) {
        return new Promise(function (resolve) {
          var pr = store.get(P[key].id, plat);
          var offer = pr && pr.getOffer && pr.getOffer();
          if (!offer) { resolve('error'); return; }
          settle('error'); // không bao giờ có hai đơn treo cùng lúc
          pending = { key: key, resolve: resolve, timer: 0 };
          Promise.resolve(store.order(offer)).then(function (err) {
            if (err && err.isError) {
              settle(Number(err.code) === Cdv.ErrorCode.PAYMENT_CANCELLED ? 'cancel' : 'error');
              return;
            }
            // Luồng thanh toán đã xong; approved/initiated sẽ đến sau ~0,5 s. Nếu không có gì
            // (cửa hàng xử lý chậm) thì báo "đang chờ" — quyền lợi vẫn được giao khi approved đến.
            if (pending && pending.key === key) pending.timer = setTimeout(function () { settle('pending'); }, 20000);
          }, function () { settle('error'); });
        });
      },
      restore: function () {
        return Promise.resolve(store.restorePurchases()).then(function (err) {
          // biên lai được xử lý sau ~0,5 s (debounce trong plugin)
          return new Promise(function (r) { setTimeout(r, 900); }).then(function () {
            syncOwned();
            if (err && err.isError) throw err;
          });
        });
      }
    };
  }

  /* ---------- Provider: native nhưng thiếu plugin mua hàng ---------- */
  function noneProvider() {
    return {
      name: 'none',
      init: function () { return Promise.resolve(); },
      price: function () { return null; },
      order: function () { return Promise.resolve('error'); },
      restore: function () { return Promise.reject(new Error('unavailable')); }
    };
  }

  /* ---------- Provider: giả lập ---------- */
  function simProvider() {
    return {
      name: 'sim',
      init: function () { return Promise.resolve(); },
      price: function () { return null; },
      order: function (key) {
        return new Promise(function (resolve) {
          var done = false;
          TG.ui.modal({
            title: 'Chế độ thử', icon: '🧪',
            body: '<p>Mua mô phỏng <b>' + TG.ui.esc(TITLES[key]) + '</b> (' + TG.ui.esc(P[key].fallbackPrice) + ').</p>' +
                  '<p class="muted">Không có giao dịch thật nào được thực hiện. Bản trên Google Play / App Store thanh toán qua cửa hàng.</p>',
            actions: [
              { label: 'Huỷ', onClick: function () { done = true; resolve('cancel'); } },
              { label: 'Xác nhận mua thử', kind: 'primary', id: 'sim-buy-ok', onClick: function () { done = true; resolve('ok'); } }
            ],
            onClose: function () { if (!done) resolve('cancel'); }
          });
        }).then(function (r) { if (r === 'ok') grant(key, 'sim-' + U.now() + '-' + Math.random().toString(36).slice(2, 7)); return r; });
      },
      restore: function () { return Promise.resolve(); }
    };
  }

  function isNative() { try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; } }
  /* Trong Capacitor, plugin Cordova (CdvPurchase) chỉ được gắn vào window sau khi cordova.js nạp
   * plugin (setTimeout) và trước sự kiện 'deviceready' — thường là SAU khi script của hub chạy.
   * Vì vậy chọn provider khi init(), chờ deviceready (tối đa 10 s) nếu đang chạy native. */
  function waitCdv() {
    if (window.CdvPurchase && window.CdvPurchase.store) return Promise.resolve(window.CdvPurchase);
    if (!isNative()) return Promise.resolve(null);
    return new Promise(function (res) {
      var done = false, iv = 0, tm = 0;
      function check() {
        if (done) return;
        if (window.CdvPurchase && window.CdvPurchase.store) { done = true; clearInterval(iv); clearTimeout(tm); res(window.CdvPurchase); }
      }
      document.addEventListener('deviceready', check, false);
      iv = setInterval(check, 100);
      tm = setTimeout(function () { if (!done) { done = true; clearInterval(iv); res(null); } }, 10000);
    });
  }
  var provider = (window.CdvPurchase && window.CdvPurchase.store) ? cdvProvider(window.CdvPurchase)
    : isNative() ? noneProvider() : simProvider();
  var initP = null;

  var iap = TG.iap = {
    titles: TITLES,
    get mode() { return provider.name; },
    init: function () {
      if (initP) return initP;
      initP = (provider.name === 'store' ? Promise.resolve(window.CdvPurchase) : waitCdv()).then(function (Cdv) {
        if (Cdv && Cdv.store && provider.name !== 'store') provider = cdvProvider(Cdv);
        else if (!Cdv && isNative()) console.warn('IAP: CdvPurchase not available');
        return provider.init();
      }).catch(function (e) { console.warn('IAP init failed', e && e.message); });
      return initP;
    },
    price: function (key) { return provider.price(key) || P[key].fallbackPrice; },
    /** Mua (đã có cổng phụ huynh). Promise<boolean>. */
    buy: function (key) {
      var s = S.state;
      if (P[key].kind === 'non_consumable' && s.owned[key]) { TG.ui.toast('Bạn đã sở hữu gói này', { icon: '✅' }); return Promise.resolve(false); }
      return TG.parental.gate('để mua hàng').then(function (ok) {
        if (!ok) return false;
        return Promise.resolve(initP).then(function () { return provider.order(key); }).then(function (r) {
          if (r === 'ok') { U.sound('claim'); return true; }
          if (r === 'error') TG.ui.toast('Không thể mua lúc này, thử lại sau', { icon: '⚠️', kind: 'warn' });
          if (r === 'pending') TG.ui.toast('Giao dịch đang chờ thanh toán — quà sẽ được cộng khi cửa hàng xác nhận', { icon: '⏳', ms: 4000 });
          return false;
        });
      });
    },
    restore: function () {
      return Promise.resolve(initP).then(function () { return provider.restore(); }).then(function () {
        var s = S.state;
        var any = s.owned.vip_lifetime || s.owned.remove_ads;
        TG.ui.toast(any ? 'Đã khôi phục giao dịch' : (provider.name === 'sim' ? 'Chế độ thử: không có giao dịch để khôi phục' : 'Không tìm thấy giao dịch để khôi phục'), { icon: '🔄' });
        TG.bus.emit('change');
      }, function () { TG.ui.toast('Khôi phục thất bại, thử lại sau', { icon: '⚠️', kind: 'warn' }); });
    },
    _grant: grant
  };
})();

/* Tủ Game 28 — cấu hình phát hành.
 * ============================================================
 *  CẦN THAY TRƯỚC KHI PHÁT HÀNH (REPLACE BEFORE RELEASE):
 *   1. ADS.units.*      — đang là ID QUẢNG CÁO THỬ NGHIỆM chính thức của Google.
 *                         Thay bằng ad unit ID thật trong tài khoản AdMob.
 *                         (App ID AdMob khai báo trong AndroidManifest/Info.plist — không nằm ở đây.)
 *   2. ADS.testing      — đặt false khi phát hành.
 *   3. IAP.products.*.id — phải trùng product ID tạo trong Google Play Console / App Store Connect.
 *   4. CONTACT_EMAIL    — "lienhe@example.com" là địa chỉ GIẢ, thay bằng email liên hệ thật
 *                         (cũng thay trong www/privacy.html do tools/build-www.mjs sinh ra).
 * ============================================================ */
(function () {
  'use strict';
  window.TG = window.TG || {};

  TG.CONFIG = {
    APP_NAME: 'Tủ Game 28',
    APP_VERSION: '1.0.0',
    CONTACT_EMAIL: 'lienhe@example.com', // TODO(release): thay email thật
    STORAGE_KEY: 'tg28.hub',             // một khoá duy nhất, có trường schema "v"

    ADS: {
      testing: true, // TODO(release): false
      // Google official TEST ad unit IDs — https://developers.google.com/admob/android/test-ads
      // TODO(release): REPLACE with your real AdMob ad unit IDs.
      units: {
        android: {
          interstitial: 'ca-app-pub-3940256099942544/1033173712',
          rewarded: 'ca-app-pub-3940256099942544/5224354917'
        },
        ios: {
          interstitial: 'ca-app-pub-3940256099942544/4411468910',
          rewarded: 'ca-app-pub-3940256099942544/1712485313'
        }
      },
      // Quy tắc quảng cáo xen kẽ (interstitial)
      interstitialEveryRounds: 3,          // sau mỗi 3 ván hoàn thành
      interstitialMinGapMs: 3 * 60 * 1000, // giãn cách ≥ 3 phút
      noAdsFirstMs: 5 * 60 * 1000,         // không có QC trong 5 phút đầu phiên
      simSeconds: 5,                       // thời lượng QC giả lập (web/dev)
      freeCoinsPerDay: 3                   // số lượt "xem QC nhận xu" mỗi ngày
    },

    IAP: {
      // TODO(release): product ID phải khớp với store.
      products: {
        remove_ads:   { id: 'remove_ads',   kind: 'non_consumable', fallbackPrice: '29.000 ₫' },
        vip_lifetime: { id: 'vip_lifetime', kind: 'non_consumable', fallbackPrice: '79.000 ₫' },
        coins_small:  { id: 'coins_small',  kind: 'consumable', coins: 500,  fallbackPrice: '19.000 ₫' },
        coins_large:  { id: 'coins_large',  kind: 'consumable', coins: 2000, fallbackPrice: '49.000 ₫' }
      }
    },

    HEALTH: {
      breakEveryMin: 30,     // nhắc nghỉ mắt sau 30 phút chơi liên tục
      breakSeconds: 20,      // nghỉ 20 giây
      continuityGapMin: 5,   // rời game > 5 phút thì tính lại từ đầu
      limitOptions: [0, 30, 45, 60, 90, 120] // 0 = tắt (mặc định)
    }
  };
})();

# Checklist phát hành

## Phải làm trước khi nộp (cần tài khoản thật — không làm được thay bạn)
- [ ] Tạo tài khoản Google Play Console (phí 25 USD một lần). Tài khoản cá nhân mới phải chạy **closed testing ≥12 người thử trong 14 ngày** trước khi lên production.
- [ ] (iOS) Tài khoản Apple Developer 99 USD/năm + máy Mac có Xcode.
- [ ] Tạo app trong AdMob → lấy **App ID** và **Ad unit ID** (interstitial, rewarded). Thay ở:
  - `android/app/src/main/AndroidManifest.xml` (com.google.android.gms.ads.APPLICATION_ID)
  - `hub/js/ads.js` (cấu hình ad unit) → build lại.
- [ ] Đăng ký sản phẩm trong Play Console → Monetize → Products: `remove_ads`, `vip_lifetime` (một lần), `coins_small`, `coins_large` (tiêu hao). Giá đề xuất (khớp hub/js/config.js): remove_ads 29.000đ · vip_lifetime 79.000đ · coins_small (500 xu) 19.000đ · coins_large (2000 xu) 49.000đ.
- [ ] Thay email liên hệ `lienhe@example.com` (hub, privacy.html, listing).
- [ ] Đưa `privacy.html` lên một URL công khai (GitHub Pages) và điền vào Play Console.
- [ ] Đổi appId `vn.tugame28.app` nếu muốn — phải đổi TRƯỚC lần tải lên đầu tiên.
- [ ] Bật **Play App Signing** khi tải AAB đầu tiên; giữ kỹ upload keystore.
- [ ] Điền Data safety, Target audience, Content rating theo `data-safety.md`.
- [ ] Tải ảnh: icon 512×512, feature graphic 1024×500, ≥4 ảnh chụp điện thoại (thư mục `store/screenshots/`).

## Điền mã thật: một lệnh
`cp tools/release.config.example.json tools/release.config.json` → điền → `node tools/apply-release-config.mjs` → `node tools/apply-release-config.mjs --check` → `bash tools/build-android.sh`. Xem docs/BUILD.md.

## Đã có sẵn trong repo
- [x] 28 game chạy offline, giao diện tiếng Việt, cảm ứng + bàn phím
- [x] App hub: hồ sơ, xu/cấp, điểm danh, nhiệm vụ, thành tựu, mở khoá
- [x] Quảng cáo (interstitial có giãn cách + rewarded) và mua trong app, cổng phụ huynh, khôi phục giao dịch
- [x] Nhắc nghỉ mắt, giới hạn thời gian của phụ huynh
- [x] Chính sách quyền riêng tư (vi/en)
- [x] Dự án Capacitor Android, targetSdk theo yêu cầu Play, AAB ký sẵn bằng upload key
- [x] Nội dung store tiếng Việt/Anh, đáp án Data safety

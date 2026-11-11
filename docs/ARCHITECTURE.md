# Tủ Game 28 — kiến trúc bản phát hành (app store)

## Thư mục
```
/home/user/games/
  <genre>/gameN.html     # 28 game nguồn (arcade, puzzle, board, action, strategy, casual, multiplayer)
  index.html             # trang danh sách cũ cho web (giữ nguyên)
  hub/                   # nguồn của app hub (màn hình chính của app)
    index.html, hub.css, js/*.js, assets/
  tools/build-www.mjs    # node tools/build-www.mjs → tạo www/
  www/                   # đầu ra (KHÔNG commit): webDir của Capacitor và bản PWA
    index.html           # = hub
    games/<genre>/gameN.html   # game đã qua xử lý (xem dưới)
    manifest.webmanifest, sw.js, icons/, privacy.html
  package.json, capacitor.config.json, android/   # dự án Capacitor
  store/                 # mô tả store, chính sách, ảnh chụp, checklist
```

## ID game
`<genre>/gameN` ví dụ `board/game3`. Danh mục (tên, emoji, mô tả, thể loại) lấy theo mảng GENRES trong /home/user/games/index.html.

## Giao thức sự kiện game → hub (postMessage)
Mỗi game nguồn có sẵn helper (agent instrument thêm vào, chạy được cả khi mở game riêng lẻ — không có parent thì không làm gì):
```js
function ghEmit(type, data){try{if(window.parent&&window.parent!==window)window.parent.postMessage(Object.assign({gh:1,type:type},data||{}),'*')}catch(e){}}
```
Sự kiện:
- `ghEmit('start')` — bắt đầu một ván / trận / màn (người chơi bấm Bắt đầu, Chơi lại, vào màn mới).
- `ghEmit('end', {score, win, best})` — kết thúc ván.
  - `score`: số (điểm của ván, hoặc null nếu game không có điểm).
  - `win`: true/false nếu game có thắng thua, null nếu không áp dụng (game điểm vô tận).
  - `best`: true nếu ván này lập kỷ lục mới của người chơi.
- `ghEmit('milestone', {kind, value})` — tuỳ chọn: qua màn (`kind:'level'`), lên cấp, mở khoá, thắng đợt… `value` là số.
Game idle/mô phỏng (Tiệm Phở, Nông Trại) không có "ván": phát `milestone` khi đạt mốc (vd. nâng cấp, thu hoạch, lên cấp) và `end` với win:true khi đạt mục tiêu cuối.

Hub cũng nhận `{tg28:'close'}` (do build-www chèn vào link "← Danh sách game") để đóng game.

## Xử lý game khi build www
- Bỏ khối `<!--RIO-GREET-BEGIN-->…<!--RIO-GREET-END-->` (hub tự hiện lời chào theo tên người chơi).
- Chèn script chặn click link `../index.html` → `parent.postMessage({tg28:'close'},'*')`.
- Game chạy trong `<iframe>` toàn màn hình của hub (cùng origin để localStorage chung).

## Hub — vòng giữ chân (hook) & kiếm tiền
- Hồ sơ: tên người chơi (onboarding lần đầu, mặc định "Rio"), xu, XP/cấp độ.
- Điểm danh hằng ngày 7 ngày + chuỗi ngày (streak), nhân đôi bằng quảng cáo có thưởng.
- 3 nhiệm vụ mỗi ngày (theo sự kiện ở trên), thành tựu, mở khoá game bằng xu/cấp/VIP.
- Sức khoẻ: nhắc nghỉ mắt mỗi 30 phút, giới hạn thời gian chơi mỗi ngày (phụ huynh đặt, có cổng phụ huynh).
- Quảng cáo: interstitial sau mỗi 3 ván (giãn cách ≥3 phút, không trong 5 phút đầu, không cho VIP/đã gỡ QC), rewarded tự nguyện. Luôn không cá nhân hoá, nội dung G (an toàn trẻ em).
- Mua trong app: `remove_ads` (vĩnh viễn), `vip_lifetime` (vĩnh viễn: gỡ QC + mở mọi game + x2 xu), `coins_small`, `coins_large` (tiêu hao). Có cổng phụ huynh trước khi mua.
- Lớp nhà cung cấp: native dùng `@capacitor-community/admob` và `cordova-plugin-purchase` (CdvPurchase) nếu có; web/dev dùng bản giả lập ghi rõ "chế độ thử".
- Không thu thập dữ liệu cá nhân; mọi dữ liệu nằm trên máy.

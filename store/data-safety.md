# Google Play — Data safety & khai báo chính sách (đáp án đề xuất)

Áp dụng cho bản 1.0.0 với cấu hình mặc định (AdMob không cá nhân hoá, đã gỡ quyền AD_ID, không analytics).

## Data safety
- **Does your app collect or share any of the required user data types?** → Yes (do SDK AdMob và Google Play Billing).
  - AdMob (bản dành cho trẻ em, không cá nhân hoá) vẫn thu thập: *App activity → App interactions*, *App info and performance → Diagnostics/Crash logs*, *Device or other IDs* (App set ID). Mục đích: Advertising, Analytics, Fraud prevention. Không dùng để cá nhân hoá.
  - Google Play Billing: *Financial info → Purchase history* (do Google xử lý).
  - Kiểm tra lại theo tài liệu "Google Mobile Ads SDK – data disclosure" mới nhất trước khi nộp.
- **Is all data encrypted in transit?** → Yes.
- **Can users request data deletion?** → Ứng dụng không lưu dữ liệu trên máy chủ; người dùng xoá tiến độ trong Cài đặt → "Xoá tiến độ" hoặc gỡ ứng dụng.
- Ứng dụng tự nó: không tài khoản, không vị trí, không danh bạ, không ảnh, không micro.

## Target audience and content
- Nhóm tuổi đề xuất: **6–8, 9–12, 13–15, 16–17, 18+** (gia đình). Nếu chọn nhóm có trẻ dưới 13 → app phải tuân thủ **Families Policy**:
  - Chỉ dùng SDK quảng cáo đã được chứng nhận Families (AdMob: có) với `tagForChildDirectedTreatment=true`, nội dung mức G — đã cấu hình trong hub/js/ads.js.
  - Không gửi AD_ID — đã gỡ quyền trong AndroidManifest.
  - Quảng cáo không lừa bấm, có nút đóng rõ ràng, không chặn chơi; interstitial có giãn cách.
  - Mua trong app có cổng phụ huynh.
- **Ads:** Yes, contains ads.
- **In-app purchases:** Yes.

## Content rating (IARC questionnaire)
- Bạo lực: hoạt hình/kỳ ảo nhẹ (bắn zombie, hiệp sĩ, xe tăng – không máu me chân thực). Đề xuất kết quả mong đợi: **PEGI 7 / ESRB Everyone 10+ / 7+**. Trả lời trung thực theo nội dung thực tế; game bài (Tiến Lên, Solitaire) **không có cá cược tiền thật hay mô phỏng cờ bạc có tiền**.
- Không nội dung người dùng tạo, không chat, không chia sẻ vị trí.

## App access
- Toàn bộ chức năng dùng được không cần đăng nhập.

## Ads declaration
- Contains ads: Yes.

## Government apps / Financial features / Health: No.

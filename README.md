# Tủ Game 28

28 game chơi trên trình duyệt, chia theo 7 thể loại. Giao diện tiếng Việt, chơi được bằng bàn phím trên máy tính và cảm ứng trên điện thoại.

Mỗi game là một file HTML độc lập, không cần cài đặt hay build. Mở `index.html` để xem danh sách.

| Thư mục | Thể loại | Game |
|---|---|---|
| `arcade/` | Arcade | Rắn Neon · Né Thiên Thạch · Phi Đội Bầu Trời · Phá Gạch Pha Lê |
| `puzzle/` | Giải đố | Khối Rơi Ngũ Sắc · Ghép Trái Cây · Đẩy Thùng Kho · Sudoku Sen |
| `board/` | Cờ & Bài | Cờ Caro · Cờ Tướng · Tiến Lên Miền Nam · Xếp Bài Solitaire |
| `action/` | Hành động | Mèo Phiêu Lưu · Hầm Ngục Ngẫu Nhiên · Bắn Zombie Sinh Tồn · Thủ Thành |
| `strategy/` | Chiến thuật & Mô phỏng | Tiệm Phở Triệu Đô · Nông Trại Xanh · Hiệp Sĩ Theo Lượt · Bộ Bài Phép Thuật |
| `casual/` | Giáo dục & Giải trí | Đố Vui Việt Nam · Gõ Phím Thần Tốc · Toán Nhanh · Lật Thẻ Ghi Nhớ |
| `multiplayer/` | Chơi chung | Bóng Bàn Đôi · Xe Tăng Đại Chiến · Cờ Cá Ngựa · Ai Nhanh Hơn |

## Chạy trên máy
Mở trực tiếp `index.html` bằng trình duyệt, hoặc chạy `python3 -m http.server` rồi vào http://localhost:8000.

## Deploy GitHub Pages
Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, thư mục `/ (root)` → Save.
Sau 1–2 phút trang có ở `https://<tên-tài-khoản>.github.io/<tên-repo>/`.

`PROMPT.md` chứa bộ prompt để build lại các game bằng AI khác.

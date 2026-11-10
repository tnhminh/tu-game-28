# Prompt build 28 game HTML

Cách dùng: mỗi lần gửi cho AI khác **Phần A (yêu cầu chung)** + **một game ở Phần B**.
Mỗi lần chỉ nên build 1 game để AI làm kỹ, không bị cắt ngang giữa chừng.
Nếu AI dừng giữa chừng, nhắn "viết tiếp từ chỗ bị cắt".
Có thể build thêm trang danh sách bằng Phần C.

---

## Phần A: Yêu cầu chung (dán vào đầu mọi prompt)

```
Hãy viết một game chơi trên trình duyệt, hoàn chỉnh và chơi được ngay, theo các yêu cầu sau:

KỸ THUẬT
- Chỉ MỘT file HTML duy nhất: CSS và JS viết inline, không dùng thư viện ngoài, không gọi mạng.
- Đồ họa vẽ bằng Canvas/CSS/SVG/emoji. Âm thanh (nếu có) tạo bằng Web Audio API trong code, có nút tắt tiếng (phím M).
- Game thời gian thực: dùng requestAnimationFrame với delta-time, giới hạn delta tối đa (ví dụ 50ms) để không bị giật khi chuyển tab.
- Canvas tự co giãn vừa màn hình, giữ đúng tỉ lệ.

GIAO DIỆN
- Toàn bộ chữ bằng tiếng Việt. Thẻ <title> là tên game.
- Màn hình bắt đầu có hướng dẫn chơi; có tạm dừng (P/Esc và nút ⏸, tự dừng khi ẩn tab); màn hình thua/thắng có nút chơi lại.
- Hiển thị điểm và kỷ lục.
- Góc trên bên trái có link nhỏ "← Danh sách game" trỏ tới ../index.html.
- Bảng màu thống nhất, trông chỉn chu, có hiệu ứng nhỏ (rung, hạt nổ, chuyển động mượt).

ĐIỀU KHIỂN
- Máy tính: bàn phím (và chuột nếu hợp lý).
- Điện thoại: cảm ứng (nút ảo, joystick ảo, vuốt hoặc kéo). Nút ảo chỉ hiện trên thiết bị cảm ứng.
- Chạy tốt ở màn hình rộng 375px, không bị cuộn ngang.

LƯU TRỮ
- Lưu kỷ lục/tiến độ bằng localStorage, mọi lệnh đọc/ghi bọc trong try/catch để game vẫn chạy nếu bị chặn bộ nhớ.

BẢN QUYỀN
- Thiết kế gốc: chỉ dùng cơ chế chung của thể loại, KHÔNG sao chép tên, nhân vật, hình ảnh, màn chơi của game có sẵn.

TRƯỚC KHI TRẢ LỜI, tự kiểm tra: không lỗi cú pháp, không lỗi console, game bắt đầu → chơi → thua/thắng → chơi lại đều được, luật chơi đúng.
Trả về toàn bộ file HTML trong một khối code, không lược bớt.

GAME CẦN LÀM:
```

---

## Phần B: Mô tả 28 game (chọn 1 cái, dán ngay sau Phần A)

### 🕹 Arcade

**1. Rắn Neon** (`arcade/game1.html`)
Rắn săn mồi trên lưới 20×20 phong cách neon. Sau 3 mồi xuất hiện cặp cổng dịch chuyển, đổi vị trí mỗi 14 giây. Thỉnh thoảng sinh khối tường. 3 vật phẩm: đi xuyên thân và tường, làm chậm, nhân đôi điểm. Rắn nhanh dần khi dài ra; chuyển động vẽ mượt giữa các ô. Điều khiển: mũi tên/WASD; điện thoại vuốt hoặc bấm phím mũi tên ảo.

**2. Né Thiên Thạch** (`arcade/game2.html`)
Lái phi thuyền né thiên thạch xoay rơi từ trên xuống, tốc độ tăng dần tới 3.4 lần. Mưa thiên thạch khoảng mỗi 20–26 giây. Nhặt pha lê (+50), khiên, làm chậm thời gian; né sát được +15. Điều khiển: mũi tên/WASD; điện thoại chạm và kéo.

**3. Phi Đội Bầu Trời** (`arcade/game3.html`)
Bắn máy bay cuộn dọc, tự động bắn. 3 loại địch, các đợt khó dần. Vật phẩm: nâng súng (tối đa cấp 4), khiên, thêm mạng. Mỗi 4 đợt có trùm với thanh máu, 3 kiểu tấn công, dưới 50% máu thì đánh nhanh hơn. Điều khiển: mũi tên/WASD; điện thoại chạm và kéo.

**4. Phá Gạch Pha Lê** (`arcade/game4.html`)
Đỡ bóng phá gạch, 5 màn thiết kế tay (gạch 1–3 lần đánh, gạch không vỡ). Hết màn 5 thì quay lại khó hơn. Vật phẩm: thanh dài, 3 bóng, bóng chậm, bóng xuyên gạch, thêm mạng. Điều khiển: mũi tên/A-D/chuột, Space hoặc click để phóng bóng; điện thoại kéo để di chuyển, chạm để phóng.

### 🧩 Giải đố

**5. Khối Rơi Ngũ Sắc** (`puzzle/game1.html`)
Xếp khối rơi xóa hàng với bộ 9 khối riêng (7 khối 4 ô, 2 khối 3 ô), vẽ như đá quý 5 màu. Có ô giữ khối, xem trước 3 khối, bóng khối chỗ sẽ rơi, lên cấp mỗi 10 hàng. Điều khiển: ←/→, ↑/X xoay, Z xoay ngược, ↓ rơi nhanh, Space thả thẳng, C/Shift giữ; điện thoại có 6 nút ảo + chạm xoay, vuốt ngang, vuốt xuống.

**6. Ghép Trái Cây** (`puzzle/game2.html`)
Đổi chỗ ghép 3 trên lưới 8×8, 6 loại trái cây vẽ bằng code, có phản ứng dây chuyền và hệ số combo. Ô đặc biệt: ghép 4 ra trái sọc (xóa hàng/cột), hình L/T ra bom (3×3), ghép 5 ra cầu vồng (xóa một loại). Đổi 2 ô đặc biệt với nhau ra combo lớn. 10 màn giới hạn lượt, có mục tiêu điểm và mục tiêu thu thập, chấm sao, gợi ý khi đứng yên, tự xáo khi hết nước. Điều khiển: click 2 ô kề nhau hoặc kéo/vuốt.

**7. Đẩy Thùng Kho** (`puzzle/game3.html`)
Đẩy thùng vào đúng vị trí, 14 màn thiết kế tay (BẮT BUỘC kiểm tra mọi màn đều giải được). Hoàn tác không giới hạn, chơi lại màn, chọn màn (mở khóa lần lượt, lưu số bước tốt nhất). Điều khiển: mũi tên/WASD, Z hoàn tác, R chơi lại; điện thoại vuốt hoặc bấm phím ảo.

**8. Sudoku Sen** (`puzzle/game4.html`)
Sudoku có bộ tạo đề đảm bảo lời giải duy nhất, 3 mức (khoảng 38/30/26 số cho sẵn). Ghi chú bút chì, tô đỏ số sai, viền nét đứt ô xung đột, đồng hồ, hoàn tác, xóa, 3 gợi ý, sai 3 lần thì thua. Lưu ván dở và thời gian tốt nhất từng mức. Điều khiển: chọn ô rồi nhập 1–9 bằng phím hoặc bàn số ảo; N bật ghi chú, H gợi ý.

### ♟ Cờ & Bài

**9. Cờ Caro** (`board/game1.html`)
Bàn 15×15, 5 quân liền trở lên thắng. Đấu máy 3 mức (Dễ/Vừa/Khó, chọn ai đi trước) hoặc 2 người. Máy chấm điểm thế cờ (ba, bốn mở và gãy, nước đôi); mức Khó tìm thêm chuỗi tứ ép thắng. Đánh dấu nước vừa đi và đường thắng, có đi lại.

**10. Cờ Tướng** (`board/game2.html`)
Đầy đủ luật: cung, mắt tượng, cản chân mã, pháo cần ngòi, tốt qua sông, cấm lộ mặt tướng, không được tự để bị chiếu. Hết nước hoặc bị chiếu bí là thua; hòa sau 120 nước không ăn quân. Đấu máy (minimax alpha-beta độ sâu 1/2/3) hoặc 2 người, chọn Đỏ/Đen (lật bàn), chữ Hán hoặc chữ Việt, có đi lại và đầu hàng. Kiểm tra bằng perft: 44 / 1.920 / 79.666 nước ở độ sâu 1–3.

**11. Tiến Lên Miền Nam** (`board/game3.html`)
Người chơi với 3 máy, lá bài vẽ bằng CSS. Rác, đôi, sám, sảnh (không có 2), tứ quý, đôi thông. Chặt: 3 đôi thông chặt một heo; tứ quý chặt heo, đôi heo, 3 đôi thông; 4 đôi thông chặt đôi heo hoặc tứ quý. Ván đầu ai có 3♠ đi trước; bỏ lượt thì mất quyền tới hết vòng. Tới trắng (tứ quý 2, sảnh rồng, 6 đôi, 5 đôi thông). Tính điểm Nhất/Nhì/Ba/Bét +3/+1/−1/−3. Nút: Đánh, Bỏ lượt, Gợi ý, Bỏ chọn.

**12. Xếp Bài Solitaire** (`board/game4.html`)
Klondike, rút 1 hoặc 3 lá, mặt bài tự thiết kế. Kéo thả một lá hoặc cả dãy; chạm vào lá thì tự đưa lên ô đích hoặc cột hợp lệ. Hoàn tác không giới hạn, đếm nước, đồng hồ, nút tự hoàn thành khi lật hết bài. Thống kê riêng từng chế độ.

### ⚔ Hành động

**13. Mèo Phiêu Lưu** (`action/game1.html`)
Platformer cuộn ngang, nhân vật mèo cam vẽ bằng code. 5 màn thiết kế tay (đồng cỏ, rừng thông, hang tím, mái nhà đêm, lâu đài mây). Xu, cá (+1 mạng), bọ và dơi giẫm được, nhím không giẫm được, điểm lưu, bệ di chuyển ngang/dọc, ván một chiều, gai. Có coyote time, jump buffer, nhảy cao theo độ dài bấm. Mọi màn phải qua được. Điều khiển: ←/→, Space/↑ nhảy; điện thoại nút ◀ ▶ NHẢY.

**14. Hầm Ngục Ngẫu Nhiên** (`action/game2.html`)
Roguelite nhìn từ trên. Mỗi tầng sinh ngẫu nhiên các phòng: phòng đầu, phòng đánh, phòng báu vật, phòng cầu thang; trùm mỗi 3 tầng. Cửa khóa tới khi dọn sạch phòng. Địch: slime, dơi, cung thủ, kẻ húc. Trùm bắn vòng đạn và gọi quân. 10 vật phẩm nâng cấp, bản đồ nhỏ, chết là chơi lại. Điều khiển: WASD, J/Space chém, K bắn phép (tự nhắm địch gần nhất); điện thoại joystick + nút Chém/Bắn.

**15. Bắn Zombie Sinh Tồn** (`action/game3.html`)
Bắn hai cần nhìn từ trên, đấu trường rộng có camera theo, thùng gỗ làm vật cản, bản đồ nhỏ. Đợt vô tận: zombie đi bộ, chạy nhanh, phun axit, tank, tự nổ; zombie khổng lồ mỗi 5 đợt. Giữa các đợt có cửa hàng: thêm 3 súng (tiểu liên, shotgun, súng trường), 7 nâng cấp cộng dồn, hồi máu. Điều khiển: WASD + chuột ngắm bắn, 1–4 đổi súng; điện thoại 2 joystick.

**16. Thủ Thành** (`action/game4.html`)
Thủ thành trên đường đi cố định tới lâu đài. 4 tháp, mỗi tháp 3 cấp, bán được: Cung, Pháo (nổ lan, không bắn được quân bay), Băng (làm chậm), Sét (lan giữa các địch, xuyên giáp). 20 đợt, 6 loại địch (lính, sói nhanh, giáp, quạ bay, thầy thuốc, trùm). 20 mạng, tốc độ ×1/×2/×3, gọi đợt sớm được thưởng. Phím 1–4 chọn tháp, U nâng cấp, S bán, Space đợt tiếp.

### 🏯 Chiến thuật & Mô phỏng

**17. Tiệm Phở Triệu Đô** (`strategy/game1.html`)
Game idle: chạm bát phở kiếm tiền, thuê 9 loại nhân viên, mua nâng cấp (một số chỉ mở khi đạt mốc). Thỉnh thoảng có khách VIP 🧧 boa tiền hoặc tăng thu nhập ngắn hạn. Quay lại sau khi tắt game nhận 50% thu nhập, tối đa 8 giờ. Tái khởi nghiệp nhận sao ⭐ (+10% thu nhập mỗi sao). Số lớn viết kiểu nghìn/triệu/tỷ. Mục tiêu 25 tỷ đ. Tự lưu mỗi 5 giây, có nút xóa dữ liệu.

**18. Nông Trại Xanh** (`strategy/game2.html`)
Lưới 5×5 ô đất: chạm để trồng, tưới, thu hoạch. 9 loại cây lớn theo thời gian thực (cả khi đóng game, tối đa 4 giờ), đất khô thì cây ngừng lớn. Một ngày dài 3 phút thật, ban đêm cây chậm lớn, thời tiết (nắng, nóng, mưa, mây) ảnh hưởng độ khô đất. Giá chợ đổi mỗi ngày, có một cây 🔥 giá cao. Lên cấp mở hạt giống, mua thêm đất, 7 nâng cấp. Nút Trồng hết, Tưới hết, Thu hoạch hết. Mục tiêu 30.000 xu.

**19. Hiệp Sĩ Theo Lượt** (`strategy/game3.html`)
RPG đánh theo lượt: 3 anh hùng (Kiếm sĩ, Pháp sư, Tu sĩ) qua 10 trận, có trùm giữa và trùm cuối Hắc Long. Thứ tự lượt theo tốc độ. 16 kỹ năng mở theo cấp, MP, 7 hiệu ứng trạng thái, ⚠️ báo trước đòn mạnh của địch. Vật phẩm; trại giữa các trận để nghỉ, mua đồ, nâng trang bị. Thua thì đánh lại trận hoặc chơi lại từ đầu.

**20. Bộ Bài Phép Thuật** (`strategy/game4.html`)
Roguelike xây bộ bài: 3 năng lượng và 5 lá mỗi lượt, 25 lá gốc (tấn công, kỹ năng, sức mạnh) nâng cấp được. Địch hiện biểu tượng ý định lượt sau. Thắng trận chọn 1 trong 3 lá. 6 cổ vật, bản đồ phân nhánh 10 tầng (trận thường, tinh anh, trại, rương, sự kiện, cửa hàng), trùm cuối Vua Bóng Đêm. Cân bằng để thắng được nhưng khó.

### 📚 Giáo dục & Giải trí

**21. Đố Vui Việt Nam** (`casual/game1.html`)
Trắc nghiệm 72 câu GỐC, CHÍNH XÁC về Việt Nam, 4 chủ đề (Địa lý, Lịch sử, Văn hóa, Ẩm thực). Chọn chủ đề hoặc Tất cả, 10/15/20 câu. Mỗi câu 20 giây, trả lời nhanh nhiều điểm, đúng liên tiếp có thưởng. 1 lần 50/50 và 1 lần bỏ qua. Cuối game xem lại mọi câu, đáp án đúng và câu đã chọn. Phím 1–4/A–D, Enter qua câu. Tránh câu hỏi phụ thuộc việc sáp nhập tỉnh 2025.

**22. Gõ Phím Thần Tốc** (`casual/game2.html`)
Chữ rơi từ trên xuống, gõ đúng để phá. Từ tiếng Việt có dấu, không dấu, và tiếng Anh. 5 mạng, mỗi 10 từ lên cấp (rơi nhanh hơn, từ dài hơn). Hiện WPM và độ chính xác. QUAN TRỌNG: so khớp theo toàn bộ giá trị ô nhập (không theo từng phím) để Telex/VNI và bộ gõ IME hoạt động; xử lý sự kiện composition; chấp nhận cả Telex thô như "vieetj nam".

**23. Toán Nhanh** (`casual/game3.html`)
Tính nhẩm 60 giây, chọn phép + − × ÷. Khó dần khi trả lời đúng; phép trừ không ra số âm, phép chia luôn chia hết. Combo nhân điểm tới ×5, trả lời nhanh có thưởng. Cuối ván liệt kê câu sai. Phím số, Backspace, Enter, Esc bỏ qua; bàn số ảo cho điện thoại; đúng thì tự sang câu mới.

**24. Lật Thẻ Ghi Nhớ** (`casual/game4.html`)
Lật thẻ tìm cặp, 3 chủ đề emoji (con vật, trái cây, cờ các nước — thẻ cờ ghi kèm tên nước vì Windows không hiện emoji cờ). 3 cỡ: 4×3, 4×4, 6×4 (thành 4×6 trên điện thoại). Đếm lượt, đồng hồ, xếp hạng 1–3 sao. Điều khiển chuột/chạm hoặc mũi tên + Enter.

### 👥 Chơi chung (nhiều người trên một máy)

**25. Bóng Bàn Đôi** (`multiplayer/game1.html`)
Hai người đỡ bóng, ai đạt 7 điểm trước thắng. Bóng nhanh dần sau mỗi lần đỡ, đỡ bằng mép vợt thì bóng bay chéo. Có chế độ 1 người đấu máy 3 mức. Máy tính: W/S và ↑/↓. Điện thoại: mỗi người kéo trên nửa màn hình của mình, đa chạm; màn dọc thì xoay sân để 2 người ngồi trên/dưới. Lưu loạt đánh dài nhất.

**26. Xe Tăng Đại Chiến** (`multiplayer/game2.html`)
Đấu xe tăng trong mê cung sinh ngẫu nhiên mỗi ván, đạn nảy tường và có thể trúng chính mình, tối đa 5 viên mỗi xe. Thắng 3 ván trước. Máy tính: WASD+Space và mũi tên+Enter. Điện thoại: 2 cụm joystick + nút BẮN ở 2 đầu màn hình, cụm trên xoay 180°.

**27. Cờ Cá Ngựa** (`multiplayer/game3.html`)
2–4 ghế, mỗi ghế chọn Người/Máy/Trống. Bàn chữ thập 15×15, xúc xắc có hoạt ảnh. Ra 6 mới xuất chuồng (tùy chọn cho ra cả 1), ra 6 được đổ thêm. Không nhảy qua ngựa khác; đá ngựa địch về chuồng; không đứng chung ô với ngựa mình. Phải dừng đúng cửa chuồng; từ cửa đổ n lên bậc n, từ bậc n cần đúng n+1 để lên 1 bậc. Thắng khi 4 ngựa ở bậc 3–6. Máy ưu tiên đá và tránh ô nguy hiểm.

**28. Ai Nhanh Hơn** (`multiplayer/game4.html`)
Game phản xạ 2–4 người, ai đạt 10 điểm trước thắng. Mỗi người một vùng chạm lớn ở cạnh trên/dưới (vùng phía trên xoay 180°, hướng dẫn hiện cả 2 chiều). Phím Q / P / Z / M. 6 kiểu vòng, mỗi kiểu chỉ cần 1 nút: chạm khi đèn xanh (có màu giả); khi số bằng số vật; khi khung vàng ở emoji khác loại; khi chữ màu được tô đúng màu đó; khi emoji mục tiêu xuất hiện; khi phép cộng đúng. Chạm sai bị −1 điểm và khóa tới hết vòng. Lưu phản xạ nhanh nhất.

---

## Phần C: Trang danh sách (tùy chọn)

```
Viết file index.html làm trang danh sách cho 28 game trên. Một file, CSS/JS inline, giao diện tối kiểu tủ game, tiếng Việt.
Chia 7 nhóm (Arcade, Giải đố, Cờ & Bài, Hành động, Chiến thuật & Mô phỏng, Giáo dục & Giải trí, Chơi chung), mỗi nhóm một màu nhấn,
có hàng nút nhảy tới từng nhóm. Mỗi game là một thẻ: emoji, tên, mô tả 1 dòng, "Chơi ngay →", link tới <thư-mục>/gameN.html.
Lưới 4 cột trên máy tính, 2 cột trên tablet, 1 cột trên điện thoại.
Thư mục: arcade, puzzle, board, action, strategy, casual, multiplayer; mỗi thư mục có game1.html đến game4.html theo đúng thứ tự trên.
```

---

## Mẹo khi dùng với AI khác
- Game lớn (Cờ Tướng, Tiến Lên, Bộ Bài Phép Thuật, Hầm Ngục) dễ bị cắt giữa chừng: yêu cầu "chia làm 2 phần, phần 1 là HTML+CSS+dữ liệu, phần 2 là logic".
- Sau khi nhận code, mở file bằng trình duyệt, bấm F12 xem tab Console; có lỗi thì dán nguyên văn lỗi lại cho AI sửa.
- Muốn đổi chủ đề: chỉ cần sửa phần mô tả game, giữ nguyên Phần A.

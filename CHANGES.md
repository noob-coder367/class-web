# Nối Từ — 60 giây mỗi lượt + hệ thống hiện đáp án

Giải nén zip vào thư mục gốc repo `class-web` (giữ nguyên đường dẫn), ghi đè các file cùng tên.
**Không cần migration SQL mới.**

## File sửa
- backend/src/services/game/wordChainDictionary.js — thêm chỉ mục theo tiếng đầu + `dictionaryPhrasesStartingWith`
- backend/src/services/game/wordChain.engine.js — thêm `TURN_TIME_LIMIT_SECONDS = 60` và `findAnswer`
- backend/src/services/game/wordChain.service.js — thêm `revealAnswer`, trả `turn_started_at` / `server_time` / `turn_time_limit`, select thêm `turns_used`, `updated_at`
- backend/src/controllers/wordChain.controller.js — thêm `reveal`
- backend/src/routes/wordChain.routes.js — thêm `POST /api/word-chain/rooms/:code/reveal`
- frontend/src/lib/wordChain.js — thêm `WORD_CHAIN_TURN_SECONDS`, `findLocalWordChainAnswer`, `turn_started_at` cho lượt mới
- frontend/src/services/wordChainService.js — bù lệch đồng hồ, thêm `revealWordChainAnswer`
- frontend/src/pages/WordChainRoomPage.jsx — đồng hồ 60 giây, khung đáp án hệ thống, khóa ô nhập khi hết giờ

## File mới
- frontend/src/word-chain-timer.css
- frontend/test/wordChain.reveal.test.js
- backend/test/wordChain.reveal.test.js

## Cách hoạt động
- Mỗi lượt đếm ngược 60 giây (online dùng mốc `updated_at` của phòng theo giờ máy chủ; 1 máy dùng giờ trình duyệt).
- Hết 60 giây: hiện đáp án hệ thống cho tất cả đội, khóa ô nhập; đội hiện tại bấm "Sang lượt tiếp theo" (tính là bỏ lượt, −1 lượt).
- Đáp án luôn hợp lệ: nối đúng tiếng cuối, có nghĩa trong từ điển, chưa dùng, thuộc nguồn của trận (trừ luật Tự do: toàn bộ từ điển).
  Ưu tiên cụm mà đội sau vẫn còn nước nối. Nếu thật sự hết nước nối thì báo "Không còn cụm từ hợp lệ nào để nối".
- Từ khởi đầu vẫn được chọn sao cho chắc chắn còn ít nhất một cụm khác để nối (SQL `start_word_chain_room_atomic` và `chooseLocalStartingPhrase`).
- Online: máy chủ chỉ trả đáp án khi đã đủ ~55–60 giây (chống xem sớm).

## Lưu ý
- Hết giờ chỉ khóa ô nhập ở giao diện; máy chủ/DB chưa chặn đáp án gửi trễ (muốn chặn cứng cần migration sửa `apply_word_chain_turn_atomic`).
- Bản cũ `ROOM_COLUMNS` thiếu `turns_used` nên phòng online không có `room.turns_used`; bản này đã bổ sung.

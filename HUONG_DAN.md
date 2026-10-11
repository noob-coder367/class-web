# Giao diện game kiểu Roblox + phòng đang mở

Catalog (trang chọn game, trang chi tiết, Admin) đọc từ `GAME_CATALOG` trong `frontend/src/lib/gameModes.js`.
`GAME_MODES` chỉ giữ game dạng phòng, nên trang Tạo phòng và backend không bị ảnh hưởng.

Migration mô tả + thư viện ảnh đã có sẵn: `supabase/migrations/202610110003_game_mode_details.sql`.
Không thêm file `202610110001_game_mode_details.sql` nữa — timestamp đó đã dùng cho roster PDF, và constraint sẽ bị tạo trùng.

## Phòng đang mở
Trang chi tiết của Đua tới kho báu, Quiz Party và Nối Từ dùng `OpenRoomsPanel`:
- host, số người / sức chứa, số đội, mã phòng, thời điểm tạo
- phòng đầy thì nút thành "Đã đầy"
- host bấm "Vào lại phòng" (không join lại)
- nút Làm mới; tự làm mới khi quay lại tab, cách nhau ít nhất 20 giây (không poll liên tục)
- Đại chiến Bu Lông chơi trực tiếp nên không có mục này

API mới: `GET /api/game-rooms/open/:gameKey` (cần đăng nhập).
Endpoint cũ `GET /api/game-rooms/open?game_mode=` vẫn giữ.

## Thêm game mới
Thêm 1 mục vào `GAME_CATALOG` (`id` = `game_key`). Game phòng tạo qua `roomGame()` đã bật `openRooms`.

# Giao diện game kiểu Roblox + đồng bộ Quản lý trò chơi

## Cách áp dụng
1. Giải nén zip vào thư mục gốc repo `class-web` (ghi đè các file trùng đường dẫn).
2. Chạy migration mới trên Supabase: `supabase/migrations/202610110001_game_mode_details.sql`
   (thêm cột `detail_description`, `gallery_paths` và tạo sẵn 4 dòng game trong bảng `game_mode_images`).
3. Deploy lại backend + frontend.

## Nguyên nhân 2 game không đồng bộ
"Đại chiến Bu Lông" và "Nối Từ" được viết cứng trong `GameModePickerPage.jsx`, không nằm trong
`GAME_MODES` nên Admin không có ô quản lý. Giờ mọi trang đọc từ `GAME_CATALOG` (`lib/gameModes.js`).
`GAME_MODES` giữ nguyên chỉ cho game dạng phòng, nên backend và trang Tạo phòng không bị ảnh hưởng.

## File thay đổi
Mới: migration, `JoinRoomModal.jsx`, `GameDetailPage.jsx`, `AdminGamesWorkspace.jsx`, `game-catalog.css`
Sửa: `routes.js`, `gameModes.js`, `gameModeImageService.js`, `GameModePickerPage.jsx`, `CreateRoomPage.jsx`,
`AdminAccountsPage.jsx`, `App.jsx`, `gameModes.test.js`, backend `gameModeImage.service/controller/routes`

## Thêm game mới sau này
Thêm 1 mục vào `GAME_CATALOG` (id = game_key) — danh sách người chơi và Admin tự có.

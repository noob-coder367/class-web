# Treasure Race 3D Maze — Kế hoạch triển khai

## Phạm vi

Redesign gameplay Treasure Race thành mê cung 3D tối, giữ nguyên luồng tạo phòng, join phòng, quiz/question và API hiện có. Thay board 2D bằng runtime maze; các endpoint cũ vẫn tồn tại, thêm endpoint movement và dữ liệu state additive.

## Kiểm tra hiện trạng

- Frontend: React 19 + Vite, route `/phong/:code`, `RoomPage.jsx` đang render board 2D và submit câu trả lời qua `gameRoomService.js`.
- Backend: Express + Supabase service-role, `gameRoom.service.js` đang giữ position tuyến tính, movement theo tốc độ trả lời và kết thúc ngay sau answer.
- Database: `game_rooms`, `game_games`, `game_teams`, `game_turns`; bảng quiz/question giữ nguyên.
- CSS: `frontend/src/game.css` đang được dùng bởi CreateRoom/RoomPage; chỉ bổ sung style mới, không xóa hoặc rewrite phần không liên quan.

## Kiến trúc đề xuất

### Backend — nguồn sự thật

- `treasureRace.engine.js`: seeded maze generator (perfect maze), cell graph, BFS shortest-path, collision-aware movement, answer evaluation, authoritative dice/phase helpers.
- `gameRoom.service.js`: khởi tạo một `maze_seed` và `maze_layout` khi start, expose maze/state, transition `QUESTION -> RESULT -> DICE_ROLL -> MOVEMENT -> NEXT_QUESTION -> FINISHED`; dice dùng `randomInt(1, 7)` trên server; validate current turn, phase, collision và remaining moves trước khi update.
- Answer đúng chỉ tạo dice result + remaining moves và chuyển phase `DICE_ROLL`; answer sai chuyển thẳng `NEXT_QUESTION`/next team, không roll và không movement.
- Movement endpoint mới nhận một direction; server chỉ nhận `up/down/left/right`, kiểm tra ô đích và số bước, trừ đúng một bước khi hợp lệ. Đụng tường giữ vị trí/số bước và trả về `collision` để client animate shake/impact.
- Khi hết câu hỏi, nếu chưa có đội tới EXIT: tính BFS distance tới exit, xếp hạng theo distance tăng dần, rồi correct_count giảm dần, total_response_time tăng dần; lưu winner server-side.

### Persistence additive

Migration mới thêm vào `game_games`: `phase`, `maze_seed`, `maze_layout`, `dice_result`, `remaining_moves`, `total_response_time`; thêm `maze_x`, `maze_y` vào `game_teams`. Các cột có default/null phù hợp để không phá dữ liệu game cũ.

### Frontend

- `RoomPage.jsx`: lobby giữ nguyên; play view dùng `MazeScene`, status HUD, question card, dice overlay, mobile controls và scoreboard.
- `components/game/MazeScene.jsx`: Three.js + React Three Fiber, low-poly instanced walls, player token/torch, exit glow, fog/darkness; camera theo dõi player. Có fallback quality giảm shadow/effect dựa trên coarse pointer/hardwareConcurrency.
- `components/game/DiceOverlay.jsx`: dice 3D CSS transform/animation chỉ trình bày; hiển thị server dice result sau khi response state cập nhật.
- `components/game/MobileControls.jsx`: 4 nút điều hướng lớn, accessible labels, chỉ hiện trên touch/coarse pointer nhưng vẫn có thể dùng bằng keyboard.
- `lib/maze.js`: client-side normalize/layout helpers và cell coordinate mapping, không quyết định dice/winner.
- `gameRoomService.js`: giữ API cũ, bổ sung `moveRoom`.
- `game.css`: bổ sung namespace `.maze-*`, HUD/overlay/mobile styles; không xóa CSS hiện tại.

### State machine UI

`lobby -> question -> dice_roll -> movement -> next_question -> question`; `finished` là terminal. Polling hiện có được giữ để tương thích multiplayer; sau mutation refresh state từ server. Keyboard chỉ phát movement khi phase `movement` và còn bước.

## Design direction

- **Design movement:** dark expedition / low-poly dungeon — cảm giác khám phá trong bóng tối, tương phản bằng ánh đuốc và màu đội.
- **Core principles:** readable in darkness; server state luôn rõ ràng; motion có trọng lượng; controls mobile-first.
- **Color philosophy:** nền than/navy gần đen để vùng chưa khám phá biến mất; amber cho torch/exit; accent màu đội chỉ dùng cho token và status; đỏ cam cho va chạm.
- **Layout paradigm:** canvas maze là lớp chính toàn màn hình, HUD nổi theo góc; question/dice là các panel nổi theo phase thay vì dashboard nhiều cột.
- **Signature elements:** vignette/fog, amber torch halo, beveled low-poly stone walls.
- **Interaction:** mỗi phím/nút tương ứng một ô, phản hồi tức thì nhưng chỉ server commit; wall bump có shake + impact ring.
- **Animation:** dice roll 3D 700–900ms; player glide ngắn giữa ô; wall shake dưới 250ms; không lạm dụng particle trên máy yếu.
- **Typography:** giữ DM Sans/Manrope hiện tại; số bước/dice dùng Manrope 800, labels ngắn và uppercase.
- **Brand essence:** cuộc đua quiz trong mê cung tối, nơi kiến thức mở đường; tò mò, cạnh tranh, rõ ràng.
- **Brand voice:** “Đúng rồi — ngọn đuốc mở thêm một lối đi.” / “Tường chắn đường. Chọn hướng khác.”
- **Signature color:** amber torch `#f6b94b` trên nền `#070b14`.

## File dự kiến sửa/tạo

### Tạo
- `backend/src/services/game/maze.js`
- `supabase/migrations/202610080001_treasure_race_3d_maze.sql`
- `frontend/src/components/game/MazeScene.jsx`
- `frontend/src/components/game/DiceOverlay.jsx`
- `frontend/src/components/game/MobileControls.jsx`
- `frontend/src/lib/maze.js`
- `TODO.md` nếu native task list không khả dụng

### Sửa
- `backend/src/services/game/treasureRace.engine.js`
- `backend/src/services/game/gameRoom.service.js`
- `backend/src/controllers/gameRoom.controller.js`
- `backend/src/routes/gameRoom.routes.js`
- `frontend/src/services/gameRoomService.js`
- `frontend/src/pages/RoomPage.jsx`
- `frontend/src/game.css`
- `backend/test/treasureRace.engine.test.js`

## Tương thích và giới hạn

- Không xóa `frontend/src/game.css`, không đổi quiz/question API.
- `answer` endpoint vẫn là endpoint hiện tại nhưng trả phase/dice state mới.
- Không tin client về dice, position, remaining moves hoặc winner.
- Nếu R3F không tải được hoặc WebGL không khả dụng, hiển thị CSS maze fallback tối giản nhưng vẫn dùng cùng server state và controls.
- Native PowerPoint không liên quan; deliverable là source code trong repo.

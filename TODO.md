# Treasure Race 3D Maze — Acceptance outcomes

## Server-authoritative maze gameplay

- Mỗi đội/người chơi là một nhân vật 3D trong cùng một maze; tất cả client nhận cùng `maze_seed` và `maze_layout`.
- Maze generation/pathfinding tách module riêng; maze seeded; BFS tính shortest-path tới EXIT.
- Server là nguồn dữ liệu chính cho vị trí, dice result, remaining moves, phase và winner; client không tự quyết định dice.
- State machine hỗ trợ `QUESTION -> RESULT -> DICE_ROLL -> MOVEMENT -> NEXT_QUESTION -> FINISHED` (các phase được lưu server-side; answer đúng đi qua dice roll, sai không roll và chuyển câu tiếp theo).

## Question, dice và movement

- Sau câu trả lời đúng, server roll số 1–6; UI hiển thị dice 3D animation lớn và sau animation chuyển sang phase di chuyển.
- Desktop dùng Arrow Up/Down/Left/Right hoặc WASD; mobile/tablet có bốn nút ↑ ↓ ← →.
- Mỗi ô hợp lệ trừ một bước; người chơi tự chọn hướng; server validate phase, collision và remaining moves.
- Không đi xuyên tường; đụng tường giữ nguyên vị trí/số bước và trả feedback collision để UI rung/shake + impact.

## Win và hiển thị

- Đội tới EXIT trước khi hết câu hỏi thắng ngay.
- Hết câu hỏi mà chưa có đội tới EXIT: xếp theo BFS distance tới EXIT, rồi correct_count giảm dần, rồi tổng response time tăng dần.
- Maze gần như tối hoàn toàn, torch chiếu vùng nhỏ, EXIT có glow nhẹ, HUD có remaining moves và tên/màu đội.
- Dùng low-poly Three.js/React Three Fiber, fog/light/shadow và fallback quality thấp cho máy yếu; giữ `frontend/src/game.css` và UI hiện tại ngoài gameplay.

## Compatibility

- Giữ nguyên create room, join room, quiz/question API và route room hiện có; endpoint movement/dice mới là additive.
- Migration additive cho state maze; không rollback hoặc xóa tính năng hiện tại.

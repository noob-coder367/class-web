# Quizly — product foundation

Quizly là nền tảng quiz/game cho lớp học, gồm landing page, đăng ký/đăng nhập, hồ sơ, quiz builder, tạo câu hỏi bằng AI/OCR, admin dashboard và game Treasure Race 3D. Realtime và leaderboard độc lập chưa được triển khai; game hiện đồng bộ state qua API polling.

## Cấu trúc

- `frontend/` — React + Vite; route-level lazy loading, auth, quiz builder, admin và Treasure Race 3D.
- `backend/` — Express API, Supabase Auth, quiz/AI/OCR/game services và kiểm tra role admin.
- `supabase/` — migrations cho profiles, quizzes/questions, ghost accounts, game, assets và các helper transaction/idempotency.
- `supabase/RESET-LEGACY.sql` — chạy một lần trên Supabase SQL Editor để xóa data/user/storage class-management cũ, giữ admin.

## Authentication

- Supabase Auth tiếp tục là identity/session provider.
- Đăng ký bằng tên hiển thị, email và mật khẩu; backend tạo user/profile và gửi email xác nhận.
- Đăng nhập bằng email/password; backend xác thực và trả session Supabase.
- Frontend lưu/khôi phục session qua Supabase client; `GET /api/auth/me` yêu cầu bearer token và trả role đã xác thực.
- Role admin được nhận diện từ profile; dashboard admin quản lý tài khoản, phòng, câu hỏi và nội dung game.

## Game và tính nhất quán

- Đáp án được xác minh ở backend; public question không chứa answer key/reference answer.
- Tạo room dùng `create_game_room_atomic` để tạo aggregate room/game/team/host player trong một transaction.
- Answer hỗ trợ `Idempotency-Key`; `game_turns` có unique constraint theo game/turn để chống replay cùng câu hỏi.
- Migration `supabase/migrations/202610100001_game_atomicity.sql` phải được apply trong môi trường đích **trước** khi deploy backend sử dụng các RPC mới.

### Quy trình migration an toàn

1. Backup/verify staging database trước.
2. Apply migration mới trên staging hoặc Supabase preview.
3. Chạy backend/frontend test và kiểm tra create room, join, answer, OCR quota.
4. Chỉ sau khi xác minh mới apply migration trên production theo quy trình vận hành của dự án.
5. Không chạy `supabase/RESET-LEGACY.sql` trong production; migration atomicity là additive và không xóa dữ liệu.

Cấu hình mẫu frontend ở `frontend/.env.example`; backend ở `backend/.env.example`. Service-role key chỉ được đặt ở backend, không đưa vào frontend hoặc Git.

## Chạy cục bộ

```bash
cd frontend
npm ci
npm run dev
```

```bash
cd backend
npm ci
npm run dev
```

## Kiểm tra

```bash
cd frontend
npm run lint
npm run build
```

```bash
cd backend
npm test
```

Dependency audit nên chạy riêng trong từng workspace:

```bash
cd backend && npm audit --omit=dev
cd frontend && npm audit --omit=dev
```

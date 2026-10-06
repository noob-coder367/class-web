# Quizly — product foundation

Quizly là nền tảng quiz/game đang ở giai đoạn foundation. Repository hiện cung cấp landing page, đăng ký/đăng nhập và hạ tầng ứng dụng cần thiết; **quiz, gameplay, realtime và leaderboard chưa được triển khai**.

## Cấu trúc

- `frontend/` — React + Vite; responsive UI và các route `/`, `/dang-nhap`, `/dang-ky`.
- `backend/` — Express API, Supabase Auth, hồ sơ và kiểm tra role admin.
- `supabase/` — cấu hình email xác nhận và SQL dọn schema/data legacy.
- `supabase/RESET-LEGACY.sql` — chạy một lần trên Supabase SQL Editor để xóa data/user/storage class-management cũ, giữ admin.

## Authentication

- Supabase Auth tiếp tục là identity/session provider.
- Đăng ký bằng tên hiển thị, email và mật khẩu; backend tạo user/profile và gửi email xác nhận.
- Đăng nhập bằng email/password; backend xác thực và trả session Supabase.
- Frontend lưu/khôi phục session qua Supabase client; `GET /api/auth/me` yêu cầu bearer token và trả role đã xác thực.
- Role admin được nhận diện từ profile; dashboard admin chưa được xây trong phase này.

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

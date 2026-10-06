# Quizly — product foundation

Quizly là nền tảng quiz/game đang ở giai đoạn foundation. Repository hiện cung cấp landing page, đăng ký/đăng nhập và hạ tầng ứng dụng cần thiết; **quiz, gameplay, realtime và leaderboard chưa được triển khai**.

## Cấu trúc

- `frontend/` — React + Vite; responsive UI và các route `/`, `/dang-nhap`, `/dang-ky`.
- `backend/` — Express API, Supabase Auth, hồ sơ/role và API AI hiện hữu.
- `supabase/` — cấu hình email và ghi chú/schema liên quan AI còn cần cho hạ tầng.
- `docs/render-ai-grading-worker.md` — ghi chú triển khai worker AI grading được giữ lại.

## Authentication

- Supabase Auth tiếp tục là identity/session provider.
- Đăng ký bằng tên hiển thị, email và mật khẩu; backend tạo user/profile và gửi email xác nhận.
- Đăng nhập bằng email/password; backend xác thực và trả session Supabase.
- Frontend lưu/khôi phục session qua Supabase client; `GET /api/auth/me` yêu cầu bearer token và trả role đã xác thực.
- Role admin được nhận diện từ profile; dashboard admin chưa được xây trong phase này.

Cấu hình mẫu frontend ở `frontend/.env.example`; backend ở `backend/.env.example`. Service-role key và khóa AI chỉ được đặt ở backend, không đưa vào frontend hoặc Git.

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

## AI

AI service abstraction, models/provider settings, OCR/vision, quota/retry và worker hiện hữu được giữ nguyên, không xuất hiện trong UI foundation này. Chưa có quiz generation hoặc AI-driven gameplay.

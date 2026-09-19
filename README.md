# class-web — Monorepo 3-tier (Frontend / Backend / Supabase)

Tái cấu trúc từ dự án React/Vite + Supabase (client-only) gốc sang mô hình
3 lớp: **Frontend (React/Vite)** → **Backend (Node/Express)** → **Supabase**.

## Vì sao phải refactor?

Bản gốc gọi Supabase trực tiếp từ trình duyệt bằng anon key cho **mọi** thao
tác, bao gồm cả thao tác nhạy cảm:

| Vấn đề trong bản gốc | Rủi ro |
|---|---|
| `SECRET_CODE` hardcode trong `App.jsx`, kiểm tra ở client | Ai mở DevTools cũng đọc được mã, hoặc gọi thẳng Supabase để tự set `is_member: true` |
| Toàn bộ thao tác Admin (list/toggle role/xóa user) gọi thẳng `supabase.from('profiles')` bằng anon key | Chỉ được chặn bởi RLS (nếu cấu hình đúng); nút "Admin" trên UI chỉ ẩn/hiện, không chặn được request thật |
| Đăng ký/đăng nhập/OTP xử lý hoàn toàn ở client | Không có nơi tập trung để audit, rate-limit, hay validate nghiệp vụ trước khi chạm DB |

## Kiến trúc hiện tại

```
class-web/
├── .gitignore
├── README.md
├── backend/                        # Node.js + Express (service role key sống ở đây)
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── app.js
│       ├── config/
│       │   ├── env.js
│       │   └── supabaseClient.js
│       ├── controllers/            # auth, admin, classroom, events, images, push
│       ├── routes/                 # admin, auth, classroom, events, images, push
│       ├── services/               # auth, admin, classRoster, classroom,
│       │                           # cleaningDuty, events, homework, rules,
│       │                           # timetable, announcements, push, …
│       ├── middlewares/            # auth, admin, member, validate, error
│       ├── data/                   # timetable.default.json, rules.default.json
│       ├── lib/                    # roles, reputationStatus
│       └── utils/
└── frontend/                       # React + Vite (chỉ dùng anon key)
    ├── .env.example
    ├── index.html
    ├── package.json
    ├── public/                     # favicon, icons, sw.js, images
    └── src/
        ├── App.jsx / main.jsx / App.css / index.css
        ├── assets/
        ├── lib/                    # supabaseClient, roles, cleaningDuty, unreadStore
        ├── services/               # apiClient, authService, adminService,
        │                           # classroomService, eventsService, pushService
        ├── context/                # AuthContext, WeatherContext
        ├── pages/                  # AuthPage, HomePage
        ├── hooks/
        └── components/             # AdminPanel, ClassListPanel, ClassRoomView,
                                    # AnnouncementsBoard, EventsSection,
                                    # HomeworkBoard, RulesBoard, CleaningBoard,
                                    # ProfileMenu, OceanScrollBackground, …
```

## Tên hiển thị (display name)

- Tài khoản Google mới có thể được gán username tạm `pending:<userId>`.
- Frontend hiện form **Tên hiển thị** khi `profile.needs_display_name === true`.
- User đặt tên lần đầu: `POST /api/auth/display-name`.
- User đổi tên sau đó: `POST /api/auth/change-username` (tối đa **2 lần / 7 ngày**).
- Admin đổi tên hộ: `PATCH /api/admin/users/:id/username` (không tính hạn mức user).
- Backend luôn ghi `updated_at` khi lưu tên; `forcePendingIfAutoNamed` **không** reset tên đã được user/admin đặt (chỉ xử lý username auto từ Google ngay sau khi tạo hồ sơ).

## Những gì đã chuyển từ Frontend sang Backend

- **`SECRET_CODE`**: chỉ trong `backend/.env`, so sánh ở `auth.service.js::registerUser`.
- **Đăng ký / xác nhận email / login username / quên mật khẩu**: qua `/api/auth/*`.
- **Tài khoản ma**: nút ma cạnh ô Gmail → `taikhoanma-x@ghost.com`. Seed `x` tăng mãi (kể cả khi xóa/đăng xuất). Chỉ đăng ký được với mã thành viên 10A4, bỏ qua email xác nhận, hiện form đặt tên ngay. Tối đa **2 tài khoản ma / ngày** (cả server). Admin vẫn thấy, đổi tên, xóa được.
- **Tên hiển thị**: `/api/auth/display-name`, `/api/auth/change-username`, `/api/auth/username-change-status`.
- **Admin Panel**: `GET/PATCH/DELETE /api/admin/...` — `requireAuth` + `requireAdmin`.
- **Quyền lớp phó** (enforce backend): học tập, kỷ luật, sự kiện, lao động (trực vệ sinh).
- **Sự kiện, lịch trực, khu vực lớp 10A4, TKB, bài tập, nội quy, thông báo**: API classroom/events tương ứng, không tin client.

Điều **vẫn giữ ở frontend** (không nhạy cảm): đọc public, realtime, Google OAuth (anon key + RLS).

## Khu vực lớp (Vô Lớp 10A4)

Thành viên bấm **Vô Lớp 10A4** vào màn nội bộ (thông báo, TKB, bài tập, nội quy, trực vệ sinh…). Chỉ trả dữ liệu sau khi backend xác thực token + `is_member` (hoặc admin).

## Cài đặt / Settings (Profile)

- Đổi ảnh đại diện (local, tối đa 3 lần/24h).
- Đổi tên hiển thị (hạn mức 2 lần/7 ngày).
- Đổi mật khẩu (tài khoản email/password).
- Bật/tắt chia sẻ vị trí (nền đại dương theo thời tiết) và Web Push.

## Cách chạy

### 1. Cấu hình Supabase

- Project URL
- `anon` key → **frontend**
- `service_role` key → **backend** (không lộ ra ngoài)

### 2. Backend

```bash
cd backend
cp .env.example .env
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SECRET_CODE
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
npm install
npm run dev
```

## Ghi chú bảo mật

- `.env` đã bị `.gitignore` — không commit.
- Không đưa `SUPABASE_SERVICE_ROLE_KEY` / `SECRET_CODE` vào `frontend/`.
- Bảng `profiles` nên bật RLS; thao tác quan trọng vẫn enforce ở backend.
- Chạy `supabase/secure-roles.sql` nếu có trong repo để khóa role/events từ client.

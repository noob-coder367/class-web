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

## Kiến trúc mới

```
class-web-monorepo/
├── .gitignore
├── README.md
├── backend/                  # Node.js + Express (service role key sống ở đây)
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── app.js
│       ├── config/
│       │   ├── env.js
│       │   └── supabaseClient.js     # client dùng SERVICE_ROLE_KEY
│       ├── controllers/
│       │   ├── auth.controller.js
│       │   └── admin.controller.js
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── admin.routes.js
│       │   └── index.js
│       ├── services/
│       │   ├── auth.service.js       # SECRET_CODE, OTP, login/register logic
│       │   └── admin.service.js      # quản lý user (bypass RLS an toàn)
│       └── middlewares/
│           ├── auth.middleware.js    # requireAuth (verify access_token)
│           ├── admin.middleware.js   # requireAdmin (role === 'admin')
│           ├── validate.middleware.js
│           └── error.middleware.js
└── frontend/                 # React + Vite (chỉ dùng anon key)
    ├── .env.example
    ├── package.json
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── lib/
        │   └── supabaseClient.js     # client dùng ANON_KEY (public reads, session)
        ├── services/
        │   ├── apiClient.js          # fetch wrapper gọi backend
        │   ├── authService.js
        │   └── adminService.js
        ├── context/
        │   └── AuthContext.jsx       # session/profile toàn app
        ├── pages/
        │   ├── AuthPage.jsx          # login/register/otp/forgot/reset
        │   └── HomePage.jsx          # landing page + điều hướng modal
        └── components/
            ├── AdminPanel.jsx        # gọi adminService, không gọi supabase trực tiếp
            ├── EventsSection.jsx
            └── decor/SeaDecor.jsx    # component trang trí thuần UI
```

## Những gì đã chuyển từ Frontend sang Backend

- **`SECRET_CODE`**: không còn tồn tại ở frontend. Nằm trong
  `backend/.env` (`SECRET_CODE=...`), chỉ được so sánh trong
  `auth.service.js::registerUser`.
- **Đăng ký**: `POST /api/auth/register` — backend tạo user bằng
  `supabase.auth.admin.createUser` (service role), tự kiểm tra
  username trùng, tự set `is_member` dựa trên kết quả kiểm tra
  `SECRET_CODE` ở server (không tin dữ liệu client gửi lên).
- **OTP**: `POST /api/auth/verify-otp`, `POST /api/auth/resend-otp` —
  backend gọi `supabase.auth.verifyOtp` / `signInWithOtp` bằng service
  role key.
- **Đăng nhập bằng username**: `POST /api/auth/login` — backend tra
  email từ username rồi gọi `signInWithPassword`, trả `session` thật
  của Supabase về cho frontend.
- **Quên/đổi mật khẩu**: `POST /api/auth/forgot-password`,
  `POST /api/auth/reset-password`.
- **Toàn bộ Admin Panel**: `GET/PATCH/DELETE /api/admin/users/...` —
  được canh gác bởi `requireAuth` + `requireAdmin`, chạy bằng service
  role key nên **không phụ thuộc RLS** để đảm bảo an toàn.
- **Khu vực lớp 10A4**: `GET /api/classroom/access`,
  `GET /api/classroom/tabs/:tab` — `requireAuth` + `requireMember`.
  Nội dung tab (thông báo chung, TKB, bài tập, nội quy) **không** nằm
  trong JS frontend; ai mở F12 cũng không đọc được nếu chưa là thành viên.

Điều **vẫn giữ ở frontend** (vì không nhạy cảm, đúng mô hình khuyến nghị
của Supabase): đọc `announcements`, đọc/đăng `events`, realtime
subscriptions, đăng nhập Google OAuth — dùng client anon key +
RLS như bình thường. Nếu muốn siết chặt hơn nữa, có thể chuyển tiếp
`handleSubmit` / `handleDeleteAnnouncement` trong `HomePage.jsx` và các
thao tác ghi trong `EventsSection.jsx` sang backend theo đúng khuôn mẫu
`admin.routes.js`.

## Khu vực lớp (Vô Lớp 10A4)

Thành viên bấm **Vô Lớp 10A4** sẽ vào màn hình nội bộ với 4 mục cạnh nút thoát:

1. Thông báo chung (mặc định)
2. Thời khoá biểu
3. Bài tập về nhà
4. Nội quy lớp

Hiện các mục **Thông báo chung / Bài tập / Nội quy** đang trống ("Chưa có nội dung"). Tab **Thời khoá biểu** hiển thị TKB lớp 10A4 (buổi sáng + buổi chiều, gồm Thứ 7). Admin thấy nút cài đặt góc dưới phải để đổi môn (dropdown) và giờ học. Dữ liệu mặc định nằm ở `backend/src/data/timetable.default.json`, bản chỉnh của admin lưu vào Supabase Storage bucket `classroom-data` (`timetable.json`) qua:

- `GET /api/classroom/timetable` — thành viên / admin
- `PUT /api/classroom/timetable` — **chỉ admin**


## Ảnh website (giáo viên, ảnh lớp)

Admin mở **Quản lý Admin → tab Ảnh website** để thêm/xóa:

- Ảnh giáo viên
- Ảnh lớp trên banner trang chủ
- Ảnh gallery (kỷ niệm)

Ảnh được lưu trên **Supabase Storage** (bucket `site-images`), nên trang chủ
hiện ảnh mới ngay, không cần token GitHub. Admin thêm/xóa từ
**Quản lý Admin → tab Ảnh website**.

Bảng đăng nhập/đăng ký: bấm ra ngoài khung (hoặc phím Esc) để đóng.

## Cách chạy

### 1. Cấu hình Supabase

Trong Supabase Dashboard, lấy 3 giá trị:
- Project URL
- `anon` / `publishable` key → dùng cho **frontend**
- `service_role` key → dùng cho **backend**, tuyệt đối không lộ ra ngoài

### 2. Backend

```bash
cd backend
cp .env.example .env
# điền SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SECRET_CODE thật vào .env
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# điền VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL vào .env
npm install
npm run dev
```

## Ghi chú bảo mật

- `.env` (cả hai thư mục) đã bị chặn bởi `.gitignore` gốc — không commit.
- Không bao giờ đưa `SUPABASE_SERVICE_ROLE_KEY` hay `SECRET_CODE` vào
  bất kỳ file nào trong `frontend/`.
- Bảng `profiles` trên Supabase nên có RLS bật (người dùng chỉ đọc/sửa
  hồ sơ của chính mình) như một lớp phòng thủ bổ sung — dù giờ đây các
  thao tác quan trọng đã được backend enforce độc lập với RLS.
- Nội dung khu vực lớp (thông báo, TKB, bài tập, nội quy) chỉ trả về
  sau khi backend xác thực token + `is_member` (hoặc admin). Ẩn nút trên
  UI không đủ — request thật vẫn bị 403 nếu giả lập F12.


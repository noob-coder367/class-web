# Email xác nhận đăng ký (link) + OTP quên mật khẩu

Đăng ký **không còn dùng mã OTP 6 số**. Sau khi nhập Gmail, backend gửi
**email xác nhận** (bấm link). Quên mật khẩu vẫn dùng mã 6 số.

## Việc cần làm trên Supabase Dashboard

1. Vào **Authentication → Providers → Email**
2. Bật **Confirm email**
3. Vào **Authentication → Email Templates** và sửa các template dưới đây.

### 1) Confirm signup (đăng ký tài khoản thường)

**Subject:**
```text
Xác nhận tài khoản 10A4
```

**Body:**
```html
<h2>Xác nhận đăng ký</h2>
<p>Xin chào,</p>
<p>Hãy bấm nút bên dưới để xác nhận email và kích hoạt tài khoản lớp 10A4.</p>
<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 18px;background:#14324a;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">
    Xác nhận email
  </a>
</p>
<p>Nếu nút không bấm được, copy link này:</p>
<p>{{ .ConfirmationURL }}</p>
```

> Redirect URL nên trùng domain frontend (ví dụ `https://class-web-zeta.vercel.app`).

### 2) Magic Link (dự phòng nếu Confirm signup không gửi được)

**Subject:**
```text
Xác nhận tài khoản 10A4
```

**Body:** dùng `{{ .ConfirmationURL }}` như trên. Không cần hiện `{{ .Token }}`.

### 3) Reset Password (quên mật khẩu — vẫn dùng OTP)

**Subject:**
```text
Mã đặt lại mật khẩu 10A4: {{ .Token }}
```

**Body:**
```html
<h2>Đặt lại mật khẩu</h2>
<p>Mã OTP của bạn là:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:bold;">{{ .Token }}</p>
<p>Nhập mã này trong app để đổi mật khẩu. Không cần bấm link.</p>
```

## Tài khoản ma

Tài khoản `taikhoanma-x@ghost.com` **không gửi email**. Backend tự xác nhận
và đưa thẳng vào form đặt tên hiển thị.

# Email xác nhận đăng ký + đặt lại mật khẩu (dùng link)

Website **không dùng mã OTP 6 số** cho xác thực. Chỉ có 2 email, cả hai đều
chứa link `{{ .ConfirmationURL }}`:

| Luồng | Backend gọi | Template Supabase |
|---|---|---|
| Đăng ký | `supabaseAdmin.auth.resend({ type: 'signup', options: { emailRedirectTo: FRONTEND_ORIGIN } })` | **Confirm signup** |
| Quên mật khẩu | `supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo: FRONTEND_ORIGIN })` | **Reset Password** |

## Việc cần làm trên Supabase Dashboard

1. **Authentication → Providers → Email**: bật **Confirm email**.
2. **Authentication → URL Configuration**:
   - **Site URL** = domain frontend (vd `https://class-web-zeta.vercel.app`).
   - **Redirect URLs** phải có đúng giá trị `FRONTEND_ORIGIN` của backend
     (thêm cả `http://localhost:5173` nếu test local). Nếu thiếu, Supabase sẽ
     redirect về Site URL thay vì `FRONTEND_ORIGIN`.
3. **Authentication → Email Templates**: sửa 2 template dưới đây.
   Không dùng `{{ .Token }}` ở bất kỳ template nào.

### 1) Confirm signup

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

### 2) Reset Password

**Subject:**
```text
Đặt lại mật khẩu tài khoản 10A4
```

**Body:**
```html
<h2>Đặt lại mật khẩu</h2>
<p>Xin chào,</p>
<p>Hãy bấm nút bên dưới để đặt mật khẩu mới cho tài khoản lớp 10A4.</p>
<p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 18px;background:#14324a;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">
    Đặt lại mật khẩu
  </a>
</p>
<p>Nếu nút không bấm được, copy link này:</p>
<p>{{ .ConfirmationURL }}</p>
<p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
```

## Luồng phía website

- **Đăng ký**: form → backend tạo tài khoản + gửi email → màn "Kiểm tra email để
  xác nhận tài khoản" → user bấm link → quay về website → đăng nhập.
- **Quên mật khẩu**: nhập username/email → backend tìm email → Supabase gửi email
  → user bấm link → quay về website → Supabase phát `PASSWORD_RECOVERY` → form
  "Đặt mật khẩu mới" → `supabase.auth.updateUser({ password })` → đăng nhập lại.
- Link hết hạn / không hợp lệ: website báo lỗi và user yêu cầu gửi lại email
  (nút "Gửi lại email xác nhận" / "Gửi lại email đặt lại mật khẩu").

## Tài khoản ma

Tài khoản `taikhoanma-x@ghost.com` **không gửi email**. Backend tự xác nhận
và đưa thẳng vào form đặt tên hiển thị. Tài khoản ma không dùng được quên mật khẩu.

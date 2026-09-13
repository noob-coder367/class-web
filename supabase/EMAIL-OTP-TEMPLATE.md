# Email OTP — gửi mã 6 số (không dùng link xác nhận)

App **đã có màn hình nhập OTP**. Email hiện gửi **link** vì template mặc định của Supabase dùng `{{ .ConfirmationURL }}`.

## Việc cần làm trên Supabase Dashboard

1. Vào **Authentication → Email Templates**
2. Sửa **2 template** sau (dán nội dung mẫu bên dưới).

### 1) Magic Link (dùng cho đăng ký / gửi lại mã)

**Subject:**
```text
Mã xác nhận 10A4: {{ .Token }}
```

**Body:**
```html
<h2>Mã xác nhận đăng ký</h2>
<p>Xin chào,</p>
<p>Mã OTP của bạn là:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:bold;">{{ .Token }}</p>
<p>Nhập mã này trong app (trang Xác nhận email). Mã có hiệu lực trong khoảng 1 giờ.</p>
<p><strong>Không cần bấm link.</strong> Nếu email có nút/link, hãy bỏ qua.</p>
```

> Có thể xóa hết `{{ .ConfirmationURL }}` khỏi template để khỏi hiện nút "Confirm".

### 2) Reset Password (quên mật khẩu)

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

## Lưu ý

- `{{ .Token }}` = mã **6 chữ số** khớp với ô OTP trong app.
- Sau khi Save template, đăng ký / gửi lại mã **một lần nữa** để nhận email mới.
- Không cần redeploy code cho bước này.

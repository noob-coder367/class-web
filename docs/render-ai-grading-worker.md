# Deploy AI Grading Worker trong web service trên Render

## Kiến trúc miễn phí

`class-web-backend` chạy API và AI grading worker trong **cùng một web process**. Khi `AI_GRADING_ENABLED=true`, `backend/src/server.js` gọi `startAiGradingWorker({ workerId: \`ai-web-${process.pid}\` })` sau khi server listen thành công.

Không tạo Render Background Worker riêng và không dùng `node src/workers/ai-grading.worker.js` làm Start Command cho service web.

## Cấu hình web service

Giữ nguyên service hiện tại:

| Setting | Value |
|---|---|
| Service | `class-web-backend` |
| Repository | `noob-coder367/class-web` |
| Branch | `main` |
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `node src/server.js` hoặc `npm start` |
| Region | `oregon` |

Không tạo Background Worker trả phí và không đổi Start Command của web service thành `npm run worker`.

## Environment variables trên web service

Đặt hoặc kiểm tra các biến sau trong Render Environment:

Bắt buộc do `backend/src/config/env.js`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SECRET_CODE`

AI grading:

- `AI_GRADING_ENABLED=true`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `OCR_SPACE_API_KEY`

Nên giữ thêm các biến `AI_GRADING_*` và biến model hiện có nếu muốn thay đổi mặc định trong `backend/src/config/env.js`, ví dụ `AI_GRADING_CONCURRENCY`, `AI_GRADING_POLL_MS`, `AI_GRADING_MAX_ATTEMPTS`, timeout/retry, giới hạn file và model provider.

Không commit giá trị secret vào repository.

## Log cần thấy sau deploy

Khi bật AI grading:

```text
[server] AI grading worker started in-web
```

Khi chưa bật:

```text
[server] AI grading worker disabled (AI_GRADING_ENABLED!=true)
```

Worker dùng worker ID `ai-web-${process.pid}` và tự dừng timer khi process nhận `SIGTERM` hoặc `SIGINT`. Nếu worker lỗi lúc khởi động, server vẫn không crash; log sẽ có:

```text
[server] không khởi động AI grading worker: ...
```

## Xác minh queue

1. Deploy web service sau khi cập nhật environment.
2. Tạo submission test từ UI.
3. Xác nhận job chuyển từ `pending` sang `processing`, sau đó `completed`, `needs_review`, `failed` hoặc `rate_limited`.
4. Kiểm tra web logs nếu job vẫn `pending`.

Free web service có thể sleep sau một thời gian không có traffic. Trong thời gian ngủ, worker cũng dừng; khi mở app hoặc có request làm service wake, worker sẽ được khởi động lại và tiếp tục poll queue.

## Lưu ý giới hạn

- Không chạy thêm `npm run worker` trên cùng web service, vì sẽ tạo process worker thứ hai không cần thiết.
- Không đổi grading algorithm, model hoặc provider.
- Không cần migration mới.
- Cách chạy Background Worker riêng trong tài liệu cũ không áp dụng cho cấu hình miễn phí này.

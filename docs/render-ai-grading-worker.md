# Deploy AI Grading Worker trên Render

## Kiến trúc

`class-web-backend` tiếp tục chạy API bằng `node src/server.js`. AI grading worker phải là **Background Worker riêng**, dùng cùng repository `noob-coder367/class-web`, branch `main`, và thư mục gốc `backend`.

Worker chạy `npm run worker`, poll bảng `ai_grading_jobs`, claim các job `pending`, xử lý chúng và cập nhật trạng thái. Không đổi grading algorithm, model hoặc provider.

## Tạo Background Worker

Trong Render Dashboard:

1. Chọn workspace **My Workspace**.
2. Chọn **New → Background Worker**.
3. Kết nối repository `https://github.com/noob-coder367/class-web`.
4. Cấu hình:

| Setting | Value |
|---|---|
| Name | `class-web-ai-grading-worker` |
| Branch | `main` |
| Root Directory | `backend` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm run worker` |
| Region | Cùng region với web service; hiện web service là `oregon` |
| Auto-Deploy | Có |

Không dùng `node src/server.js` cho worker và không đổi Start Command của web service `class-web-backend`.

## Environment variables

Copy các biến backend cần thiết từ `class-web-backend` sang worker. Không commit giá trị secret vào repo và không đặt secret trong `render.yaml`.

Bắt buộc do `backend/src/config/env.js`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SECRET_CODE`

Cần cho pipeline AI theo provider đang bật:

- `AI_GRADING_ENABLED=true`
- `GEMINI_API_KEY`
- `OCR_SPACE_API_KEY`
- `GROQ_API_KEY`

Các biến model/timeout/retry có thể copy nguyên giá trị từ web service để hai process dùng cùng policy, hoặc để mặc định trong `backend/src/config/env.js`:

- `AI_GRADING_CONCURRENCY` — mặc định `2`
- `AI_GRADING_POLL_MS` — mặc định `5000`
- `AI_GRADING_MAX_ATTEMPTS`
- `AI_GRADING_STUCK_AFTER_MS`
- `AI_GRADING_*_TIMEOUT_MS`
- `AI_GRADING_*_CONFIDENCE_THRESHOLD`
- `AI_GRADING_MAX_*`
- `GEMINI_PRIMARY_MODEL`, `GEMINI_SECONDARY_MODEL`, `GROQ_MODEL`, `OCR_SPACE_ENDPOINT`

Để API có thể enqueue và hiển thị trạng thái AI đúng, đặt `AI_GRADING_ENABLED=true` trên **web service và worker**. Chỉ worker mới chạy `npm run worker`; web service vẫn chỉ chạy API.

Không cần `PORT`, `FRONTEND_ORIGIN`, `API_PUBLIC_URL`, VAPID hoặc GitHub token cho worker nếu worker không dùng các tính năng tương ứng. Nếu Render đã có bộ biến backend chuẩn, cách an toàn nhất là copy cùng bộ biến sang worker, giữ nguyên secret values.

## Xác minh sau deploy

Trong worker logs cần thấy:

```text
[ai-grading-worker] starting { enabled: true, pollMs: ..., concurrency: ... }
```

Khi có lỗi poll sẽ thấy log `[ai-grading] worker poll failed`. Khi Render dừng/redeploy worker, cần thấy log `shutting down (SIGTERM)` hoặc `shutting down (SIGINT)`.

Checklist:

1. Tạo một submission test từ UI.
2. Xác nhận job chuyển từ `pending` sang `processing`, sau đó `completed`, `needs_review`, `failed` hoặc `rate_limited`.
3. Trang quản trị không còn báo `Worker AI hiện không hoạt động` sau khi queue có worker đang poll.
4. Nếu job vẫn `pending`, kiểm tra `AI_GRADING_ENABLED=true`, Supabase service-role key, provider API key và worker logs.

## Code worker hiện tại

`backend/src/workers/ai-grading.worker.js` đã:

- import `startAiGradingWorker` từ `../services/ai-grading/index.js`;
- thoát sạch khi `AI_GRADING_ENABLED` không phải `true`;
- log startup với enabled/poll/concurrency;
- dùng worker id `ai-worker-${process.pid}`;
- xử lý `SIGTERM`/`SIGINT` và gọi shutdown callback.

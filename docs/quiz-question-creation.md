# Quizly · Hệ thống tạo câu hỏi (phase 2)

Trang `/tao-phong` (và `/tao-phong/:quizId` để sửa lại phòng đã lưu). Chưa có gameplay/join/realtime/leaderboard.

## Cài đặt thủ công (làm theo thứ tự)

1. **Giải nén zip vào gốc repo** (ghi đè các file trùng tên), rồi:
   ```bash
   cd backend && npm install unpdf   # đọc PDF; tự cập nhật package.json + package-lock.json
   git add -A && git commit -m "feat: add quiz question creation system" && git push
   ```
   Không có `unpdf` thì TXT/DOCX/text vẫn chạy, PDF trả lỗi rõ ràng (HTTP 501).
2. **Supabase → SQL Editor**: chạy `supabase/migrations/202610070002_quizzes_and_questions.sql` (an toàn khi chạy lại).
3. **Render** (backend) → Environment:
   - `GROQ_API_KEY` (bắt buộc cho AI), `GROQ_MODEL` (tuỳ chọn, mặc định `openai/gpt-oss-20b`), `AI_PROVIDER=groq`.
   - Giữ `FRONTEND_ORIGIN` = domain Vercel production.
4. **Google OAuth** (nếu chưa bật): Supabase → Authentication → Providers → Google (Client ID/Secret từ Google Cloud),
   Authentication → URL Configuration: thêm domain Vercel vào Site URL và Redirect URLs.
   Redirect URI trên Google Cloud: `https://<project-ref>.supabase.co/auth/v1/callback`.
   Code dùng `window.location.origin`, không hard-code URL.
5. **Vercel**: không cần biến mới (`VITE_API_BASE_URL` giữ nguyên). Route SPA đã có trong `vercel.json` hiện tại.
6. Chạy test: `cd backend && npm test` và `cd frontend && npm test && npm run lint && npm run build`.

## Google-only
Backend (`requireGoogle`) xác minh token bằng Supabase rồi yêu cầu: có identity `google` **và** claim `amr` của chính token
chứa `oauth`. Tài khoản email/password (kể cả đã link Google nhưng đăng nhập bằng mật khẩu) bị 403 `google_required`.
RLS cũng kiểm tra tương tự qua `public.current_user_is_google()`, nên gọi thẳng PostgREST cũng không bypass được.

## API
| Method | Route | Ghi chú |
|---|---|---|
| GET | `/api/quizzes/access` | mọi user đã đăng nhập; trả `can_create_quiz`, `provider` |
| GET/POST | `/api/quizzes` | danh sách / tạo (id do server sinh) |
| GET/PUT/DELETE | `/api/quizzes/:id` | PUT = lưu cả phòng + câu hỏi trong 1 transaction, idempotent theo id |
| POST | `/api/ai/generate-questions` | JSON `{text,count,types,difficulty}` hoặc file thô `application/octet-stream` + header `X-File-Name`; chỉ trả preview, không ghi DB |

Giới hạn AI: 12 lượt/10 phút và 80 lượt/ngày/user, 1 request đồng thời/user, text ≤ 30.000 ký tự, ≤ 30 câu, file ≤ 8 MB (PDF ≤ 150 trang), timeout 45s.

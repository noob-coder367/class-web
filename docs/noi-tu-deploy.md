# Triển khai Nối Từ

1. Review và áp dụng migration theo thứ tự: `supabase/migrations/20261011100100_word_chain_game.sql` (bảng/RPC Nối Từ), sau đó `supabase/migrations/20261014000100_word_chain_room_cancellation.sql` (cho phép trạng thái phòng bị host đóng). Các migration chỉ bổ sung phạm vi Nối Từ, không sửa cấu trúc game cũ. Chạy qua quy trình release Supabase đã được dự án phê duyệt trước khi deploy backend; không chạy trực tiếp khi chưa có quyền và phê duyệt triển khai.
2. Deploy backend lên Render từ branch/PR sau khi migration thành công. Không thêm biến môi trường mới; backend dùng `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` hiện có. API Nối Từ có rate limit riêng.
3. Deploy frontend lên Vercel sau khi API backend có migration. Không thêm biến môi trường mới ngoài cấu hình `VITE_API_BASE_URL` hiện có (nếu dự án dùng URL backend khác mặc định).
4. Smoke-test: mở `/choi`, chọn Nối Từ; thử local theo chủ đề và văn bản; tạo phòng online, cho tài khoản thứ hai vào bằng mã, bắt đầu trận, kiểm tra đáp án hợp lệ/sai/lặp, Bỏ lượt và refresh để kiểm tra đồng bộ. Với host, thử cả hai lựa chọn thoát phòng: giữ phòng và đóng phòng; xác nhận người chơi khác thấy trạng thái phòng đã đóng.

Các migration chưa được áp dụng lên Supabase trong task này; không có tuyên bố deploy Render/Vercel hoặc production database thành công.

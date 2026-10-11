# Kế hoạch triển khai Nối Từ

## Khảo sát repository

- Frontend React/Vite có registry game ở `frontend/src/lib/gameModes.js`, picker ở `GameModePickerPage.jsx`, routing tập trung trong `App.jsx`; game hiện dùng route lobby chung cho đua kho báu và route riêng cho Quiz Party.
- Backend Express dùng auth bắt buộc, route/controller/service, Supabase service-role và RPC PostgreSQL cho cập nhật game atomic. Game rooms hiện yêu cầu quiz nên Nối Từ không dùng các API này để tránh đổi luật game cũ.
- Cơ sở dữ liệu bật RLS và khóa quyền client trực tiếp; ứng dụng dùng backend làm lớp quyền. Client phòng hiện đồng bộ polling 3 giây; không có dấu hiệu một cơ chế Realtime chung đang được dùng cho game state.
- Có test engine, security, atomicity và migration; cả frontend/backend dùng `node --test`. Chưa tìm thấy nguồn wordlist phù hợp có thể đưa vào bundle mà không phát sinh ràng buộc license phức tạp.

## Kiến trúc

- Nối Từ có service/engine, route API, tables và RPC riêng; mọi biến đổi trong trận online khóa bản ghi trận, xác thực đội/lượt, kiểm tra chuỗi từ/trùng/lượt và ghi history trong cùng transaction. Phòng online theo cơ chế auth hiện có, polling trạng thái để tái sử dụng cách đồng bộ của repo.
- Chế độ một máy chạy bằng state client riêng, lưu trạng thái trận trong `sessionStorage` của cùng tab để khôi phục khi refresh; không tạo phòng online, không đăng nhập từng đội và không dùng cấu hình Quiz Party.
- Adapter từ vựng dùng danh sách seed do dự án tự biên soạn có danh mục nguồn/phạm vi rõ; adapter thay nguồn được. Văn bản tự dán trích xuất n-gram heuristic cho strict mode; expanded mode kết hợp nguồn wordlist có cấp phép. Chuẩn hóa NFKC, dấu câu/khoảng trắng và token cuối/đầu ở backend.
- UI thêm entry vào picker, trang thiết lập riêng và màn hình trận responsively; giữ những route và component game hiện tại. Không gọi Gemini theo mỗi lượt; không cần biến môi trường AI mới.
- Migration là bổ sung và RLS deny trực tiếp, RPC chỉ service_role; không chạy migration lên database từ task này.

## Thiết kế giao diện

- **Design movement:** game-show sân khấu hiện đại, lấy cảm hứng từ bảng chữ lớn và đèn hiệu game show.
- **Nguyên tắc:** lượt hiện tại luôn rõ; nhập nhanh trên điện thoại; lịch sử dễ rà; phản hồi lỗi không làm mất nội dung nhập.
- **Màu sắc:** nền mực xanh tím, màu hổ phách cho lượt đang chơi, xanh ngọc cho đáp án hợp lệ và đỏ san hô cho lỗi.
- **Bố cục:** thanh trạng thái ngang ở đầu, sân khấu chữ và ô nhập làm trục chính, lịch sử/điểm đội xếp thành dải bên dưới hoặc cuộn trên mobile.
- **Motif:** chip từ nối, vòng sáng quanh đội hiện tại, đường nối mảnh giữa các cụm từ.
- **Tương tác/animation:** đổi đội nhanh dưới 250 ms, focus input sau mỗi lượt, mọi chuyển động tôn trọng reduced-motion; âm thanh tắt mặc định.
- **Typography:** dùng font hiện tại của ứng dụng; tiêu đề đậm, cụm từ sân khấu lớn, số lượt dùng chữ số tabular.
- **Brand essence:** trò chơi ngôn ngữ theo lượt, dành cho lớp học/nhóm bạn; vui, rõ ràng, công bằng.
- **Brand voice:** “Từ cuối là ‘sinh’ — đội tiếp theo nối nào?” / “Cụm từ đã dùng rồi. Thử một cách nối khác nhé.”
- **Wordmark/mark:** hai thẻ chữ nối nhau bằng mũi tên nhỏ, đặt cạnh chữ NỐI TỪ.
- **Màu nhận diện:** hổ phách `#f5b942`.

## Cấu trúc chính

- `backend/src/services/game/wordChain.*`: chuẩn hóa, adapter, engine và dịch vụ persistence.
- `backend/src/routes/wordChain.routes.js`, controller tương ứng: API được xác thực và giới hạn riêng.
- `supabase/migrations/*word_chain*`: schema, RLS, ràng buộc và RPC atomic mới.
- `frontend/src/pages/WordChain*`, `frontend/src/services/wordChainService.js`, CSS riêng: thiết lập và chơi Nối Từ, tách khỏi quiz/game cũ.
- `backend/test/wordChain*`, `frontend/test/wordChain*`: luật, nguồn nội dung, vòng lượt và state local.
- `docs/word-dictionary-sources.md`: nguồn, license, phạm vi, attribution và cập nhật dữ liệu.

# Nguồn dữ liệu từ vựng Nối Từ

**Ngày kiểm tra nguồn: 11-10-2026.** Phiên bản seed ban đầu: `project-seed-2026-10-11.1`.

## Dữ liệu hiện được dùng

Game hiện dùng một tập seed nhỏ do đóng góp trong repository biên soạn thủ công (`shared/word-chain-seed.json`). Đây là các cụm từ ngắn theo tám chủ đề giao diện cung cấp: động vật, trường học, khoa học, lịch sử, địa lý, thể thao, công nghệ và ẩm thực. Không tải, scrape hoặc chép danh sách từ website/dictionary bên thứ ba vào file này. Các cụm từ là seed gợi ý có giới hạn, không phải từ điển toàn diện; thiếu thuật ngữ hoặc cụm ít gặp là điều có thể xảy ra.

Tập dữ liệu seed được phát hành riêng theo **CC0 1.0 Universal** bởi người đóng góp phần dữ liệu trong thay đổi này; có thể sao chép, sửa đổi, phân phối và sử dụng thương mại mà không cần ghi công. CC0 chỉ áp dụng cho phần lựa chọn seed do dự án tạo, không áp dụng cho mã nguồn, văn bản người dùng dán hoặc nội dung của bên khác. Nội dung license chính thức: https://creativecommons.org/publicdomain/zero/1.0/ .

Danh sách được nạp qua adapter backend `wordChainDictionary.js`; frontend đọc cùng một JSON để hỗ trợ chế độ một máy. Phiên bản adapter được lưu cùng metadata phòng online. Khi cập nhật, tăng hằng phiên bản trong adapter và cập nhật tài liệu này. Nếu phát hiện mục sai/vi phạm, gỡ mục đó khỏi seed; trong các trận đã tạo, nguồn phrase đã được snapshot vào phòng nên không thay đổi ngược lịch sử trận. Không tự động tải hoặc cập nhật từ xa.

## Nguồn đã kiểm tra nhưng không bundle

Wiktionary tiếng Việt, do cộng đồng biên tập, cấp phép nội dung theo CC BY-SA 4.0 và trước đó có nội dung GFDL; trang quyền tác giả nêu nghĩa vụ ghi công và chia sẻ tương tự. Wikimedia cho biết văn bản dump thường theo GFDL và CC BY-SA 4.0, nhưng một số nội dung có ngoại lệ hoặc license khác. Vì yêu cầu theo dõi attribution/share-alike trên từng nội dung, phiên bản này **không bundle hay trích xuất** Wiktionary. Nếu adapter tương lai dùng dữ liệu đó, cần lưu nguồn/version và attribution theo entry/dump, giữ license tương ứng, kiểm tra exceptions và đảm bảo tuân thủ share-alike trước khi phân phối.

Một wordlist khác trong repository `duyet/vietnamese-wordlist` ghi GPL-2.0 và dẫn nguồn Ho Ngoc Duc; do giấy phép copyleft khác với CC0 seed của dự án và nguồn gốc danh sách cần thẩm định thêm, phiên bản này cũng **không bundle** danh sách đó.

## Cách kiểm tra/giới hạn nội dung

- Chế độ theo chủ đề chỉ chấp nhận phrase nằm trong seed chủ đề đã chọn.
- Chế độ dán văn bản strict tạo các n-gram liên tiếp tối đa bốn âm tiết từ văn bản, bằng heuristic tách theo dấu câu/khoảng trắng. Đây **không phải** phân tích hình thái hay xác nhận rằng phrase là mục từ từ điển. UI phải công bố rõ giới hạn này và báo số phrase heuristic tạo được.
- Chế độ expanded dùng văn bản làm ngữ cảnh, sau đó mở rộng bằng tập seed dự án; đây vẫn là wordlist nhỏ chứ không phải từ điển đầy đủ.
- Chế độ kết hợp hợp nhất seed chủ đề với các phrase trích từ văn bản.
- Backend chuẩn hóa Unicode NFKC, chữ thường tiếng Việt, dấu câu và dấu gạch nối thành ranh giới âm tiết; so sánh phrase chuẩn hóa, kiểm tra từ cuối/từ đầu và cấm phrase lặp. Dữ liệu frontend không được dùng để quyết định kết quả phòng online.

## Tham chiếu license

- CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/ .
- Wiktionary tiếng Việt — Quyền tác giả: https://vi.wiktionary.org/wiki/Wiktionary:Quy%E1%BB%81n_t%C3%A1c_gi%E1%BA%A3 .
- Wikimedia dump licensing: https://dumps.wikimedia.org/legal.html .
- Duyet Vietnamese wordlist (GPL-2.0, không được sử dụng trong seed): https://github.com/duyet/vietnamese-wordlist .

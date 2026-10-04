-- Restore the bundled rule wording only where production text is blank.
-- Preserve existing section order, points, settings and notice text.
update public.rule_items as target
set text = source.text
from (
  values
    ('style', 0, 'Mặc đồng phục sai quy định của buổi học : đánh dấu 1 lần'),
    ('style', 1, 'Không có phù hiệu hoặc sai quy định về giày dép : đánh dấu 1 lần'),
    ('style', 2, 'Hành vi chan nhau trong lớp hoặc trong trường : đánh dấu 3 lần'),
    ('style', 3, 'Không tham gia chào cờ : đánh dấu 3 lần'),
    ('style', 4, 'Bị phát hiện gian lận trong giờ ktra : đánh dấu 3 lần'),
    ('style', 5, 'Bị phát hiện sử dụng ĐT trong lớp : đánh dấu 3 lần'),
    ('style', 6, 'Bị phát hiện ăn trong lớp hay ăn ngoài hành lang quá giờ quy định : đánh dấu 1 lần'),
    ('time', 0, 'Đi trễ : đánh dấu 1 lần'),
    ('order', 0, 'Nói chuyện lớn trong giờ học, ảnh hưởng đến người khác sẽ bị nhắc nhở'),
    ('order', 1, 'Mỗi người có 2 lần bị nhắc nhở, lần thứ 3 bắt đầu đánh dấu'),
    ('order', 2, 'Trường hợp bị giáo viên nhắc nhở thì đánh dấu ngay lập tức')
) as source(section_id, position, text)
where target.section_id = source.section_id
  and target.position = source.position
  and nullif(btrim(target.text), '') is null;

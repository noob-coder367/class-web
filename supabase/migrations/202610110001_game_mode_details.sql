-- Chi tiết trò chơi: mô tả dài + thư viện ảnh giới thiệu (tối đa 8 ảnh / game).
alter table public.game_mode_images
  add column if not exists detail_description text,
  add column if not exists gallery_paths text[] not null default '{}'::text[];

alter table public.game_mode_images
  add constraint game_mode_images_detail_description_length
    check (detail_description is null or char_length(detail_description) <= 2000),
  add constraint game_mode_images_gallery_limit
    check (cardinality(gallery_paths) <= 8);

-- Đồng bộ: mọi game hiện có đều có một dòng trong Quản lý các trò chơi.
-- Chỉ chèn khi chưa có (không ghi đè nội dung admin đã chỉnh).
insert into public.game_mode_images (game_key, image_path, display_title, text_color)
values
  ('treasure-race', null, 'Đua tới kho báu', '#FFFFFF'),
  ('quiz-party', null, 'Quiz Party — Đại chiến mini-game', '#FFFFFF'),
  ('bolt-sort', null, 'Đại chiến Bu Lông', '#FFFFFF'),
  ('word-chain', null, 'Nối Từ', '#FFFFFF')
on conflict (game_key) do nothing;

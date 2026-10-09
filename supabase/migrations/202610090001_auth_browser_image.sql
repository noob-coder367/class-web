-- Managed image shown on login/register pages; reuses the existing public bucket.
insert into public.game_mode_images (game_key, image_path, display_title, display_note, text_color)
values ('auth-browser', null, 'Ảnh trình duyệt', null, '#FFFFFF')
on conflict (game_key) do nothing;

-- Allow title/note/color settings to exist before a cover image is uploaded.
alter table public.game_mode_images
  alter column image_path drop not null,
  add column display_title text,
  add column display_note text,
  add column text_color text,
  add constraint game_mode_images_title_length
    check (display_title is null or char_length(display_title) between 1 and 60),
  add constraint game_mode_images_note_length
    check (display_note is null or char_length(display_note) <= 300),
  add constraint game_mode_images_text_color_format
    check (text_color is null or text_color ~ '^#[0-9A-Fa-f]{6}$');

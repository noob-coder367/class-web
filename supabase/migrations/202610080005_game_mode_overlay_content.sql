-- Add a dedicated piece of copy displayed over the Game Mode cover image.
alter table public.game_mode_images
  add column overlay_content text,
  add constraint game_mode_images_overlay_content_length
    check (overlay_content is null or char_length(overlay_content) <= 300);

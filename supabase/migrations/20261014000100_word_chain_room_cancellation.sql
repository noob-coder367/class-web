-- Allow a host to close an online Word Chain room without deleting its history.
alter table public.word_chain_rooms
  drop constraint if exists word_chain_rooms_status_check;

alter table public.word_chain_rooms
  add constraint word_chain_rooms_status_check
  check (status in ('lobby', 'playing', 'finished', 'cancelled'));

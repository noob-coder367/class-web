-- Additive authoritative state for Treasure Race 3D maze.
alter table public.game_games add column if not exists phase text not null default 'question';
alter table public.game_games add column if not exists maze_seed bigint;
alter table public.game_games add column if not exists maze_layout jsonb;
alter table public.game_games add column if not exists dice_result integer;
alter table public.game_games add column if not exists remaining_moves integer not null default 0;
alter table public.game_games drop constraint if exists game_games_phase_check;
alter table public.game_games add constraint game_games_phase_check check (phase in ('question','result','dice_roll','movement','next_question','finished'));
alter table public.game_teams add column if not exists maze_x integer not null default 0;
alter table public.game_teams add column if not exists maze_y integer not null default 0;
alter table public.game_teams add column if not exists total_response_time integer not null default 0;
alter table public.game_games add constraint game_games_dice_result_check check (dice_result is null or dice_result between 1 and 6);
alter table public.game_games add constraint game_games_remaining_moves_check check (remaining_moves >= 0);

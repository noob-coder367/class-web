# Game mode architecture

`backend/src/services/game/gameModes.js` is the server-side registry for game
rules.  It owns the database mode id, accepted legacy aliases, room-creation
RPC, initial game state, answer scoring, final ranking, and whether movement is
available.  Shared concerns remain in `gameRoom.service.js`: authentication,
room code generation, quiz ownership, player membership, and the existing
atomic database RPC calls.

The browser registry is `frontend/src/lib/gameModes.js`.  It maps the server
mode id to picker metadata, the room page, and the optional settings shown in
the create-room form.  Do not use a new mode id as a loose string in a page;
read it through this registry instead.

## Adding a game

1. Create the game-specific engine next to the existing game engines, then add
   one entry to the backend registry.  Reuse shared room/player behavior only
   where it applies.
2. Add the matching entry to the frontend registry, including `apiMode` and
   `roomPath`, and create its room page if it needs a different presentation.
3. Add an **additive** Supabase migration that permits the new `game_mode` and
   creates any new RPC needed by that mode.  Do not alter existing room/game
   rows or replace an old mode's RPC.
4. Add focused engine/registry tests, then run the existing backend and
   frontend test/build commands.

Treasure Race continues to call `create_game_room_atomic`; Quiz Party continues
to call `create_game_room_atomic_v2`.  This compatibility split is intentional.

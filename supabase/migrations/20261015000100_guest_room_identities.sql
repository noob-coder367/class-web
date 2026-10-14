-- Allow stable client-generated guest UUIDs in room membership/host fields.
-- Room tables remain accessible only to service_role through the backend; the room URL
-- and the unguessable guest UUID together act as the guest capability.
do $$
declare
  target record;
  fk record;
begin
  for target in
    select * from (values
      ('public', 'game_rooms'),
      ('public', 'game_room_players'),
      ('public', 'game_answers'),
      ('public', 'game_action_claims'),
      ('public', 'word_chain_rooms'),
      ('public', 'word_chain_players'),
      ('public', 'word_chain_turns'),
      ('public', 'word_chain_action_claims')
    ) as tables(schema_name, table_name)
  loop
    for fk in
      select conname
      from pg_constraint
      where contype = 'f'
        and conrelid = format('%I.%I', target.schema_name, target.table_name)::regclass
        and confrelid = 'auth.users'::regclass
    loop
      execute format('alter table %I.%I drop constraint %I', target.schema_name, target.table_name, fk.conname);
    end loop;
  end loop;
end;
$$;

-- Run as postgres via Supabase SQL Editor or execute_sql. All fixtures roll back.
begin;
insert into auth.users (id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into public.trips (user_id, destination, days, pace, start_date, itinerary) values
 ('11111111-1111-4111-8111-111111111111', 'kyoto', 1, 'balanced', '2030-01-01', '[{"day":1,"activities":[]}]'),
 ('22222222-2222-4222-8222-222222222222', 'paris', 1, 'balanced', '2030-01-01', '[{"day":1,"activities":[]}]');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
declare affected integer;
begin
  if (select count(*) from public.trips) <> 1 then raise exception 'FAIL: owner SELECT isolation'; end if;
  insert into public.trips (destination, days, pace, start_date, itinerary)
  values ('bali', 1, 'relaxed', '2030-01-02', '[{"day":1,"activities":[]}]');
  if (select count(*) from public.trips) <> 2 then raise exception 'FAIL: owner INSERT'; end if;
  begin
    insert into public.trips (user_id, destination, days, pace, start_date, itinerary)
    values ('22222222-2222-4222-8222-222222222222', 'bali', 1, 'relaxed', '2030-01-02', '[{"day":1,"activities":[]}]');
    raise exception 'FAIL: cross-owner INSERT allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.trips (destination, days, pace, start_date, itinerary)
    values ('bali', 1, 'relaxed', '2030-01-02', '[{"day":1,"activities":[]}]');
    raise exception 'FAIL: duplicate INSERT allowed';
  exception when unique_violation then null; end;
  update public.trips set pace = 'packed' where destination = 'paris';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: cross-owner UPDATE allowed'; end if;
  update public.trips set pace = 'packed' where destination = 'kyoto';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner UPDATE denied'; end if;
  begin
    update public.trips set user_id = '22222222-2222-4222-8222-222222222222';
    raise exception 'FAIL: ownership transfer allowed';
  exception when insufficient_privilege then null; end;
  delete from public.trips where destination = 'paris';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: cross-owner DELETE allowed'; end if;
  delete from public.trips where destination = 'bali';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner DELETE denied'; end if;
end $$;

-- Verify the second user sees only their unchanged row.
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.trips) <> 1 or
     (select destination <> 'paris' or pace <> 'balanced' from public.trips limit 1)
  then raise exception 'FAIL: second user isolation'; end if;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin perform * from public.trips; raise exception 'FAIL: anon SELECT allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.trips (destination, days, pace, start_date, itinerary)
    values ('bali', 1, 'relaxed', '2030-01-02', '[{"day":1,"activities":[]}]');
    raise exception 'FAIL: anon INSERT allowed';
  exception when insufficient_privilege then null; end;
  begin update public.trips set pace = 'packed'; raise exception 'FAIL: anon UPDATE allowed';
  exception when insufficient_privilege then null; end;
  begin delete from public.trips; raise exception 'FAIL: anon DELETE allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: owner CRUD, cross-user isolation, ownership immutability, duplicates, and anon denial' as result;
rollback;

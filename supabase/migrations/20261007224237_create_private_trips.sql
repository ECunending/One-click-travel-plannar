-- All access is tied to Supabase Auth. No public or service-role client access.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  destination text not null check (destination in ('kyoto', 'lisbon', 'bali', 'paris')),
  days smallint not null check (days between 1 and 7),
  pace text not null check (pace in ('relaxed', 'balanced', 'packed')),
  start_date date not null check (start_date between date '0001-01-01' and date '9999-12-31'),
  itinerary jsonb not null check (
    jsonb_typeof(itinerary) = 'array'
    and jsonb_array_length(itinerary) = days
    and octet_length(itinerary::text) <= 32768
  ),
  created_at timestamptz not null default now(),
  constraint trips_owner_plan_unique unique (user_id, destination, start_date, days, pace)
);

-- Matches WHERE user_id = ? ORDER BY created_at DESC, id DESC and indexes the FK.
create index trips_owner_created_idx on public.trips (user_id, created_at desc, id desc);

alter table public.trips enable row level security;
revoke all on public.trips from public, anon, authenticated;
grant select, delete on public.trips to authenticated;
grant insert (user_id, destination, days, pace, start_date, itinerary) on public.trips to authenticated;
grant update (destination, days, pace, start_date, itinerary) on public.trips to authenticated;

create policy trips_select_own on public.trips for select to authenticated
  using ((select auth.uid()) = user_id);
create policy trips_insert_own on public.trips for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy trips_update_own on public.trips for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy trips_delete_own on public.trips for delete to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.trips is 'Private travel itineraries owned by Supabase Auth users.';

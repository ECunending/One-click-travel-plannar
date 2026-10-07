-- Supabase may create this privileged event-trigger helper during provisioning.
-- It should run only as an event trigger, never as a client-callable RPC.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

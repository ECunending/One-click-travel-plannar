import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Postgres migration enforces RLS, ownership, privileges, and unique indexes', async () => {
  const db = new PGlite();
  try {
    // Minimal Supabase Auth contract for a real embedded Postgres instance.
    // Production supplies these roles, table, and function itself.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    const directory = new URL('../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(file, directory), 'utf8'));
    }
    const results = await db.exec(await readFile(new URL('../supabase/tests/trips_rls.sql', import.meta.url), 'utf8'));
    assert.ok(results.some(result => result.rows.some(row => row.result?.startsWith('PASS:'))));
    const { rows } = await db.query(`select relrowsecurity from pg_class where oid = 'public.trips'::regclass`);
    assert.equal(rows[0].relrowsecurity, true);
    const policies = await db.query("select policyname from pg_policies where tablename = 'trips'");
    assert.equal(policies.rows.length, 4);
    const indexes = await db.query("select indexname from pg_indexes where tablename = 'trips'");
    assert.deepEqual(indexes.rows.map(row => row.indexname).sort(), ['trips_owner_created_idx', 'trips_owner_plan_unique', 'trips_pkey']);
    assert.equal((await db.query('select count(*)::int as count from auth.users')).rows[0].count, 0, 'security test fixtures must roll back');
  } finally { await db.close(); }
});

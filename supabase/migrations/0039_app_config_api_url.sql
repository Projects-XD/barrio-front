-- Configuración pública de la app (p. ej. URL del backend). Solo lectura para usuarios; se edita desde el panel de Supabase.
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

grant select on public.app_config to anon, authenticated;

drop policy if exists "app_config lectura publica" on public.app_config;
create policy "app_config lectura publica"
  on public.app_config for select
  to anon, authenticated
  using (true);

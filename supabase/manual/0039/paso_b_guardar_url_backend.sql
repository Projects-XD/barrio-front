insert into public.app_config (key, value)
values ('api_base_url', 'https://relative-cane-unjustly.ngrok-free.dev/api/v1')
on conflict (key) do update set value = excluded.value, updated_at = now();

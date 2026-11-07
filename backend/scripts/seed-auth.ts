// Crea las cuentas de la demo en Supabase Auth con los IDs fijos de la migración 0010.
// Uso: aplicar las migraciones y ejecutar `npm run seed` desde backend/. Es seguro repetirlo.
//
// Lee de backend/.env (ignorado por git): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// SEED_PASSWORD_WILMER, SEED_PASSWORD_EDSON y SEED_PASSWORD_ADMIN.
// Las contraseñas no van en el código para no publicarlas en el repo.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable ${name} en backend/.env`);
  return value;
}

const SEED_USERS = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    email: 'samirloroamaya24@gmail.com',
    fullName: 'Wilmer',
    password: requireEnv('SEED_PASSWORD_WILMER'),
    isAdmin: false,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    email: 'edson@gmail.com',
    fullName: 'Edson',
    password: requireEnv('SEED_PASSWORD_EDSON'),
    isAdmin: false,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    email: 'admin@gmail.com',
    fullName: 'Admin',
    password: requireEnv('SEED_PASSWORD_ADMIN'),
    isAdmin: true,
  },
];

const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: zone, error: zoneError } = await supabase
    .from('zones')
    .select('id')
    .eq('name', 'Castilla')
    .single();
  if (zoneError) throw new Error(`No se encontró la zona Castilla. ¿Aplicaste las migraciones? ${zoneError.message}`);

  // ponytail: una sola página de 1000 usuarios, de sobra para este seed.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`No se pudieron listar los usuarios: ${listError.message}`);

  for (const user of SEED_USERS) {
    const existing = list.users.find((u) => u.email?.toLowerCase() === user.email);
    let id = user.id;

    if (existing) {
      // No se borra ni se cambia la contraseña: borrar arrastraría en cascada sus favores y perfil.
      id = existing.id;
      const nota = existing.id === user.id ? '' : ` con otro ID (${existing.id})`;
      console.log(`= ${user.email}: ya existía${nota}; conserva su contraseña.`);
    } else {
      // El trigger de la migración 0002 crea aquí la fila en public.users con el nombre y la zona.
      const { error } = await supabase.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.fullName, zone_id: zone.id },
      });
      if (error) throw new Error(`No se pudo crear ${user.email}: ${error.message}`);
      console.log(`+ ${user.email}: creado.`);
    }

    // El trigger no escribe is_admin. Upsert por si la fila no existe: el trigger no bloquea
    // el registro cuando falla. is_admin solo se envía en true para no quitarle el rol a nadie.
    const { error: profileError } = await supabase.from('users').upsert({
      id,
      full_name: user.fullName,
      zone_id: zone.id,
      ...(user.isAdmin && { is_admin: true }),
    });
    if (profileError) throw new Error(`No se pudo guardar el perfil de ${user.email}: ${profileError.message}`);
  }

  console.log('Listo.');
}

main().catch((error) => {
  console.error(`Seed fallido: ${error.message}`);
  process.exit(1);
});

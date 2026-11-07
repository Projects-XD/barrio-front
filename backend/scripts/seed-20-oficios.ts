import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Las credenciales salen de backend/.env, nunca del codigo.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en backend/.env');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VECINOS_SEED = [
  { name: 'Carlos Mendoza', category: 'gasfiteria', exp: 8, desc: 'Especialista en fugas de agua, tuberías de PVC y bombas de agua residenciales.', vouches: 6 },
  { name: 'Manuel Silva', category: 'gasfiteria', exp: 12, desc: 'Maestro gasfitero con 12 años en Castilla. Desatoros e instalaciones sanitarias.', vouches: 9 },
  { name: 'Jorge Ruesta', category: 'gasfiteria', exp: 5, desc: 'Instalación de griferías, tanques elevados y cambio de válvulas.', vouches: 4 },
  { name: 'Roberto Zapata', category: 'carpinteria', exp: 15, desc: 'Muebles de melamina, puertas de madera maciza, reparaciones y repisas.', vouches: 11 },
  { name: 'Segundo Juárez', category: 'carpinteria', exp: 10, desc: 'Ebanista y restaurador de marcos, ventanas y mesas de madera en el barrio.', vouches: 7 },
  { name: 'Luis Fernando Farfán', category: 'carpinteria', exp: 6, desc: 'Fabricación y ajuste de puertas corredizas, armarios y muebles de cocina.', vouches: 3 },
  { name: 'Walter Dioses', category: 'electricidad', exp: 14, desc: 'Técnico electricista certificado. Cableados, tableros eléctricos y fugas de corriente.', vouches: 12 },
  { name: 'Álvaro Chunga', category: 'electricidad', exp: 7, desc: 'Instalación de luminarias LED, tomacorrientes y mantenimiento de pozos a tierra.', vouches: 5 },
  { name: 'César Navarro', category: 'electricidad', exp: 9, desc: 'Revisión y balanceo de cargas monofásicas y trifásicas para casas y negocios.', vouches: 8 },
  { name: 'Pedro Morales', category: 'cerrajeria', exp: 11, desc: 'Cerrajería de emergencia 24h. Apertura de puertas, duplicados y cambio de guardas.', vouches: 10 },
  { name: 'David Quintana', category: 'cerrajeria', exp: 6, desc: 'Instalación de cerraduras de seguridad, candados y cerrojos blindados.', vouches: 4 },
  { name: 'Miguel Ángel Prado', category: 'cerrajeria', exp: 13, desc: 'Reparación de chapas residenciales y cerrajería metálica para rejas exteriores.', vouches: 7 },
  { name: 'Profesora Ana Lucía', category: 'clases', exp: 8, desc: 'Clases particulares de matemáticas y física para primaria y secundaria.', vouches: 8 },
  { name: 'Carmen Rosa Timaná', category: 'clases', exp: 10, desc: 'Refuerzo escolar integral, comprensión lectora y preparación para exámenes.', vouches: 6 },
  { name: 'Ing. Gabriel Benites', category: 'clases', exp: 5, desc: 'Nivelación en cálculo, álgebra e introducción a la computación.', vouches: 5 },
  { name: 'Luciana Valdivia', category: 'paseador_mascotas', exp: 4, desc: 'Paseos diarios matutinos y vespertinos con adiestramiento básico y mucho cuidado.', vouches: 7 },
  { name: 'Renato Seminario', category: 'paseador_mascotas', exp: 3, desc: 'Cuidado y paseo responsable de perros medianos y grandes en parques de la zona.', vouches: 5 },
  { name: 'Fiorella Córdova', category: 'paseador_mascotas', exp: 5, desc: 'Paseadora de perritos y atención personalizada a mascotas con necesidades especiales.', vouches: 6 },
  { name: 'Héctor Coronado', category: 'otro', exp: 9, desc: 'Pintura de fachadas e interiores, empaste y mantenimiento de techos.', vouches: 8 },
  { name: 'Julio Espinoza', category: 'otro', exp: 12, desc: 'Albañilería general, tarrajeo, pisos de mayólica y pequeñas ampliaciones.', vouches: 10 },
  { name: 'Enrique Villegas', category: 'otro', exp: 7, desc: 'Mantenimiento de jardines, poda de árboles y sistema de riego por goteo.', vouches: 4 }
];

async function seed() {
  const { data: zone } = await supabase.from('zones').select('id').eq('name', 'Castilla').single();
  if (!zone) throw new Error('Zona Castilla no encontrada');

  const { data: oficios } = await supabase.from('oficios').select('id, category');
  const oficiosMap = new Map(oficios.map((o) => [o.category, o.id]));

  console.log(`Poblando ${VECINOS_SEED.length} oficios en la zona Castilla...`);

  const { data: list } = await supabase.auth.admin.listUsers();
  const existingUsers = list?.users || [];

  for (let i = 0; i < VECINOS_SEED.length; i++) {
    const v = VECINOS_SEED[i];
    const email = `vecino.oficio.${i + 1}@barrio.pe`;
    const oficioId = oficiosMap.get(v.category);

    if (!oficioId) continue;

    let authUser = existingUsers.find((u) => u.email === email);

    if (!authUser) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { full_name: v.name, zone_id: zone.id }
      });
      if (createErr) {
        console.error(`Error creando auth user ${email}:`, createErr.message);
        continue;
      }
      authUser = created.user;
    }

    // Asegurar usuario
    await supabase.from('users').upsert({
      id: authUser.id,
      full_name: v.name,
      zone_id: zone.id
    });

    // Limpiar perfil previo si hubiera para insertar fresco
    await supabase.from('professional_profiles').delete().eq('user_id', authUser.id);

    // Insertar perfil profesional
    const { error: profErr } = await supabase.from('professional_profiles').insert({
      user_id: authUser.id,
      oficio_id: oficioId,
      zone_id: zone.id,
      description: v.desc,
      years_experience: v.exp,
      is_visible: true,
      validated_count: v.vouches,
      is_validated: v.vouches >= 3
    });

    if (profErr) {
      console.error(`Error en perfil de ${v.name}:`, profErr.message);
    } else {
      console.log(`✓ [${v.category}] ${v.name} (${v.vouches} vistos buenos)`);
    }
  }

  console.log('¡Llenado completado exitosamente!');
}

seed().catch(console.error);

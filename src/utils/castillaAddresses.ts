import { isWithinCastilla } from './geo';

export interface CastillaAddressItem {
  id: string;
  title: string;
  subtitle: string;
  coords?: { lat: number; lng: number };
}

// Catálogo estructurado de vías, avenidas, urbanizaciones y asentamientos humanos de Castilla (Piura).
export const CASTILLA_KNOWN_PLACES: CastillaAddressItem[] = [
  // Avenidas principales
  { id: 'av-circunvalacion', title: 'Av. Circunvalación', subtitle: 'Castilla, Piura (Sector El Indio / Chiclayito)' },
  { id: 'av-guardia-civil', title: 'Av. Guardia Civil', subtitle: 'Castilla, Piura (Miraflores / San Antonio)' },
  { id: 'av-ramon-castilla', title: 'Av. Ramón Castilla', subtitle: 'Castilla Centro, Piura' },
  { id: 'av-progreso', title: 'Av. Progreso', subtitle: 'Castilla, Piura (Eje principal Castilla / Campo Polo)' },
  { id: 'av-junin', title: 'Av. Junín', subtitle: 'Castilla Centro, Piura' },
  { id: 'av-jorge-chavez', title: 'Av. Jorge Chávez', subtitle: 'Castilla, Piura (Hacia el Aeropuerto)' },
  { id: 'av-los-angeles', title: 'Av. Los Ángeles', subtitle: 'Castilla, Piura (Urb. Los Ángeles)' },
  { id: 'av-tacna', title: 'Av. Tacna', subtitle: 'Castilla Centro, Piura' },
  { id: 'av-grau', title: 'Av. Grau', subtitle: 'Castilla, Piura' },
  { id: 'av-irazola', title: 'Av. Irazola', subtitle: 'Urb. Miraflores, Castilla, Piura' },
  { id: 'av-luis-montero', title: 'Av. Luis Montero', subtitle: 'Urb. Miraflores, Castilla, Piura (Frente a Estadio)' },
  { id: 'av-cayetano-heredia', title: 'Av. Cayetano Heredia', subtitle: 'Castilla Centro, Piura' },
  { id: 'av-independencia', title: 'Av. Independencia', subtitle: 'Castilla, Piura' },
  { id: 'av-caceres', title: 'Av. Andrés Avelino Cáceres', subtitle: 'Castilla, Piura (Límite con Open Plaza)' },
  { id: 'av-corpac', title: 'Av. Corpac', subtitle: 'Castilla, Piura (Zona Aeropuerto)' },
  { id: 'av-sanchez-cerro', title: 'Av. Sánchez Cerro', subtitle: 'Sector Castilla, Piura' },

  // Jirones y calles del casco urbano de Castilla
  { id: 'jr-ayacucho', title: 'Jr. Ayacucho', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-huancavelica', title: 'Jr. Huancavelica', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-cuzco', title: 'Jr. Cuzco', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-arequipa', title: 'Jr. Arequipa', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-moquegua', title: 'Jr. Moquegua', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-puno', title: 'Jr. Puno', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-callao', title: 'Jr. Callao', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-bolognesi', title: 'Jr. Bolognesi', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-libertad', title: 'Jr. Libertad', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-san-martin', title: 'Jr. San Martín', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-alfonso-ugarte', title: 'Jr. Alfonso Ugarte', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-guisse', title: 'Jr. Almirante Guisse', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-amazonas', title: 'Jr. Amazonas', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-sucre', title: 'Jr. Sucre', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-piura', title: 'Jr. Piura', subtitle: 'Castilla Centro, Piura' },
  { id: 'jr-mariano-melgar', title: 'Jr. Mariano Melgar', subtitle: 'Castilla, Piura' },

  // Asentamientos Humanos y Urbanizaciones de Castilla
  { id: 'ah-el-indio', title: 'A.H. El Indio', subtitle: 'Castilla, Piura' },
  { id: 'ah-chiclayito', title: 'A.H. Chiclayito', subtitle: 'Castilla, Piura' },
  { id: 'ah-campo-polo', title: 'A.H. Campo Polo', subtitle: 'Castilla, Piura' },
  { id: 'ah-talarita', title: 'A.H. Talarita', subtitle: 'Castilla, Piura' },
  { id: 'ah-maria-goretti', title: 'A.H. María Goretti', subtitle: 'Castilla, Piura' },
  { id: 'ah-cossio-pomar', title: 'A.H. Cossío del Pomar', subtitle: 'Castilla, Piura' },
  { id: 'ah-almirante-grau', title: 'A.H. Almirante Grau', subtitle: 'Castilla, Piura' },
  { id: 'ah-los-corales', title: 'A.H. Los Corales', subtitle: 'Castilla, Piura' },
  { id: 'ah-nuevo-castilla', title: 'A.H. Nuevo Castilla', subtitle: 'Castilla, Piura' },
  { id: 'ah-las-monjas', title: 'A.H. Las Monjas', subtitle: 'Castilla, Piura' },
  { id: 'ah-valle-esperanza', title: 'A.H. Valle La Esperanza', subtitle: 'Castilla, Piura' },
  { id: 'ah-la-primavera', title: 'A.H. La Primavera', subtitle: 'Castilla, Piura' },
  { id: 'urb-miraflores', title: 'Urb. Miraflores', subtitle: 'Castilla, Piura' },
  { id: 'urb-san-bernardo', title: 'Urb. San Bernardo', subtitle: 'Castilla, Piura' },
  { id: 'urb-el-bosque', title: 'Urb. El Bosque', subtitle: 'Castilla, Piura' },
  { id: 'urb-los-angeles', title: 'Urb. Los Ángeles', subtitle: 'Castilla, Piura' },
  { id: 'urb-san-antonio', title: 'Urb. San Antonio', subtitle: 'Castilla, Piura' },
  { id: 'urb-15-setiembre', title: 'Urb. 15 de Setiembre', subtitle: 'Castilla, Piura' },
  { id: 'upis-colinas-castilla', title: 'UPIS Colinas de Castilla', subtitle: 'Castilla, Piura' },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Busca coincidencias de direcciones exclusivamente dentro de Castilla (Piura).
 * Utiliza coincidencia local ultrarrápida combinada con OpenStreetMap Nominatim
 * delimitado estrictamente por bounding box y polígono de Castilla.
 */
export async function searchCastillaAddresses(query: string): Promise<CastillaAddressItem[]> {
  const q = normalize(query);
  if (q.length < 2) return [];

  // 1. Búsqueda local en el catálogo curado de Castilla
  const localMatches = CASTILLA_KNOWN_PLACES.filter((item) => {
    const t = normalize(item.title);
    const s = normalize(item.subtitle);
    return t.includes(q) || s.includes(q);
  });

  // Si no hay red o la consulta es muy corta, devuelve inmediatamente los locales
  if (q.length < 3) {
    return localMatches.slice(0, 5);
  }

  // 2. Consulta a OpenStreetMap Nominatim con viewbox estricto de Castilla
  try {
    const viewbox = '-80.665,-4.95,-80.35,-5.26';
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&viewbox=${viewbox}&bounded=1&format=jsonv2&limit=6&countrycodes=pe&accept-language=es`;

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BarrioApp/1.0',
      },
    });

    if (res.ok) {
      const data = (await res.json()) as {
        place_id: number;
        display_name: string;
        lat: string;
        lon: string;
      }[];

      const remoteItems: CastillaAddressItem[] = [];

      for (const item of data) {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);

        // REGLA ESTRICTA: Debe estar dentro del polígono oficial de Castilla
        if (!isWithinCastilla({ lat, lng })) continue;

        // Limpiar el nombre para presentación
        const parts = item.display_name.split(',').map((p) => p.trim());
        const primary = parts[0] || 'Ubicación en Castilla';
        const secondary = parts.slice(1, 3).join(', ') || 'Castilla, Piura';

        remoteItems.push({
          id: `osm-${item.place_id}`,
          title: primary,
          subtitle: secondary,
          coords: { lat, lng },
        });
      }

      // Fusionar evitando duplicados por título
      const seenTitles = new Set<string>();
      const combined: CastillaAddressItem[] = [];

      for (const item of [...localMatches, ...remoteItems]) {
        const normTitle = normalize(item.title);
        if (!seenTitles.has(normTitle)) {
          seenTitles.add(normTitle);
          combined.push(item);
        }
      }

      return combined.slice(0, 6);
    }
  } catch {
    // Si falla la red, usar los resultados locales
  }

  return localMatches.slice(0, 6);
}

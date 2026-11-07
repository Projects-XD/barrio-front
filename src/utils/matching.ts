import { oficioLabel } from '@/i18n/labels';
import type { Favor, FavorType, OficioCategory, ProfessionalProfile } from '@/types';
import { distanceMetersBetween, type Coords } from './geo';

export type SuggestedMatch = {
  id: string;
  kind: 'oficio' | 'oferta';
  title: string;
  subtitle: string;
  meta: string;
  distanceMeters: number | null;
  targetRoute: string;
};

const STOP_WORDS = new Set(['necesito', 'ofrezco', 'para', 'como', 'este', 'esta']);

const KEYWORD_TO_OFICIO: { pattern: RegExp; categories: OficioCategory[] }[] = [
  {
    pattern: /(fuga|tuber[ií]a|ca[ñn]o|grifo|desag[üu]e|inodoro|agua|ba[ñn]o|tanque|gasfiter)/i,
    categories: ['gasfiteria'],
  },
  {
    pattern: /(luz|cable|enchufe|corto|foco|interruptor|corriente|el[eé]ctric|tablero|l[aá]mpara)/i,
    categories: ['electricidad'],
  },
  {
    pattern: /(madera|puerta|mueble|mesa|silla|estante|ropero|ventana|repisa|carpinter|martillo|taladro|sierra)/i,
    categories: ['carpinteria'],
  },
  {
    pattern: /(llave|cerradura|cerrajer|candado|chapa|traba)/i,
    categories: ['cerrajeria'],
  },
  {
    pattern: /(clase|matem[aá]tica|ingl[eé]s|ense[ñn]ar|aprender|tarea|colegio|estudio|computadora|celular)/i,
    categories: ['clases'],
  },
  {
    pattern: /(perro|mascota|pasear|gato|cachorro|veterinari)/i,
    categories: ['paseador_mascotas'],
  },
];

const FAVOR_TYPE_TO_OFICIO: Record<FavorType, OficioCategory[]> = {
  herramienta: ['carpinteria', 'gasfiteria', 'electricidad', 'cerrajeria'],
  ayuda_temporal: ['carpinteria', 'gasfiteria', 'electricidad'],
  donacion_materiales: ['carpinteria', 'otro'],
  intercambio_habilidades: ['clases', 'otro'],
  movilidad_solidaria: ['otro'],
  otros: ['otro', 'clases'],
};

export function findMatchesForFavor(params: {
  favorType: FavorType;
  title: string;
  description?: string | null;
  authorId?: string | null;
  referenceCoords?: Coords | null;
  profiles: ProfessionalProfile[];
  favors: Favor[];
  limit?: number;
}): SuggestedMatch[] {
  const {
    favorType,
    title,
    description,
    authorId,
    referenceCoords,
    profiles,
    favors,
    limit = 3,
  } = params;

  const fullText = `${title} ${description ?? ''}`.toLowerCase();
  const matchedCategories = new Set<OficioCategory>();

  for (const rule of KEYWORD_TO_OFICIO) {
    if (rule.pattern.test(fullText)) {
      rule.categories.forEach((c) => matchedCategories.add(c));
    }
  }
  if (matchedCategories.size === 0) {
    (FAVOR_TYPE_TO_OFICIO[favorType] ?? []).forEach((c) => matchedCategories.add(c));
  }

  const results: (SuggestedMatch & { score: number })[] = [];

  // Palabras del favor para comparar con la descripción de cada perfil (se calculan una sola vez).
  const textWords = fullText
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

  // 1. Buscar oficios registrados en la zona que coincidan
  for (const prof of profiles) {
    if (authorId && prof.userId === authorId) continue;
    const catMatch = matchedCategories.has(prof.oficio.category);
    const descMatch = textWords.some(
      (w) => prof.description.toLowerCase().includes(w) || prof.oficio.name.toLowerCase().includes(w)
    );

    if (!catMatch && !descMatch && profiles.length > 3) continue;

    const dist =
      referenceCoords && prof.location
        ? distanceMetersBetween(referenceCoords, prof.location)
        : null;

    const score =
      (catMatch ? 50 : 15) +
      (descMatch ? 25 : 0) +
      Math.min(20, prof.validatedCount * 5) -
      (dist != null ? Math.min(20, dist / 200) : 5);

    results.push({
      id: `oficio-${prof.id}`,
      kind: 'oficio',
      title: `${prof.user.fullName} · ${oficioLabel[prof.oficio.category]}`,
      subtitle: prof.description || 'Servicio vecinal disponible en tu zona',
      meta:
        prof.validatedCount > 0
          ? `${prof.validatedCount} ${prof.validatedCount === 1 ? 'visto bueno' : 'vistos buenos'}`
          : 'Vecino registrado',
      distanceMeters: dist,
      targetRoute: `/oficio/${prof.id}`,
      score,
    });
  }

  // 2. Buscar ofertas de ayuda activas de otros vecinos del mismo tipo
  for (const f of favors) {
    if (authorId && f.authorId === authorId) continue;
    if (f.status !== 'abierta' && f.status !== 'en_curso') continue;
    if (f.intent !== 'ofrecer') continue;
    if (f.type !== favorType) continue;

    const dist =
      referenceCoords && f.location
        ? distanceMetersBetween(referenceCoords, f.location)
        : null;

    results.push({
      id: `oferta-${f.id}`,
      kind: 'oferta',
      title: f.title,
      subtitle: `Ofrecido por ${f.author.fullName}`,
      meta: 'Oferta solidaria activa',
      distanceMeters: dist,
      targetRoute: `/favores/${f.id}`,
      score: 45 - (dist != null ? Math.min(15, dist / 200) : 5),
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...item }) => item);
}


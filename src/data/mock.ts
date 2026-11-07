import type { CriticalResource, Favor, ProfessionalProfile, SupportService, VulnerabilityReport } from '@/types';

export const ZONE_ID = 'zona-centro';

export const profilesMock: ProfessionalProfile[] = [
  {
    id: 'p1',
    userId: 'u1',
    user: { id: 'u1', fullName: 'Lucía Ramírez', avatarUrl: null },
    oficio: { id: 'o1', category: 'gasfiteria', name: 'Gasfitería' },
    zoneId: ZONE_ID,
    description: 'Reparación de cañerías, llaves y calefones. Atiendo emergencias de fin de semana.',
    yearsExperience: 12,
    distanceKm: 0.4,
    validatedCount: 3,
    isValidated: true,
    hasVouchedByMe: false,
  },
  {
    id: 'p2',
    userId: 'u2',
    user: { id: 'u2', fullName: 'Tomás Pérez', avatarUrl: null },
    oficio: { id: 'o2', category: 'carpinteria', name: 'Carpintería' },
    zoneId: ZONE_ID,
    description: 'Muebles a medida y arreglos de puertas y ventanas.',
    yearsExperience: 8,
    distanceKm: 0.8,
    validatedCount: 1,
    isValidated: false,
    hasVouchedByMe: false,
  },
  {
    id: 'p3',
    userId: 'u3',
    user: { id: 'u3', fullName: 'Carmen Soto', avatarUrl: null },
    oficio: { id: 'o3', category: 'clases', name: 'Clases' },
    zoneId: ZONE_ID,
    description: 'Clases de matemáticas para primaria y secundaria.',
    yearsExperience: 5,
    distanceKm: 1.2,
    validatedCount: 2,
    isValidated: true,
    hasVouchedByMe: false,
  },
  {
    id: 'p4',
    userId: 'u4',
    user: { id: 'u4', fullName: 'Ana Vega', avatarUrl: null },
    oficio: { id: 'o4', category: 'paseador_mascotas', name: 'Paseador de mascotas' },
    zoneId: ZONE_ID,
    description: 'Paseos diarios en grupos pequeños, con fotos para los dueños.',
    yearsExperience: 3,
    distanceKm: 0.3,
    validatedCount: 0,
    isValidated: false,
    hasVouchedByMe: false,
  },
];

export const favorsMock: Favor[] = [
  {
    id: 'f1',
    authorId: 'u5',
    author: { id: 'u5', fullName: 'Jorge Muñoz' },
    zoneId: ZONE_ID,
    type: 'herramienta',
    title: 'Necesito una escalera el sábado',
    description: 'Para limpiar canaletas. La devuelvo el domingo.',
    status: 'abierta',
    distanceKm: 0.2,
    interestedCount: 1,
    hasInterestedByMe: false,
    createdAt: '2026-11-05T10:00:00Z',
    syncStatus: 'enviado',
  },
  {
    id: 'f2',
    authorId: 'u6',
    author: { id: 'u6', fullName: 'Marcela Lobos' },
    zoneId: ZONE_ID,
    type: 'ayuda_temporal',
    title: 'Puedo cuidar a un niño dos horas',
    description: null,
    status: 'en_curso',
    distanceKm: 0.6,
    interestedCount: 0,
    hasInterestedByMe: false,
    createdAt: '2026-11-04T18:30:00Z',
    syncStatus: 'enviado',
  },
];

export const servicesMock: SupportService[] = [
  { id: 's1', name: 'Centro de salud Los Álamos', type: 'salud', phone: '000000000', addressSummary: 'Av. Principal, frente a la plaza', distanceKm: 0.9, hours: '08:00 a 20:00', isVerified: true },
  { id: 's2', name: 'Bomberos, estación Centro', type: 'bomberos', phone: '000000001', addressSummary: 'Calle del Mercado', distanceKm: 1.4, hours: '24 horas', isVerified: true },
  { id: 's3', name: 'Grupo de apoyo vecinal Plaza', type: 'grupo_apoyo', phone: '000000002', addressSummary: 'Sede junta de vecinos', distanceKm: 0.5, hours: null, isVerified: false },
];

export const reportsMock: VulnerabilityReport[] = [
  { id: 'r1', zoneId: ZONE_ID, approxLat: 0, approxLng: 0, description: 'Adulta mayor sin acceso a agua hace dos días.', needs: ['agua'], status: 'activo', isAnonymous: true, reporterName: null, createdAt: '2026-11-06T08:00:00Z', resolvedAt: null },
  { id: 'r2', zoneId: ZONE_ID, approxLat: 0, approxLng: 0, description: 'Familia que necesita medicinas para diabetes.', needs: ['medicinas'], status: 'activo', isAnonymous: false, reporterName: 'Vecina de calle 3', createdAt: '2026-11-05T15:00:00Z', resolvedAt: null },
];

export const resourcesMock: CriticalResource[] = [
  { id: 'c1', kind: 'oferta', resource: 'generador', quantity: 1, notes: 'Disponible para cargar celulares', status: 'abierto', distanceKm: 0.3 },
  { id: 'c2', kind: 'pedido', resource: 'agua', quantity: 20, notes: 'Litros para familia', status: 'abierto', distanceKm: 0.7 },
];

export const zoneMock = { id: ZONE_ID, name: 'Centro', city: 'Ciudad' };

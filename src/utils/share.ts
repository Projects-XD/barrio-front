import { Alert, Linking } from 'react-native';
import { favorTypeLabel, oficioLabel, resourceLabel } from '@/i18n/labels';
import type { Favor, ProfessionalProfile, VulnerabilityReport } from '@/types';

export function shareViaWhatsApp(message: string) {
  const encoded = encodeURIComponent(message.trim());
  const url = `https://wa.me/?text=${encoded}`;
  Linking.openURL(url).catch(() => {
    Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp en este dispositivo.');
  });
}

// Sin nombre de zona se omite del encabezado, en lugar de inventar una.
const zoneSuffix = (zoneName?: string) => (zoneName ? ` · Zona ${zoneName}` : '');

export function shareFavorWhatsApp(favor: Favor, zoneName?: string) {
  const tipo = favorTypeLabel[favor.type];
  const lines = [
    `*Barrio${zoneSuffix(zoneName)}*`,
    `${favor.title}`,
    favor.description ? `${favor.description}` : null,
    `Categoría: ${tipo} · Publicado por ${favor.author.fullName}`,
    `Ingresa a la app Barrio para coordinar por el chat vecinal.`,
  ].filter(Boolean);
  shareViaWhatsApp(lines.join('\n'));
}

export function shareOficioWhatsApp(profile: ProfessionalProfile, zoneName?: string) {
  const especialidad = oficioLabel[profile.oficio.category];
  const avales =
    profile.validatedCount === 1
      ? '1 visto bueno vecinal'
      : `${profile.validatedCount} vistos buenos vecinales`;
  const lines = [
    `*Recomendación de oficio en Barrio${zoneSuffix(zoneName)}*`,
    `${profile.user.fullName} · ${especialidad}`,
    profile.description ? `"${profile.description}"` : null,
    `Respaldo: ${avales}${profile.yearsExperience ? ` · ${profile.yearsExperience} años de experiencia` : ''}`,
    `Encuéntralo en el directorio de Oficios de la app Barrio.`,
  ].filter(Boolean);
  shareViaWhatsApp(lines.join('\n'));
}

// El texto del reporte puede identificar a un vecino en riesgo: solo se comparte el tipo de
// ayuda que se necesita y se remite a la app, donde la ubicación sigue siendo aproximada.
export function shareReportWhatsApp(report: VulnerabilityReport, zoneName?: string) {
  const needs =
    report.needs.length > 0
      ? `Necesita: ${report.needs.map((n) => resourceLabel[n]).join(', ')}`
      : 'Requiere apoyo vecinal';
  const lines = [
    `*Alerta de apoyo vecinal · Barrio${zoneSuffix(zoneName)}*`,
    needs,
    `Los detalles y la ubicación aproximada están en el mapa de emergencia de la app Barrio.`,
  ];
  shareViaWhatsApp(lines.join('\n'));
}

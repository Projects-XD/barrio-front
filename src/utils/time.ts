// "hace 5 min", "hace 2 h", "hace 3 días": más fácil de leer que una fecha.
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return '';
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

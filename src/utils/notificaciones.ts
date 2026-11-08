import type { BackendNotification } from '@/api/endpoints';
import type { IconName } from '@/i18n/icons';

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

const notificationIcon: Record<BackendNotification['type'], IconName> = {
  interes_en_favor: 'hand-left-outline',
  nuevo_mensaje: 'chatbubble-ellipses-outline',
  visto_bueno_recibido: 'ribbon-outline',
  reporte_actualizado: 'document-text-outline',
  emergencia_activada: 'alert-circle-outline',
  nueva_publicacion: 'megaphone-outline',
  sistema: 'notifications-outline',
};

// Los avisos de tipo 'sistema' dicen qué son en payload.kind; cada uno tiene su propio ícono.
const iconoPorKind: Record<string, IconName> = {
  emergencia_finalizada: 'checkmark-circle-outline',
  favor_oculto: 'eye-off-outline',
  favor_cerrado: 'lock-closed-outline',
  favor_asignado: 'hand-left-outline',
  oficio_validado: 'shield-checkmark-outline',
  cuenta_suspendida: 'warning-outline',
  cuenta_baneada: 'ban-outline',
  cuenta_reactivada: 'checkmark-circle-outline',
};

export function iconForNotification(n: BackendNotification): IconName {
  const kind = str(n.payload.kind);
  if (n.type === 'sistema' && kind && iconoPorKind[kind]) return iconoPorKind[kind];
  return notificationIcon[n.type];
}

// Quita "Necesito:" / "Ofrezco:" del título, porque el aviso ya dice si pide u ofrece.
function limpiaTitulo(titulo: string): string {
  return titulo.replace(/^(?:Necesito|Ofrezco)(?:\s*\([^)]*\))?:\s*/i, '').trim() || titulo;
}

const comillas = (titulo: string | null) => (titulo ? `«${limpiaTitulo(titulo)}»` : null);

function fechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
}

function describeSistema(n: BackendNotification): { title: string; detail: string | null } {
  const favorTitle = str(n.payload.favor_title);
  switch (str(n.payload.kind)) {
    case 'emergencia_finalizada':
      return { title: 'La emergencia en tu zona terminó', detail: str(n.payload.reason) };
    case 'favor_oculto':
      return { title: 'Tu publicación fue retirada por reportes', detail: comillas(favorTitle) };
    case 'favor_cerrado':
      return {
        title:
          n.payload.estado === 'cancelada'
            ? 'Una ayuda en la que te interesaste fue cancelada'
            : 'Una ayuda en la que te interesaste se cerró',
        detail: comillas(favorTitle),
      };
    case 'favor_asignado':
      return { title: 'Te eligieron para ayudar', detail: comillas(favorTitle) };
    case 'oficio_validado':
      return { title: 'Tu oficio fue validado por los vecinos', detail: str(n.payload.oficio_name) };
    case 'cuenta_suspendida': {
      const hasta = fechaCorta(str(n.payload.hasta));
      return { title: 'Tu cuenta está suspendida', detail: hasta ? `Hasta el ${hasta}` : null };
    }
    case 'cuenta_baneada':
      return { title: 'Tu cuenta fue bloqueada', detail: 'Acumulaste demasiados reportes de vecinos.' };
    case 'cuenta_reactivada':
      return { title: 'Tu cuenta volvió a estar activa', detail: null };
    default:
      return { title: 'Aviso de Barrio', detail: null };
  }
}

export function describeNotification(n: BackendNotification): { title: string; detail: string | null } {
  const favorTitle = str(n.payload.favor_title);
  switch (n.type) {
    case 'interes_en_favor':
      return {
        title: `${str(n.payload.responder_name) ?? 'Un vecino'} quiere ayudarte`,
        detail: favorTitle ? `En tu favor «${favorTitle}»` : null,
      };
    case 'nuevo_mensaje':
      return {
        title: `Nuevo mensaje de ${str(n.payload.sender_name) ?? 'un vecino'}`,
        detail: favorTitle ? `Sobre «${favorTitle}»` : null,
      };
    case 'visto_bueno_recibido':
      if (n.payload.kind === 'oficio') {
        return { title: `${str(n.payload.voucher_name) ?? 'Un vecino'} avaló tu oficio`, detail: null };
      }
      return { title: 'Recibiste un visto bueno', detail: comillas(favorTitle) };
    case 'reporte_actualizado':
      if (n.payload.kind === 'denuncia') {
        return { title: 'Revisamos tu denuncia', detail: str(n.payload.estado) };
      }
      return { title: 'Tu reporte de emergencia se marcó como resuelto', detail: null };
    case 'emergencia_activada':
      if (n.payload.kind === 'reporte') {
        return { title: 'Nueva alerta comunitaria en tu zona', detail: str(n.payload.description) };
      }
      return { title: 'Se activó una emergencia en tu zona', detail: str(n.payload.reason) };
    case 'nueva_publicacion': {
      const autor = str(n.payload.author_name) ?? 'Un vecino';
      if (n.payload.kind === 'oficio') {
        return { title: `${autor} publicó un oficio`, detail: str(n.payload.oficio_name) };
      }
      const ofrece = n.payload.intent === 'ofrecer';
      return {
        title: `${autor} ${ofrece ? 'ofrece ayuda' : 'pide ayuda'}`,
        detail: comillas(favorTitle),
      };
    }
    case 'sistema':
      return describeSistema(n);
    default:
      return { title: 'Aviso de Barrio', detail: null };
  }
}

// Ruta a la que lleva un aviso al tocarlo; null si no tiene destino.
export function notificationRoute(n: BackendNotification): string | null {
  const conversationId = str(n.payload.conversation_id);
  const favorId = str(n.payload.favor_id);
  const profileId = str(n.payload.profile_id);
  if (conversationId) return `/chat/${conversationId}`;
  if (favorId) return `/favores/${favorId}`;
  if (profileId) return `/oficio/${profileId}`;
  // Emergencias y alertas comunitarias llevan al panel de emergencia.
  if (n.type === 'emergencia_activada' || n.payload.kind === 'emergencia_finalizada') return '/emergencia';
  return null;
}

import type { BackendNotification } from '@/api/endpoints';
import type { IconName } from '@/i18n/icons';

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

export const notificationIcon: Record<BackendNotification['type'], IconName> = {
  interes_en_favor: 'hand-left-outline',
  nuevo_mensaje: 'chatbubble-ellipses-outline',
  visto_bueno_recibido: 'ribbon-outline',
  reporte_actualizado: 'document-text-outline',
  emergencia_activada: 'alert-circle-outline',
  nueva_publicacion: 'megaphone-outline',
  sistema: 'notifications-outline',
};

// Quita "Necesito:" / "Ofrezco:" del título, porque el aviso ya dice si pide u ofrece.
function limpiaTitulo(titulo: string): string {
  return titulo.replace(/^(?:Necesito|Ofrezco)(?:\s*\([^)]*\))?:\s*/i, '').trim() || titulo;
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
      return { title: 'Recibiste un visto bueno', detail: null };
    case 'reporte_actualizado':
      return { title: 'Tu reporte tuvo novedades', detail: null };
    case 'emergencia_activada':
      return { title: 'Se activó una emergencia en tu zona', detail: null };
    case 'nueva_publicacion': {
      const autor = str(n.payload.author_name) ?? 'Un vecino';
      if (n.payload.kind === 'oficio') {
        return { title: `${autor} publicó un oficio`, detail: str(n.payload.oficio_name) };
      }
      const ofrece = n.payload.intent === 'ofrecer';
      return {
        title: `${autor} ${ofrece ? 'ofrece ayuda' : 'pide ayuda'}`,
        detail: favorTitle ? `«${limpiaTitulo(favorTitle)}»` : null,
      };
    }
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
  return null;
}

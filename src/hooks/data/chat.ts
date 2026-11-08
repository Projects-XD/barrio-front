import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blockConversationUser, getConversation, listConversations, listMessages, reportConversationUser, sendMessage, unblockConversationUser, updateConversation, type BackendConversation, type BackendMessage, type ReportReason } from '@/api/endpoints';
import { useAppStore } from '@/store/app-store';
import { supabase } from '@/lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import { FRESH_LIVE_MS } from './shared';

// ============================================================================
// CHAT (solo con conexión: no pasa por la cola offline)
// ============================================================================

// Sin tiempo real: mientras el chat está abierto se consultan los mensajes cada pocos segundos.
const CHAT_POLL_MS = 4_000;

export function useConversations(favorId?: string) {
  const userId = useAppStore((s) => s.userId);
  return useQuery<BackendConversation[]>({
    queryKey: ['conversations', userId, favorId ?? 'all'],
    staleTime: FRESH_LIVE_MS,
    enabled: Boolean(userId),
    queryFn: () => listConversations(favorId),
  });
}

export function useConversation(id: string) {
  return useQuery<BackendConversation>({
    queryKey: ['conversation', id],
    staleTime: FRESH_LIVE_MS,
    enabled: Boolean(id),
    queryFn: () => getConversation(id),
  });
}

export function useMessages(conversationId: string) {
  const isOnline = useAppStore((s) => s.isOnline);
  return useQuery<BackendMessage[]>({
    queryKey: ['messages', conversationId],
    staleTime: 0, // abrir un chat siempre trae lo último y marca como leído
    gcTime: 2 * 60_000,
    enabled: Boolean(conversationId) && isOnline,
    refetchInterval: CHAT_POLL_MS,
    queryFn: () => listMessages(conversationId),
  });
}

export const MAX_CHAT_IMAGES = 2;

// Reduce la foto (ancho 1280 px, JPEG 60 %: ~150-300 KB) y la sube a Storage; en la BD solo queda la URL.
async function uploadChatImage(userId: string, localUri: string): Promise<string> {
  const small = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width: 1280 } }], {
    compress: 0.6,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const body = await (await fetch(small.uri)).arrayBuffer();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await supabase.storage.from('chat-images').upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw new Error('No se pudo subir la imagen. Revisa tu conexión e inténtalo de nuevo.');
  return supabase.storage.from('chat-images').getPublicUrl(path).data.publicUrl;
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.userId);
  return useMutation({
    mutationFn: async (input: string | { body: string; localImages?: string[] }) => {
      const { body, localImages = [] } = typeof input === 'string' ? { body: input } : input;
      if (localImages.length > MAX_CHAT_IMAGES) throw new Error(`Máximo ${MAX_CHAT_IMAGES} imágenes por mensaje.`);
      if (localImages.length && !userId) throw new Error('Tu sesión no está activa.');
      const urls = await Promise.all(localImages.map((uri) => uploadChatImage(userId!, uri)));
      return sendMessage(conversationId, body, urls);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUpdateConversation(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: { muted?: boolean; closed?: true }) => updateConversation(conversationId, changes),
    onSuccess: (updated) => {
      qc.setQueryData(['conversation', conversationId], (prev: BackendConversation | undefined) =>
        prev ? { ...prev, ...updated } : updated,
      );
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useBlockConversationUser(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => blockConversationUser(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUnblockConversationUser(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unblockConversationUser(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useReportConversationUser(conversationId: string) {
  return useMutation({
    mutationFn: (input: { reason: ReportReason; details?: string }) =>
      reportConversationUser(conversationId, input.reason, input.details),
  });
}

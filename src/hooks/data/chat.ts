import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blockConversationUser, getConversation, listConversations, listMessages, reportConversationUser, sendMessage, unblockConversationUser, updateConversation, type BackendConversation, type BackendMessage, type ReportReason } from '@/api/endpoints';
import { useAppStore } from '@/store/app-store';
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

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendMessage(conversationId, body),
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
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      if (updated.favor_id) qc.invalidateQueries({ queryKey: ['favor', updated.favor_id] });
      qc.invalidateQueries({ queryKey: ['favors'] });
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

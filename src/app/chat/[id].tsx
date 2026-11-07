import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { usePalette } from '@/hooks/usePalette';
import {
  useBlockConversationUser,
  useConversation,
  useMessages,
  useReportConversationUser,
  useSendMessage,
  useUnblockConversationUser,
  useUpdateConversation,
} from '@/hooks/useData';
import { updateFavor, type BackendMessage, type ReportReason } from '@/api/endpoints';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';

const MAX_LENGTH = 1000;

const reasonLabel: Record<ReportReason, string> = {
  acoso: 'Acoso',
  spam: 'Spam',
  contenido_inapropiado: 'Contenido inapropiado',
  datos_falsos: 'Datos falsos',
  otro: 'Otro',
};
const reasons = Object.keys(reasonLabel) as ReportReason[];

type Panel = null | 'menu' | 'cerrar' | 'bloquear' | 'reportar' | 'resolver';

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

function Bubble({ message, mine, seen }: { message: BackendMessage; mine: boolean; seen: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? { backgroundColor: colors.azul } : { backgroundColor: colors.blanco }]}>
        <Text style={[styles.bubbleText, { color: mine ? colors.blanco : colors.texto }]}>{message.body}</Text>
        <Text style={[styles.bubbleTime, { color: mine ? colors.azulSuave : p.muted }]}>
          {hora(message.created_at)}
          {mine && seen ? '  ·  Leído' : ''}
        </Text>
      </View>
    </View>
  );
}

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const userId = useAppStore((s) => s.userId);
  const isOnline = useAppStore((s) => s.isOnline);

  const conversation = useConversation(id);
  const messages = useMessages(id);
  const send = useSendMessage(id);
  const update = useUpdateConversation(id);
  const block = useBlockConversationUser(id);
  const unblock = useUnblockConversationUser(id);
  const report = useReportConversationUser(id);

  const [text, setText] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState<ReportReason>('acoso');
  const [details, setDetails] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [favorResuelto, setFavorResuelto] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);

  // La lista está invertida (lo más nuevo abajo), así que recibe los mensajes del más nuevo al más viejo.
  const data = useMemo(() => [...(messages.data ?? [])].reverse(), [messages.data]);
  const lastMineId = useMemo(() => (messages.data ?? []).filter((m) => m.sender_id === userId).at(-1)?.id, [messages.data, userId]);

  const conv = conversation.data;
  const iAmAuthor = conv?.author_id === userId;
  const other = conv ? (iAmAuthor ? conv.responder : conv.author) : null;
  const otherName = other?.full_name ?? 'Vecino';
  const muted = conv ? (iAmAuthor ? conv.author_muted : conv.responder_muted) : false;
  const closed = Boolean(conv?.closed_at);
  // Solo quien bloqueó ve la opción de desbloquear; el bloqueado no se entera.
  const blockedByMe = Boolean(conv?.blocked_by_me);
  const canWrite = isOnline && !closed;

  const closePanel = () => {
    setPanel(null);
    setActionError(null);
  };

  const enviar = () => {
    const body = text.trim();
    if (!body || send.isPending || !canWrite) return;
    send.mutate(body, { onSuccess: () => setText('') });
  };

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
      closePanel();
    } catch (err) {
      setActionError((err as Error)?.message ?? 'No se pudo completar la acción.');
    }
  };

  if (conversation.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: p.background }]}>
        <ActivityIndicator size="large" color={p.primary} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  if (conversation.isError || !conv) {
    return (
      <View style={[styles.root, { backgroundColor: p.background, padding: spacing.md }]}>
        <EmptyState
          icon="chatbubbles-outline"
          title="No pudimos abrir este chat"
          message={(conversation.error as Error)?.message ?? 'Puede que ya no esté disponible.'}
        />
        <AppButton label="Reintentar" variant="secondary" onPress={() => conversation.refetch()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: p.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: otherName,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Opciones del chat"
              hitSlop={12}
              onPress={() => setPanel('menu')}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={colors.azul} />
            </Pressable>
          ),
        }}
      />

      {conv.favor ? (
        <View style={[styles.favorBar, { backgroundColor: p.highlight }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/favores/${conv.favor_id}`)}
            style={styles.favorLinkArea}
          >
            <Ionicons name="heart-outline" size={18} color={p.text} />
            <Text numberOfLines={1} style={[styles.favorText, { color: p.text }]}>
              Favor: {conv.favor.title}
            </Text>
          </Pressable>
          {iAmAuthor && !closed && !favorResuelto ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Marcar favor como resuelto y agradecer a ${otherName}`}
              onPress={() => setPanel('resolver')}
              style={styles.resolverChatBtn}
            >
              <Ionicons name="checkmark-circle-outline" size={15} color={colors.verdeExito} />
              <Text style={styles.resolverChatBtnText}>Marcar resuelto</Text>
            </Pressable>
          ) : favorResuelto ? (
            <View style={styles.resueltoTag}>
              <Ionicons name="checkmark-circle" size={15} color={colors.verdeExito} />
              <Text style={styles.resolverChatBtnText}>Resuelto</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {!isOnline ? (
        <Text style={[styles.banner, { backgroundColor: colors.naranjaSuave, color: colors.texto }]}>
          Sin conexión: el chat no está disponible hasta que vuelvas a tener internet.
        </Text>
      ) : null}
      {blockedByMe ? (
        <Text style={[styles.banner, { backgroundColor: colors.rojoSuave, color: colors.texto }]}>
          Bloqueaste a {otherName}. Puedes desbloquearlo desde el menú de opciones.
        </Text>
      ) : closed ? (
        <Text style={[styles.banner, { backgroundColor: colors.grisBorde, color: colors.texto }]}>
          Esta conversación está cerrada.
        </Text>
      ) : null}

      {messages.isLoading && isOnline ? (
        <ActivityIndicator size="large" color={p.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          inverted
          data={data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Bubble message={item} mine={item.sender_id === userId} seen={item.id === lastMineId && Boolean(item.read_at)} />
          )}
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title={`Escríbele a ${otherName}`}
                message="Coordinen aquí los detalles del favor."
              />
            </View>
          }
        />
      )}

      {send.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {send.error.message}
        </Text>
      ) : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10), borderTopColor: p.border }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={closed ? 'Conversación cerrada' : isOnline ? 'Escribe un mensaje' : 'Sin conexión'}
          placeholderTextColor={colors.gris}
          editable={canWrite}
          multiline
          maxLength={MAX_LENGTH}
          accessibilityLabel="Mensaje"
          style={[styles.input, { borderColor: p.border, color: p.text }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
          accessibilityState={{ disabled: !canWrite || !text.trim() || send.isPending }}
          disabled={!canWrite || !text.trim() || send.isPending}
          onPress={enviar}
          style={[
            styles.sendButton,
            { backgroundColor: p.cta },
            (!canWrite || !text.trim() || send.isPending) && { opacity: 0.45 },
          ]}
        >
          <Ionicons name="send" size={20} color={p.ctaText} />
        </Pressable>
      </View>

      <Modal visible={panel !== null} transparent animationType="fade" onRequestClose={closePanel}>
        <Pressable style={styles.overlay} onPress={closePanel}>
          <Pressable onPress={() => {}} style={styles.card}>
            {panel === 'menu' ? (
              <>
                <Text style={[styles.cardTitle, { color: p.text }]}>Opciones</Text>
                <AppButton
                  label={muted ? 'Volver a recibir avisos' : 'Silenciar avisos'}
                  variant="secondary"
                  icon={muted ? 'notifications-outline' : 'notifications-off-outline'}
                  onPress={() => run(() => update.mutateAsync({ muted: !muted }))}
                />
                {!closed ? (
                  <AppButton
                    label="Cerrar conversación"
                    variant="secondary"
                    icon="lock-closed-outline"
                    onPress={() => setPanel('cerrar')}
                  />
                ) : null}
                <AppButton
                  label={`Reportar a ${otherName}`}
                  variant="secondary"
                  icon="flag-outline"
                  onPress={() => {
                    report.reset();
                    setPanel('reportar');
                  }}
                />
                {blockedByMe ? (
                  <AppButton
                    label={unblock.isPending ? 'Desbloqueando...' : `Desbloquear a ${otherName}`}
                    variant="secondary"
                    icon="lock-open-outline"
                    onPress={() => run(() => unblock.mutateAsync())}
                    disabled={unblock.isPending}
                  />
                ) : (
                  <AppButton
                    label={`Bloquear a ${otherName}`}
                    variant="danger"
                    icon="ban-outline"
                    onPress={() => setPanel('bloquear')}
                  />
                )}
                {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
                <AppButton label="Cancelar" variant="secondary" onPress={closePanel} />
              </>
            ) : null}

            {panel === 'cerrar' ? (
              <>
                <Text style={[styles.cardTitle, { color: p.text }]}>¿Cerrar la conversación?</Text>
                <Text style={[styles.cardText, { color: p.body }]}>
                  Ninguno de los dos podrá enviar más mensajes en este chat.
                </Text>
                {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
                <AppButton
                  label={update.isPending ? 'Cerrando...' : 'Sí, cerrar'}
                  onPress={() => run(() => update.mutateAsync({ closed: true }))}
                  disabled={update.isPending}
                />
                <AppButton label="Volver" variant="secondary" onPress={() => setPanel('menu')} />
              </>
            ) : null}

            {panel === 'bloquear' ? (
              <>
                <Text style={[styles.cardTitle, { color: p.text }]}>¿Bloquear a {otherName}?</Text>
                <Text style={[styles.cardText, { color: p.body }]}>
                  Se cerrarán sus conversaciones y no podrá escribirte ni responder a tus favores.
                </Text>
                {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
                <AppButton
                  label={block.isPending ? 'Bloqueando...' : 'Sí, bloquear'}
                  variant="danger"
                  onPress={() => run(() => block.mutateAsync())}
                  disabled={block.isPending}
                />
                <AppButton label="Volver" variant="secondary" onPress={() => setPanel('menu')} />
              </>
            ) : null}

            {panel === 'reportar' ? (
              <>
                <Text style={[styles.cardTitle, { color: p.text }]}>Reportar a {otherName}</Text>
                <Text style={[styles.cardText, { color: p.body }]}>
                  Un administrador revisará el reporte. {otherName} no verá que lo enviaste.
                </Text>
                <View style={styles.chips}>
                  {reasons.map((r) => (
                    <Chip key={r} label={reasonLabel[r]} selected={reason === r} onPress={() => setReason(r)} />
                  ))}
                </View>
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Cuéntanos qué pasó (opcional)"
                  placeholderTextColor={colors.gris}
                  multiline
                  maxLength={500}
                  accessibilityLabel="Detalles del reporte"
                  style={[styles.input, styles.reportInput, { borderColor: p.border, color: p.text }]}
                />
                {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
                <AppButton
                  label={report.isPending ? 'Enviando...' : 'Enviar reporte'}
                  onPress={() =>
                    run(async () => {
                      await report.mutateAsync({ reason, details: details.trim() || undefined });
                      setDetails('');
                    })
                  }
                  disabled={report.isPending}
                />
                <AppButton label="Volver" variant="secondary" onPress={() => setPanel('menu')} />
              </>
            ) : null}

            {panel === 'resolver' ? (
              <>
                <Text style={[styles.cardTitle, { color: p.text }]}>¿Se resolvió tu favor?</Text>
                <Text style={[styles.cardText, { color: p.body }]}>
                  Se marcará el favor como resuelto y enviaremos un mensaje de agradecimiento comunitario a {otherName}.
                </Text>
                {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
                <AppButton
                  label={resolviendo ? 'Guardando...' : `Resolver y agradecer a ${otherName}`}
                  variant="accent"
                  icon="checkmark-circle-outline"
                  disabled={resolviendo}
                  onPress={() =>
                    run(async () => {
                      setResolviendo(true);
                      try {
                        await updateFavor(conv.favor_id, {
                          status: 'cerrada',
                          assigned_to_user_id: conv.responder_id,
                        });
                        if (canWrite) {
                          send.mutate(
                            `¡Muchas gracias por tu ayuda, ${otherName}! He marcado el favor como resuelto en el barrio.`,
                          );
                        }
                        setFavorResuelto(true);
                        queryClient.invalidateQueries({ queryKey: ['favor', conv.favor_id] });
                        queryClient.invalidateQueries({ queryKey: ['favors'] });
                      } finally {
                        setResolviendo(false);
                      }
                    })
                  }
                />
                <AppButton label="Cancelar" variant="secondary" onPress={closePanel} />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  favorBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  favorLinkArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  favorText: { flex: 1, fontFamily: fonts.semiBold, fontSize: 14 },
  resolverChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.blanco,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  resueltoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.verdeExitoSuave,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  resolverChatBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.verdeExito,
  },
  banner: { fontFamily: fonts.medium, fontSize: 14, paddingHorizontal: 16, paddingVertical: 10, textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  bubbleTime: { fontFamily: fonts.regular, fontSize: 12, marginTop: 4, alignSelf: 'flex-end' },
  error: { color: colors.rojo, fontSize: 14, fontFamily: fonts.medium, lineHeight: 20, paddingHorizontal: 16, marginBottom: 6 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: colors.blanco,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: fonts.regular,
    textAlignVertical: 'top',
  },
  sendButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(19, 46, 102, 0.5)', justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.blanco, borderRadius: radius.xl, padding: spacing.lg },
  cardTitle: { fontFamily: fonts.bold, fontSize: 22, marginBottom: spacing.sm },
  cardText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  reportInput: { flex: 0, minHeight: 80, marginBottom: spacing.sm },
});

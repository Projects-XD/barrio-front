import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Favor } from '@/types';
import { favorTypeLabel } from '@/i18n/labels';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius } from '@/theme';
import { timeAgo } from '@/utils/time';
import { Card } from './Card';
import { useAppStore } from '@/store/app-store';

type Props = { favor: Favor; onPress?: () => void };

/**
 * Limpia prefijos redundantes ("Necesito:", "Ofrezco:") que el usuario o el sistema
 * puedan haber añadido, para que el título se lea de forma limpia y editorial.
 */
function cleanDisplayTitle(title: string): string {
  const stripped = title.replace(/^(?:Necesito|Ofrezco)(?:\s*\([^)]*\))?:\s*/i, '').trim();
  return stripped || title;
}

export function FavorCard({ favor, onPress }: Props) {
  const p = usePalette();
  const userId = useAppStore((s) => s.userId);
  const esMio = Boolean(userId && favor.authorId === userId);
  const esOfrecimiento = favor.intent === 'ofrecer';

  const intentColor = esOfrecimiento ? colors.verdeExito : colors.naranja;
  const intentLabel = esOfrecimiento ? 'Ofrecimiento' : 'Pedido';
  const categoryLabel = favorTypeLabel[favor.type];
  const titleText = cleanDisplayTitle(favor.title);
  const authorName = esMio ? 'Tú' : favor.author.fullName;
  const timeText = timeAgo(favor.createdAt);

  return (
    <Card onPress={onPress}>
      <View style={styles.container}>
        {/* Barra sutil de acento visual según intención (verde = ofrecimiento, naranja = pedido) */}
        <View style={[styles.accentBar, { backgroundColor: intentColor }]} />

        <View style={styles.content}>
          {/* Fila superior: Kicker minimalista inline (nunca se sobrepone a la fecha) */}
          <View style={styles.topRow}>
            <View style={styles.kickerContainer}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.kickerText}>
                <Text style={[styles.kickerIntent, { color: intentColor }]}>
                  {intentLabel.toUpperCase()}
                </Text>
                <Text style={[styles.kickerSeparator, { color: p.muted }]}> · </Text>
                <Text style={[styles.kickerCategory, { color: p.muted }]}>
                  {categoryLabel}
                </Text>
              </Text>
              {esMio ? (
                <View style={styles.mineTag}>
                  <Text style={styles.mineText}>Tuya</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.time, { color: p.muted }]}>{timeText}</Text>
          </View>

          {/* Título principal con tipografía clara */}
          <Text style={[styles.title, { color: p.text }]} numberOfLines={2}>
            {titleText}
          </Text>

          {/* Descripción opcional (si tiene más detalle) */}
          {favor.description ? (
            <Text style={[styles.desc, { color: p.muted }]} numberOfLines={2}>
              {favor.description}
            </Text>
          ) : null}

          {/* Pie de tarjeta: Autor y estado informativo */}
          <View style={styles.footerRow}>
            <Text style={[styles.author, { color: esMio ? colors.azul : p.text }]}>
              {authorName}
            </Text>

            <View style={styles.footerRight}>
              {favor.syncStatus !== 'enviado' ? (
                <Text style={styles.syncNotice}>Sin conexión</Text>
              ) : favor.moderationStatus === 'pendiente' ? (
                <Text style={styles.pendingNotice}>En revisión</Text>
              ) : favor.interestedCount > 0 ? (
                <Text style={[styles.interested, { color: p.muted }]}>
                  {favor.interestedCount === 1 ? '1 interesado' : `${favor.interestedCount} interesados`}
                </Text>
              ) : null}
              {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.gris} /> : null}
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  accentBar: {
    width: 3.5,
    borderRadius: 2,
    marginRight: 12,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  kickerContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  kickerText: {
    flexShrink: 1,
    fontSize: 12,
  },
  kickerIntent: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  kickerSeparator: {
    fontSize: 12,
  },
  kickerCategory: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  mineTag: {
    backgroundColor: colors.azulSuave,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  mineText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.azul,
  },
  time: {
    fontFamily: fonts.regular,
    fontSize: 12,
    flexShrink: 0,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 23,
    marginBottom: 4,
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  author: {
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  interested: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  syncNotice: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.naranja,
  },
  pendingNotice: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.gris,
  },
});

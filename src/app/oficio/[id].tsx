import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ValidationBadge } from '@/components/ValidationBadge';
import { usePalette } from '@/hooks/usePalette';
import { useProfile, useVouch } from '@/hooks/useData';
import { oficioLabel } from '@/i18n/labels';
import { fonts, spacing } from '@/theme';

export default function OficioDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const { data: profile, isLoading } = useProfile(id);
  const vouch = useVouch(id);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={p.primary} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <EmptyState title="Perfil no encontrado" message="Puede que ya no esté disponible." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: profile.user.fullName }} />
      <Card>
        <Text style={[styles.nombre, { color: p.text }]}>{profile.user.fullName}</Text>
        <Text style={{ color: p.muted, fontFamily: fonts.regular, fontSize: 16 }}>
          {`${oficioLabel[profile.oficio.category]}${profile.yearsExperience ? ` · ${profile.yearsExperience} años de experiencia` : ''}`}
        </Text>
        <Text style={[styles.descripcion, { color: p.text }]}>{profile.description}</Text>
        <ValidationBadge validatedCount={profile.validatedCount} />
      </Card>

      <AppButton
        label={profile.hasVouchedByMe ? 'Visto bueno dado' : 'Dar visto bueno'}
        onPress={() => vouch.mutate()}
        disabled={profile.hasVouchedByMe || vouch.isPending}
      />
      <AppButton label="Contactar" variant="secondary" onPress={() => {}} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  nombre: { fontSize: 22, fontFamily: fonts.bold, marginBottom: 4 },
  descripcion: { fontFamily: fonts.regular, fontSize: 18, marginVertical: spacing.sm, lineHeight: 26 },
});

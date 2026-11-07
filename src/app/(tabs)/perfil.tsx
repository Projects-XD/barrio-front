import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/ToggleRow';
import { usePalette } from '@/hooks/usePalette';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, spacing } from '@/theme';

export default function Perfil() {
  const p = usePalette();
  const emergency = useAppStore((s) => s.emergencyActive);
  const setEmergency = useAppStore((s) => s.setEmergency);
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);
  const clearSession = useAppStore((s) => s.clearSession);

  const handleLogout = () => {
    clearSession();
    router.replace('/welcome');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: p.text }]}>Mi Perfil</Text>
        <Text style={[styles.subtitulo, { color: p.muted }]}>
          Gestiona tu identidad vecinal y preferencias de la app.
        </Text>
      </View>

      <Card>
        <View style={styles.usuarioRow}>
          <View style={[styles.avatar, { backgroundColor: colors.azul }]}>
            <Text style={styles.avatarText}>AG</Text>
          </View>
          <View style={styles.usuarioInfo}>
            <Text style={[styles.nombre, { color: p.text }]}>Alexander García</Text>
            <Text style={[styles.zona, { color: p.muted }]}>Zona: Centro · Miembro activo</Text>
          </View>
        </View>
      </Card>

      <Text style={[styles.seccionLabel, { color: p.text }]}>Mi confianza comunitaria</Text>
      <Card>
        <View style={styles.metricasRow}>
          <View style={styles.metrica}>
            <Text style={[styles.metricaValor, { color: colors.naranja }]}>3</Text>
            <Text style={styles.metricaLabel}>Vistos buenos</Text>
          </View>
          <View style={styles.metricaDivider} />
          <View style={styles.metrica}>
            <Text style={[styles.metricaValor, { color: colors.azul }]}>2</Text>
            <Text style={styles.metricaLabel}>Favores dados</Text>
          </View>
        </View>
      </Card>

      <Text style={[styles.seccionLabel, { color: p.text }]}>Simulaciones del Reto (Hackathon)</Text>
      <Card>
        <ToggleRow
          label="Modo emergencia activo"
          value={emergency}
          onChange={setEmergency}
        />
        <View style={styles.separador} />
        <ToggleRow
          label="Simular modo sin conexión"
          value={!isOnline}
          onChange={(v) => setOnline(!v)}
        />
      </Card>

      <View style={{ marginTop: spacing.md }}>
        <AppButton
          label="Ver tutorial de la app"
          variant="secondary"
          onPress={() => router.push('/welcome')}
        />
        <AppButton
          label="Cerrar sesión"
          variant="link"
          onPress={handleLogout}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md, marginTop: spacing.xs },
  titulo: { fontSize: 28, fontFamily: fonts.bold, marginBottom: 4 },
  subtitulo: { fontSize: 15, fontFamily: fonts.regular, lineHeight: 20 },
  usuarioRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.blanco, fontFamily: fonts.bold, fontSize: 18 },
  usuarioInfo: { flex: 1 },
  nombre: { fontSize: 19, fontFamily: fonts.bold, marginBottom: 2 },
  zona: { fontSize: 14, fontFamily: fonts.medium },
  seccionLabel: { fontSize: 16, fontFamily: fonts.semiBold, marginTop: spacing.md, marginBottom: 8 },
  metricasRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 4 },
  metrica: { alignItems: 'center' },
  metricaValor: { fontSize: 26, fontFamily: fonts.bold, marginBottom: 2 },
  metricaLabel: { fontSize: 14, fontFamily: fonts.regular, color: colors.gris },
  metricaDivider: { width: 1, height: 36, backgroundColor: colors.grisBorde },
  separador: { height: 1, backgroundColor: colors.grisBorde, marginVertical: 4 },
});

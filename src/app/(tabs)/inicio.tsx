import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { FavorCard } from '@/components/FavorCard';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { usePalette } from '@/hooks/usePalette';
import { useFavors } from '@/hooks/useData';
import { useAppStore } from '@/store/app-store';

export default function Inicio() {
  const p = usePalette();
  const emergency = useAppStore((s) => s.emergencyActive);
  const offline = !useAppStore((s) => s.isOnline);
  const { data: favors = [] } = useFavors();

  return (
    <Screen>
      <StatusBanner variant="emergencia" visible={emergency} />
      <StatusBanner variant="offline" visible={offline} />

      <Text style={[styles.titulo, { color: p.text }]}>Hola, vecino</Text>

      {emergency ? (
        <>
          <Text style={[styles.sub, { color: p.muted }]}>Tu barrio está en modo emergencia. Revisa los apoyos disponibles.</Text>
          <AppButton label="Servicios, reportes y recursos" onPress={() => router.push('/emergencia')} />
        </>
      ) : (
        <>
          <Text style={[styles.sub, { color: p.muted }]}>Encuentra ayuda o comparte lo que tienes.</Text>
          <AppButton label="Buscar oficio" onPress={() => router.push('/(tabs)/oficios')} />
          <AppButton label="Pedir o ofrecer favor" variant="secondary" onPress={() => router.push('/favores/nuevo')} />
        </>
      )}

      <Text style={[styles.seccion, { color: p.text }]}>Publicaciones recientes</Text>
      {favors.slice(0, 3).map((f) => (
        <FavorCard key={f.id} favor={f} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 28, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  sub: { fontSize: 16, marginBottom: 14 },
  seccion: { fontSize: 22, fontWeight: '700', marginTop: 18, marginBottom: 10 },
});

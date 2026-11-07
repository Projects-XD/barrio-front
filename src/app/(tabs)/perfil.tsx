import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/ToggleRow';
import { usePalette } from '@/hooks/usePalette';
import { useAppStore } from '@/store/app-store';
import { fonts, spacing } from '@/theme';

export default function Perfil() {
  const p = usePalette();
  const emergency = useAppStore((s) => s.emergencyActive);
  const setEmergency = useAppStore((s) => s.setEmergency);
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);

  return (
    <Screen>
      <Text style={[styles.titulo, { color: p.text }]}>Perfil</Text>

      <Card>
        <Text style={[styles.nombre, { color: p.text }]}>Tu nombre</Text>
        <Text style={{ color: p.muted, fontFamily: fonts.regular, fontSize: 16 }}>Zona: Castilla</Text>
      </Card>

      <Card>
        <Text style={[styles.resumen, { color: p.text }]}>Vistos buenos recibidos: 3</Text>
      </Card>

      <Card>
        <ToggleRow label="Modo emergencia" value={emergency} onChange={setEmergency} />
        <View style={styles.separador} />
        <ToggleRow label="Simular sin conexión" value={!isOnline} onChange={(v) => setOnline(!v)} />
      </Card>

      <AppButton label="Ver tutorial" variant="secondary" onPress={() => {}} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 28, fontFamily: fonts.bold, marginTop: 8, marginBottom: spacing.md },
  nombre: { fontSize: 18, fontFamily: fonts.bold },
  resumen: { fontFamily: fonts.regular, fontSize: 18 },
  separador: { height: 1, backgroundColor: '#E3DDD0', marginVertical: 4 },
});

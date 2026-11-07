import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { colors } from '@/theme';

export default function Index() {
  const hydrated = useAppStore((s) => s.hydrated);
  const userId = useAppStore((s) => s.userId);

  // Esperar a que _layout recupere la sesión guardada antes de decidir a dónde ir.
  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo }}>
        <ActivityIndicator size="large" color={colors.azul} />
      </View>
    );
  }

  return <Redirect href={userId ? '/(tabs)/inicio' : '/welcome'} />;
}

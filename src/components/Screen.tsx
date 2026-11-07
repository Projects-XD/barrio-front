import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/hooks/usePalette';

type Props = { children: ReactNode; scroll?: boolean };

export function Screen({ children, scroll = true }: Props) {
  const p = usePalette();
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: p.background }]}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // 120 px abajo: el botón flotante de emergencia no tapa el último elemento.
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120, flexGrow: 1 },
});

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
    <View style={[styles.content, styles.fixed]}>{children}</View>
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
  content: { paddingHorizontal: 20, paddingTop: 12, flexGrow: 1 },
  // Sin scroll propio, el contenido se limita a la pantalla para que las listas internas (FlatList) hagan scroll.
  fixed: { flex: 1 },
});

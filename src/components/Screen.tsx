import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/hooks/usePalette';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  keyboardAvoiding?: boolean;
};

export function Screen({ children, scroll = true, keyboardAvoiding = true }: Props) {
  const p = usePalette();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fixed]}>{children}</View>
  );

  const body = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: p.background }]}>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // 80 px abajo: asegura que el teclado o elementos inferiores nunca tapen inputs ni botones.
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 80, flexGrow: 1 },
  // Sin scroll propio, el contenido se limita a la pantalla para que las listas internas (FlatList) hagan scroll.
  fixed: { flex: 1, paddingBottom: 0 },
});

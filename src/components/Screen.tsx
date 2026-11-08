import type { ComponentRef, ReactNode, RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/hooks/usePalette';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  keyboardAvoiding?: boolean;
  topInset?: boolean;
  scrollViewRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = true,
  keyboardAvoiding = true,
  topInset = true,
  scrollViewRef,
  contentStyle,
}: Props) {
  const p = usePalette();
  const content = scroll ? (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={[styles.content, !topInset && styles.noTopInset, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fixed, !topInset && styles.noTopInset, contentStyle]}>{children}</View>
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
    <SafeAreaView
      edges={topInset ? ['top', 'left', 'right'] : ['left', 'right']}
      style={[styles.root, { backgroundColor: p.background }]}
    >
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 80, flexGrow: 1 },
  noTopInset: { paddingTop: 4 },
  fixed: { flex: 1, paddingBottom: 0 },
});

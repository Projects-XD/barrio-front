import { StyleSheet, Switch, Text, View } from 'react-native';
import { usePalette } from '@/hooks/usePalette';

type Props = { label: string; value: boolean; onChange: (value: boolean) => void };

export function ToggleRow({ label, value, onChange }: Props) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: p.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: p.primary, false: p.border }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56, gap: 12 },
  label: { fontSize: 18, flex: 1 },
});

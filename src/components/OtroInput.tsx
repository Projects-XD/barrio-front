import { StyleSheet, Text, TextInput, View } from 'react-native';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius } from '@/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength?: number;
};

// Campo que aparece al elegir "Otro": la persona escribe la opción que no está en la lista.
export function OtroInput({ label, value, onChangeText, placeholder, maxLength = 60 }: Props) {
  const p = usePalette();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: p.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gris}
        maxLength={maxLength}
        style={[styles.input, { color: p.text, borderColor: p.cta }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, marginBottom: 4 },
  label: { fontFamily: fonts.semiBold, fontSize: 15, marginBottom: 6 },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
    backgroundColor: colors.blanco,
  },
});

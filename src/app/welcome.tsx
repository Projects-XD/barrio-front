import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { fonts, colors, radius, spacing } from '@/theme';

const slides = [
  { titulo: 'Encuentra oficios de confianza', texto: 'Oficios validados por tus vecinos de la misma zona.' },
  { titulo: 'Comparte favores sin dinero', texto: 'Presta, ofrece o pide ayuda en tu barrio.' },
  { titulo: 'Apoyo en emergencias', texto: 'Encuentra servicios y recursos cuando más se necesitan.' },
];

export default function Welcome() {
  const p = usePalette();
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;
  const slide = slides[index];

  const next = () => (last ? router.replace('/register') : setIndex(index + 1));

  return (
    <Screen scroll={false}>
      <View style={styles.slide}>
        <View style={styles.ilustra}>
          <Text style={{ color: p.muted, fontFamily: fonts.regular, fontSize: 18 }}>Ilustración</Text>
        </View>
        <Text style={[styles.titulo, { color: p.text }]}>{slide.titulo}</Text>
        <Text style={[styles.texto, { color: p.muted }]}>{slide.texto}</Text>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === index ? p.primary : p.border }]} />
          ))}
        </View>
      </View>
      <AppButton label={last ? 'Empezar' : 'Siguiente'} onPress={next} />
      <AppButton label="Saltar" variant="link" onPress={() => router.replace('/register')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: spacing.xl },
  ilustra: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.bordeSuave,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  titulo: { fontSize: 28, fontFamily: fonts.bold, textAlign: 'center', marginBottom: spacing.sm },
  texto: { fontFamily: fonts.regular, fontSize: 18, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 8, marginVertical: spacing.lg },
  dot: { width: 10, height: 10, borderRadius: 5 },
});

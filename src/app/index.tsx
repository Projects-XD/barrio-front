import { Redirect } from 'expo-router';
import { useAppStore } from '@/store/app-store';

export default function Index() {
  const userId = useAppStore((s) => s.userId);
  return <Redirect href={userId ? '/(tabs)/inicio' : '/welcome'} />;
}

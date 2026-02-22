import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAppStore } from '../src/state/use-app-store';

export default function RootLayout() {
  const bootstrap = useAppStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="practice" options={{ title: 'Üben' }} />
      <Stack.Screen name="settings" options={{ title: 'Einstellungen' }} />
      <Stack.Screen name="summary" options={{ title: 'Session Summary' }} />
    </Stack>
  );
}

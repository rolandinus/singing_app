import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAppStore } from '../src/state/use-app-store';
import { t } from '../src/core/i18n/translator';

export default function RootLayout() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const locale = useAppStore((s) => s.settings.locale);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="summary" options={{ title: t(locale, 'nav_summary'), presentation: 'modal' }} />
    </Stack>
  );
}

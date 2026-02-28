import React from 'react';
import { Tabs } from 'expo-router';
import { t } from '../../src/core/i18n/translator';
import { useAppStore } from '../../src/state/use-app-store';

export default function TabsLayout() {
  const locale = useAppStore((s) => s.settings.locale);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1d4ed8',
      }}
    >
      <Tabs.Screen name="index" options={{ title: t(locale, 'nav_dashboard') }} />
      <Tabs.Screen name="practice" options={{ title: t(locale, 'nav_practice') }} />
      <Tabs.Screen name="settings" options={{ title: t(locale, 'nav_settings') }} />
    </Tabs>
  );
}

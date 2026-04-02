import React from 'react';
import { Tabs } from 'expo-router';
import { t } from '../../src/core/i18n/translator';
import { useAppStore } from '../../src/state/use-app-store';
import { useThemeColors } from '../../src/ui/hooks/use-theme-colors';

export default function TabsLayout() {
  const locale = useAppStore((s) => s.settings.locale);
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t(locale, 'nav_dashboard') }} />
      <Tabs.Screen name="practice" options={{ title: t(locale, 'nav_practice') }} />
      <Tabs.Screen name="settings" options={{ title: t(locale, 'nav_settings') }} />
      {__DEV__ ? (
        <Tabs.Screen name="debug" options={{ title: t(locale, 'nav_debug') }} />
      ) : null}
    </Tabs>
  );
}

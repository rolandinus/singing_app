import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { modeLabel, t } from '../src/core/i18n/translator';
import { useAppStore } from '../src/state/use-app-store';
import { Card } from '../src/ui/components/Card';
import { Screen } from '../src/ui/components/Screen';

export default function SummaryScreen() {
  const settings = useAppStore((s) => s.settings);
  const summary = useAppStore((s) => s.summary);
  const clearSummary = useAppStore((s) => s.clearSummary);

  const locale = settings.locale;

  if (!summary) {
    return (
      <Screen>
        <Card>
          <Text>{t(locale, 'no_finished_session')}</Text>
          <Pressable onPress={() => router.replace('/')}><Text>{t(locale, 'back_dashboard')}</Text></Pressable>
        </Card>
      </Screen>
    );
  }

  const accuracy = Math.round(summary.accuracy * 100);

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>{t(locale, 'session_finished')}</Text>
        <Text style={styles.body}>{t(locale, 'mode')}: {modeLabel(locale, summary.mode)}</Text>
        <Text style={styles.body}>{t(locale, 'correct')}: {summary.correct}/{summary.total}</Text>
        <Text style={styles.body}>{t(locale, 'accuracy')}: {accuracy}%</Text>

        <Pressable
          style={styles.button}
          onPress={() => {
            clearSummary();
            router.replace('/');
          }}
        >
          <Text style={styles.buttonText}>{t(locale, 'back_dashboard')}</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  body: { color: '#334155', fontSize: 15 },
  button: { marginTop: 8, backgroundColor: '#1d4ed8', borderRadius: 8, alignItems: 'center', paddingVertical: 10 },
  buttonText: { color: '#fff', fontWeight: '700' },
});

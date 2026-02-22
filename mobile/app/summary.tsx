import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppStore } from '../src/state/use-app-store';
import { Card } from '../src/ui/components/Card';
import { Screen } from '../src/ui/components/Screen';

export default function SummaryScreen() {
  const summary = useAppStore((s) => s.summary);
  const clearSummary = useAppStore((s) => s.clearSummary);

  if (!summary) {
    return (
      <Screen>
        <Card>
          <Text>Keine abgeschlossene Session.</Text>
          <Pressable onPress={() => router.replace('/')}><Text>Zum Dashboard</Text></Pressable>
        </Card>
      </Screen>
    );
  }

  const accuracy = Math.round(summary.accuracy * 100);

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Session abgeschlossen</Text>
        <Text style={styles.body}>Modus: {summary.mode}</Text>
        <Text style={styles.body}>Korrekt: {summary.correct}/{summary.total}</Text>
        <Text style={styles.body}>Accuracy: {accuracy}%</Text>

        <Pressable
          style={styles.button}
          onPress={() => {
            clearSummary();
            router.replace('/');
          }}
        >
          <Text style={styles.buttonText}>Zum Dashboard</Text>
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

import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../src/ui/components/Card';
import { Screen } from '../src/ui/components/Screen';
import { useAppStore } from '../src/state/use-app-store';
import { SKILL_DEFINITIONS } from '../src/core/config/curriculum';

export default function DashboardScreen() {
  const bootstrapped = useAppStore((s) => s.bootstrapped);
  const settings = useAppStore((s) => s.settings);
  const recentSessions = useAppStore((s) => s.recentSessions);
  const skillRows = useAppStore((s) => s.skillRows);
  const startGuided = useAppStore((s) => s.startGuided);

  return (
    <Screen>
      <Card style={styles.hero}>
        <Text style={styles.eyebrow}>Geführtes Programm</Text>
        <Text style={styles.heroTitle}>Nächste Session starten</Text>
        <Text style={styles.heroBody}>
          {bootstrapped
            ? `Tagesziel: ${settings.dailyGoalExercises} Übungen`
            : 'Lade Daten...'}
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            startGuided();
            router.push('/practice');
          }}
        >
          <Text style={styles.primaryButtonText}>Guided Session starten</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        {recentSessions.length === 0 ? (
          <Text style={styles.muted}>Noch keine Sessions.</Text>
        ) : (
          recentSessions.slice(0, 5).map((session) => (
            <Text key={session.sessionId} style={styles.muted}>
              {new Date(session.completedAt).toLocaleString('de-DE')}: {session.summary.correct}/{session.summary.total} ({Math.round(session.summary.accuracy * 100)}%)
            </Text>
          ))
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Skill Map (Visual)</Text>
        {skillRows.map((row) => {
          const label = SKILL_DEFINITIONS.find((s) => s.key === row.skillKey)?.label ?? row.skillKey;
          return (
            <View key={`${row.clef}.${row.skillKey}`} style={styles.skillRow}>
              <Text style={styles.skillName}>{label} • {row.clef}</Text>
              <Text style={styles.muted}>L{row.level} • {row.mastery}% • {row.attemptsTotal} Versuche</Text>
            </View>
          );
        })}
      </Card>

      <View style={styles.actionsRow}>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/practice')}>
          <Text style={styles.secondaryButtonText}>Custom Practice</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/settings')}>
          <Text style={styles.secondaryButtonText}>Settings</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#dbeafe' },
  eyebrow: { fontSize: 12, color: '#1e40af', fontWeight: '700' },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  heroBody: { fontSize: 14, color: '#334155' },
  primaryButton: { backgroundColor: '#1d4ed8', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  muted: { color: '#64748b', fontSize: 13 },
  skillRow: { gap: 4, paddingVertical: 4 },
  skillName: { color: '#1e293b', fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8 },
  secondaryButton: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
});

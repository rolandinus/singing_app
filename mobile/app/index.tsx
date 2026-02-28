import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../src/ui/components/Card';
import { Screen } from '../src/ui/components/Screen';
import { useAppStore } from '../src/state/use-app-store';
import { clefLabel, localeTag, skillLabel, t } from '../src/core/i18n/translator';

export default function DashboardScreen() {
  const bootstrapped = useAppStore((s) => s.bootstrapped);
  const settings = useAppStore((s) => s.settings);
  const recentSessions = useAppStore((s) => s.recentSessions);
  const skillRows = useAppStore((s) => s.skillRows);
  const startGuided = useAppStore((s) => s.startGuided);

  const locale = settings.locale;

  return (
    <Screen>
      <Card style={styles.hero}>
        <Text style={styles.eyebrow}>{t(locale, 'hero_program')}</Text>
        <Text style={styles.heroTitle}>{t(locale, 'hero_next_session')}</Text>
        <Text style={styles.heroBody}>
          {bootstrapped
            ? t(locale, 'daily_goal', { count: settings.dailyGoalExercises })
            : t(locale, 'loading_data')}
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            startGuided();
            router.push('/practice');
          }}
        >
          <Text style={styles.primaryButtonText}>{t(locale, 'start_guided')}</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t(locale, 'recent_sessions')}</Text>
        {recentSessions.length === 0 ? (
          <Text style={styles.muted}>{t(locale, 'no_sessions')}</Text>
        ) : (
          recentSessions.slice(0, 5).map((session) => (
            <Text key={session.sessionId} style={styles.muted}>
              {new Date(session.completedAt).toLocaleString(localeTag(locale))}: {session.summary.correct}/{session.summary.total} ({Math.round(session.summary.accuracy * 100)}%)
            </Text>
          ))
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t(locale, 'skill_map_training')}</Text>
        {skillRows.map((row) => (
          <View key={`${row.clef}.${row.skillKey}`} style={styles.skillRow}>
            <View style={styles.skillRowHead}>
              <Text style={styles.skillName}>{skillLabel(locale, row.skillKey)} • {clefLabel(locale, row.clef)}</Text>
              <Text style={styles.muted}>L{row.level}</Text>
            </View>
            <View style={styles.masteryTrack}>
              <View style={[styles.masteryFill, { width: `${row.mastery}%` }]} />
            </View>
            <Text style={styles.muted}>{row.mastery}% • {row.attemptsTotal} {t(locale, 'attempts')}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.actionsRow}>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/practice')}>
          <Text style={styles.secondaryButtonText}>{t(locale, 'custom_practice')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/settings')}>
          <Text style={styles.secondaryButtonText}>{t(locale, 'settings')}</Text>
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
  skillRow: { gap: 6, paddingVertical: 6 },
  skillRowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skillName: { color: '#1e293b', fontWeight: '600', flex: 1, paddingRight: 8 },
  masteryTrack: { height: 8, borderRadius: 99, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  masteryFill: { height: 8, borderRadius: 99, backgroundColor: '#1d4ed8' },
  actionsRow: { flexDirection: 'row', gap: 8 },
  secondaryButton: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
});

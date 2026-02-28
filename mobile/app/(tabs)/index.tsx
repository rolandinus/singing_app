import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/ui/components/Card';
import { Screen } from '../../src/ui/components/Screen';
import { useAppStore } from '../../src/state/use-app-store';
import { clefLabel, localeTag, modeLabel, skillLabel, t } from '../../src/core/i18n/translator';

function masteryColor(mastery: number): string {
  if (mastery < 40) return '#64748b';
  if (mastery < 80) return '#d97706';
  return '#16a34a';
}

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  );
}

export default function DashboardScreen() {
  const bootstrapped = useAppStore((s) => s.bootstrapped);
  const settings = useAppStore((s) => s.settings);
  const recentSessions = useAppStore((s) => s.recentSessions);
  const skillRows = useAppStore((s) => s.skillRows);
  const loading = useAppStore((s) => s.loading);
  const startGuided = useAppStore((s) => s.startGuided);

  const locale = settings.locale;
  const completedToday = recentSessions
    .filter((session) => isToday(session.completedAt))
    .reduce((acc, session) => acc + Number(session.summary?.total ?? 0), 0);
  const dailyProgress = Math.min(100, Math.round((completedToday / Math.max(1, settings.dailyGoalExercises)) * 100));

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
        {bootstrapped ? (
          <>
            <Text style={styles.todayProgress}>{t(locale, 'today_progress', { done: completedToday, goal: settings.dailyGoalExercises })}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${dailyProgress}%` }]} />
            </View>
          </>
        ) : null}
        <Pressable
          style={[styles.primaryButton, loading.startGuided && styles.disabledButton]}
          onPress={async () => {
            await startGuided();
            router.push('/practice');
          }}
          disabled={loading.startGuided}
        >
          {loading.startGuided ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t(locale, 'start_guided')}</Text>}
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t(locale, 'recent_sessions')}</Text>
        {recentSessions.length === 0 ? (
          <Text style={styles.muted}>{t(locale, 'no_sessions')}</Text>
        ) : (
          recentSessions.slice(0, 5).map((session) => {
            const accuracy = Math.round(Number(session.summary?.accuracy ?? 0) * 100);
            const badgeColor = accuracy < 40 ? '#64748b' : accuracy < 80 ? '#d97706' : '#16a34a';

            return (
              <View key={session.sessionId} style={styles.sessionRow}>
                <View style={styles.sessionMain}>
                  <Text style={styles.sessionDate}>{new Date(session.completedAt).toLocaleDateString(localeTag(locale))}</Text>
                  <Text style={styles.muted}>{modeLabel(locale, session.mode)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: `${badgeColor}22`, borderColor: `${badgeColor}66` }]}>
                  <Text style={[styles.badgeText, { color: badgeColor }]}>{accuracy}%</Text>
                </View>
              </View>
            );
          })
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t(locale, 'skill_map_training')}</Text>
        {settings.enabledClefs.map((clef) => {
          const rows = skillRows.filter((row) => row.clef === clef);
          if (rows.length === 0) return null;

          return (
            <View key={clef} style={styles.clefGroup}>
              <Text style={styles.clefHeader}>{clefLabel(locale, clef)}</Text>
              {rows.map((row) => {
                const fillColor = masteryColor(row.mastery);
                return (
                  <View key={`${row.clef}.${row.skillKey}`} style={styles.skillRow}>
                    <View style={styles.skillRowHead}>
                      <Text style={styles.skillName}>{skillLabel(locale, row.skillKey)}</Text>
                      <Text style={styles.muted}>L{row.level}</Text>
                    </View>
                    <View style={styles.masteryTrack}>
                      <View style={[styles.masteryFill, { width: `${row.mastery}%`, backgroundColor: fillColor }]} />
                    </View>
                    <Text style={styles.muted}>{row.mastery}% • {row.attemptsTotal} {t(locale, 'attempts')}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#dbeafe' },
  eyebrow: { fontSize: 12, color: '#1e40af', fontWeight: '700' },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  heroBody: { fontSize: 14, color: '#334155' },
  todayProgress: { color: '#1e40af', fontWeight: '600', fontSize: 13 },
  progressTrack: { height: 6, borderRadius: 99, backgroundColor: '#bfdbfe', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 99, backgroundColor: '#1d4ed8' },
  primaryButton: { backgroundColor: '#1d4ed8', minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  muted: { color: '#64748b', fontSize: 13 },
  sessionRow: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionMain: { gap: 2 },
  sessionDate: { color: '#0f172a', fontWeight: '600' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontWeight: '700', fontSize: 12 },
  clefGroup: { gap: 8, paddingTop: 4 },
  clefHeader: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  skillRow: { gap: 6, paddingVertical: 4 },
  skillRowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skillName: { color: '#1e293b', fontWeight: '600', flex: 1, paddingRight: 8 },
  masteryTrack: { height: 8, borderRadius: 99, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  masteryFill: { height: 8, borderRadius: 99 },
});

import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { clefLabel, modeLabel, skillLabel, t } from '../src/core/i18n/translator';
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
          <Text style={styles.title}>{t(locale, 'no_finished_session')}</Text>
          <Text style={styles.body}>{t(locale, 'no_finished_session_hint')}</Text>
          <Pressable style={styles.button} onPress={() => router.replace('/')}>
            <Text style={styles.buttonText}>{t(locale, 'back_dashboard')}</Text>
          </Pressable>
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

        <View style={styles.accuracyWrap}>
          <Text style={styles.accuracyNumber}>{accuracy}%</Text>
          <Text style={styles.accuracyLabel}>{t(locale, 'accuracy_big_label')}</Text>
        </View>

        <Text style={styles.sectionTitle}>{t(locale, 'practiced_skills')}</Text>
        {summary.practicedSkills && summary.practicedSkills.length > 0 ? (
          summary.practicedSkills.map((row) => {
            const color = row.masteryDelta < 0 ? '#be123c' : row.masteryDelta === 0 ? '#475569' : '#047857';
            const sign = row.masteryDelta > 0 ? '+' : '';
            return (
              <View key={`${row.clef}.${row.skillKey}`} style={styles.skillRow}>
                <Text style={styles.skillText}>{skillLabel(locale, row.skillKey)} • {clefLabel(locale, row.clef)}</Text>
                <Text style={[styles.deltaText, { color }]}>{sign}{row.masteryDelta}%</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.body}>{t(locale, 'no_skill_changes')}</Text>
        )}

        <Text style={styles.streakText}>{t(locale, 'streak_days', { count: summary.streakDays ?? 0 })}</Text>

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
  sectionTitle: { marginTop: 6, color: '#0f172a', fontWeight: '700', fontSize: 15 },
  accuracyWrap: {
    alignSelf: 'center',
    width: 132,
    minHeight: 132,
    borderRadius: 66,
    borderWidth: 6,
    borderColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    marginVertical: 8,
  },
  accuracyNumber: { fontSize: 36, fontWeight: '800', color: '#1d4ed8' },
  accuracyLabel: { color: '#334155', fontSize: 12, fontWeight: '600' },
  skillRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  skillText: { color: '#0f172a', fontWeight: '600', flex: 1, paddingRight: 8 },
  deltaText: { fontWeight: '700' },
  streakText: { color: '#0369a1', fontWeight: '700', textAlign: 'center' },
  button: { marginTop: 8, backgroundColor: '#1d4ed8', borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  buttonText: { color: '#fff', fontWeight: '700' },
});

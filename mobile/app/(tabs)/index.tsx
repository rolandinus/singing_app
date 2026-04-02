import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Card } from '../../src/ui/components/Card';
import { ProgressExplainerCard } from '../../src/ui/components/ProgressExplainerCard';
import { Screen } from '../../src/ui/components/Screen';
import { useAppStore } from '../../src/state/use-app-store';
import { clefLabel, localeTag, modeLabel, skillLabel, t, type TranslationKey } from '../../src/core/i18n/translator';
import type { ExerciseFamily } from '../../src/core/types';
import { useThemeColors } from '../../src/ui/hooks/use-theme-colors';

const GUIDED_FAMILY_OPTIONS: Array<{ value: ExerciseFamily | null; labelKey: TranslationKey }> = [
  { value: null, labelKey: 'family_all' },
  { value: 'visual', labelKey: 'family_visual' },
  { value: 'aural', labelKey: 'family_aural' },
  { value: 'singing', labelKey: 'family_singing' },
];

function masteryColor(mastery: number, colors: ReturnType<typeof useThemeColors>): string {
  if (mastery < 40) return colors.masteryLow;
  if (mastery < 80) return colors.masteryMid;
  return colors.masteryHigh;
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
  const colors = useThemeColors();
  const bootstrapped = useAppStore((s) => s.bootstrapped);
  const settings = useAppStore((s) => s.settings);
  const recentSessions = useAppStore((s) => s.recentSessions);
  const skillRows = useAppStore((s) => s.skillRows);
  const loading = useAppStore((s) => s.loading);
  const startGuided = useAppStore((s) => s.startGuided);
  const guidedFamily = useAppStore((s) => s.guidedFamily);
  const setGuidedFamily = useAppStore((s) => s.setGuidedFamily);

  const locale = settings.locale;
  const completedToday = recentSessions
    .filter((session) => isToday(session.completedAt))
    .reduce((acc, session) => acc + Number(session.summary?.total ?? 0), 0);
  const dailyProgress = Math.min(100, Math.round((completedToday / Math.max(1, settings.dailyGoalExercises)) * 100));

  return (
    <Screen>
      <Card style={{ backgroundColor: colors.surfaceBlue }}>
        <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '700' }}>{t(locale, 'hero_program')}</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>{t(locale, 'hero_next_session')}</Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary }}>
          {bootstrapped
            ? t(locale, 'daily_goal', { count: settings.dailyGoalExercises })
            : t(locale, 'loading_data')}
        </Text>
        {bootstrapped ? (
          <>
            <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>
              {t(locale, 'today_progress', { done: completedToday, goal: settings.dailyGoalExercises })}
            </Text>
            <View style={{ height: 6, borderRadius: 99, backgroundColor: colors.progressTrack, overflow: 'hidden' }}>
              <View style={{ height: 6, borderRadius: 99, backgroundColor: colors.primaryStrong, width: `${dailyProgress}%` }} />
            </View>
          </>
        ) : null}
        <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>{t(locale, 'family')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GUIDED_FAMILY_OPTIONS.map(({ value, labelKey }) => (
            <Pressable
              key={String(value)}
              style={[
                { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 999, paddingHorizontal: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
                guidedFamily === value && { backgroundColor: colors.toggleActiveBg, borderColor: colors.toggleActiveBorder },
              ]}
              onPress={() => setGuidedFamily(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: guidedFamily === value }}
            >
              <Text style={[
                { color: colors.textSecondary },
                guidedFamily === value && { color: colors.primaryStrong, fontWeight: '700' },
              ]}>
                {t(locale, labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[
            { backgroundColor: colors.primaryStrong, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
            loading.startGuided && { opacity: 0.6 },
          ]}
          onPress={async () => {
            await startGuided();
            router.push('/practice');
          }}
          disabled={loading.startGuided}
          accessibilityRole="button"
        >
          {loading.startGuided
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700' }}>{t(locale, 'start_guided')}</Text>}
        </Pressable>
      </Card>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{t(locale, 'recent_sessions')}</Text>
        {recentSessions.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t(locale, 'no_sessions')}</Text>
        ) : (
          recentSessions.slice(0, 5).map((session) => {
            const accuracy = Math.round(Number(session.summary?.accuracy ?? 0) * 100);
            const badgeColor = masteryColor(accuracy, colors);

            return (
              <View
                key={session.sessionId}
                style={{
                  minHeight: 52,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ gap: 2 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                    {new Date(session.completedAt).toLocaleDateString(localeTag(locale))}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{modeLabel(locale, session.mode)}</Text>
                </View>
                <View style={{ borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: `${badgeColor}22`, borderColor: `${badgeColor}66` }}>
                  <Text style={{ fontWeight: '700', fontSize: 12, color: badgeColor }}>{accuracy}%</Text>
                </View>
              </View>
            );
          })
        )}
      </Card>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{t(locale, 'skill_map_training')}</Text>
        {settings.enabledClefs.map((clef) => {
          const rows = skillRows.filter((row) => row.clef === clef);
          if (rows.length === 0) return null;

          return (
            <View key={clef} style={{ gap: 8, paddingTop: 4 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{clefLabel(locale, clef)}</Text>
              {rows.map((row) => {
                const fillColor = masteryColor(row.mastery, colors);
                return (
                  <View key={`${row.clef}.${row.skillKey}`} style={{ gap: 6, paddingVertical: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.textSecondary, fontWeight: '600', flex: 1, paddingRight: 8 }}>{skillLabel(locale, row.skillKey)}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>L{row.level}</Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 99, backgroundColor: colors.masteryTrack, overflow: 'hidden' }}>
                      <View style={{ height: 8, borderRadius: 99, backgroundColor: fillColor, width: `${row.mastery}%` }} />
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{row.mastery}% • {row.attemptsTotal} {t(locale, 'attempts')}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
        <ProgressExplainerCard locale={locale} />
      </Card>
    </Screen>
  );
}

import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { clefLabel, modeLabel, skillLabel, t } from '../src/core/i18n/translator';
import { useAppStore } from '../src/state/use-app-store';
import { Card } from '../src/ui/components/Card';
import { ProgressExplainerCard } from '../src/ui/components/ProgressExplainerCard';
import { Screen } from '../src/ui/components/Screen';
import { useThemeColors } from '../src/ui/hooks/use-theme-colors';

export default function SummaryScreen() {
  const colors = useThemeColors();
  const settings = useAppStore((s) => s.settings);
  const summary = useAppStore((s) => s.summary);
  const clearSummary = useAppStore((s) => s.clearSummary);

  const locale = settings.locale;

  if (!summary) {
    return (
      <Screen>
        <Card>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{t(locale, 'no_finished_session')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{t(locale, 'no_finished_session_hint')}</Text>
          <Pressable
            style={{ marginTop: 8, backgroundColor: colors.primaryStrong, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
            onPress={() => router.replace('/')}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t(locale, 'back_dashboard')}</Text>
          </Pressable>
        </Card>
      </Screen>
    );
  }

  const accuracy = Math.round(summary.accuracy * 100);

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{t(locale, 'session_finished')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{t(locale, 'mode')}: {modeLabel(locale, summary.mode)}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{t(locale, 'correct')}: {summary.correct}/{summary.total}</Text>

        <View
          style={{
            alignSelf: 'center',
            width: 132,
            minHeight: 132,
            borderRadius: 66,
            borderWidth: 6,
            borderColor: colors.toggleActiveBorder,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceInfo,
            marginVertical: 8,
          }}
        >
          <Text style={{ fontSize: 36, fontWeight: '800', color: colors.primaryStrong }}>{accuracy}%</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{t(locale, 'accuracy_big_label')}</Text>
        </View>

        <Text style={{ marginTop: 6, color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>{t(locale, 'practiced_skills')}</Text>
        {summary.practicedSkills && summary.practicedSkills.length > 0 ? (
          summary.practicedSkills.map((row) => {
            const color = row.masteryDelta < 0 ? colors.danger : row.masteryDelta === 0 ? colors.textSecondary : colors.success;
            const sign = row.masteryDelta > 0 ? '+' : '';
            return (
              <View
                key={`${row.clef}.${row.skillKey}`}
                style={{
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600', flex: 1, paddingRight: 8 }}>
                  {skillLabel(locale, row.skillKey)} • {clefLabel(locale, row.clef)}
                </Text>
                <Text style={{ fontWeight: '700', color }}>{sign}{row.masteryDelta}%</Text>
              </View>
            );
          })
        ) : (
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{t(locale, 'no_skill_changes')}</Text>
        )}

        <ProgressExplainerCard locale={locale} />

        <Text style={{ color: '#0369a1', fontWeight: '700', textAlign: 'center' }}>
          {t(locale, 'streak_days', { count: summary.streakDays ?? 0 })}
        </Text>

        <Pressable
          style={{ marginTop: 8, backgroundColor: colors.primaryStrong, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
          onPress={() => {
            clearSummary();
            router.replace('/');
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>{t(locale, 'back_dashboard')}</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

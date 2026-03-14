import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { clefLabel, t } from '../../src/core/i18n/translator';
import type { Clef, Locale } from '../../src/core/types';
import { Screen } from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { Stepper } from '../../src/ui/components/Stepper';
import { useAppStore } from '../../src/state/use-app-store';
import { useThemeColors } from '../../src/ui/hooks/use-theme-colors';

const MIN_DAILY_GOAL = 1;
const MAX_DAILY_GOAL = 50;
const MIN_BPM = 40;
const MAX_BPM = 200;
const BPM_STEP = 4;

export default function SettingsScreen() {
  const colors = useThemeColors();
  const settings = useAppStore((s) => s.settings);
  const loading = useAppStore((s) => s.loading);
  const saveSettings = useAppStore((s) => s.saveSettings);

  const locale = settings.locale;
  const saving = loading.saveSettings;

  const treble = settings.enabledClefs.includes('treble');
  const bass = settings.enabledClefs.includes('bass');

  function toggleClef(clef: Clef) {
    const current = settings.enabledClefs;
    const isEnabled = current.includes(clef);
    const next = isEnabled ? current.filter((c) => c !== clef) : [...current, clef];
    const finalClefs: Clef[] = next.length ? next : ['treble'];
    const defaultClef = finalClefs.includes(settings.defaultClef) ? settings.defaultClef : finalClefs[0];
    saveSettings({ enabledClefs: finalClefs, defaultClef });
  }

  function setDefaultClef(clef: Clef) {
    if (settings.defaultClef === clef) return;
    saveSettings({ defaultClef: clef });
  }

  function setDailyGoal(next: number) {
    if (!Number.isFinite(next) || next < MIN_DAILY_GOAL || next > MAX_DAILY_GOAL) return;
    if (next === settings.dailyGoalExercises) return;
    saveSettings({ dailyGoalExercises: next });
  }

  function setBpm(next: number) {
    const clamped = Math.max(MIN_BPM, Math.min(MAX_BPM, next));
    if (clamped === settings.bpm) return;
    saveSettings({ bpm: clamped });
  }

  function setLocale(next: Locale) {
    if (next === settings.locale) return;
    saveSettings({ locale: next });
  }

  const toggleStyle = {
    minHeight: 44 as const,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  const toggleOnStyle = {
    backgroundColor: colors.toggleActiveBg,
    borderColor: colors.toggleActiveBorder,
  };

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{t(locale, 'settings')}</Text>
          {saving ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>

        <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>{t(locale, 'enabled_clefs')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[toggleStyle, treble && toggleOnStyle]}
            onPress={() => toggleClef('treble')}
            disabled={saving}
          >
            <Text style={[{ color: colors.textSecondary }, treble && { color: colors.primary, fontWeight: '700' }]}>
              {clefLabel(locale, 'treble')}
            </Text>
          </Pressable>
          <Pressable
            style={[toggleStyle, bass && toggleOnStyle]}
            onPress={() => toggleClef('bass')}
            disabled={saving}
          >
            <Text style={[{ color: colors.textSecondary }, bass && { color: colors.primary, fontWeight: '700' }]}>
              {clefLabel(locale, 'bass')}
            </Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>{t(locale, 'default_clef')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[toggleStyle, settings.defaultClef === 'treble' && toggleOnStyle]}
            onPress={() => setDefaultClef('treble')}
            disabled={saving}
          >
            <Text style={[{ color: colors.textSecondary }, settings.defaultClef === 'treble' && { color: colors.primary, fontWeight: '700' }]}>
              {clefLabel(locale, 'treble')}
            </Text>
          </Pressable>
          <Pressable
            style={[toggleStyle, settings.defaultClef === 'bass' && toggleOnStyle]}
            onPress={() => setDefaultClef('bass')}
            disabled={saving}
          >
            <Text style={[{ color: colors.textSecondary }, settings.defaultClef === 'bass' && { color: colors.primary, fontWeight: '700' }]}>
              {clefLabel(locale, 'bass')}
            </Text>
          </Pressable>
        </View>

        <Stepper
          label={t(locale, 'daily_goal_label')}
          value={settings.dailyGoalExercises}
          min={MIN_DAILY_GOAL}
          max={MAX_DAILY_GOAL}
          onChange={setDailyGoal}
          disabled={saving}
        />

        <Stepper
          label={t(locale, 'bpm_label')}
          value={settings.bpm}
          min={MIN_BPM}
          max={MAX_BPM}
          step={BPM_STEP}
          onChange={setBpm}
          disabled={saving}
        />

        <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>{t(locale, 'language')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[toggleStyle, settings.locale === 'de' && toggleOnStyle]}
            onPress={() => setLocale('de')}
            disabled={saving}
          >
            <Text style={[{ color: colors.textSecondary }, settings.locale === 'de' && { color: colors.primary, fontWeight: '700' }]}>
              {t(locale, 'lang_de')}
            </Text>
          </Pressable>
          <Pressable
            style={[toggleStyle, settings.locale === 'en' && toggleOnStyle]}
            onPress={() => setLocale('en')}
            disabled={saving}
          >
            <Text style={[{ color: colors.textSecondary }, settings.locale === 'en' && { color: colors.primary, fontWeight: '700' }]}>
              {t(locale, 'lang_en')}
            </Text>
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}

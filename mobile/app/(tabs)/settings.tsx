import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { clefLabel, t } from '../../src/core/i18n/translator';
import type { Clef, Locale } from '../../src/core/types';
import { Screen } from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { Stepper } from '../../src/ui/components/Stepper';
import { useAppStore } from '../../src/state/use-app-store';

const MIN_DAILY_GOAL = 1;
const MAX_DAILY_GOAL = 50;

export default function SettingsScreen() {
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

  function setLocale(next: Locale) {
    if (next === settings.locale) return;
    saveSettings({ locale: next });
  }

  return (
    <Screen>
      <Card>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t(locale, 'settings')}</Text>
          {saving ? <ActivityIndicator size="small" color="#1d4ed8" /> : null}
        </View>

        <Text style={styles.label}>{t(locale, 'enabled_clefs')}</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.toggle, treble && styles.toggleOn]}
            onPress={() => toggleClef('treble')}
            disabled={saving}
          >
            <Text style={[styles.toggleText, treble && styles.toggleTextOn]}>{clefLabel(locale, 'treble')}</Text>
          </Pressable>
          <Pressable
            style={[styles.toggle, bass && styles.toggleOn]}
            onPress={() => toggleClef('bass')}
            disabled={saving}
          >
            <Text style={[styles.toggleText, bass && styles.toggleTextOn]}>{clefLabel(locale, 'bass')}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>{t(locale, 'default_clef')}</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.toggle, settings.defaultClef === 'treble' && styles.toggleOn]}
            onPress={() => setDefaultClef('treble')}
            disabled={saving}
          >
            <Text style={[styles.toggleText, settings.defaultClef === 'treble' && styles.toggleTextOn]}>
              {clefLabel(locale, 'treble')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggle, settings.defaultClef === 'bass' && styles.toggleOn]}
            onPress={() => setDefaultClef('bass')}
            disabled={saving}
          >
            <Text style={[styles.toggleText, settings.defaultClef === 'bass' && styles.toggleTextOn]}>
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

        <Text style={styles.label}>{t(locale, 'language')}</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.toggle, settings.locale === 'de' && styles.toggleOn]}
            onPress={() => setLocale('de')}
            disabled={saving}
          >
            <Text style={[styles.toggleText, settings.locale === 'de' && styles.toggleTextOn]}>{t(locale, 'lang_de')}</Text>
          </Pressable>
          <Pressable
            style={[styles.toggle, settings.locale === 'en' && styles.toggleOn]}
            onPress={() => setLocale('en')}
            disabled={saving}
          >
            <Text style={[styles.toggleText, settings.locale === 'en' && styles.toggleTextOn]}>{t(locale, 'lang_en')}</Text>
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  label: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  toggle: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  toggleText: { color: '#334155' },
  toggleTextOn: { color: '#1d4ed8', fontWeight: '700' },
});

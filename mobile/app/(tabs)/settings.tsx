import React, { useEffect } from 'react';
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

  const [dailyGoal, setDailyGoal] = React.useState(settings.dailyGoalExercises);
  const [treble, setTreble] = React.useState(settings.enabledClefs.includes('treble'));
  const [bass, setBass] = React.useState(settings.enabledClefs.includes('bass'));
  const [defaultClef, setDefaultClef] = React.useState<Clef>(settings.defaultClef);
  const [selectedLocale, setSelectedLocale] = React.useState<Locale>(settings.locale);
  const [saved, setSaved] = React.useState(false);
  const [dailyGoalError, setDailyGoalError] = React.useState('');

  useEffect(() => {
    setDailyGoal(settings.dailyGoalExercises);
    setTreble(settings.enabledClefs.includes('treble'));
    setBass(settings.enabledClefs.includes('bass'));
    setDefaultClef(settings.defaultClef);
    setSelectedLocale(settings.locale);
    setDailyGoalError('');
  }, [settings]);

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>{t(locale, 'settings')}</Text>

        <Text style={styles.label}>{t(locale, 'enabled_clefs')}</Text>
        <View style={styles.row}>
          <Pressable style={[styles.toggle, treble && styles.toggleOn]} onPress={() => setTreble((v) => !v)}>
            <Text style={[styles.toggleText, treble && styles.toggleTextOn]}>{clefLabel(locale, 'treble')}</Text>
          </Pressable>
          <Pressable style={[styles.toggle, bass && styles.toggleOn]} onPress={() => setBass((v) => !v)}>
            <Text style={[styles.toggleText, bass && styles.toggleTextOn]}>{clefLabel(locale, 'bass')}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>{t(locale, 'default_clef')}</Text>
        <View style={styles.row}>
          <Pressable style={[styles.toggle, defaultClef === 'treble' && styles.toggleOn]} onPress={() => setDefaultClef('treble')}>
            <Text style={[styles.toggleText, defaultClef === 'treble' && styles.toggleTextOn]}>{clefLabel(locale, 'treble')}</Text>
          </Pressable>
          <Pressable style={[styles.toggle, defaultClef === 'bass' && styles.toggleOn]} onPress={() => setDefaultClef('bass')}>
            <Text style={[styles.toggleText, defaultClef === 'bass' && styles.toggleTextOn]}>{clefLabel(locale, 'bass')}</Text>
          </Pressable>
        </View>

        <Stepper
          label={t(locale, 'daily_goal_label')}
          value={dailyGoal}
          min={MIN_DAILY_GOAL}
          max={MAX_DAILY_GOAL}
          onChange={(next) => {
            setDailyGoal(next);
            setDailyGoalError('');
          }}
          disabled={loading.saveSettings}
        />
        {dailyGoalError ? <Text style={styles.error}>{dailyGoalError}</Text> : null}

        <Text style={styles.label}>{t(locale, 'language')}</Text>
        <View style={styles.row}>
          <Pressable style={[styles.toggle, selectedLocale === 'de' && styles.toggleOn]} onPress={() => setSelectedLocale('de')}>
            <Text style={[styles.toggleText, selectedLocale === 'de' && styles.toggleTextOn]}>{t(locale, 'lang_de')}</Text>
          </Pressable>
          <Pressable style={[styles.toggle, selectedLocale === 'en' && styles.toggleOn]} onPress={() => setSelectedLocale('en')}>
            <Text style={[styles.toggleText, selectedLocale === 'en' && styles.toggleTextOn]}>{t(locale, 'lang_en')}</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.save, loading.saveSettings && styles.saveDisabled]}
          onPress={async () => {
            const enabledClefs = [treble ? 'treble' : null, bass ? 'bass' : null].filter(Boolean) as Clef[];
            const finalClefs: Clef[] = enabledClefs.length ? enabledClefs : ['treble'];
            if (!Number.isFinite(dailyGoal) || dailyGoal < MIN_DAILY_GOAL || dailyGoal > MAX_DAILY_GOAL) {
              setDailyGoalError(t(locale, 'invalid_goal_range', { min: MIN_DAILY_GOAL, max: MAX_DAILY_GOAL }));
              return;
            }

            await saveSettings({
              enabledClefs: finalClefs,
              defaultClef: finalClefs.includes(defaultClef) ? defaultClef : finalClefs[0],
              dailyGoalExercises: dailyGoal,
              locale: selectedLocale,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
          disabled={loading.saveSettings}
        >
          {loading.saveSettings ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t(locale, 'save')}</Text>}
        </Pressable>

        {saved ? <Text style={styles.savedText}>{t(selectedLocale, 'saved')}</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  error: { color: '#be123c', fontSize: 13, fontWeight: '600' },
  save: { marginTop: 8, backgroundColor: '#1d4ed8', borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontWeight: '700' },
  savedText: { color: '#047857', fontWeight: '600' },
});

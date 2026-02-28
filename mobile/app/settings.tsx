import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { clefLabel, t } from '../src/core/i18n/translator';
import type { Clef, Locale } from '../src/core/types';
import { Screen } from '../src/ui/components/Screen';
import { Card } from '../src/ui/components/Card';
import { useAppStore } from '../src/state/use-app-store';

export default function SettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const saveSettings = useAppStore((s) => s.saveSettings);

  const locale = settings.locale;

  const [dailyGoal, setDailyGoal] = React.useState(String(settings.dailyGoalExercises));
  const [treble, setTreble] = React.useState(settings.enabledClefs.includes('treble'));
  const [bass, setBass] = React.useState(settings.enabledClefs.includes('bass'));
  const [defaultClef, setDefaultClef] = React.useState<Clef>(settings.defaultClef);
  const [selectedLocale, setSelectedLocale] = React.useState<Locale>(settings.locale);
  const [saved, setSaved] = React.useState(false);

  useEffect(() => {
    setDailyGoal(String(settings.dailyGoalExercises));
    setTreble(settings.enabledClefs.includes('treble'));
    setBass(settings.enabledClefs.includes('bass'));
    setDefaultClef(settings.defaultClef);
    setSelectedLocale(settings.locale);
  }, [settings]);

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>{t(locale, 'settings')}</Text>

        <Text style={styles.label}>{t(locale, 'enabled_clefs')}</Text>
        <View style={styles.row}>
          <Pressable style={[styles.toggle, treble && styles.toggleOn]} onPress={() => setTreble((v) => !v)}><Text>{clefLabel(locale, 'treble')}</Text></Pressable>
          <Pressable style={[styles.toggle, bass && styles.toggleOn]} onPress={() => setBass((v) => !v)}><Text>{clefLabel(locale, 'bass')}</Text></Pressable>
        </View>

        <Text style={styles.label}>{t(locale, 'default_clef')}</Text>
        <View style={styles.row}>
          <Pressable style={[styles.toggle, defaultClef === 'treble' && styles.toggleOn]} onPress={() => setDefaultClef('treble')}><Text>{clefLabel(locale, 'treble')}</Text></Pressable>
          <Pressable style={[styles.toggle, defaultClef === 'bass' && styles.toggleOn]} onPress={() => setDefaultClef('bass')}><Text>{clefLabel(locale, 'bass')}</Text></Pressable>
        </View>

        <Text style={styles.label}>{t(locale, 'daily_goal_label')}</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={dailyGoal} onChangeText={setDailyGoal} />

        <Text style={styles.label}>{t(locale, 'language')}</Text>
        <View style={styles.row}>
          <Pressable style={[styles.toggle, selectedLocale === 'de' && styles.toggleOn]} onPress={() => setSelectedLocale('de')}><Text>{t(locale, 'lang_de')}</Text></Pressable>
          <Pressable style={[styles.toggle, selectedLocale === 'en' && styles.toggleOn]} onPress={() => setSelectedLocale('en')}><Text>{t(locale, 'lang_en')}</Text></Pressable>
        </View>

        <Pressable
          style={styles.save}
          onPress={() => {
            const enabledClefs = [treble ? 'treble' : null, bass ? 'bass' : null].filter(Boolean) as Clef[];
            const finalClefs: Clef[] = enabledClefs.length ? enabledClefs : ['treble'];
            void saveSettings({
              enabledClefs: finalClefs,
              defaultClef: finalClefs.includes(defaultClef) ? defaultClef : finalClefs[0],
              dailyGoalExercises: Number(dailyGoal) || settings.dailyGoalExercises,
              locale: selectedLocale,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
        >
          <Text style={styles.saveText}>{t(locale, 'save')}</Text>
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
  toggle: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff' },
  toggleOn: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  save: { marginTop: 8, backgroundColor: '#1d4ed8', borderRadius: 8, alignItems: 'center', paddingVertical: 10 },
  saveText: { color: '#fff', fontWeight: '700' },
  savedText: { color: '#047857', fontWeight: '600' },
});

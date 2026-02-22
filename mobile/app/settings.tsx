import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../src/ui/components/Screen';
import { Card } from '../src/ui/components/Card';
import { useAppStore } from '../src/state/use-app-store';

export default function SettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const saveSettings = useAppStore((s) => s.saveSettings);

  const [dailyGoal, setDailyGoal] = React.useState(String(settings.dailyGoalExercises));
  const [treble, setTreble] = React.useState(settings.enabledClefs.includes('treble'));
  const [bass, setBass] = React.useState(settings.enabledClefs.includes('bass'));
  const [defaultClef, setDefaultClef] = React.useState<'treble' | 'bass'>(settings.defaultClef);

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Einstellungen</Text>
        <Text style={styles.label}>Enabled Clefs</Text>
        <View style={styles.row}>
          <Pressable style={[styles.toggle, treble && styles.toggleOn]} onPress={() => setTreble((v) => !v)}><Text>Treble</Text></Pressable>
          <Pressable style={[styles.toggle, bass && styles.toggleOn]} onPress={() => setBass((v) => !v)}><Text>Bass</Text></Pressable>
        </View>

        <Text style={styles.label}>Default Clef</Text>
        <View style={styles.row}>
          <Pressable style={[styles.toggle, defaultClef === 'treble' && styles.toggleOn]} onPress={() => setDefaultClef('treble')}><Text>Treble</Text></Pressable>
          <Pressable style={[styles.toggle, defaultClef === 'bass' && styles.toggleOn]} onPress={() => setDefaultClef('bass')}><Text>Bass</Text></Pressable>
        </View>

        <Text style={styles.label}>Daily Goal</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={dailyGoal} onChangeText={setDailyGoal} />

        <Pressable
          style={styles.save}
          onPress={() => {
            const enabledClefs = [treble ? 'treble' : null, bass ? 'bass' : null].filter(Boolean) as Array<'treble' | 'bass'>;
            const finalClefs = enabledClefs.length ? enabledClefs : ['treble'];
            void saveSettings({
              enabledClefs: finalClefs,
              defaultClef: finalClefs.includes(defaultClef) ? defaultClef : finalClefs[0],
              dailyGoalExercises: Number(dailyGoal) || settings.dailyGoalExercises,
            });
          }}
        >
          <Text style={styles.saveText}>Speichern</Text>
        </Pressable>
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
});

import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { INTERVAL_LABELS, SKILL_DEFINITIONS } from '../src/core/config/curriculum';
import type { SkillKey } from '../src/core/types';
import { useAppStore } from '../src/state/use-app-store';
import { Card } from '../src/ui/components/Card';
import { Screen } from '../src/ui/components/Screen';
import { StaffSvg } from '../src/ui/components/StaffSvg';

const visualSkills = SKILL_DEFINITIONS.filter((s) => s.family === 'visual');

function promptToNotes(exercise: any): string[] {
  if (!exercise) return [];
  if (exercise.skillKey === 'note_naming') return [exercise.prompt.note as string];
  if (exercise.skillKey === 'interval_visual') return [exercise.prompt.first as string, exercise.prompt.second as string];
  return [];
}

export default function PracticeScreen() {
  const selectedSkill = useAppStore((s) => s.selectedSkill);
  const selectedClef = useAppStore((s) => s.selectedClef);
  const selectedLevel = useAppStore((s) => s.selectedLevel);
  const selectedCount = useAppStore((s) => s.selectedCount);
  const setSelectedSkill = useAppStore((s) => s.setSelectedSkill);
  const setSelectedClef = useAppStore((s) => s.setSelectedClef);
  const setSelectedLevel = useAppStore((s) => s.setSelectedLevel);
  const setSelectedCount = useAppStore((s) => s.setSelectedCount);
  const startCustom = useAppStore((s) => s.startCustom);

  const currentExercise = useAppStore((s) => s.currentExercise);
  const sessionMeta = useAppStore((s) => s.sessionMeta);
  const feedback = useAppStore((s) => s.feedback);
  const submitChoice = useAppStore((s) => s.submitChoice);
  const nextExercise = useAppStore((s) => s.nextExercise);
  const endSession = useAppStore((s) => s.endSession);
  const summary = useAppStore((s) => s.summary);

  if (summary) {
    router.replace('/summary');
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.sectionTitle}>Custom Session</Text>

        <Text style={styles.label}>Skill</Text>
        <View style={styles.chipsRow}>
          {visualSkills.map((skill) => (
            <Pressable
              key={skill.key}
              style={[styles.chip, selectedSkill === skill.key && styles.chipActive]}
              onPress={() => setSelectedSkill(skill.key as SkillKey)}
            >
              <Text style={[styles.chipText, selectedSkill === skill.key && styles.chipTextActive]}>{skill.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Clef</Text>
        <View style={styles.chipsRow}>
          {['treble', 'bass'].map((clef) => (
            <Pressable key={clef} style={[styles.chip, selectedClef === clef && styles.chipActive]} onPress={() => setSelectedClef(clef as any)}>
              <Text style={[styles.chipText, selectedClef === clef && styles.chipTextActive]}>{clef}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Level</Text>
            <TextInput keyboardType="numeric" value={String(selectedLevel)} onChangeText={(v) => setSelectedLevel(Number(v) || 1)} style={styles.input} />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Count</Text>
            <TextInput keyboardType="numeric" value={String(selectedCount)} onChangeText={(v) => setSelectedCount(Number(v) || 1)} style={styles.input} />
          </View>
        </View>

        <Pressable style={styles.primaryButton} onPress={() => startCustom()}>
          <Text style={styles.primaryButtonText}>Start Custom</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>
          Session: {sessionMeta.total ? `${sessionMeta.mode} ${sessionMeta.index + 1}/${sessionMeta.total}` : 'Keine aktive Session'}
        </Text>

        {currentExercise ? (
          <>
            <Text style={styles.prompt}>{buildPrompt(currentExercise)}</Text>

            {currentExercise.skillKey !== 'rhythm_id' ? (
              <StaffSvg clef={currentExercise.clef} notes={promptToNotes(currentExercise)} />
            ) : (
              <Text style={styles.rhythm}>{String((currentExercise.prompt as any).display)}</Text>
            )}

            <View style={styles.choicesRow}>
              {currentExercise.choices.map((choice) => (
                <Pressable key={choice} style={styles.choice} onPress={() => void submitChoice(choice)}>
                  <Text style={styles.choiceText}>{labelForChoice(currentExercise.skillKey, choice, currentExercise.metadata)}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.feedback, feedback.isCorrect ? styles.feedbackOk : styles.feedbackBad]}>{feedback.text}</Text>
            <View style={styles.row}>
              <Pressable style={styles.secondaryButton} onPress={() => void nextExercise()}><Text style={styles.secondaryButtonText}>Nächste Übung</Text></Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => void endSession()}><Text style={styles.secondaryButtonText}>Session beenden</Text></Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.muted}>Starte eine Session oben.</Text>
        )}
      </Card>
    </Screen>
  );
}

function buildPrompt(exercise: any): string {
  if (exercise.skillKey === 'note_naming') return `Welche Note ist das? (${exercise.clef})`;
  if (exercise.skillKey === 'interval_visual') return `Welches Intervall siehst du? (${exercise.clef})`;
  if (exercise.skillKey === 'rhythm_id') return 'Welches Rhythmusmuster ist dargestellt?';
  return 'Übung';
}

function labelForChoice(skillKey: string, choice: string, metadata: any): string {
  if (skillKey === 'interval_visual') {
    const n = Number(choice);
    return `${choice} - ${INTERVAL_LABELS[n] ?? choice}`;
  }
  if (skillKey === 'rhythm_id') {
    return metadata?.choiceLabels?.[choice] ?? choice;
  }
  return choice;
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  label: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  chipText: { color: '#334155' },
  chipTextActive: { color: '#1d4ed8', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, gap: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  primaryButton: { backgroundColor: '#059669', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  prompt: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  rhythm: { fontSize: 28, textAlign: 'center', color: '#334155', marginVertical: 10 },
  choicesRow: { gap: 8 },
  choice: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, backgroundColor: '#f8fafc' },
  choiceText: { color: '#1e293b', fontWeight: '600' },
  feedback: { fontWeight: '700' },
  feedbackOk: { color: '#047857' },
  feedbackBad: { color: '#be123c' },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, alignItems: 'center', paddingVertical: 10, backgroundColor: '#fff' },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
  muted: { color: '#64748b' },
});

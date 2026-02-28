import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { INTERVAL_LABELS, SKILL_DEFINITIONS } from '../src/core/config/curriculum';
import { clefLabel, modeLabel, skillLabel, t, type TranslationKey } from '../src/core/i18n/translator';
import type { Exercise, ExerciseFamily, SkillKey } from '../src/core/types';
import { useAppStore } from '../src/state/use-app-store';
import { Card } from '../src/ui/components/Card';
import { Screen } from '../src/ui/components/Screen';
import { StaffSvg } from '../src/ui/components/StaffSvg';

const CUSTOM_FAMILIES: ExerciseFamily[] = ['visual', 'aural'];

function promptToNotes(exercise: Exercise | null): string[] {
  if (!exercise) return [];
  if (exercise.skillKey === 'note_naming') return [String(exercise.prompt.note)];
  if (exercise.skillKey === 'interval_visual') return [String(exercise.prompt.first), String(exercise.prompt.second)];
  return [];
}

export default function PracticeScreen() {
  const settings = useAppStore((s) => s.settings);
  const selectedFamily = useAppStore((s) => s.selectedFamily);
  const selectedSkill = useAppStore((s) => s.selectedSkill);
  const selectedClef = useAppStore((s) => s.selectedClef);
  const selectedLevel = useAppStore((s) => s.selectedLevel);
  const selectedCount = useAppStore((s) => s.selectedCount);
  const setSelectedFamily = useAppStore((s) => s.setSelectedFamily);
  const setSelectedSkill = useAppStore((s) => s.setSelectedSkill);
  const setSelectedClef = useAppStore((s) => s.setSelectedClef);
  const setSelectedLevel = useAppStore((s) => s.setSelectedLevel);
  const setSelectedCount = useAppStore((s) => s.setSelectedCount);
  const startCustom = useAppStore((s) => s.startCustom);

  const currentExercise = useAppStore((s) => s.currentExercise);
  const sessionMeta = useAppStore((s) => s.sessionMeta);
  const feedback = useAppStore((s) => s.feedback);
  const answerState = useAppStore((s) => s.answerState);
  const submitChoice = useAppStore((s) => s.submitChoice);
  const playPrompt = useAppStore((s) => s.playPrompt);
  const nextExercise = useAppStore((s) => s.nextExercise);
  const endSession = useAppStore((s) => s.endSession);
  const summary = useAppStore((s) => s.summary);

  const locale = settings.locale;
  const familySkills = SKILL_DEFINITIONS.filter((s) => s.family === selectedFamily);

  useEffect(() => {
    if (summary) {
      router.replace('/summary');
    }
  }, [summary]);

  const progressPercent = sessionMeta.total > 0 ? Math.round((sessionMeta.index / sessionMeta.total) * 100) : 0;
  const canGoNext = Boolean(feedback.text);
  const subPrompt = currentExercise ? buildSubPrompt(currentExercise, locale) : '';

  return (
    <Screen>
      <Card>
        <Text style={styles.sectionTitle}>{t(locale, 'custom_session')}</Text>

        <Text style={styles.label}>{t(locale, 'family')}</Text>
        <View style={styles.chipsRow}>
          {CUSTOM_FAMILIES.map((family) => (
            <Pressable
              key={family}
              style={[styles.chip, selectedFamily === family && styles.chipActive]}
              onPress={() => setSelectedFamily(family)}
            >
              <Text style={[styles.chipText, selectedFamily === family && styles.chipTextActive]}>
                {t(locale, `family_${family}` as TranslationKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t(locale, 'skill')}</Text>
        <View style={styles.chipsRow}>
          {familySkills.map((skill) => (
            <Pressable
              key={skill.key}
              style={[styles.chip, selectedSkill === skill.key && styles.chipActive]}
              onPress={() => setSelectedSkill(skill.key as SkillKey)}
            >
              <Text style={[styles.chipText, selectedSkill === skill.key && styles.chipTextActive]}>{skillLabel(locale, skill.key)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t(locale, 'clef')}</Text>
        <View style={styles.chipsRow}>
          {settings.enabledClefs.map((clef) => (
            <Pressable key={clef} style={[styles.chip, selectedClef === clef && styles.chipActive]} onPress={() => setSelectedClef(clef)}>
              <Text style={[styles.chipText, selectedClef === clef && styles.chipTextActive]}>{clefLabel(locale, clef)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>{t(locale, 'level')}</Text>
            <TextInput keyboardType="numeric" value={String(selectedLevel)} onChangeText={(v) => setSelectedLevel(Number(v) || 1)} style={styles.input} />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>{t(locale, 'count')}</Text>
            <TextInput keyboardType="numeric" value={String(selectedCount)} onChangeText={(v) => setSelectedCount(Number(v) || 1)} style={styles.input} />
          </View>
        </View>

        <Pressable style={styles.primaryButton} onPress={() => startCustom()}>
          <Text style={styles.primaryButtonText}>{t(locale, 'start_custom')}</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>
          {t(locale, 'session_label')}: {sessionMeta.total
            ? `${modeLabel(locale, sessionMeta.mode)} • ${t(locale, 'exercise_label')} ${sessionMeta.index + 1}/${sessionMeta.total}`
            : t(locale, 'no_active_session')}
        </Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        {currentExercise ? (
          <>
            <Text style={styles.prompt}>{buildPrompt(currentExercise, locale)}</Text>
            {subPrompt ? <Text style={styles.subPrompt}>{subPrompt}</Text> : null}

            {currentExercise.skillKey !== 'rhythm_id' ? (
              <StaffSvg clef={currentExercise.clef} notes={promptToNotes(currentExercise)} />
            ) : (
              <Text style={styles.rhythm}>{String(currentExercise.prompt.display)}</Text>
            )}

            {currentExercise.skillKey === 'interval_aural' ? (
              <Pressable style={styles.promptButton} onPress={() => void playPrompt()}>
                <Text style={styles.promptButtonText}>{t(locale, 'play_prompt')}</Text>
              </Pressable>
            ) : null}

            <View style={styles.choicesRow}>
              {currentExercise.choices.map((choice) => {
                const key = String(choice);
                const selected = answerState.selectedChoice === key;
                const isCorrectChoice = answerState.expectedChoice === key;
                const isWrongSelected = selected && answerState.expectedChoice !== key;

                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.choice,
                      selected && styles.choiceSelected,
                      isCorrectChoice && styles.choiceCorrect,
                      isWrongSelected && styles.choiceWrong,
                    ]}
                    onPress={() => void submitChoice(key)}
                    disabled={Boolean(answerState.selectedChoice)}
                  >
                    <Text style={styles.choiceText}>{labelForChoice(currentExercise.skillKey, key, currentExercise.metadata)}</Text>
                  </Pressable>
                );
              })}
            </View>

            {feedback.text ? (
              <Text style={[styles.feedback, feedback.isCorrect ? styles.feedbackOk : styles.feedbackBad]}>{feedback.text}</Text>
            ) : null}

            <View style={styles.row}>
              <Pressable
                style={[styles.secondaryButton, !canGoNext && styles.disabledButton]}
                onPress={() => void nextExercise()}
                disabled={!canGoNext}
              >
                <Text style={styles.secondaryButtonText}>{t(locale, 'next_exercise')}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => void endSession()}>
                <Text style={styles.secondaryButtonText}>{t(locale, 'end_session')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.muted}>{t(locale, 'start_session_above')}</Text>
        )}
      </Card>
    </Screen>
  );
}

function buildPrompt(exercise: Exercise, locale: 'de' | 'en'): string {
  if (exercise.skillKey === 'note_naming') return t(locale, 'which_note', { clef: clefLabel(locale, exercise.clef) });
  if (exercise.skillKey === 'interval_visual') return t(locale, 'which_interval', { clef: clefLabel(locale, exercise.clef) });
  if (exercise.skillKey === 'rhythm_id') return t(locale, 'which_rhythm');
  if (exercise.skillKey === 'interval_aural') return t(locale, 'identify_heard_interval');
  return t(locale, 'exercise_unknown');
}

function buildSubPrompt(exercise: Exercise, locale: 'de' | 'en'): string {
  if (exercise.skillKey === 'interval_visual') return t(locale, 'interval_visual_hint');
  if (exercise.skillKey === 'interval_aural') return t(locale, 'interval_aural_hint');
  return '';
}

function labelForChoice(skillKey: string, choice: string, metadata: Record<string, unknown>): string {
  if (skillKey === 'interval_visual' || skillKey === 'interval_aural') {
    const n = Number(choice);
    return `${choice} - ${INTERVAL_LABELS[n] ?? choice}`;
  }
  if (skillKey === 'rhythm_id') {
    return String((metadata.choiceLabels as Record<string, string> | undefined)?.[choice] ?? choice);
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
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#10b981' },
  prompt: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  subPrompt: { fontSize: 13, color: '#475569' },
  rhythm: { fontSize: 28, textAlign: 'center', color: '#334155', marginVertical: 10 },
  promptButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  promptButtonText: { color: '#334155', fontWeight: '600' },
  choicesRow: { gap: 8 },
  choice: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, backgroundColor: '#f8fafc' },
  choiceSelected: { borderColor: '#60a5fa' },
  choiceCorrect: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  choiceWrong: { borderColor: '#f43f5e', backgroundColor: '#fff1f2' },
  choiceText: { color: '#1e293b', fontWeight: '600' },
  feedback: { fontWeight: '700' },
  feedbackOk: { color: '#047857' },
  feedbackBad: { color: '#be123c' },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, alignItems: 'center', paddingVertical: 10, backgroundColor: '#fff' },
  disabledButton: { opacity: 0.45 },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
  muted: { color: '#64748b' },
});

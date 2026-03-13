import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { INTERVAL_LABELS, SKILL_DEFINITIONS } from '../../src/core/config/curriculum';
import { clefLabel, localeTag, modeLabel, skillLabel, t, type TranslationKey } from '../../src/core/i18n/translator';
import type { Exercise, ExerciseFamily, SkillKey } from '../../src/core/types';
import { useAppStore } from '../../src/state/use-app-store';
import { Card } from '../../src/ui/components/Card';
import { HearingPromptSvg } from '../../src/ui/components/HearingPromptSvg';
import { Screen } from '../../src/ui/components/Screen';
import { StaffSvg } from '../../src/ui/components/StaffSvg';
import { Stepper } from '../../src/ui/components/Stepper';

const CUSTOM_FAMILIES: ExerciseFamily[] = ['visual', 'aural', 'singing'];

function logEndSessionDebug(stage: string, details: Record<string, unknown> = {}) {
  console.log(`[practice:end-session] ${stage}`, details);
}

function promptToNotes(exercise: Exercise | null): string[] {
  if (!exercise) return [];
  if (exercise.skillKey === 'note_naming') return [String(exercise.prompt.note)];
  if (exercise.skillKey === 'interval_visual') return [String(exercise.prompt.first), String(exercise.prompt.second)];
  if (exercise.skillKey === 'sing_note') return [String(exercise.prompt.target)];
  if (exercise.skillKey === 'sing_interval') return [String(exercise.prompt.reference), String(exercise.prompt.target)];
  if (exercise.skillKey === 'sing_melody') return Array.isArray(exercise.prompt.notes) ? (exercise.prompt.notes as string[]).map(String) : [];
  return [];
}

export default function PracticeScreen() {
  const [showEndSessionConfirm, setShowEndSessionConfirm] = React.useState(false);
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
  const loading = useAppStore((s) => s.loading);
  const startCustom = useAppStore((s) => s.startCustom);

  const currentExercise = useAppStore((s) => s.currentExercise);
  const sessionMeta = useAppStore((s) => s.sessionMeta);
  const feedback = useAppStore((s) => s.feedback);
  const answerState = useAppStore((s) => s.answerState);
  const summary = useAppStore((s) => s.summary);
  const submitChoice = useAppStore((s) => s.submitChoice);
  const playPrompt = useAppStore((s) => s.playPrompt);
  const captureSingingAttempt = useAppStore((s) => s.captureSingingAttempt);
  const singingNoteIndex = useAppStore((s) => s.singingNoteIndex);
  const pitchDebug = useAppStore((s) => s.pitchDebug);
  const nextExercise = useAppStore((s) => s.nextExercise);
  const endSession = useAppStore((s) => s.endSession);
  const locale = settings.locale;
  const familySkills = SKILL_DEFINITIONS.filter((s) => s.family === selectedFamily);

  React.useEffect(() => {
    if (summary) {
      logEndSessionDebug('summary_detected_navigating', {
        mode: summary.mode,
        total: summary.total,
        correct: summary.correct,
      });
      router.push('/summary');
    }
  }, [summary]);

  async function goToNextExercise() {
    await nextExercise();
  }

  async function confirmEndSession() {
    logEndSessionDebug('confirm_end_session_started', {
      sessionMode: sessionMeta.mode,
      sessionIndex: sessionMeta.index,
      sessionTotal: sessionMeta.total,
    });
    try {
      await endSession();
      logEndSessionDebug('confirm_end_session_finished', {
        hasSummary: Boolean(useAppStore.getState().summary),
      });
    } catch (error) {
      console.error('[practice:end-session] confirm_end_session_failed', error);
      throw error;
    }
  }

  const progressPercent = sessionMeta.total > 0 ? Math.round((sessionMeta.index / sessionMeta.total) * 100) : 0;
  const canGoNext = Boolean(feedback.text);
  const subPrompt = currentExercise ? buildSubPrompt(currentExercise, locale) : '';
  const sessionActive = sessionMeta.total > 0;

  React.useEffect(() => {
    if (!sessionActive && showEndSessionConfirm) {
      setShowEndSessionConfirm(false);
    }
  }, [sessionActive, showEndSessionConfirm]);

  return (
    <Screen>
      {!sessionActive ? (
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
              <Stepper label={t(locale, 'level')} value={selectedLevel} min={1} max={5} onChange={setSelectedLevel} disabled={loading.startCustom} />
            </View>
            <View style={styles.half}>
              <Stepper label={t(locale, 'count')} value={selectedCount} min={1} max={50} onChange={setSelectedCount} disabled={loading.startCustom} />
            </View>
          </View>

          <Pressable style={[styles.primaryButton, loading.startCustom && styles.disabledButton]} onPress={() => void startCustom()} disabled={loading.startCustom}>
            {loading.startCustom ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t(locale, 'start_custom')}</Text>}
          </Pressable>
        </Card>
      ) : null}

      {sessionActive ? (
        <Card>
          <Text style={styles.sectionTitle}>
            {t(locale, 'session_label')}: {`${modeLabel(locale, sessionMeta.mode)} • ${t(locale, 'exercise_label')} ${sessionMeta.index + 1}/${sessionMeta.total}`}
          </Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>

          {currentExercise ? (
            <>
              <Text style={styles.prompt}>{buildPrompt(currentExercise, locale)}</Text>
              {subPrompt ? <Text style={styles.subPrompt}>{subPrompt}</Text> : null}

              {currentExercise.skillKey === 'sing_interval' && currentExercise.metadata.intervalLabel ? (
                <Text style={styles.intervalName}>{String(currentExercise.metadata.intervalLabel)}</Text>
              ) : null}

              {currentExercise.skillKey === 'interval_aural' ? (
                <HearingPromptSvg />
              ) : currentExercise.skillKey !== 'rhythm_id' ? (
                <StaffSvg
                  clef={currentExercise.clef}
                  notes={promptToNotes(currentExercise)}
                  highlightIndex={loading.captureSingingAttempt ? singingNoteIndex : null}
                />
              ) : (
                <Text style={styles.rhythm}>{String(currentExercise.prompt.display)}</Text>
              )}

              {(currentExercise.skillKey === 'interval_aural'
                || currentExercise.skillKey === 'sing_note'
                || currentExercise.skillKey === 'sing_interval'
                || currentExercise.skillKey === 'sing_melody') ? (
                <Pressable style={[styles.promptButton, loading.playPrompt && styles.disabledButton]} onPress={() => void playPrompt()} disabled={loading.playPrompt}>
                  {loading.playPrompt ? <ActivityIndicator color="#334155" /> : <Text style={styles.promptButtonText}>{t(locale, 'play_prompt')}</Text>}
                </Pressable>
              ) : null}

              {currentExercise.family === 'singing' ? (
                <Pressable
                  style={[styles.captureButton, loading.captureSingingAttempt && styles.disabledButton]}
                  onPress={() => void captureSingingAttempt()}
                  disabled={loading.captureSingingAttempt}
                >
                  {loading.captureSingingAttempt ? <ActivityIndicator color="#fff" /> : <Text style={styles.captureButtonText}>{t(locale, 'record_and_evaluate')}</Text>}
                </Pressable>
              ) : null}

              {currentExercise.family === 'singing' ? (
                <View style={styles.debugPanel}>
                  <Text style={styles.debugTitle}>{t(locale, 'mic_debug_title')}</Text>
                  <Text style={styles.debugLine}>{t(locale, 'mic_debug_phase')}: {pitchDebug.phase}</Text>
                  <Text style={styles.debugLine}>{t(locale, 'mic_debug_duration_ms')}: {formatDebugInteger(locale, pitchDebug.durationMillis)}</Text>
                  <Text style={styles.debugLine}>{t(locale, 'mic_debug_metering_db')}: {formatDebugDecimal(locale, pitchDebug.metering)}</Text>
                  <Text style={styles.debugLine}>{t(locale, 'mic_debug_frequency_hz')}: {formatDebugDecimal(locale, pitchDebug.frequency)}</Text>
                  <Text style={styles.debugLine}>{t(locale, 'mic_debug_timeline_points')}: {formatDebugInteger(locale, pitchDebug.timelinePoints)}</Text>
                  <Text style={styles.debugLine}>{t(locale, 'mic_debug_updated')}: {formatDebugTimestamp(locale, pitchDebug.timestampMs)}</Text>
                </View>
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
                      disabled={Boolean(answerState.selectedChoice) || loading.submitChoice || loading.captureSingingAttempt}
                    >
                      <Text style={styles.choiceText}>{labelForChoice(currentExercise.skillKey, key, currentExercise.metadata)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {feedback.text ? (
                <Text style={[styles.feedback, feedback.isCorrect ? styles.feedbackOk : styles.feedbackBad]}>{feedback.text}</Text>
              ) : null}

              <Pressable
                style={[styles.secondaryButton, (!canGoNext || loading.nextExercise) && styles.disabledButton]}
                onPress={() => void goToNextExercise()}
                disabled={!canGoNext || loading.nextExercise}
              >
                {loading.nextExercise ? <ActivityIndicator color="#334155" /> : <Text style={styles.secondaryButtonText}>{t(locale, 'next_exercise')}</Text>}
              </Pressable>

              <Pressable
                style={styles.endLinkButton}
                onPress={() => {
                  logEndSessionDebug('end_session_button_pressed', {
                    loading: loading.endSession,
                    sessionActive,
                    hasCurrentExercise: Boolean(currentExercise),
                    sessionIndex: sessionMeta.index,
                    sessionTotal: sessionMeta.total,
                  });
                  logEndSessionDebug('end_session_confirm_opened');
                  setShowEndSessionConfirm(true);
                }}
                disabled={loading.endSession}
              >
                {loading.endSession ? <ActivityIndicator color="#be123c" /> : <Text style={styles.endLinkText}>{t(locale, 'end_session')}</Text>}
              </Pressable>

              {showEndSessionConfirm ? (
                <View style={styles.confirmPanel}>
                  <Text style={styles.confirmTitle}>{t(locale, 'confirm_end_title')}</Text>
                  <Text style={styles.confirmBody}>{t(locale, 'confirm_end_body')}</Text>
                  <View style={styles.confirmActions}>
                    <Pressable
                      style={[styles.confirmButton, styles.confirmCancelButton]}
                      onPress={() => {
                        logEndSessionDebug('end_session_cancelled');
                        setShowEndSessionConfirm(false);
                      }}
                    >
                      <Text style={styles.confirmCancelText}>{t(locale, 'cancel')}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.confirmButton, styles.confirmDangerButton, loading.endSession && styles.disabledButton]}
                      onPress={() => {
                        logEndSessionDebug('end_session_alert_confirmed');
                        setShowEndSessionConfirm(false);
                        void confirmEndSession();
                      }}
                      disabled={loading.endSession}
                    >
                      {loading.endSession ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.confirmDangerText}>{t(locale, 'end_now')}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.muted}>{t(locale, 'start_session_above')}</Text>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

function buildPrompt(exercise: Exercise, locale: 'de' | 'en'): string {
  if (exercise.skillKey === 'note_naming') return t(locale, 'which_note', { clef: clefLabel(locale, exercise.clef) });
  if (exercise.skillKey === 'interval_visual') return t(locale, 'which_interval', { clef: clefLabel(locale, exercise.clef) });
  if (exercise.skillKey === 'rhythm_id') return t(locale, 'which_rhythm');
  if (exercise.skillKey === 'interval_aural') return t(locale, 'identify_heard_interval');
  if (exercise.skillKey === 'sing_note') return t(locale, 'sing_note_prompt', { clef: clefLabel(locale, exercise.clef) });
  if (exercise.skillKey === 'sing_interval') return t(locale, 'sing_interval_prompt', { clef: clefLabel(locale, exercise.clef) });
  if (exercise.skillKey === 'sing_melody') return t(locale, 'sing_melody_prompt', { clef: clefLabel(locale, exercise.clef) });
  return t(locale, 'exercise_unknown');
}

function buildSubPrompt(exercise: Exercise, locale: 'de' | 'en'): string {
  if (exercise.skillKey === 'interval_visual') return t(locale, 'interval_visual_hint');
  if (exercise.skillKey === 'interval_aural') return t(locale, 'interval_aural_hint');
  if (exercise.skillKey === 'sing_note') return t(locale, 'sing_note_hint');
  if (exercise.skillKey === 'sing_interval') return t(locale, 'sing_interval_hint');
  if (exercise.skillKey === 'sing_melody') return t(locale, 'sing_melody_hint');
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

function formatDebugInteger(locale: 'de' | 'en', value: number | null): string {
  if (value == null || !Number.isFinite(value)) return t(locale, 'mic_debug_na');
  return String(Math.round(value));
}

function formatDebugDecimal(locale: 'de' | 'en', value: number | null): string {
  if (value == null || !Number.isFinite(value)) return t(locale, 'mic_debug_na');
  return value.toFixed(1);
}

function formatDebugTimestamp(locale: 'de' | 'en', timestampMs: number | null): string {
  if (timestampMs == null || !Number.isFinite(timestampMs)) return t(locale, 'mic_debug_na');
  return new Date(timestampMs).toLocaleTimeString(localeTag(locale), {
    hour12: false,
  });
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  label: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  chipText: { color: '#334155' },
  chipTextActive: { color: '#1d4ed8', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, gap: 6 },
  primaryButton: { backgroundColor: '#059669', minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#10b981' },
  prompt: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  subPrompt: { fontSize: 13, color: '#475569' },
  intervalName: { fontSize: 18, fontWeight: '700', color: '#2563eb', textAlign: 'center', marginVertical: 4 },
  rhythm: { fontSize: 28, textAlign: 'center', color: '#334155', marginVertical: 10 },
  promptButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: '#fff' },
  promptButtonText: { color: '#334155', fontWeight: '600' },
  captureButton: { alignSelf: 'flex-start', borderRadius: 8, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: '#f59e0b' },
  captureButtonText: { color: '#fff', fontWeight: '700' },
  debugPanel: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, backgroundColor: '#f8fafc', padding: 10, gap: 3 },
  debugTitle: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  debugLine: { color: '#334155', fontSize: 12 },
  choicesRow: { gap: 8 },
  choice: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: '#f8fafc' },
  choiceSelected: { borderColor: '#60a5fa' },
  choiceCorrect: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  choiceWrong: { borderColor: '#f43f5e', backgroundColor: '#fff1f2' },
  choiceText: { color: '#1e293b', fontWeight: '600' },
  feedback: { fontWeight: '700' },
  feedbackOk: { color: '#047857' },
  feedbackBad: { color: '#be123c' },
  confirmPanel: { marginTop: 8, borderWidth: 1, borderColor: '#fecdd3', backgroundColor: '#fff1f2', borderRadius: 10, padding: 12, gap: 10 },
  confirmTitle: { color: '#881337', fontWeight: '700', fontSize: 15 },
  confirmBody: { color: '#9f1239', fontSize: 13 },
  confirmActions: { flexDirection: 'row', gap: 8 },
  confirmButton: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  confirmCancelButton: { borderWidth: 1, borderColor: '#fda4af', backgroundColor: '#fff' },
  confirmDangerButton: { backgroundColor: '#be123c' },
  confirmCancelText: { color: '#9f1239', fontWeight: '600' },
  confirmDangerText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 44, backgroundColor: '#fff' },
  endLinkButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  endLinkText: { color: '#be123c', fontWeight: '600' },
  disabledButton: { opacity: 0.45 },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
  muted: { color: '#64748b' },
});

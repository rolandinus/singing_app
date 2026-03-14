import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { INTERVAL_LABELS, SKILL_DEFINITIONS } from '../../src/core/config/curriculum';
import { clefLabel, localeTag, modeLabel, skillLabel, t, type TranslationKey } from '../../src/core/i18n/translator';
import type { Exercise, ExerciseFamily, MelodyFirstNoteMode, SkillKey } from '../../src/core/types';
import { buildLiveSingingFeedback } from '../../src/core/utils/live-singing-feedback';
import { useAppStore } from '../../src/state/use-app-store';
import { Card } from '../../src/ui/components/Card';
import { HearingPromptSvg } from '../../src/ui/components/HearingPromptSvg';
import { MelodyTrainerPanel } from '../../src/ui/components/MelodyTrainerPanel';
import { Screen } from '../../src/ui/components/Screen';
import { StaffSvg } from '../../src/ui/components/StaffSvg';
import { Stepper } from '../../src/ui/components/Stepper';
import { useThemeColors } from '../../src/ui/hooks/use-theme-colors';

const CUSTOM_FAMILIES: ExerciseFamily[] = ['visual', 'aural', 'singing'];

const SKILL_LEVEL_DETAIL_PREFIX: Record<SkillKey, string> = {
  note_naming: 'level_detail_note_naming',
  interval_visual: 'level_detail_interval_id',
  interval_aural: 'level_detail_interval_id',
  rhythm_id: 'level_detail_rhythm',
  sing_note: 'level_detail_sing_note',
  sing_interval: 'level_detail_sing_interval',
  sing_melody: 'level_detail_sing_melody',
};

function logEndSessionDebug(stage: string, details: Record<string, unknown> = {}) {
  console.log(`[practice:end-session] ${stage}`, details);
}

function promptToNotes(exercise: Exercise | null): string[] {
  if (!exercise) return [];
  if (exercise.skillKey === 'note_naming') return [String(exercise.prompt.note)];
  if (exercise.skillKey === 'interval_visual') return [String(exercise.prompt.first), String(exercise.prompt.second)];
  if (exercise.skillKey === 'sing_note') return [String(exercise.prompt.target)];
  if (exercise.skillKey === 'sing_interval') return [String(exercise.prompt.reference), String(exercise.prompt.target)];
  if (exercise.skillKey === 'sing_melody') {
    if (!Array.isArray(exercise.prompt.notes)) return [];
    return (exercise.prompt.notes as Array<unknown>).map((n) => {
      if (n && typeof n === 'object' && 'pitch' in n) return String((n as Record<string, unknown>).pitch);
      return String(n);
    });
  }
  return [];
}

export default function PracticeScreen() {
  const colors = useThemeColors();
  const [showEndSessionConfirm, setShowEndSessionConfirm] = React.useState(false);
  const settings = useAppStore((s) => s.settings);
  const selectedFamily = useAppStore((s) => s.selectedFamily);
  const selectedSkill = useAppStore((s) => s.selectedSkill);
  const selectedClef = useAppStore((s) => s.selectedClef);
  const selectedLevel = useAppStore((s) => s.selectedLevel);
  const selectedCount = useAppStore((s) => s.selectedCount);
  const selectedMelodyOptions = useAppStore((s) => s.selectedMelodyOptions);
  const setSelectedFamily = useAppStore((s) => s.setSelectedFamily);
  const setSelectedSkill = useAppStore((s) => s.setSelectedSkill);
  const setSelectedClef = useAppStore((s) => s.setSelectedClef);
  const setSelectedLevel = useAppStore((s) => s.setSelectedLevel);
  const setSelectedCount = useAppStore((s) => s.setSelectedCount);
  const setSelectedMelodyOptions = useAppStore((s) => s.setSelectedMelodyOptions);
  const loading = useAppStore((s) => s.loading);
  const startCustom = useAppStore((s) => s.startCustom);

  const currentExercise = useAppStore((s) => s.currentExercise);
  const sessionMeta = useAppStore((s) => s.sessionMeta);
  const feedback = useAppStore((s) => s.feedback);
  const answerState = useAppStore((s) => s.answerState);
  const summary = useAppStore((s) => s.summary);
  const submitChoice = useAppStore((s) => s.submitChoice);
  const playPrompt = useAppStore((s) => s.playPrompt);
  const playMelodyPrompt = useAppStore((s) => s.playMelodyPrompt);
  const stopPlayback = useAppStore((s) => s.stopPlayback);
  const regenerateMelody = useAppStore((s) => s.regenerateMelody);
  const auditMelodyNote = useAppStore((s) => s.auditMelodyNote);
  const setMelodyBpm = useAppStore((s) => s.setMelodyBpm);
  const melodyBpm = useAppStore((s) => s.melodyBpm);
  const melodyCountInBeat = useAppStore((s) => s.melodyCountInBeat);
  const melodyNoteResults = useAppStore((s) => s.melodyNoteResults);
  const melodyRecordingProgress = useAppStore((s) => s.melodyRecordingProgress);
  const singNoteAutoAdvancePending = useAppStore((s) => s.singNoteAutoAdvancePending);
  const captureSingingAttempt = useAppStore((s) => s.captureSingingAttempt);
  const singingNoteIndex = useAppStore((s) => s.singingNoteIndex);
  const pitchDebug = useAppStore((s) => s.pitchDebug);
  const nextExercise = useAppStore((s) => s.nextExercise);
  const abortSession = useAppStore((s) => s.abortSession);
  const endSession = useAppStore((s) => s.endSession);
  const locale = settings.locale;
  const familySkills = SKILL_DEFINITIONS.filter((s) => s.family === selectedFamily);
  const promptNotes = promptToNotes(currentExercise);
  const liveSingingFeedback = currentExercise && (
    currentExercise.skillKey === 'sing_note'
    || currentExercise.skillKey === 'sing_interval'
    || currentExercise.skillKey === 'sing_melody'
  )
    ? buildLiveSingingFeedback({
      skillKey: currentExercise.skillKey,
      isCapturing: loading.captureSingingAttempt,
      promptNotes,
      singingNoteIndex,
      frequency: pitchDebug.frequency,
    })
    : {
      detectedNote: null,
      targetIndex: null,
      isOffTarget: false,
      correctionDirection: null,
    };
  const lastAutoPlayedIntervalId = React.useRef<string | null>(null);

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

  React.useEffect(() => {
    if (!currentExercise || currentExercise.skillKey !== 'sing_interval') {
      lastAutoPlayedIntervalId.current = null;
      return;
    }

    if (lastAutoPlayedIntervalId.current === currentExercise.id) return;
    lastAutoPlayedIntervalId.current = currentExercise.id;
    void auditMelodyNote(String(currentExercise.prompt.reference));
  }, [auditMelodyNote, currentExercise]);

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
  const canGoNext = Boolean(feedback.text) && !singNoteAutoAdvancePending;
  const subPrompt = currentExercise ? buildSubPrompt(currentExercise, locale) : '';
  const sessionActive = sessionMeta.total > 0;

  React.useEffect(() => {
    if (!sessionActive && showEndSessionConfirm) {
      setShowEndSessionConfirm(false);
    }
  }, [sessionActive, showEndSessionConfirm]);

  // Reset firstNoteMode to 'random' when the clef changes and the current mode
  // is not valid for the newly selected clef (e.g. C2 is bass-only, C6 is treble-only).
  const trebleFirstNoteModes: MelodyFirstNoteMode[] = ['random', 'C4', 'C6'];
  const bassFirstNoteModes: MelodyFirstNoteMode[] = ['random', 'C2', 'C4'];
  const clefFirstNoteModes = selectedClef === 'treble' ? trebleFirstNoteModes : bassFirstNoteModes;

  React.useEffect(() => {
    if (!clefFirstNoteModes.includes(selectedMelodyOptions.firstNoteMode)) {
      setSelectedMelodyOptions({ firstNoteMode: 'random' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClef]);

  return (
    <Screen>
      {!sessionActive ? (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{t(locale, 'custom_session')}</Text>

          <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>{t(locale, 'family')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CUSTOM_FAMILIES.map((family) => (
              <Pressable
                key={family}
                style={[
                  { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 999, paddingHorizontal: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
                  selectedFamily === family && { backgroundColor: colors.toggleActiveBg, borderColor: colors.toggleActiveBorder },
                ]}
                onPress={() => setSelectedFamily(family)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedFamily === family }}
              >
                <Text style={[
                  { color: colors.textSecondary },
                  selectedFamily === family && { color: colors.primaryStrong, fontWeight: '700' },
                ]}>
                  {t(locale, `family_${family}` as TranslationKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>{t(locale, 'skill')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {familySkills.map((skill) => (
              <Pressable
                key={skill.key}
                style={[
                  { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 999, paddingHorizontal: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
                  selectedSkill === skill.key && { backgroundColor: colors.toggleActiveBg, borderColor: colors.toggleActiveBorder },
                ]}
                onPress={() => setSelectedSkill(skill.key as SkillKey)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedSkill === skill.key }}
              >
                <Text style={[
                  { color: colors.textSecondary },
                  selectedSkill === skill.key && { color: colors.primaryStrong, fontWeight: '700' },
                ]}>
                  {skillLabel(locale, skill.key)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>{t(locale, 'clef')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {settings.enabledClefs.map((clef) => (
              <Pressable
                key={clef}
                style={[
                  { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 999, paddingHorizontal: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
                  selectedClef === clef && { backgroundColor: colors.toggleActiveBg, borderColor: colors.toggleActiveBorder },
                ]}
                onPress={() => setSelectedClef(clef)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedClef === clef }}
              >
                <Text style={[
                  { color: colors.textSecondary },
                  selectedClef === clef && { color: colors.primaryStrong, fontWeight: '700' },
                ]}>
                  {clefLabel(locale, clef)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Stepper label={t(locale, 'level')} value={selectedLevel} min={1} max={5} onChange={setSelectedLevel} disabled={loading.startCustom} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Stepper label={t(locale, 'count')} value={selectedCount} min={1} max={50} onChange={setSelectedCount} disabled={loading.startCustom} />
            </View>
          </View>

          <View style={{ borderWidth: 1, borderColor: colors.borderLight, borderRadius: 8, backgroundColor: colors.surfaceNeutral, padding: 10 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
              {t(locale, `${SKILL_LEVEL_DETAIL_PREFIX[selectedSkill]}_${selectedLevel}` as TranslationKey)}
            </Text>
          </View>

          {selectedSkill === 'sing_melody' ? (
            <View style={{ borderWidth: 1, borderColor: colors.borderBlue, borderRadius: 10, backgroundColor: colors.surfaceMelodyOptions, padding: 12, gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent }}>{t(locale, 'melody_options_title')}</Text>

              <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>{t(locale, 'melody_first_note')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {clefFirstNoteModes.map((mode) => {
                  const labelKey: TranslationKey = mode === 'random'
                    ? 'melody_first_note_random'
                    : mode === 'C2'
                      ? 'melody_first_note_c2'
                      : mode === 'C6'
                        ? 'melody_first_note_c6'
                        : 'melody_first_note_c4';
                  const active = selectedMelodyOptions.firstNoteMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      style={[
                        { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 999, paddingHorizontal: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
                        active && { backgroundColor: colors.toggleActiveBg, borderColor: colors.toggleActiveBorder },
                      ]}
                      onPress={() => setSelectedMelodyOptions({ firstNoteMode: mode })}
                      disabled={loading.startCustom}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[{ color: colors.textSecondary }, active && { color: colors.primaryStrong, fontWeight: '700' }]}>
                        {t(locale, labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>{t(locale, 'melody_intervals')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {([1, 2, 3, 4, 5, 6, 7, 8] as number[]).map((step) => {
                  const active = selectedMelodyOptions.allowedIntervalSteps.includes(step);
                  return (
                    <Pressable
                      key={step}
                      style={[
                        { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 999, paddingHorizontal: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
                        active && { backgroundColor: colors.toggleActiveBg, borderColor: colors.toggleActiveBorder },
                      ]}
                      disabled={loading.startCustom}
                      onPress={() => {
                        const current = selectedMelodyOptions.allowedIntervalSteps;
                        const next = active
                          ? current.filter((s) => s !== step)
                          : [...current, step].sort((a, b) => a - b);
                        setSelectedMelodyOptions({ allowedIntervalSteps: next });
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[{ color: colors.textSecondary }, active && { color: colors.primaryStrong, fontWeight: '700' }]}>
                        {INTERVAL_LABELS[step] ?? String(step)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedMelodyOptions.allowedIntervalSteps.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '600' }}>{t(locale, 'melody_intervals_empty_error')}</Text>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={[
              { backgroundColor: '#059669', minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
              loading.startCustom && { opacity: 0.45 },
            ]}
            onPress={() => void startCustom()}
            disabled={loading.startCustom}
            accessibilityRole="button"
          >
            {loading.startCustom
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700' }}>{t(locale, 'start_custom')}</Text>}
          </Pressable>
        </Card>
      ) : null}

      {sessionActive ? (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
            {t(locale, 'session_label')}: {`${modeLabel(locale, sessionMeta.mode)} • ${t(locale, 'exercise_label')} ${sessionMeta.index + 1}/${sessionMeta.total}`}
          </Text>

          <View style={{ height: 8, borderRadius: 99, backgroundColor: colors.masteryTrack, overflow: 'hidden' }}>
            <View style={{ height: 8, backgroundColor: '#10b981', width: `${progressPercent}%` }} />
          </View>

          {currentExercise ? (
            <>
              {/* sing_melody gets its own dedicated trainer panel */}
              {currentExercise.skillKey === 'sing_melody' ? (
                <MelodyTrainerPanel
                  exercise={currentExercise}
                  locale={locale}
                  bpm={melodyBpm}
                  countInBeat={melodyCountInBeat}
                  noteResults={melodyNoteResults}
                  recordingProgress={melodyRecordingProgress}
                  singingNoteIndex={singingNoteIndex}
                  liveDetectedNote={liveSingingFeedback.isOffTarget ? liveSingingFeedback.detectedNote : null}
                  liveDetectedNoteIndex={liveSingingFeedback.isOffTarget ? liveSingingFeedback.targetIndex : null}
                  feedback={feedback}
                  loadingPlay={loading.playPrompt}
                  loadingCapture={loading.captureSingingAttempt}
                  loadingStop={loading.stopPlayback}
                  onPlay={() => void playMelodyPrompt()}
                  onRecord={() => void captureSingingAttempt()}
                  onStop={() => void stopPlayback()}
                  onRegenerate={() => regenerateMelody()}
                  onTapNote={(note) => void auditMelodyNote(note)}
                  onChangeBpm={setMelodyBpm}
                />
              ) : (
                <>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{buildPrompt(currentExercise, locale)}</Text>
                  {subPrompt ? <Text style={{ fontSize: 13, color: colors.textSecondary }}>{subPrompt}</Text> : null}
                  {currentExercise.skillKey === 'sing_note' ? (
                    <Text style={{ fontSize: 24, fontWeight: '800', color: colors.primaryStrong, textAlign: 'center', letterSpacing: 0.6 }}>
                      {String(currentExercise.prompt.target).toUpperCase()}
                    </Text>
                  ) : null}

                  {currentExercise.skillKey === 'sing_interval' && currentExercise.metadata.intervalLabel ? (
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary, textAlign: 'center', marginVertical: 4 }}>
                      {String(currentExercise.metadata.intervalLabel)}
                    </Text>
                  ) : null}

                  {currentExercise.skillKey === 'interval_aural' ? (
                    <HearingPromptSvg />
                  ) : currentExercise.skillKey !== 'rhythm_id' ? (
                    <StaffSvg
                      clef={currentExercise.clef}
                      notes={promptNotes}
                      highlightIndex={loading.captureSingingAttempt ? singingNoteIndex : null}
                      overlayNote={liveSingingFeedback.isOffTarget ? liveSingingFeedback.detectedNote : null}
                      overlayIndex={liveSingingFeedback.isOffTarget ? liveSingingFeedback.targetIndex : null}
                      overlayDirection={liveSingingFeedback.isOffTarget ? liveSingingFeedback.correctionDirection : null}
                      singleNoteLayout={currentExercise.skillKey === 'sing_note'}
                    />
                  ) : (
                    <Text style={{ fontSize: 28, textAlign: 'center', color: colors.textSecondary, marginVertical: 10 }}>
                      {String(currentExercise.prompt.display)}
                    </Text>
                  )}

                  {(currentExercise.skillKey === 'interval_aural'
                    || currentExercise.skillKey === 'sing_note'
                    || currentExercise.skillKey === 'sing_interval') ? (
                    <Pressable
                      style={[
                        { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.borderLight, borderRadius: 8, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.surface },
                        loading.playPrompt && { opacity: 0.45 },
                      ]}
                      onPress={() => void playPrompt()}
                      disabled={loading.playPrompt}
                      accessibilityRole="button"
                    >
                      {loading.playPrompt
                        ? <ActivityIndicator color={colors.textSecondary} />
                        : <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t(locale, 'play_prompt')}</Text>}
                    </Pressable>
                  ) : null}

                  {currentExercise.family === 'singing' ? (
                    <Pressable
                      style={[
                        { alignSelf: 'flex-start', borderRadius: 8, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.amber },
                        (loading.captureSingingAttempt || singNoteAutoAdvancePending) && { opacity: 0.45 },
                      ]}
                      onPress={() => void captureSingingAttempt()}
                      disabled={loading.captureSingingAttempt || singNoteAutoAdvancePending}
                      accessibilityRole="button"
                    >
                      {loading.captureSingingAttempt
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={{ color: '#fff', fontWeight: '700' }}>{t(locale, 'record_and_evaluate')}</Text>}
                    </Pressable>
                  ) : null}

                  {currentExercise.family === 'singing' ? (
                    <View style={{ borderWidth: 1, borderColor: colors.borderLight, borderRadius: 8, backgroundColor: colors.surfaceNeutral, padding: 10, gap: 3 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>{t(locale, 'mic_debug_title')}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'mic_debug_phase')}: {pitchDebug.phase}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'mic_debug_duration_ms')}: {formatDebugInteger(locale, pitchDebug.durationMillis)}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'mic_debug_metering_db')}: {formatDebugDecimal(locale, pitchDebug.metering)}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'mic_debug_frequency_hz')}: {formatDebugDecimal(locale, pitchDebug.frequency)}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'mic_debug_timeline_points')}: {formatDebugInteger(locale, pitchDebug.timelinePoints)}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'mic_debug_updated')}: {formatDebugTimestamp(locale, pitchDebug.timestampMs)}</Text>
                    </View>
                  ) : null}

                  {currentExercise.skillKey === 'sing_note' && singNoteAutoAdvancePending ? (
                    <Text style={{ textAlign: 'center', fontSize: 72, lineHeight: 78, color: colors.success, fontWeight: '800' }}>✓</Text>
                  ) : null}

                  {feedback.text ? (
                    <Text style={{ fontWeight: '700', color: feedback.isCorrect ? colors.success : colors.danger }}>{feedback.text}</Text>
                  ) : null}
                </>
              )}

              {currentExercise.choices.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {currentExercise.choices.map((choice) => {
                    const key = String(choice);
                    const selected = answerState.selectedChoice === key;
                    const isCorrectChoice = answerState.expectedChoice === key;
                    const isWrongSelected = selected && answerState.expectedChoice !== key;

                    return (
                      <Pressable
                        key={key}
                        style={[
                          { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 8, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.surfaceNeutral },
                          selected && { borderColor: colors.primary },
                          isCorrectChoice && { borderColor: '#10b981', backgroundColor: colors.choiceCorrectBg },
                          isWrongSelected && { borderColor: '#f43f5e', backgroundColor: colors.choiceWrongBg },
                        ]}
                        onPress={() => void submitChoice(key)}
                        disabled={Boolean(answerState.selectedChoice) || loading.submitChoice || loading.captureSingingAttempt}
                        accessibilityRole="button"
                      >
                        <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                          {labelForChoice(currentExercise.skillKey, key, currentExercise.metadata)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* Feedback for non-melody exercises (melody shows its own feedback in MelodyTrainerPanel) */}
              {currentExercise.skillKey !== 'sing_melody' && feedback.text ? (
                <Text style={{ fontWeight: '700', color: feedback.isCorrect ? colors.success : colors.danger }}>{feedback.text}</Text>
              ) : null}

              <Pressable
                style={[
                  { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 44, backgroundColor: colors.surface },
                  (!canGoNext || loading.nextExercise) && { opacity: 0.45 },
                ]}
                onPress={() => void goToNextExercise()}
                disabled={!canGoNext || loading.nextExercise}
                accessibilityRole="button"
              >
                {loading.nextExercise
                  ? <ActivityIndicator color={colors.textSecondary} />
                  : <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t(locale, 'next_exercise')}</Text>}
              </Pressable>

              <Pressable
                style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => {
                  logEndSessionDebug('end_session_button_pressed', {
                    loading: loading.endSession,
                    sessionActive,
                    hasCurrentExercise: Boolean(currentExercise),
                    sessionIndex: sessionMeta.index,
                    sessionTotal: sessionMeta.total,
                  });
                  // If no exercise has been answered yet, abort immediately without confirmation or summary.
                  const noExerciseCompleted = sessionMeta.index === 0 && !feedback.text;
                  if (noExerciseCompleted) {
                    logEndSessionDebug('abort_session_no_exercise_completed');
                    abortSession();
                    return;
                  }
                  logEndSessionDebug('end_session_confirm_opened');
                  setShowEndSessionConfirm(true);
                }}
                disabled={loading.endSession}
                accessibilityRole="button"
                accessibilityLabel={t(locale, 'end_session')}
              >
                {loading.endSession
                  ? <ActivityIndicator color={colors.danger} />
                  : <Text style={{ color: colors.danger, fontWeight: '600' }}>{t(locale, 'end_session')}</Text>}
              </Pressable>

              {showEndSessionConfirm ? (
                <View style={{ marginTop: 8, borderWidth: 1, borderColor: colors.borderDanger, backgroundColor: colors.surfaceDanger, borderRadius: 10, padding: 12, gap: 10 }}>
                  <Text style={{ color: '#881337', fontWeight: '700', fontSize: 15 }}>{t(locale, 'confirm_end_title')}</Text>
                  <Text style={{ color: '#9f1239', fontSize: 13 }}>{t(locale, 'confirm_end_body')}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={{ flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#fda4af', backgroundColor: colors.surface }}
                      onPress={() => {
                        logEndSessionDebug('end_session_cancelled');
                        setShowEndSessionConfirm(false);
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={{ color: '#9f1239', fontWeight: '600' }}>{t(locale, 'cancel')}</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        { flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: '#be123c' },
                        loading.endSession && { opacity: 0.45 },
                      ]}
                      onPress={() => {
                        logEndSessionDebug('end_session_alert_confirmed');
                        setShowEndSessionConfirm(false);
                        void confirmEndSession();
                      }}
                      disabled={loading.endSession}
                      accessibilityRole="button"
                    >
                      {loading.endSession ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: '700' }}>{t(locale, 'end_now')}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={{ color: colors.textMuted }}>{t(locale, 'start_session_above')}</Text>
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
    const choiceLabels = metadata.choiceLabels as Record<string, string> | undefined;
    if (choiceLabels?.[choice]) return choiceLabels[choice];
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

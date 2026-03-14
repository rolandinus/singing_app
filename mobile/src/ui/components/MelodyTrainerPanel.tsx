import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { STAFF_MARGIN_LEFT, STAFF_MARGIN_TOP, LINE_SPACING, SVG_STAFF_HEIGHT, SVG_STAFF_WIDTH } from '../../core/config/constants';
import { COUNT_IN_BEATS } from '../../core/services/session-service';
import type { MelodyNoteResult } from '../../core/services/session-service';
import { t, type TranslationKey } from '../../core/i18n/translator';
import type { Clef, Exercise, MelodyNote, NoteType } from '../../core/types';
import { buildNoteNodes, buildStaffNodes } from '../../core/render/staff-builder';
import { buildMelodyResultRenderNotes } from '../../core/utils/melody-result-notes';
import { toReactNativeSvgTree, type SvgDescriptor } from '../../core/render/rn-svg-renderer';

type Locale = 'de' | 'en';

const componentMap = {
  Line,
  Ellipse,
  Circle,
  Path,
  Text: SvgText,
  G,
} as const;

function renderNode(node: SvgDescriptor, key: string): React.ReactNode {
  const Component = componentMap[node.component as keyof typeof componentMap];
  if (!Component) return null;
  const children = node.children.map((child, index) => {
    if (typeof child === 'string') return child;
    return renderNode(child, `${key}-${index}`);
  });
  return <Component key={key} {...node.props}>{children}</Component>;
}

/** Read MelodyNote array safely from a melody exercise prompt. */
function getMelodyNoteObjects(exercise: Exercise): MelodyNote[] {
  if (exercise.skillKey !== 'sing_melody') return [];
  const notes = (exercise.prompt as Record<string, unknown>).notes;
  if (!Array.isArray(notes)) return [];
  return (notes as unknown[]).map((n) => {
    if (n && typeof n === 'object' && 'pitch' in n && 'duration' in n) {
      return n as MelodyNote;
    }
    // Backwards compatibility: bare string treated as a quarter note.
    return { pitch: String(n), duration: 'quarter' as NoteType };
  });
}

/** Extract pitch strings from MelodyNote array. */
function getMelodyNotes(exercise: Exercise): string[] {
  return getMelodyNoteObjects(exercise).map((n) => n.pitch);
}

/** Extract duration array from MelodyNote array. */
function getMelodyDurations(exercise: Exercise): NoteType[] {
  return getMelodyNoteObjects(exercise).map((n) => n.duration);
}

function noteBeats(duration: NoteType): number {
  return duration === 'half' ? 2 : 1;
}

/** Staff with per-note tap-to-audition support and optional correctness overlay. */
function TappableStaff({
  clef,
  notes,
  durations,
  highlightIndex,
  overlayNote,
  overlayIndex,
  overlayDuration,
  noteResults,
  renderedNotes,
  onTapNote,
  recordingProgress,
}: {
  clef: Clef;
  notes: string[];
  durations?: NoteType[];
  highlightIndex?: number | null;
  overlayNote?: string | null;
  overlayIndex?: number | null;
  overlayDuration?: NoteType;
  noteResults?: MelodyNoteResult[];
  renderedNotes?: Array<{ note: string; duration: NoteType; slotIndex: number; correct: boolean }>;
  onTapNote?: (note: string, index: number) => void;
  recordingProgress?: number | null;
}) {
  const renderedPitchNotes = renderedNotes ?? notes.map((note, index) => ({
    note,
    duration: durations?.[index] ?? 'quarter',
    slotIndex: index,
    correct: true,
  }));
  const useDurationWeightedLayout = !renderedNotes && Boolean(durations?.length);
  const durationBasedSlotIndices = useDurationWeightedLayout
    ? (() => {
      let cursor = 0;
      return renderedPitchNotes.map((note) => {
        const slot = cursor;
        cursor += noteBeats(note.duration);
        return slot;
      });
    })()
    : [];
  const totalBeatSlots = useDurationWeightedLayout
    ? Math.max(1, renderedPitchNotes.reduce((sum, note) => sum + noteBeats(note.duration), 0))
    : Math.max(notes.length, renderedPitchNotes.length);
  const slotIndices = useDurationWeightedLayout
    ? durationBasedSlotIndices
    : renderedPitchNotes.map((note) => note.slotIndex);
  const noteNodes = buildNoteNodes(
    renderedPitchNotes.map((note) => note.note),
    clef,
    highlightIndex ?? null,
    renderedPitchNotes.map((note) => note.duration),
    {
      layoutNoteCount: totalBeatSlots,
      slotIndices,
      noteStyles: renderedNotes
        ? renderedPitchNotes.map((note) => ({
          fill: note.correct ? '#047857' : '#dc2626',
          stroke: note.correct ? '#047857' : '#dc2626',
        }))
        : undefined,
    },
  );
  const overlayNodes = overlayNote && overlayIndex != null
    ? buildNoteNodes(
      [overlayNote],
      clef,
      null,
      [overlayDuration ?? 'quarter'],
      {
        layoutNoteCount: totalBeatSlots,
        slotIndices: [slotIndices[overlayIndex] ?? overlayIndex],
        noteStyles: [{ fill: '#dc2626', stroke: '#dc2626', rx: 8, ry: 6 }],
      },
    )
    : [];
  const staffNodes = buildStaffNodes(clef);
  const allNodes = [...staffNodes, ...noteNodes, ...overlayNodes];
  const tree = toReactNativeSvgTree(allNodes);

  const NOTE_START_X = STAFF_MARGIN_LEFT + 110;
  const availableWidth = SVG_STAFF_WIDTH - NOTE_START_X - STAFF_MARGIN_LEFT;
  const NOTE_SPACING = totalBeatSlots > 1 ? Math.min(availableWidth / (totalBeatSlots - 1), 180) : 0;
  const TAP_HALF_WIDTH = 22;
  const normalizedProgress = recordingProgress == null ? null : Math.max(0, Math.min(1, recordingProgress));
  const maxBeatIndex = Math.max(0, totalBeatSlots - 1);
  // Map progress to beat index space (0..totalBeatSlots), then clamp to rendered slots.
  // This keeps cursor beat boundaries aligned with note-highlight timing.
  const cursorBeatPosition = normalizedProgress == null ? null : normalizedProgress * totalBeatSlots;
  const cursorX = cursorBeatPosition == null ? null : NOTE_START_X + Math.min(cursorBeatPosition, maxBeatIndex) * NOTE_SPACING;
  const cursorTopY = STAFF_MARGIN_TOP - 14;
  const cursorBottomY = STAFF_MARGIN_TOP + (LINE_SPACING * 4) + 14;

  return (
    <View style={styles.staffWrapper}>
      <Svg
        width="100%"
        height={160}
        viewBox={`0 0 ${SVG_STAFF_WIDTH} ${SVG_STAFF_HEIGHT}`}
      >
        {tree.map((node, index) => renderNode(node, String(index)))}

        {/* Timing cursor while recording melody */}
        {cursorX != null ? (
          <G>
            <Line x1={cursorX} y1={cursorTopY} x2={cursorX} y2={cursorBottomY} stroke="#f59e0b" strokeWidth={2} />
            <Circle cx={cursorX} cy={cursorTopY} r={4} fill="#f59e0b" />
          </G>
        ) : null}

        {/* Correctness indicators above staff notes */}
        {noteResults && noteResults.map((result, i) => {
          const cx = NOTE_START_X + (slotIndices[i] ?? i) * NOTE_SPACING;
          const cy = 8;
          const color = result.correct ? '#10b981' : '#f43f5e';
          return <Circle key={`result-${i}`} cx={cx} cy={cy} r={5} fill={color} />;
        })}
      </Svg>

      {/* Invisible tap targets overlaid on each note */}
      {onTapNote && notes.map((note, i) => {
        const noteSlotIndex = slotIndices[i] ?? i;
        const leftPct = ((NOTE_START_X + noteSlotIndex * NOTE_SPACING - TAP_HALF_WIDTH) / SVG_STAFF_WIDTH) * 100;
        const widthPct = ((TAP_HALF_WIDTH * 2) / SVG_STAFF_WIDTH) * 100;
        return (
          <Pressable
            key={`tap-${i}`}
            style={[
              styles.noteTapTarget,
              { left: `${leftPct}%` as any, width: `${widthPct}%` as any },
            ]}
            onPress={() => onTapNote(note, i)}
            accessibilityLabel={note}
          />
        );
      })}
    </View>
  );
}

/** BPM stepper control. */
function BpmControl({
  bpm,
  onChangeBpm,
  locale,
}: {
  bpm: number;
  onChangeBpm: (bpm: number) => void;
  locale: Locale;
}) {
  return (
    <View style={styles.bpmRow}>
      <Text style={styles.bpmLabel}>{t(locale, 'melody_bpm_label')}: {bpm}</Text>
      <View style={styles.bpmButtons}>
        <Pressable style={styles.bpmBtn} onPress={() => onChangeBpm(Math.max(40, bpm - 4))}>
          <Text style={styles.bpmBtnText}>−</Text>
        </Pressable>
        <Pressable style={styles.bpmBtn} onPress={() => onChangeBpm(Math.min(200, bpm + 4))}>
          <Text style={styles.bpmBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Count-in beat indicator. */
function CountInIndicator({
  beat,
  total,
  locale,
}: {
  beat: number | null;
  total: number;
  locale: Locale;
}) {
  if (beat === null) return null;
  return (
    <View style={styles.countInRow}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.countInDot, i + 1 <= beat && styles.countInDotActive]}
        />
      ))}
      <Text style={styles.countInText}>
        {t(locale, 'melody_count_in', { beat: String(beat), total: String(total) })}
      </Text>
    </View>
  );
}

type Props = {
  exercise: Exercise;
  locale: Locale;
  bpm: number;
  countInBeat: number | null;
  noteResults: MelodyNoteResult[];
  recordingProgress: number | null;
  singingNoteIndex: number | null;
  liveDetectedNote?: string | null;
  liveDetectedNoteIndex?: number | null;
  feedback: { text: string; isCorrect: boolean };
  loadingPlay: boolean;
  loadingCapture: boolean;
  loadingStop: boolean;
  onPlay: () => void;
  onRecord: () => void;
  onStop: () => void;
  onRegenerate: () => void;
  onTapNote: (note: string, index: number) => void;
  onChangeBpm: (bpm: number) => void;
};

export function MelodyTrainerPanel({
  exercise,
  locale,
  bpm,
  countInBeat,
  noteResults,
  recordingProgress,
  singingNoteIndex,
  liveDetectedNote,
  liveDetectedNoteIndex,
  feedback,
  loadingPlay,
  loadingCapture,
  loadingStop,
  onPlay,
  onRecord,
  onStop,
  onRegenerate,
  onTapNote,
  onChangeBpm,
}: Props) {
  const notes = getMelodyNotes(exercise);
  const durations = getMelodyDurations(exercise);
  const isCapturing = loadingCapture;
  const isCountingIn = isCapturing && countInBeat !== null;
  const hasResult = noteResults.length > 0;
  const renderedResultNotes = buildMelodyResultRenderNotes(noteResults, durations);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(locale, 'melody_trainer_title')}</Text>

      {/* BPM control (hidden during capture) */}
      {!isCapturing ? (
        <BpmControl bpm={bpm} onChangeBpm={onChangeBpm} locale={locale} />
      ) : null}

      {/* Target melody staff */}
      <Text style={styles.staffLabel}>{t(locale, 'melody_target_staff')}</Text>
      <Text style={styles.tapHint}>{t(locale, 'melody_tap_note_hint')}</Text>
      <TappableStaff
        clef={exercise.clef}
        notes={notes}
        durations={durations}
        highlightIndex={isCapturing && !isCountingIn ? singingNoteIndex : null}
        overlayNote={liveDetectedNote}
        overlayIndex={liveDetectedNoteIndex}
        overlayDuration={liveDetectedNoteIndex != null ? (durations[liveDetectedNoteIndex] ?? 'quarter') : 'quarter'}
        recordingProgress={isCapturing && !isCountingIn ? recordingProgress : null}
        onTapNote={!isCapturing ? onTapNote : undefined}
      />

      {/* Count-in indicator */}
      <CountInIndicator beat={countInBeat} total={COUNT_IN_BEATS} locale={locale} />

      {/* Per-note result staff (shown after attempt) */}
      {hasResult ? (
        <>
          <Text style={styles.staffLabel}>{t(locale, 'melody_result_staff')}</Text>
          <TappableStaff
            clef={exercise.clef}
            notes={notes}
            durations={durations}
            noteResults={noteResults}
            renderedNotes={renderedResultNotes}
          />
          <View style={styles.noteResultsRow}>
            {noteResults.map((result, i) => (
              <View
                key={i}
                style={[styles.noteResultBadge, result.correct ? styles.noteResultOk : styles.noteResultBad]}
              >
                <Text style={styles.noteResultBadgeText}>{Math.round(result.score * 100)}%</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Feedback text */}
      {feedback.text ? (
        <Text style={[styles.feedback, feedback.isCorrect ? styles.feedbackOk : styles.feedbackBad]}>
          {feedback.text}
        </Text>
      ) : null}

      {/* Control buttons */}
      <View style={styles.controlsRow}>
        {/* Regenerate */}
        <Pressable
          style={[styles.controlBtn, styles.regenerateBtn, isCapturing && styles.disabledButton]}
          onPress={onRegenerate}
          disabled={isCapturing}
        >
          <Text style={styles.controlBtnText}>{t(locale, 'melody_regenerate')}</Text>
        </Pressable>

        {/* Play / Stop prompt */}
        {loadingPlay ? (
          <Pressable style={[styles.controlBtn, styles.stopBtn]} onPress={onStop} disabled={loadingStop}>
            {loadingStop ? <ActivityIndicator color="#fff" /> : <Text style={styles.controlBtnText}>{t(locale, 'melody_stop')}</Text>}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.controlBtn, styles.playBtn, isCapturing && styles.disabledButton]}
            onPress={onPlay}
            disabled={isCapturing}
          >
            <Text style={styles.controlBtnText}>{t(locale, 'melody_play')}</Text>
          </Pressable>
        )}

        {/* Record / recording in progress */}
        <Pressable
          style={[styles.controlBtn, isCapturing ? styles.recordingBtn : styles.recordBtn, loadingPlay && styles.disabledButton]}
          onPress={isCapturing ? onStop : onRecord}
          disabled={loadingPlay}
        >
          {isCapturing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.controlBtnText}>{t(locale, 'melody_record')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  title: { fontSize: 15, fontWeight: '700', color: '#1e40af' },
  staffLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 4 },
  tapHint: { fontSize: 11, color: '#94a3b8' },
  staffWrapper: { position: 'relative' },
  noteTapTarget: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  bpmRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bpmLabel: { fontSize: 13, color: '#334155', fontWeight: '600', flex: 1 },
  bpmButtons: { flexDirection: 'row', gap: 6 },
  bpmBtn: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  bpmBtnText: { fontSize: 18, color: '#334155', fontWeight: '700', lineHeight: 22 },
  countInRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  countInDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#e2e8f0' },
  countInDotActive: { backgroundColor: '#2563eb' },
  countInText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  noteResultsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  noteResultBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, minWidth: 36, alignItems: 'center' },
  noteResultOk: { backgroundColor: '#dcfce7' },
  noteResultBad: { backgroundColor: '#ffe4e6' },
  noteResultBadgeText: { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  feedback: { fontWeight: '700', fontSize: 14 },
  feedbackOk: { color: '#047857' },
  feedbackBad: { color: '#be123c' },
  controlsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  controlBtn: { flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  regenerateBtn: { backgroundColor: '#e2e8f0' },
  playBtn: { backgroundColor: '#2563eb' },
  stopBtn: { backgroundColor: '#64748b' },
  recordBtn: { backgroundColor: '#f59e0b' },
  recordingBtn: { backgroundColor: '#dc2626' },
  disabledButton: { opacity: 0.45 },
  controlBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

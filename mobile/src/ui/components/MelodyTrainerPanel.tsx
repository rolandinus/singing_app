import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { STAFF_MARGIN_LEFT, STAFF_MARGIN_TOP, LINE_SPACING, SVG_STAFF_HEIGHT, SVG_STAFF_WIDTH } from '../../core/config/constants';
import { COUNT_IN_BEATS, getMelodyNoteObjects, noteBeats } from '../../core/services/session-service';
import type { MelodyNoteResult } from '../../core/services/session-service';
import { t, type TranslationKey } from '../../core/i18n/translator';
import type { Clef, Exercise, MelodyNote, NoteType } from '../../core/types';
import { buildNoteNodes, buildStaffNodes, NOTE_SLOTS_START_X, yForScientific } from '../../core/render/staff-builder';
import { buildMelodyResultRenderNotes } from '../../core/utils/melody-result-notes';
import { toReactNativeSvgTree, type SvgDescriptor } from '../../core/render/rn-svg-renderer';
import { useThemeColors } from '../hooks/use-theme-colors';

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


/** Staff with per-note tap-to-audition support and optional correctness overlay. */
function TappableStaff({
  clef,
  notes,
  durations,
  highlightIndex,
  correctionDirection,
  liveDetectedNote,
  overlayIndex,
  noteResults,
  renderedNotes,
  incorrectOverlays,
  onTapNote,
  recordingProgress,
  noteColor,
}: {
  clef: Clef;
  notes: string[];
  durations?: NoteType[];
  highlightIndex?: number | null;
  correctionDirection?: 'up' | 'down' | null;
  liveDetectedNote?: string | null;
  overlayIndex?: number | null;
  noteResults?: MelodyNoteResult[];
  renderedNotes?: Array<{ note: string; duration: NoteType; slotIndex: number; correct: boolean; isOctaveOff: boolean }>;
  incorrectOverlays?: Array<{ note: string; duration: NoteType; slotIndex: number; isOctaveOff: boolean }>;
  onTapNote?: (note: string, index: number) => void;
  recordingProgress?: number | null;
  noteColor?: string;
}) {
  const renderedPitchNotes = renderedNotes ?? notes.map((note, index) => ({
    note,
    duration: durations?.[index] ?? 'quarter',
    slotIndex: index,
    correct: true,
  }));
  // Always use beat-weighted layout when reference durations are available so that
  // both the target staff and the result (recorded) staff share the same X positions.
  const useDurationWeightedLayout = Boolean(durations?.length);
  // Build a lookup from note-ordinal-index → cumulative beat offset using the reference durations.
  const beatOffsetByNoteIndex: number[] = (() => {
    if (!durations?.length) return [];
    const offsets: number[] = [];
    let cursor = 0;
    for (const dur of durations) {
      offsets.push(cursor);
      cursor += noteBeats(dur);
    }
    return offsets;
  })();
  // Total beats is determined solely by the reference melody durations.
  const totalBeatSlots = useDurationWeightedLayout
    ? Math.max(1, (durations ?? []).reduce((sum, dur) => sum + noteBeats(dur), 0))
    : Math.max(notes.length, renderedPitchNotes.length);
  const slotIndices = useDurationWeightedLayout
    ? renderedPitchNotes.map((note) => beatOffsetByNoteIndex[note.slotIndex] ?? note.slotIndex)
    : renderedPitchNotes.map((note) => note.slotIndex);
  // Use totalBeatSlots + 1 as layoutNoteCount so the last note is not at the right edge of
  // the staff, leaving one beat-slot of room for the cursor to travel past the final note.
  const layoutNoteCount = totalBeatSlots + 1;
  const noteNodes = buildNoteNodes(
    renderedPitchNotes.map((note) => note.note),
    clef,
    highlightIndex ?? null,
    renderedPitchNotes.map((note) => note.duration),
    {
      layoutNoteCount,
      slotIndices,
      noteStyles: renderedNotes
        ? renderedPitchNotes.map((note) => {
          const color = note.correct ? '#047857' : note.isOctaveOff ? '#f97316' : '#dc2626';
          return { fill: color, stroke: color };
        })
        : undefined,
    },
    noteColor,
  );
  const incorrectOverlayNodes = incorrectOverlays?.length
    ? buildNoteNodes(
      incorrectOverlays.map((o) => o.note),
      clef,
      null,
      incorrectOverlays.map((o) => o.duration),
      {
        layoutNoteCount,
        slotIndices: incorrectOverlays.map((o) => beatOffsetByNoteIndex[o.slotIndex] ?? o.slotIndex),
        noteStyles: incorrectOverlays.map((o) => {
          const c = o.isOctaveOff ? '#f97316' : '#dc2626';
          return { fill: c, stroke: c, rx: 8, ry: 6 };
        }),
      },
      noteColor,
    )
    : [];
  const staffNodes = buildStaffNodes(clef, noteColor);
  const tree = toReactNativeSvgTree([...staffNodes, ...noteNodes, ...incorrectOverlayNodes]);

  // NOTE_SLOTS_START_X matches xForSlot's startX so the cursor aligns with note positions.
  const NOTE_START_X = NOTE_SLOTS_START_X;
  const availableWidth = SVG_STAFF_WIDTH - NOTE_START_X - STAFF_MARGIN_LEFT;
  // Dividing by totalBeatSlots (= layoutNoteCount - 1) means one beat-slot of padding exists
  // after the last note, so the cursor can travel past it when progress reaches 1.
  const NOTE_SPACING = totalBeatSlots > 0 ? Math.min(availableWidth / totalBeatSlots, 180) : 0;
  const TAP_HALF_WIDTH = 22;
  const normalizedProgress = recordingProgress == null ? null : Math.max(0, Math.min(1, recordingProgress));
  // Cursor travels from beat 0 (first note) to beat totalBeatSlots (end of last note).
  const cursorBeatPosition = normalizedProgress == null ? null : normalizedProgress * totalBeatSlots;
  const cursorX = cursorBeatPosition == null ? null : NOTE_START_X + cursorBeatPosition * NOTE_SPACING;
  const cursorTopY = STAFF_MARGIN_TOP - 14;
  const cursorBottomY = STAFF_MARGIN_TOP + (LINE_SPACING * 4) + 14;

  return (
    <View style={{ position: 'relative' }}>
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
          const color = result.correct ? '#10b981' : result.isOctaveOff ? '#f97316' : '#f43f5e';
          return <Circle key={`result-${i}`} cx={cx} cy={8} r={5} fill={color} />;
        })}
      </Svg>

      {/* Directional arrow overlaid at target note position during capture */}
      {correctionDirection != null && overlayIndex != null && notes[overlayIndex] ? (() => {
        const SVG_HEIGHT_PX = 160;
        const scale = SVG_HEIGHT_PX / SVG_STAFF_HEIGHT;
        const noteX = NOTE_START_X + (slotIndices[overlayIndex] ?? overlayIndex) * NOTE_SPACING;
        const noteY = yForScientific(notes[overlayIndex], clef);
        const arrowY = correctionDirection === 'up' ? noteY + 18 : noteY - 30;
        return (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: arrowY * scale,
              left: `${(noteX / SVG_STAFF_WIDTH) * 100}%` as any,
              transform: [{ translateX: -14 }],
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#dc2626', fontSize: 20, fontWeight: '700', lineHeight: 24 }}>
              {correctionDirection === 'up' ? '↑' : '↓'}
            </Text>
            {liveDetectedNote ? (
              <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700', lineHeight: 14 }}>
                {liveDetectedNote}
              </Text>
            ) : null}
          </View>
        );
      })() : null}

      {/* Invisible tap targets overlaid on each note */}
      {onTapNote && notes.map((note, i) => {
        const noteSlotIndex = slotIndices[i] ?? i;
        const leftPct = ((NOTE_START_X + noteSlotIndex * NOTE_SPACING - TAP_HALF_WIDTH) / SVG_STAFF_WIDTH) * 100;
        const widthPct = ((TAP_HALF_WIDTH * 2) / SVG_STAFF_WIDTH) * 100;
        return (
          <Pressable
            key={`tap-${i}`}
            style={[
              { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'transparent' },
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
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600', flex: 1 }}>
        {t(locale, 'melody_bpm_label')}: {bpm}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Pressable
          style={{ width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
          onPress={() => onChangeBpm(Math.max(40, bpm - 4))}
          accessibilityRole="button"
          accessibilityLabel={t(locale, 'melody_bpm_decrease')}
        >
          <Text style={{ fontSize: 18, color: colors.textSecondary, fontWeight: '700', lineHeight: 22 }}>−</Text>
        </Pressable>
        <Pressable
          style={{ width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
          onPress={() => onChangeBpm(Math.min(200, bpm + 4))}
          accessibilityRole="button"
          accessibilityLabel={t(locale, 'melody_bpm_increase')}
        >
          <Text style={{ fontSize: 18, color: colors.textSecondary, fontWeight: '700', lineHeight: 22 }}>+</Text>
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
  const colors = useThemeColors();
  if (beat === null) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: i + 1 <= beat ? colors.primary : colors.countInDotInactive,
          }}
        />
      ))}
      <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
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
  correctionDirection?: 'up' | 'down' | null;
  liveDetectedNote?: string | null;
  liveDetectedNoteIndex?: number | null;
  liveOctaveWarning?: 'high' | 'low' | null;
  liveIsOnTarget?: boolean;
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
  correctionDirection,
  liveDetectedNote,
  liveDetectedNoteIndex,
  liveOctaveWarning,
  liveIsOnTarget,
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
  const colors = useThemeColors();
  const noteObjects = getMelodyNoteObjects(exercise);
  const notes = noteObjects.map((n) => n.pitch);
  const durations = noteObjects.map((n) => n.duration);
  const isCapturing = loadingCapture;
  const hasResult = noteResults.length > 0;
  const renderedResultNotes = buildMelodyResultRenderNotes(noteResults, durations);

  const [latchedOctaveWarning, setLatchedOctaveWarning] = React.useState<'high' | 'low' | null>(null);
  const prevOctaveWarning = React.useRef<'high' | 'low' | null>(null);
  React.useEffect(() => {
    if (!isCapturing) {
      setLatchedOctaveWarning(null);
      prevOctaveWarning.current = null;
      return;
    }
    if (liveOctaveWarning && liveOctaveWarning === prevOctaveWarning.current) {
      // Only show warning after two consecutive analysis points agree on the same octave direction
      setLatchedOctaveWarning(liveOctaveWarning);
    } else if (liveIsOnTarget) {
      setLatchedOctaveWarning(null);
    }
    prevOctaveWarning.current = liveOctaveWarning ?? null;
  }, [isCapturing, liveOctaveWarning, liveIsOnTarget]);

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accent }}>{t(locale, 'melody_trainer_title')}</Text>

      {/* BPM control (hidden during capture) */}
      {!isCapturing ? (
        <BpmControl bpm={bpm} onChangeBpm={onChangeBpm} locale={locale} />
      ) : null}

      {/* Target melody staff */}
      <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: 4 }}>{t(locale, 'melody_target_staff')}</Text>
      <Text style={{ fontSize: 11, color: colors.textSubtle }}>{t(locale, 'melody_tap_note_hint')}</Text>
      <TappableStaff
        clef={exercise.clef}
        notes={notes}
        durations={durations}
        highlightIndex={isCapturing && countInBeat === null ? singingNoteIndex : null}
        correctionDirection={isCapturing ? correctionDirection : null}
        liveDetectedNote={isCapturing ? liveDetectedNote : null}
        overlayIndex={liveDetectedNoteIndex}
        recordingProgress={isCapturing && countInBeat === null ? recordingProgress : null}
        noteResults={hasResult ? noteResults : undefined}
        incorrectOverlays={hasResult ? renderedResultNotes.filter((n) => !n.correct) : undefined}
        onTapNote={!isCapturing ? onTapNote : undefined}
        noteColor={colors.textPrimary}
      />

      {/* Count-in indicator */}
      <CountInIndicator beat={countInBeat} total={COUNT_IN_BEATS} locale={locale} />

      {/* Live octave warning */}
      {isCapturing && latchedOctaveWarning ? (
        <View style={{ borderRadius: 8, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400e' }}>
            {t(locale, latchedOctaveWarning === 'high' ? 'melody_octave_too_high' : 'melody_octave_too_low')}
          </Text>
        </View>
      ) : null}

      {/* Per-note score badges (shown after attempt) */}
      {hasResult ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {noteResults.map((result, i) => (
            <View
              key={i}
              style={{
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
                minWidth: 36,
                alignItems: 'center',
                backgroundColor: result.correct ? colors.noteResultOkBg : result.isOctaveOff ? '#ffedd5' : colors.noteResultBadBg,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>{Math.round(result.score * 100)}%</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Feedback text */}
      {feedback.text ? (
        <Text style={{ fontWeight: '700', fontSize: 14, color: feedback.isCorrect ? colors.success : colors.danger }}>
          {feedback.text}
        </Text>
      ) : null}

      {/* Detail hint when correct but not 100%: show which notes were imperfect */}
      {feedback.isCorrect && noteResults.length > 0 && noteResults.some((r) => r.score < 1) ? (() => {
        const perfectCount = noteResults.filter((r) => r.score === 1).length;
        const total = noteResults.length;
        const imperfect = noteResults
          .map((r, i) => ({ ...r, position: i + 1 }))
          .filter((r) => r.score < 1);
        const hints = imperfect.map((r) => {
          if (r.detectedMidi === null) return `Note ${r.position}: nicht erkannt`;
          if (r.isOctaveOff) return `Note ${r.position}: Oktave versetzt`;
          return `Note ${r.position}: Tonhöhe abweichend (${Math.round(r.score * 100)}%)`;
        });
        return (
          <View style={{ backgroundColor: colors.noteResultOkBg, borderRadius: 8, padding: 8, gap: 2 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.success }}>
              {perfectCount}/{total} Noten perfekt
            </Text>
            {hints.map((hint, i) => (
              <Text key={i} style={{ fontSize: 12, color: colors.textSecondary }}>• {hint}</Text>
            ))}
          </View>
        );
      })() : null}

      {/* Control buttons */}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {/* Regenerate */}
        <Pressable
          style={[
            { flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: colors.borderLight },
            isCapturing && { opacity: 0.45 },
          ]}
          onPress={onRegenerate}
          disabled={isCapturing}
          accessibilityRole="button"
          accessibilityLabel={t(locale, 'melody_regenerate')}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>{t(locale, 'melody_regenerate')}</Text>
        </Pressable>

        {/* Play / Stop prompt */}
        {loadingPlay ? (
          <Pressable
            style={{ flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: colors.textMuted }}
            onPress={onStop}
            disabled={loadingStop}
            accessibilityRole="button"
            accessibilityLabel={t(locale, 'melody_stop')}
          >
            {loadingStop ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t(locale, 'melody_stop')}</Text>}
          </Pressable>
        ) : (
          <Pressable
            style={[
              { flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: colors.primary },
              isCapturing && { opacity: 0.45 },
            ]}
            onPress={onPlay}
            disabled={isCapturing}
            accessibilityRole="button"
            accessibilityLabel={t(locale, 'melody_play')}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t(locale, 'melody_play')}</Text>
          </Pressable>
        )}

        {/* Record / recording in progress */}
        <Pressable
          style={[
            {
              flex: 1,
              minHeight: 44,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8,
              backgroundColor: isCapturing ? '#dc2626' : colors.amber,
            },
            (loadingPlay || feedback.isCorrect) && { opacity: 0.45 },
          ]}
          onPress={isCapturing ? onStop : onRecord}
          disabled={loadingPlay || feedback.isCorrect}
          accessibilityRole="button"
          accessibilityLabel={isCapturing ? t(locale, 'melody_stop') : t(locale, 'melody_record')}
        >
          {isCapturing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t(locale, 'melody_record')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

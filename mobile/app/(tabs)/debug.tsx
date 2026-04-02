import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Circle, Line, Svg, Text as SvgText } from 'react-native-svg';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { ExpoAudioPromptPort } from '../../src/adapters/audio/expo-audio-prompt-port';
import { ExpoPitchCapturePort, type PitchCaptureDebugSnapshot } from '../../src/adapters/pitch/expo-pitch-capture-port';
import { AsyncStoragePort } from '../../src/adapters/storage/async-storage-port';
import { DEFAULT_MELODY_OPTIONS } from '../../src/core/domain/exercise-generator';
import { t, type TranslationKey } from '../../src/core/i18n/translator';
import {
  buildMelodyTimingModel,
  SessionService,
  type MelodyNoteResult,
} from '../../src/core/services/session-service';
import type { Clef, Exercise, MelodyNote, NoteType } from '../../src/core/types';
import { midiToScientific } from '../../src/core/utils/note-helpers';
import { noteFromPitch } from '../../src/core/utils/pitch';
import { useAppStore, type PitchDebugState, INITIAL_PITCH_DEBUG_STATE, mergePitchDebugState } from '../../src/state/use-app-store';
import { Card } from '../../src/ui/components/Card';
import { MelodyTrainerPanel } from '../../src/ui/components/MelodyTrainerPanel';
import { Screen } from '../../src/ui/components/Screen';
import { Stepper } from '../../src/ui/components/Stepper';
import { useThemeColors } from '../../src/ui/hooks/use-theme-colors';

type CaptureSample = {
  timeMs: number;
  frequency: number;
  note: string;
};

type CaptureSummary = {
  samples: CaptureSample[];
  medianHz: number | null;
  medianNote: string | null;
  minHz: number | null;
  maxHz: number | null;
  spreadHz: number | null;
  topNotes: Array<{ note: string; count: number }>;
};

type SlotDetectorSummary = {
  medianHz: number | null;
  medianNote: string | null;
  modeNote: string | null;
  noteCountsLabel: string;
};

type SingleDetectorRow = {
  timeMs: number;
  slotNr: number | null;
  sample: CaptureSample;
};

type RecordedTake = {
  uri: string;
  durationMillis: number | null;
  timestampMs: number | null;
};

const MAX_PITCH_DEBUG_EVENTS = 2500;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}


function toNoteName(frequency: number): string {
  if (!Number.isFinite(frequency) || frequency <= 0) return 'n/a';
  return midiToScientific(noteFromPitch(frequency));
}

function getLatestCaptureEvents(events: PitchCaptureDebugSnapshot[]): PitchCaptureDebugSnapshot[] | null {
  let startIndex = -1;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.phase === 'recording' && event.message === 'recording_started') {
      startIndex = i;
      break;
    }
  }
  if (startIndex < 0) return null;

  const tail = events.slice(startIndex);
  const completeIndex = tail.findIndex((event) => event.phase === 'analysis_complete');
  return completeIndex >= 0 ? tail.slice(0, completeIndex + 1) : tail;
}

function getLatestRecordedTake(captureEvents: PitchCaptureDebugSnapshot[] | null): RecordedTake | null {
  if (!captureEvents) return null;
  for (let i = captureEvents.length - 1; i >= 0; i -= 1) {
    const event = captureEvents[i];
    if (event.phase !== 'recorded' || !event.uri) continue;
    return {
      uri: event.uri,
      durationMillis: Number.isFinite(event.durationMillis) ? Number(event.durationMillis) : null,
      timestampMs: Number.isFinite(event.timestampMs) ? Number(event.timestampMs) : null,
    };
  }
  return null;
}

function buildCaptureSummary(captureEvents: PitchCaptureDebugSnapshot[] | null): CaptureSummary | null {
  if (!captureEvents) return null;

  const samples: CaptureSample[] = captureEvents
    .filter((event) => event.phase === 'analysis_sample' && Number.isFinite(event.frequency) && event.detector === 'studio_pitch')
    .map((event) => ({
      timeMs: Number(event.sampleTimeMs ?? 0),
      frequency: Number(event.frequency),
      note: toNoteName(Number(event.frequency)),
    }));

  if (samples.length === 0) return null;

  const frequencies = samples.map((sample) => sample.frequency);
  const medianHz = median(frequencies);
  const minHz = Math.min(...frequencies);
  const maxHz = Math.max(...frequencies);

  const noteCounts = new Map<string, number>();
  samples.forEach((sample) => {
    noteCounts.set(sample.note, (noteCounts.get(sample.note) ?? 0) + 1);
  });

  const topNotes = Array.from(noteCounts.entries())
    .map(([note, count]) => ({ note, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    samples,
    medianHz,
    medianNote: medianHz != null ? toNoteName(medianHz) : null,
    minHz,
    maxHz,
    spreadHz: maxHz - minHz,
    topNotes,
  };
}

function buildSlotDetectorSummary(samples: CaptureSample[]): SlotDetectorSummary {
  if (samples.length === 0) {
    return {
      medianHz: null,
      medianNote: null,
      modeNote: null,
      noteCountsLabel: 'n/a',
    };
  }

  const frequencies = samples.map((sample) => sample.frequency).filter((value) => Number.isFinite(value));
  const noteCounts = new Map<string, number>();
  samples.forEach((sample) => {
    noteCounts.set(sample.note, (noteCounts.get(sample.note) ?? 0) + 1);
  });

  const sortedCounts = Array.from(noteCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const medianHz = frequencies.length > 0 ? median(frequencies) : null;

  return {
    medianHz,
    medianNote: medianHz != null ? toNoteName(medianHz) : null,
    modeNote: sortedCounts[0]?.[0] ?? null,
    noteCountsLabel: sortedCounts.map(([note, count]) => `${note}:${count}`).join(', '),
  };
}

function buildSingleDetectorRows(
  samples: CaptureSample[],
  slotResolver?: (timeMs: number) => number | null,
): SingleDetectorRow[] {
  return [...samples]
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(-160)
    .map((sample) => ({
      timeMs: sample.timeMs,
      slotNr: slotResolver ? slotResolver(sample.timeMs) : null,
      sample,
    }));
}

function buildSingleDetectorSlotSummaries(rows: SingleDetectorRow[]): Array<{ slotNr: number; summary: SlotDetectorSummary }> {
  const grouped = new Map<number, CaptureSample[]>();
  rows.forEach((row) => {
    if (!Number.isFinite(row.slotNr)) return;
    const slotNr = Number(row.slotNr);
    const existing = grouped.get(slotNr) ?? [];
    existing.push(row.sample);
    grouped.set(slotNr, existing);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([slotNr, samples]) => ({
      slotNr,
      summary: buildSlotDetectorSummary(samples),
    }));
}

function latestCaptureMessage(captureEvents: PitchCaptureDebugSnapshot[] | null): string | null {
  if (!captureEvents) return null;
  for (let i = captureEvents.length - 1; i >= 0; i -= 1) {
    const event = captureEvents[i];
    const message = event.message ?? '';
    if (!message) continue;
    if (event.detector === 'studio_pitch') return message;
    if (message.startsWith('studio_pitch_') || message === 'analysis_finished' || message === 'analysis_finished_without_pitch') return message;
  }
  return null;
}

function getMelodyNoteObjects(exercise: Exercise | null): MelodyNote[] {
  if (!exercise || exercise.skillKey !== 'sing_melody') return [];
  const notes = (exercise.prompt as Record<string, unknown>).notes;
  if (!Array.isArray(notes)) return [];
  return notes.map((note) => {
    if (note && typeof note === 'object' && 'pitch' in note && 'duration' in note) {
      return note as MelodyNote;
    }
    return { pitch: String(note), duration: 'quarter' as NoteType };
  });
}

function noteBeats(duration: NoteType): number {
  return duration === 'half' ? 2 : 1;
}

function totalMelodyBeats(exercise: Exercise | null): number {
  return Math.max(1, getMelodyNoteObjects(exercise).reduce((sum, note) => sum + noteBeats(note.duration), 0));
}

function resolveMelodySlotNr(exercise: Exercise | null, bpm: number, timeMs: number): number | null {
  if (!Number.isFinite(timeMs) || timeMs < 0) return null;

  const notes = getMelodyNoteObjects(exercise);
  if (notes.length === 0) return null;

  const beats = Math.max(1, notes.reduce((sum, note) => sum + noteBeats(note.duration), 0));
  const timing = buildMelodyTimingModel(bpm, beats);
  let cursorMs = 0;

  for (let i = 0; i < notes.length; i += 1) {
    const note = notes[i];
    const durationMs = noteBeats(note?.duration ?? 'quarter') * timing.noteDurationMs;
    const endMs = cursorMs + durationMs;
    if (timeMs >= cursorMs && timeMs < endMs) {
      return i + 1;
    }
    cursorMs = endMs;
  }

  if (timeMs <= cursorMs + 250) {
    return notes.length;
  }

  return null;
}

function formatHz(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(2)} Hz`;
}

function formatMs(value: number): string {
  if (!Number.isFinite(value)) return 'n/a';
  return `${Math.round(value)} ms`;
}

function formatClockTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const rounded = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatSignedCents(result: MelodyNoteResult): string {
  if (result.detectedMidi == null || !Number.isFinite(result.detectedMidi)) return 'n/a';
  const cents = Math.round((result.detectedMidi - result.targetMidi) * 100);
  return `${cents > 0 ? '+' : ''}${cents}c`;
}

function formatDetectedMidi(result: MelodyNoteResult | null): string {
  if (!result || result.detectedMidi == null || !Number.isFinite(result.detectedMidi)) return 'n/a';
  return midiToScientific(result.detectedMidi);
}

// Octave reference lines drawn on the chart (C2–C6)
const CHART_GRID: Array<{ hz: number; label: string }> = [
  { hz: 65.41, label: 'C2' },
  { hz: 130.81, label: 'C3' },
  { hz: 261.63, label: 'C4' },
  { hz: 523.25, label: 'C5' },
  { hz: 1046.5, label: 'C6' },
];
const CHART_MIN_HZ = 60;
const CHART_MAX_HZ = 1400;
const CHART_LOG_MIN = Math.log2(CHART_MIN_HZ);
const CHART_LOG_MAX = Math.log2(CHART_MAX_HZ);

function PitchTimelineChart({
  samples,
  durationMs,
  playbackMs,
}: {
  samples: Array<{ timeMs: number; frequency: number }>;
  durationMs: number;
  playbackMs: number;
}) {
  const colors = useThemeColors();
  const [chartWidth, setChartWidth] = React.useState(300);
  const height = 160;
  const padLeft = 34;
  const drawW = Math.max(1, chartWidth - padLeft);
  const safeDuration = Math.max(1, durationMs);

  const toX = (ms: number) => padLeft + (ms / safeDuration) * drawW;
  const toY = (hz: number) => {
    const clamped = Math.max(CHART_MIN_HZ, Math.min(CHART_MAX_HZ, hz));
    return height - ((Math.log2(clamped) - CHART_LOG_MIN) / (CHART_LOG_MAX - CHART_LOG_MIN)) * height;
  };

  const cursorX = toX(playbackMs);

  return (
    <View
      style={{ height, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surfaceNeutral }}
      onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
    >
      <Svg width={chartWidth} height={height}>
        {CHART_GRID.map(({ hz, label }) => {
          const y = toY(hz);
          return (
            <React.Fragment key={label}>
              <Line x1={padLeft} x2={chartWidth} y1={y} y2={y} stroke={colors.borderLight} strokeWidth={1} />
              <SvgText x={2} y={y + 4} fontSize={9} fill={colors.textMuted}>{label}</SvgText>
            </React.Fragment>
          );
        })}
        {samples.map((pt, i) => (
          <Circle
            key={i}
            cx={toX(pt.timeMs)}
            cy={toY(pt.frequency)}
            r={3}
            fill={colors.primaryStrong}
            opacity={0.75}
          />
        ))}
        {playbackMs > 0 && cursorX >= padLeft && (
          <Line x1={cursorX} x2={cursorX} y1={0} y2={height} stroke={colors.danger} strokeWidth={2} />
        )}
      </Svg>
    </View>
  );
}

function SummaryBlock({
  locale,
  summary,
  statusMessage,
}: {
  locale: 'de' | 'en';
  summary: CaptureSummary | null;
  statusMessage?: string | null;
}) {
  const colors = useThemeColors();

  return (
    <View
      style={{
        flex: 1,
        minWidth: 220,
        borderWidth: 1,
        borderColor: colors.borderLight,
        borderRadius: 10,
        backgroundColor: colors.surfaceNeutral,
        padding: 10,
        gap: 4,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t(locale, 'debug_compare_experimental')}</Text>
      {!summary ? (
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'debug_compare_unavailable')}</Text>
      ) : (
        <>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'debug_pitch_samples')}: {summary.samples.length}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'debug_pitch_median_note')}: {summary.medianNote ?? 'n/a'}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'debug_pitch_median_hz')}: {formatHz(summary.medianHz)}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'debug_pitch_spread_hz')}: {formatHz(summary.spreadHz)}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
            {summary.topNotes.slice(0, 4).map((entry) => (
              <View
                key={`${entry.note}-${entry.count}`}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  backgroundColor: colors.surface,
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{entry.note} ({entry.count})</Text>
              </View>
            ))}
          </View>
        </>
      )}
      {statusMessage ? (
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{statusMessage}</Text>
      ) : null}
    </View>
  );
}

type PitchSamplesTableProps = {
  rows: SingleDetectorRow[];
  slotSummaryByNr: Map<number, SlotDetectorSummary>;
  activeReplaySlotNr: number | null;
  keyPrefix: string;
  col3Header: TranslationKey;
  col4Header: TranslationKey;
  renderCol4: (row: SingleDetectorRow) => string;
  locale: 'de' | 'en';
};

function PitchSamplesTable({ rows, slotSummaryByNr, activeReplaySlotNr, keyPrefix, col3Header, col4Header, renderCol4, locale }: PitchSamplesTableProps) {
  const colors = useThemeColors();
  return (
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
      <View style={{ minWidth: 520 }}>
        <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
          <Text style={{ color: colors.textMuted, fontWeight: '600', width: 86 }}>{t(locale, 'debug_pitch_time_ms')}</Text>
          <Text style={{ color: colors.textMuted, fontWeight: '600', width: 64 }}>{t(locale, 'debug_compare_slot_nr')}</Text>
          <Text style={{ color: colors.textMuted, fontWeight: '600', width: 150 }}>{t(locale, col3Header)}</Text>
          <Text style={{ color: colors.textMuted, fontWeight: '600', flex: 1 }}>{t(locale, col4Header)}</Text>
        </View>
        <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
          {rows.map((row, index) => {
            const nextRow = rows[index + 1] ?? null;
            const slotFinished = row.slotNr != null && nextRow?.slotNr !== row.slotNr;
            const slotSummary = row.slotNr != null ? slotSummaryByNr.get(row.slotNr) ?? null : null;
            return (
              <React.Fragment key={`${keyPrefix}${row.timeMs}-${index}`}>
                <View
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 5,
                    borderBottomWidth: 1,
                    borderBottomColor: activeReplaySlotNr != null && row.slotNr === activeReplaySlotNr ? colors.borderBlue : colors.border,
                    backgroundColor: activeReplaySlotNr != null && row.slotNr === activeReplaySlotNr ? colors.surfaceInfo : 'transparent',
                  }}
                >
                  <Text style={{ color: colors.textSecondary, width: 86, fontSize: 12 }}>{formatMs(row.timeMs)}</Text>
                  <Text style={{ color: colors.textSecondary, width: 64, fontSize: 12 }}>{row.slotNr ?? 'n/a'}</Text>
                  <Text style={{ color: colors.textSecondary, width: 150, fontSize: 12 }}>
                    {`${row.sample.note} • ${formatHz(row.sample.frequency)}`}
                  </Text>
                  <Text style={{ color: colors.textSecondary, flex: 1, fontSize: 12 }}>{renderCol4(row)}</Text>
                </View>
                {slotFinished && slotSummary ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      paddingVertical: 6,
                      backgroundColor: colors.surfaceNeutral,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderLight,
                    }}
                  >
                    <Text style={{ color: colors.primaryStrong, width: 86, fontSize: 12, fontWeight: '700' }}>slot total</Text>
                    <Text style={{ color: colors.primaryStrong, width: 64, fontSize: 12, fontWeight: '700' }}>{row.slotNr}</Text>
                    <Text style={{ color: colors.textPrimary, width: 150, fontSize: 12 }}>
                      median: {slotSummary.medianNote ?? 'n/a'} • {formatHz(slotSummary.medianHz)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, flex: 1, fontSize: 12 }}>
                      counts: {slotSummary.noteCountsLabel}
                    </Text>
                  </View>
                ) : null}
              </React.Fragment>
            );
          })}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

export default function DebugScreen() {
  const colors = useThemeColors();
  const settings = useAppStore((s) => s.settings);
  const locale = settings.locale;
  const melodyBpm = useAppStore((s) => s.melodyBpm);
  const setMelodyBpm = useAppStore((s) => s.setMelodyBpm);

  const pitchPortRef = React.useRef<ExpoPitchCapturePort | null>(null);
  const serviceRef = React.useRef<SessionService | null>(null);
  if (!pitchPortRef.current) {
    pitchPortRef.current = new ExpoPitchCapturePort();
  }
  if (!serviceRef.current) {
    serviceRef.current = new SessionService(
      new AsyncStoragePort(),
      new ExpoAudioPromptPort(),
      pitchPortRef.current,
    );
  }
  const service = serviceRef.current;

  const enabledClefs = React.useMemo<Clef[]>(() => {
    if (settings.enabledClefs.length > 0) return settings.enabledClefs;
    return ['treble', 'bass'];
  }, [settings.enabledClefs]);

  const [events, setEvents] = React.useState<PitchCaptureDebugSnapshot[]>([]);
  const [latestState, setLatestState] = React.useState<PitchDebugState>(INITIAL_PITCH_DEBUG_STATE);
  const [serviceReady, setServiceReady] = React.useState(false);
  const [serviceError, setServiceError] = React.useState<string | null>(null);
  const [melodyClef, setMelodyClef] = React.useState<Clef>(settings.defaultClef);
  const [melodyLevel, setMelodyLevel] = React.useState(2);
  const [melodyExercise, setMelodyExercise] = React.useState<Exercise | null>(null);
  const [melodyFeedback, setMelodyFeedback] = React.useState({ text: '', isCorrect: false });
  const [melodyNoteResults, setMelodyNoteResults] = React.useState<MelodyNoteResult[]>([]);
  const [melodyCountInBeat, setMelodyCountInBeat] = React.useState<number | null>(null);
  const [melodyRecordingProgress, setMelodyRecordingProgress] = React.useState<number | null>(null);
  const [singingNoteIndex, setSingingNoteIndex] = React.useState<number | null>(null);
  const [loadingPlay, setLoadingPlay] = React.useState(false);
  const [loadingCapture, setLoadingCapture] = React.useState(false);
  const [loadingStop, setLoadingStop] = React.useState(false);
  const [replayStatus, setReplayStatus] = React.useState<AudioStatus | null>(null);
  const [replayError, setReplayError] = React.useState<string | null>(null);
  const [wavTimeline, setWavTimeline] = React.useState<Array<{ timeMs: number; frequency: number }>>([]);
  const [wavAnalysisLoading, setWavAnalysisLoading] = React.useState(false);
  const [wavAnalysisError, setWavAnalysisError] = React.useState<string | null>(null);
  const captureRunIdRef = React.useRef(0);
  const recordingProgressIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const replayPlayerRef = React.useRef<AudioPlayer | null>(null);
  const replayPlayerUriRef = React.useRef<string | null>(null);
  const replayStatusSubRef = React.useRef<{ remove: () => void } | null>(null);
  const wavAnalysisRunRef = React.useRef(0);

  const disposeReplayPlayer = React.useCallback(() => {
    replayStatusSubRef.current?.remove();
    replayStatusSubRef.current = null;
    const player = replayPlayerRef.current;
    replayPlayerRef.current = null;
    replayPlayerUriRef.current = null;
    if (player) {
      try {
        player.pause();
      } catch (error) {
        console.log('[debug:replay] pause failed during cleanup', error);
      }
      try {
        player.remove();
      } catch (error) {
        console.log('[debug:replay] remove failed during cleanup', error);
      }
    }
  }, []);

  const stopReplay = React.useCallback(() => {
    const player = replayPlayerRef.current;
    if (player) {
      try {
        player.pause();
      } catch (error) {
        console.log('[debug:replay] pause failed', error);
      }
    }
    setReplayStatus((previous) => (previous ? { ...previous, playing: false } : previous));
  }, []);
  React.useEffect(() => {
    let active = true;

    service.setPitchDebugListener((snapshot) => {
      if (!active) return;
      const typed = snapshot as PitchCaptureDebugSnapshot;
      setLatestState((previous) => mergePitchDebugState(previous, typed));
      setEvents((previous) => [...previous, typed].slice(-MAX_PITCH_DEBUG_EVENTS));
    });

    void service.init()
      .then(() => {
        if (!active) return;
        setServiceReady(true);
        setServiceError(null);
      })
      .catch((error) => {
        if (!active) return;
        console.error('[debug:init] service failed to initialize', error);
        setServiceError(error instanceof Error && error.message ? error.message : 'Debug service failed to initialize.');
      });

    return () => {
      active = false;
      captureRunIdRef.current += 1;
      if (recordingProgressIntervalRef.current) {
        clearInterval(recordingProgressIntervalRef.current);
        recordingProgressIntervalRef.current = null;
      }
      service.setPitchDebugListener(null);
      void service.stopPrompt();
      void service.stopCapture();
      disposeReplayPlayer();
    };
  }, [disposeReplayPlayer, service]);

  React.useEffect(() => {
    const fallbackClef = enabledClefs.includes(settings.defaultClef)
      ? settings.defaultClef
      : enabledClefs[0] ?? 'treble';
    if (!enabledClefs.includes(melodyClef)) {
      setMelodyClef(fallbackClef);
    }
  }, [enabledClefs, melodyClef, settings.defaultClef]);

  const initMelodyExercise = React.useCallback(() => {
    if (!serviceReady) return;
    setMelodyExercise(service.createMelodyExercise({
      clef: melodyClef,
      level: melodyLevel,
      melodyOptions: DEFAULT_MELODY_OPTIONS,
    }));
    setMelodyFeedback({ text: '', isCorrect: false });
    setMelodyNoteResults([]);
    setMelodyCountInBeat(null);
    setMelodyRecordingProgress(null);
    setSingingNoteIndex(null);
  }, [melodyClef, melodyLevel, service, serviceReady]);

  React.useEffect(() => {
    initMelodyExercise();
  }, [initMelodyExercise]);

  const clearPitchDebugEvents = React.useCallback(() => {
    setEvents([]);
    setLatestState({ ...INITIAL_PITCH_DEBUG_STATE });
  }, []);

  const stopActiveMedia = React.useCallback(async () => {
    captureRunIdRef.current += 1;
    if (recordingProgressIntervalRef.current) {
      clearInterval(recordingProgressIntervalRef.current);
      recordingProgressIntervalRef.current = null;
    }

    setLoadingStop(true);
    setLoadingPlay(false);
    setLoadingCapture(false);
    setMelodyCountInBeat(null);
    setMelodyRecordingProgress(null);
    setSingingNoteIndex(null);
    stopReplay();

    try {
      await Promise.all([service.stopPrompt(), service.stopCapture()]);
    } finally {
      setLoadingStop(false);
    }
  }, [service, stopReplay]);

  const playMelodyPrompt = React.useCallback(async () => {
    if (!melodyExercise || loadingPlay || loadingCapture) return;
    setLoadingPlay(true);
    try {
      await service.playMelodyExerciseWithTiming(melodyExercise, melodyBpm);
    } finally {
      setLoadingPlay(false);
    }
  }, [loadingCapture, loadingPlay, melodyBpm, melodyExercise, service]);

  const regenerateMelody = React.useCallback(() => {
    initMelodyExercise();
  }, [initMelodyExercise]);

  const auditMelodyNote = React.useCallback(async (note: string) => {
    await service.auditNote(note);
  }, [service]);

  const captureMelodyAttempt = React.useCallback(async () => {
    if (!melodyExercise || loadingCapture) return;

    captureRunIdRef.current += 1;
    const runId = captureRunIdRef.current;
    if (recordingProgressIntervalRef.current) {
      clearInterval(recordingProgressIntervalRef.current);
      recordingProgressIntervalRef.current = null;
    }

    setLoadingCapture(true);
    disposeReplayPlayer();
    setReplayStatus(null);
    setReplayError(null);
    setMelodyFeedback({ text: '', isCorrect: false });
    setMelodyNoteResults([]);
    setMelodyCountInBeat(null);
    setMelodyRecordingProgress(null);
    setSingingNoteIndex(null);
    setLatestState({
      ...INITIAL_PITCH_DEBUG_STATE,
      timestampMs: Date.now(),
      message: 'capture_requested',
    });

    const beats = totalMelodyBeats(melodyExercise);
    const timing = buildMelodyTimingModel(melodyBpm, beats);
    const visualDurationMs = beats * timing.noteDurationMs;

    try {
      const outcome = await service.captureMelodyExerciseAttempt(melodyExercise, {
        bpm: melodyBpm,
        onRecordingStarted: () => {
          if (captureRunIdRef.current !== runId) return;
          const recordingStartedAt = Date.now();
          setMelodyRecordingProgress(0);
          recordingProgressIntervalRef.current = setInterval(() => {
            if (captureRunIdRef.current !== runId) return;
            const elapsed = Date.now() - recordingStartedAt;
            const progress = Math.max(0, Math.min(1, elapsed / visualDurationMs));
            setMelodyRecordingProgress(progress);
            if (progress >= 1 && recordingProgressIntervalRef.current) {
              clearInterval(recordingProgressIntervalRef.current);
              recordingProgressIntervalRef.current = null;
            }
          }, 50);
        },
        onCountInBeat: (beat) => {
          if (captureRunIdRef.current !== runId) return;
          setMelodyCountInBeat(beat);
        },
        onNoteIndex: (index) => {
          if (captureRunIdRef.current !== runId) return;
          setSingingNoteIndex(index);
          setMelodyCountInBeat(null);
        },
      });

      if (captureRunIdRef.current !== runId || !outcome) return;

      setMelodyFeedback({
        text: outcome.feedback,
        isCorrect: outcome.evaluation.correct,
      });
      setMelodyNoteResults(outcome.noteResults);
    } catch (error) {
      console.error('[debug:capture] melody capture failed', error);
      if (captureRunIdRef.current !== runId) return;
      setMelodyFeedback({
        text: error instanceof Error && error.message ? error.message : 'Aufnahme fehlgeschlagen.',
        isCorrect: false,
      });
    } finally {
      if (captureRunIdRef.current !== runId) return;
      if (recordingProgressIntervalRef.current) {
        clearInterval(recordingProgressIntervalRef.current);
        recordingProgressIntervalRef.current = null;
      }
      setLoadingCapture(false);
      setMelodyCountInBeat(null);
      setMelodyRecordingProgress(null);
      setSingingNoteIndex(null);
    }
  }, [disposeReplayPlayer, loadingCapture, melodyBpm, melodyExercise, service]);

  const captureEvents = getLatestCaptureEvents(events);
  const recordedTake = getLatestRecordedTake(captureEvents);
  const studioSummary = buildCaptureSummary(captureEvents);
  const liveRows = buildSingleDetectorRows(
    studioSummary?.samples ?? [],
    (timeMs) => resolveMelodySlotNr(melodyExercise, melodyBpm, timeMs),
  );
  const liveSlotSummaries = buildSingleDetectorSlotSummaries(liveRows);
  const liveSlotSummaryByNr = new Map(liveSlotSummaries.map((entry) => [entry.slotNr, entry.summary]));
  const studioStatusMessage = latestCaptureMessage(captureEvents);
  const replayTimeSeconds = replayStatus?.currentTime ?? 0;
  const replayDurationSeconds = replayStatus?.duration
    ?? (recordedTake?.durationMillis != null ? recordedTake.durationMillis / 1000 : 0);
  const activeReplaySlotNr = recordedTake
    ? resolveMelodySlotNr(melodyExercise, melodyBpm, replayTimeSeconds * 1000)
    : null;
  const activeReplayResult = activeReplaySlotNr != null ? melodyNoteResults[activeReplaySlotNr - 1] ?? null : null;
  const activeLiveSlotSummary = activeReplaySlotNr != null ? liveSlotSummaryByNr.get(activeReplaySlotNr) ?? null : null;
  const melodyNotes = getMelodyNoteObjects(melodyExercise);
  const activeReplayTarget = activeReplaySlotNr != null ? melodyNotes[activeReplaySlotNr - 1]?.pitch ?? null : null;
  const chartSamples = wavTimeline.length > 0 ? wavTimeline : (studioSummary?.samples ?? []);
  const chartDurationMs = replayDurationSeconds > 0
    ? replayDurationSeconds * 1000
    : (recordedTake?.durationMillis ?? 0);
  const wavSamples: CaptureSample[] = wavTimeline.map((point) => ({
    timeMs: point.timeMs,
    frequency: point.frequency,
    note: toNoteName(point.frequency),
  }));
  const wavRows = buildSingleDetectorRows(
    wavSamples,
    (timeMs) => resolveMelodySlotNr(melodyExercise, melodyBpm, timeMs),
  );
  const wavSlotSummaries = buildSingleDetectorSlotSummaries(wavRows);
  const wavSlotSummaryByNr = new Map(wavSlotSummaries.map((entry) => [entry.slotNr, entry.summary]));

  React.useEffect(() => {
    if (!recordedTake?.uri) {
      disposeReplayPlayer();
      setReplayStatus(null);
      setReplayError(null);
      return;
    }

    if (
      replayPlayerUriRef.current
      && (
        replayPlayerUriRef.current !== recordedTake.uri
        || recordedTake.timestampMs != null
      )
    ) {
      disposeReplayPlayer();
      setReplayStatus(null);
    }
  }, [disposeReplayPlayer, recordedTake?.timestampMs, recordedTake?.uri]);

  React.useEffect(() => {
    wavAnalysisRunRef.current += 1;
    setWavTimeline([]);
    setWavAnalysisLoading(false);
    setWavAnalysisError(null);
  }, [recordedTake?.timestampMs, recordedTake?.uri]);

  const reprocessRecordedTake = React.useCallback(() => {
    const port = pitchPortRef.current;
    if (!recordedTake?.uri || !port) return;

    wavAnalysisRunRef.current += 1;
    const runId = wavAnalysisRunRef.current;
    setWavTimeline([]);
    setWavAnalysisLoading(true);
    setWavAnalysisError(null);

    void port.analyzeWavPitch(recordedTake.uri, 80)
      .then((timeline) => {
        if (wavAnalysisRunRef.current !== runId) return;
        setWavTimeline(timeline);
      })
      .catch((error) => {
        console.error('[debug:wav] WAV pitch analysis failed', error);
        if (wavAnalysisRunRef.current !== runId) return;
        setWavAnalysisError(error instanceof Error && error.message ? error.message : 'WAV pitch analysis failed.');
      })
      .finally(() => {
        if (wavAnalysisRunRef.current !== runId) return;
        setWavAnalysisLoading(false);
      });
  }, [recordedTake?.uri]);

  const playRecordedTake = React.useCallback(async (restart = false) => {
    if (!recordedTake?.uri) return;

    setReplayError(null);
    await service.stopPrompt();
    await service.stopCapture();

    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
        interruptionMode: 'duckOthers',
      });
    } catch (error) {
      console.log('[debug:replay] failed to set playback audio mode', error);
    }

    let player = replayPlayerRef.current;
    if (!player || replayPlayerUriRef.current !== recordedTake.uri) {
      disposeReplayPlayer();
      player = createAudioPlayer({ uri: recordedTake.uri }, { updateInterval: 100 });
      replayPlayerRef.current = player;
      replayPlayerUriRef.current = recordedTake.uri;
      replayStatusSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
        setReplayStatus(status);
      });
    }

    try {
      if (restart || (replayStatus?.didJustFinish ?? false)) {
        await player.seekTo(0);
      }
      player.play();
    } catch (error) {
      console.error('[debug:replay] failed to play recorded take', error);
      setReplayError(error instanceof Error && error.message ? error.message : 'Replay failed.');
    }
  }, [disposeReplayPlayer, recordedTake?.uri, replayStatus?.didJustFinish, service]);

  if (!__DEV__) {
    return (
      <Screen>
        <Card>
          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Debug disabled in production builds.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={{ backgroundColor: colors.surfaceInfo, borderColor: colors.borderBlue }}>
        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 18 }}>{t(locale, 'debug_melody_title')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t(locale, 'debug_melody_hint')}</Text>

        {serviceError ? (
          <Text style={{ color: colors.danger, fontWeight: '700' }}>{serviceError}</Text>
        ) : null}

        {!serviceReady || !melodyExercise ? (
          <View style={{ minHeight: 120, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primaryStrong} />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
              <View style={{ flex: 1, minWidth: 180, gap: 6 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>{t(locale, 'clef')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {enabledClefs.map((clef) => {
                    const active = melodyClef === clef;
                    return (
                      <Pressable
                        key={clef}
                        style={{
                          borderWidth: 1,
                          borderColor: active ? colors.toggleActiveBorder : colors.borderLight,
                          backgroundColor: active ? colors.toggleActiveBg : colors.surface,
                          borderRadius: 999,
                          minHeight: 40,
                          paddingHorizontal: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: loadingCapture ? 0.45 : 1,
                        }}
                        onPress={() => setMelodyClef(clef)}
                        disabled={loadingCapture}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={{ color: active ? colors.primaryStrong : colors.textSecondary, fontWeight: active ? '700' : '500' }}>
                          {t(locale, clef)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ flex: 1, minWidth: 180 }}>
                <Stepper
                  label={t(locale, 'level')}
                  value={melodyLevel}
                  min={1}
                  max={5}
                  onChange={setMelodyLevel}
                  disabled={loadingCapture}
                />
              </View>
            </View>

            <MelodyTrainerPanel
              exercise={melodyExercise}
              locale={locale}
              bpm={melodyBpm}
              countInBeat={melodyCountInBeat}
              noteResults={melodyNoteResults}
              recordingProgress={melodyRecordingProgress}
              singingNoteIndex={singingNoteIndex}
              feedback={melodyFeedback}
              loadingPlay={loadingPlay}
              loadingCapture={loadingCapture}
              loadingStop={loadingStop}
              onPlay={() => void playMelodyPrompt()}
              onRecord={() => void captureMelodyAttempt()}
              onStop={() => void stopActiveMedia()}
              onRegenerate={regenerateMelody}
              onTapNote={(note) => void auditMelodyNote(note)}
              onChangeBpm={setMelodyBpm}
            />

            <View
              style={{
                borderWidth: 1,
                borderColor: colors.borderLight,
                borderRadius: 12,
                backgroundColor: colors.surfaceNeutral,
                padding: 12,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{t(locale, 'debug_melody_replay_title')}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t(locale, 'debug_melody_replay_hint')}</Text>

              {!recordedTake ? (
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t(locale, 'debug_melody_replay_unavailable')}</Text>
              ) : (
                <>
                  {chartSamples.length > 0 ? (
                    <PitchTimelineChart
                      samples={chartSamples}
                      durationMs={chartDurationMs}
                      playbackMs={replayTimeSeconds * 1000}
                    />
                  ) : wavAnalysisLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                      <ActivityIndicator size="small" color={colors.primaryStrong} />
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Analysiere WAV…</Text>
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Pressable
                      onPress={() => void playRecordedTake(replayStatus?.currentTime ? true : false)}
                      disabled={loadingCapture}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.borderBlue,
                        backgroundColor: colors.surfaceInfo,
                        borderRadius: 999,
                        minHeight: 38,
                        paddingHorizontal: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: loadingCapture ? 0.45 : 1,
                      }}
                    >
                      <Text style={{ color: colors.primaryStrong, fontWeight: '700' }}>
                        {replayStatus?.currentTime ? t(locale, 'debug_melody_replay_restart') : t(locale, 'debug_melody_replay_play')}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={stopReplay}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        borderRadius: 999,
                        minHeight: 38,
                        paddingHorizontal: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t(locale, 'debug_melody_replay_stop')}</Text>
                    </Pressable>

                    <Pressable
                      onPress={reprocessRecordedTake}
                      disabled={wavAnalysisLoading}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.borderBlue,
                        backgroundColor: colors.surfaceInfo,
                        borderRadius: 999,
                        minHeight: 38,
                        paddingHorizontal: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: wavAnalysisLoading ? 0.45 : 1,
                      }}
                    >
                      <Text style={{ color: colors.primaryStrong, fontWeight: '700' }}>{t(locale, 'debug_melody_replay_reprocess')}</Text>
                    </Pressable>
                  </View>

                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: activeReplaySlotNr != null ? colors.borderBlue : colors.borderLight,
                      backgroundColor: activeReplaySlotNr != null ? colors.surfaceInfo : colors.surface,
                      borderRadius: 10,
                      padding: 12,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                      {t(locale, 'debug_melody_replay_position')}: {formatClockTime(replayTimeSeconds)} / {formatClockTime(replayDurationSeconds)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {t(locale, 'debug_melody_replay_slot')}: {activeReplaySlotNr ?? 'n/a'}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {t(locale, 'debug_melody_replay_target')}: {activeReplayTarget ?? 'n/a'}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {t(locale, 'debug_melody_replay_detected_current')}: {formatDetectedMidi(activeReplayResult)}
                    </Text>
                    {activeLiveSlotSummary ? (
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {t(locale, 'debug_melody_replay_slot_summary')}: {activeLiveSlotSummary.modeNote ?? 'n/a'} ({activeLiveSlotSummary.noteCountsLabel})
                      </Text>
                    ) : null}
                    {activeReplaySlotNr != null && wavSlotSummaryByNr.get(activeReplaySlotNr) ? (
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {t(locale, 'debug_wav_analysis_detector')}: {wavSlotSummaryByNr.get(activeReplaySlotNr)?.medianNote ?? 'n/a'} ({wavSlotSummaryByNr.get(activeReplaySlotNr)?.noteCountsLabel ?? 'n/a'})
                      </Text>
                    ) : null}
                    {replayError ? (
                      <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>{replayError}</Text>
                    ) : null}
                    {wavAnalysisError ? (
                      <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>{wavAnalysisError}</Text>
                    ) : null}
                  </View>
                </>
              )}
            </View>

            {melodyNoteResults.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{t(locale, 'debug_melody_detection_title')}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t(locale, 'debug_melody_detection_hint')}</Text>

                <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
                  <View style={{ minWidth: 420, gap: 6 }}>
                    <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 36 }}>#</Text>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 72 }}>{t(locale, 'debug_melody_target')}</Text>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 118 }}>{t(locale, 'debug_melody_detected')}</Text>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 72 }}>{t(locale, 'debug_melody_delta')}</Text>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 74 }}>{t(locale, 'debug_melody_score')}</Text>
                    </View>

                    {melodyNoteResults.map((result) => (
                      <View
                        key={result.noteIndex}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: activeReplaySlotNr === result.noteIndex + 1 ? colors.borderBlue : colors.border,
                          backgroundColor: activeReplaySlotNr === result.noteIndex + 1
                            ? colors.surfaceInfo
                            : result.correct ? colors.noteResultOkBg : colors.noteResultBadBg,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          borderWidth: activeReplaySlotNr === result.noteIndex + 1 ? 1 : 0,
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, width: 36, fontWeight: '700' }}>{result.noteIndex + 1}</Text>
                        <Text style={{ color: colors.textSecondary, width: 72 }}>{midiToScientific(result.targetMidi)}</Text>
                        <Text style={{ color: colors.textSecondary, width: 118 }}>{formatDetectedMidi(result)}</Text>
                        <Text style={{ color: result.correct ? colors.success : colors.danger, width: 72, fontWeight: '700' }}>{formatSignedCents(result)}</Text>
                        <Text style={{ color: colors.textPrimary, width: 74, fontWeight: '700' }}>{Math.round(result.score * 100)}%</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            {wavRows.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{t(locale, 'debug_wav_analysis_title')}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t(locale, 'debug_wav_analysis_hint')}</Text>
                <PitchSamplesTable
                  rows={wavRows}
                  slotSummaryByNr={wavSlotSummaryByNr}
                  activeReplaySlotNr={activeReplaySlotNr}
                  keyPrefix="wav-"
                  col3Header="debug_wav_analysis_detector"
                  col4Header="debug_melody_target"
                  renderCol4={(row) => (row.slotNr != null ? melodyNotes[row.slotNr - 1]?.pitch ?? 'n/a' : 'n/a')}
                  locale={locale}
                />
              </View>
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 18 }}>{t(locale, 'debug_pitch_title')}</Text>
          <Pressable
            onPress={clearPitchDebugEvents}
            style={{
              backgroundColor: colors.surfaceInfo,
              borderColor: colors.borderBlue,
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 10,
              minHeight: 36,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.primaryStrong, fontWeight: '700' }}>{t(locale, 'debug_pitch_clear')}</Text>
          </Pressable>
        </View>

        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t(locale, 'debug_pitch_hint')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {t(locale, 'debug_pitch_events')}: {events.length} | {t(locale, 'mic_debug_phase')}: {latestState.phase}
        </Text>

        {!captureEvents ? (
          <Text style={{ color: colors.textSecondary }}>{t(locale, 'debug_pitch_no_capture')}</Text>
        ) : (
          <>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 6 }}>{t(locale, 'debug_pitch_latest')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <SummaryBlock locale={locale} summary={studioSummary} statusMessage={studioStatusMessage} />
            </View>

            <Text style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 8 }}>{t(locale, 'debug_compare_samples_title')}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t(locale, 'debug_compare_samples_hint')}</Text>
            <PitchSamplesTable
              rows={liveRows}
              slotSummaryByNr={liveSlotSummaryByNr}
              activeReplaySlotNr={activeReplaySlotNr}
              keyPrefix=""
              col3Header="debug_compare_experimental"
              col4Header="debug_pitch_frequency"
              renderCol4={(row) => formatHz(row.sample.frequency)}
              locale={locale}
            />
          </>
        )}
      </Card>
    </Screen>
  );
}

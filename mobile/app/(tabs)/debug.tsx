import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { ExpoAudioPromptPort } from '../../src/adapters/audio/expo-audio-prompt-port';
import { ExpoPitchCapturePort, type PitchCaptureDebugSnapshot } from '../../src/adapters/pitch/expo-pitch-capture-port';
import { AsyncStoragePort } from '../../src/adapters/storage/async-storage-port';
import { DEFAULT_MELODY_OPTIONS } from '../../src/core/domain/exercise-generator';
import { t } from '../../src/core/i18n/translator';
import {
  buildMelodyTimingModel,
  computeMelodyNoteResults,
  SessionService,
  type MelodyNoteResult,
} from '../../src/core/services/session-service';
import type { Clef, Exercise, MelodyNote, NoteType } from '../../src/core/types';
import { midiToScientific } from '../../src/core/utils/note-helpers';
import { noteFromPitch } from '../../src/core/utils/pitch';
import { useAppStore } from '../../src/state/use-app-store';
import { Card } from '../../src/ui/components/Card';
import { MelodyTrainerPanel } from '../../src/ui/components/MelodyTrainerPanel';
import { Screen } from '../../src/ui/components/Screen';
import { Stepper } from '../../src/ui/components/Stepper';
import { useThemeColors } from '../../src/ui/hooks/use-theme-colors';

type DetectorSource = 'autocorrelation' | 'studio_pitch';

type CaptureSample = {
  timeMs: number;
  frequency: number;
  note: string;
  detector: DetectorSource;
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

type ComparisonRow = {
  timeMs: number;
  slotNr: number | null;
  auto: CaptureSample | null;
  studio: CaptureSample | null;
};

type SlotDetectorSummary = {
  medianHz: number | null;
  medianNote: string | null;
  modeNote: string | null;
  noteCountsLabel: string;
};

type SlotSummary = {
  slotNr: number;
  auto: SlotDetectorSummary;
  studio: SlotDetectorSummary;
};

type MelodyTimeline = {
  anchorsMs: number[];
  bucketMs: number;
};

type RecordedTake = {
  uri: string;
  durationMillis: number | null;
};

type PitchDebugState = {
  phase: PitchCaptureDebugSnapshot['phase'];
  timestampMs: number | null;
  durationMillis: number;
  metering: number | null;
  frequency: number | null;
  sampleTimeMs: number | null;
  timelinePoints: number;
  uri: string | null;
  message: string;
};

const MAX_PITCH_DEBUG_EVENTS = 2500;
const INITIAL_PITCH_DEBUG_STATE: PitchDebugState = {
  phase: 'idle',
  timestampMs: null,
  durationMillis: 0,
  metering: null,
  frequency: null,
  sampleTimeMs: null,
  timelinePoints: 0,
  uri: null,
  message: '',
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function mergePitchDebugState(previous: PitchDebugState, snapshot: PitchCaptureDebugSnapshot): PitchDebugState {
  const next: PitchDebugState = {
    ...previous,
    phase: snapshot.phase,
    timestampMs: snapshot.timestampMs,
  };

  if (snapshot.durationMillis !== undefined) next.durationMillis = snapshot.durationMillis;
  if (snapshot.metering !== undefined) next.metering = snapshot.metering;
  if (snapshot.frequency !== undefined) next.frequency = snapshot.frequency;
  if (snapshot.sampleTimeMs !== undefined) next.sampleTimeMs = snapshot.sampleTimeMs;
  if (snapshot.timelinePoints !== undefined) next.timelinePoints = snapshot.timelinePoints;
  if (snapshot.uri !== undefined) next.uri = snapshot.uri;
  if (snapshot.message !== undefined) next.message = snapshot.message;

  return next;
}

function detectorFromEvent(event: PitchCaptureDebugSnapshot): DetectorSource {
  return event.detector === 'studio_pitch' ? 'studio_pitch' : 'autocorrelation';
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
    };
  }
  return null;
}

function buildCaptureSummary(captureEvents: PitchCaptureDebugSnapshot[] | null, detector: DetectorSource): CaptureSummary | null {
  if (!captureEvents) return null;

  const samples: CaptureSample[] = captureEvents
    .filter((event) => event.phase === 'analysis_sample' && Number.isFinite(event.frequency) && detectorFromEvent(event) === detector)
    .map((event) => ({
      timeMs: Number(event.sampleTimeMs ?? 0),
      frequency: Number(event.frequency),
      note: toNoteName(Number(event.frequency)),
      detector,
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

function buildComparisonRows(
  autoSamples: CaptureSample[],
  studioSamples: CaptureSample[],
  timeline?: MelodyTimeline | null,
  slotResolver?: (timeMs: number) => number | null,
): ComparisonRow[] {
  if (autoSamples.length === 0 && studioSamples.length === 0 && (!timeline || timeline.anchorsMs.length === 0)) return [];

  const findClosestUnused = (
    samples: CaptureSample[],
    used: Set<number>,
    targetTimeMs: number,
    maxDistanceMs: number,
  ): number => {
    let bestIndex = -1;
    let bestDelta = Number.POSITIVE_INFINITY;

    samples.forEach((candidate, index) => {
      if (used.has(index)) return;
      const delta = Math.abs(candidate.timeMs - targetTimeMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIndex = index;
      }
    });

    return bestIndex >= 0 && bestDelta <= maxDistanceMs ? bestIndex : -1;
  };

  const usedAuto = new Set<number>();
  const usedStudio = new Set<number>();
  const rows: ComparisonRow[] = [];

  if (timeline && timeline.anchorsMs.length > 0) {
    const maxDistanceMs = Math.max(120, Math.round(timeline.bucketMs * 0.65));
    timeline.anchorsMs.forEach((timeMs) => {
      const autoIndex = findClosestUnused(autoSamples, usedAuto, timeMs, maxDistanceMs);
      const studioIndex = findClosestUnused(studioSamples, usedStudio, timeMs, maxDistanceMs);
      if (autoIndex >= 0) usedAuto.add(autoIndex);
      if (studioIndex >= 0) usedStudio.add(studioIndex);

      rows.push({
        timeMs,
        slotNr: slotResolver ? slotResolver(timeMs) : null,
        auto: autoIndex >= 0 ? autoSamples[autoIndex] ?? null : null,
        studio: studioIndex >= 0 ? studioSamples[studioIndex] ?? null : null,
      });
    });
  } else {
    autoSamples.forEach((sample, sampleIdx) => {
      let bestIndex = -1;
      let bestDelta = Number.POSITIVE_INFINITY;

      studioSamples.forEach((candidate, index) => {
        if (usedStudio.has(index)) return;
        const delta = Math.abs(candidate.timeMs - sample.timeMs);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestIndex = index;
        }
      });

      const studio = bestIndex >= 0 && bestDelta <= 240 ? studioSamples[bestIndex] : null;
      if (bestIndex >= 0 && studio) {
        usedStudio.add(bestIndex);
      }

      usedAuto.add(sampleIdx);
      rows.push({
        timeMs: sample.timeMs,
        slotNr: slotResolver ? slotResolver(sample.timeMs) : null,
        auto: sample,
        studio,
      });
    });
  }

  autoSamples.forEach((sample, index) => {
    if (usedAuto.has(index)) return;
    rows.push({
      timeMs: sample.timeMs,
      slotNr: slotResolver ? slotResolver(sample.timeMs) : null,
      auto: sample,
      studio: null,
    });
  });

  studioSamples.forEach((sample, index) => {
    if (usedStudio.has(index)) return;
    rows.push({
      timeMs: sample.timeMs,
      slotNr: slotResolver ? slotResolver(sample.timeMs) : null,
      auto: null,
      studio: sample,
    });
  });

  return rows.sort((a, b) => a.timeMs - b.timeMs).slice(-120);
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

function buildSlotSummaries(rows: ComparisonRow[]): SlotSummary[] {
  const grouped = new Map<number, { auto: CaptureSample[]; studio: CaptureSample[] }>();
  rows.forEach((row) => {
    if (!Number.isFinite(row.slotNr)) return;
    const slotNr = Number(row.slotNr);
    const existing = grouped.get(slotNr) ?? { auto: [], studio: [] };
    if (row.auto) existing.auto.push(row.auto);
    if (row.studio) existing.studio.push(row.studio);
    grouped.set(slotNr, existing);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([slotNr, samples]) => ({
      slotNr,
      auto: buildSlotDetectorSummary(samples.auto),
      studio: buildSlotDetectorSummary(samples.studio),
    }));
}

function latestDetectorMessage(
  captureEvents: PitchCaptureDebugSnapshot[] | null,
  detector: DetectorSource,
): string | null {
  if (!captureEvents) return null;
  for (let i = captureEvents.length - 1; i >= 0; i -= 1) {
    const event = captureEvents[i];
    const message = event.message ?? '';
    if (detectorFromEvent(event) === detector && message) return message;
    if (detector === 'studio_pitch' && message.startsWith('studio_pitch_')) return message;
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

function buildMelodyTimeline(exercise: Exercise | null, bpm: number): MelodyTimeline | null {
  if (!exercise || exercise.skillKey !== 'sing_melody') return null;

  const beats = totalMelodyBeats(exercise);
  const timing = buildMelodyTimingModel(bpm, beats);
  const bucketMs = Math.max(250, timing.segmentMs);
  const totalDurationMs = Math.max(bucketMs, timing.captureDurationMs);
  const bucketCount = Math.max(1, Math.ceil(totalDurationMs / bucketMs));

  const anchorsMs = Array.from({ length: bucketCount }, (_, index) => index * bucketMs);
  return { anchorsMs, bucketMs };
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

function normalizeDetectedMidis(targetCount: number, detectedMidis: number[]): number[] {
  if (targetCount <= 0 || detectedMidis.length === 0) return [];
  return Array.from({ length: targetCount }, (_, targetIdx) => {
    if (targetCount === 1) return detectedMidis[0];
    const ratio = targetIdx / (targetCount - 1);
    const sourceIdx = Math.round(ratio * (detectedMidis.length - 1));
    return detectedMidis[Math.max(0, Math.min(detectedMidis.length - 1, sourceIdx))];
  });
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

function summaryLabel(locale: 'de' | 'en', detector: DetectorSource): string {
  return detector === 'studio_pitch'
    ? t(locale, 'debug_compare_experimental')
    : t(locale, 'debug_compare_current');
}

function SummaryBlock({
  locale,
  detector,
  summary,
  statusMessage,
}: {
  locale: 'de' | 'en';
  detector: DetectorSource;
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
      <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{summaryLabel(locale, detector)}</Text>
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
                key={`${detector}-${entry.note}-${entry.count}`}
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
  const [experimentalMelodyNoteResults, setExperimentalMelodyNoteResults] = React.useState<MelodyNoteResult[]>([]);
  const [melodyCountInBeat, setMelodyCountInBeat] = React.useState<number | null>(null);
  const [melodyRecordingProgress, setMelodyRecordingProgress] = React.useState<number | null>(null);
  const [singingNoteIndex, setSingingNoteIndex] = React.useState<number | null>(null);
  const [loadingPlay, setLoadingPlay] = React.useState(false);
  const [loadingCapture, setLoadingCapture] = React.useState(false);
  const [loadingStop, setLoadingStop] = React.useState(false);
  const [replayStatus, setReplayStatus] = React.useState<AudioStatus | null>(null);
  const [replayError, setReplayError] = React.useState<string | null>(null);
  const captureRunIdRef = React.useRef(0);
  const recordingProgressIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const replayPlayerRef = React.useRef<AudioPlayer | null>(null);
  const replayPlayerUriRef = React.useRef<string | null>(null);
  const replayStatusSubRef = React.useRef<{ remove: () => void } | null>(null);

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

  React.useEffect(() => {
    if (!serviceReady) return;
    setMelodyExercise(service.createMelodyExercise({
      clef: melodyClef,
      level: melodyLevel,
      melodyOptions: DEFAULT_MELODY_OPTIONS,
    }));
    setMelodyFeedback({ text: '', isCorrect: false });
    setMelodyNoteResults([]);
    setExperimentalMelodyNoteResults([]);
    setMelodyCountInBeat(null);
    setMelodyRecordingProgress(null);
    setSingingNoteIndex(null);
  }, [melodyClef, melodyLevel, service, serviceReady]);

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
    if (!serviceReady) return;
    setMelodyExercise(service.createMelodyExercise({
      clef: melodyClef,
      level: melodyLevel,
      melodyOptions: DEFAULT_MELODY_OPTIONS,
    }));
    setMelodyFeedback({ text: '', isCorrect: false });
    setMelodyNoteResults([]);
    setExperimentalMelodyNoteResults([]);
    setMelodyCountInBeat(null);
    setMelodyRecordingProgress(null);
    setSingingNoteIndex(null);
  }, [melodyClef, melodyLevel, service, serviceReady]);

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
    setMelodyFeedback({ text: '', isCorrect: false });
    setMelodyNoteResults([]);
    setExperimentalMelodyNoteResults([]);
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

      const targetMidis = Array.isArray((melodyExercise.expectedAnswer as Record<string, unknown>).targetMidis)
        ? ((melodyExercise.expectedAnswer as Record<string, unknown>).targetMidis as number[]).filter((value) => Number.isFinite(value))
        : [];
      const experimentalDetectedMidisBySlot = Array.isArray((outcome.contour as Record<string, unknown> | null)?.experimentalDetectedMidisBySlot)
        ? (((outcome.contour as Record<string, unknown>).experimentalDetectedMidisBySlot as Array<number | null>)
          .map((value) => (Number.isFinite(value) ? Number(value) : null)))
        : [];
      const experimentalDetectedMidis = Array.isArray(outcome.contour?.experimentalDetectedMidis)
        ? (outcome.contour?.experimentalDetectedMidis as number[]).filter((value) => Number.isFinite(value))
        : [];
      const toleranceCents = Number(settings.pitchToleranceCentsByLevel?.[melodyExercise.level] ?? 50);
      if (targetMidis.length > 0 && experimentalDetectedMidisBySlot.length > 0) {
        setExperimentalMelodyNoteResults(
          computeMelodyNoteResults(
            targetMidis,
            experimentalDetectedMidisBySlot,
            toleranceCents,
          ),
        );
      } else if (targetMidis.length > 0 && experimentalDetectedMidis.length > 0) {
        setExperimentalMelodyNoteResults(
          computeMelodyNoteResults(
            targetMidis,
            normalizeDetectedMidis(targetMidis.length, experimentalDetectedMidis),
            toleranceCents,
          ),
        );
      }
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
  }, [loadingCapture, melodyBpm, melodyExercise, service, settings.pitchToleranceCentsByLevel]);

  const captureEvents = getLatestCaptureEvents(events);
  const recordedTake = getLatestRecordedTake(captureEvents);
  const autoSummary = buildCaptureSummary(captureEvents, 'autocorrelation');
  const studioSummary = buildCaptureSummary(captureEvents, 'studio_pitch');
  const melodyTimeline = buildMelodyTimeline(melodyExercise, melodyBpm);
  const comparisonRows = buildComparisonRows(
    autoSummary?.samples ?? [],
    studioSummary?.samples ?? [],
    melodyTimeline,
    (timeMs) => resolveMelodySlotNr(melodyExercise, melodyBpm, timeMs),
  );
  const slotSummaries = buildSlotSummaries(comparisonRows);
  const slotSummaryByNr = new Map(slotSummaries.map((summary) => [summary.slotNr, summary]));
  const autoStatusMessage = latestDetectorMessage(captureEvents, 'autocorrelation');
  const studioStatusMessage = latestDetectorMessage(captureEvents, 'studio_pitch');
  const replayTimeSeconds = replayStatus?.currentTime ?? 0;
  const replayDurationSeconds = replayStatus?.duration
    ?? (recordedTake?.durationMillis != null ? recordedTake.durationMillis / 1000 : 0);
  const activeReplaySlotNr = recordedTake
    ? resolveMelodySlotNr(melodyExercise, melodyBpm, replayTimeSeconds * 1000)
    : null;
  const activeReplayResult = activeReplaySlotNr != null ? melodyNoteResults[activeReplaySlotNr - 1] ?? null : null;
  const activeExperimentalReplayResult = activeReplaySlotNr != null ? experimentalMelodyNoteResults[activeReplaySlotNr - 1] ?? null : null;
  const activeReplaySlotSummary = activeReplaySlotNr != null ? slotSummaryByNr.get(activeReplaySlotNr) ?? null : null;
  const melodyNotes = getMelodyNoteObjects(melodyExercise);
  const activeReplayTarget = activeReplaySlotNr != null ? melodyNotes[activeReplaySlotNr - 1]?.pitch ?? null : null;

  React.useEffect(() => {
    if (!recordedTake?.uri) {
      disposeReplayPlayer();
      setReplayStatus(null);
      setReplayError(null);
      return;
    }

    if (replayPlayerUriRef.current && replayPlayerUriRef.current !== recordedTake.uri) {
      disposeReplayPlayer();
      setReplayStatus(null);
    }
  }, [disposeReplayPlayer, recordedTake?.uri]);

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
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {t(locale, 'debug_melody_replay_detected_experimental')}: {formatDetectedMidi(activeExperimentalReplayResult)}
                    </Text>
                    {activeReplaySlotSummary ? (
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {t(locale, 'debug_melody_replay_slot_summary')}: {summaryLabel(locale, 'autocorrelation')} {activeReplaySlotSummary.auto.modeNote ?? 'n/a'} | {summaryLabel(locale, 'studio_pitch')} {activeReplaySlotSummary.studio.modeNote ?? 'n/a'}
                      </Text>
                    ) : null}
                    {replayError ? (
                      <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>{replayError}</Text>
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
                  <View style={{ minWidth: 760, gap: 6 }}>
                    <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 36 }}>#</Text>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 72 }}>{t(locale, 'debug_melody_target')}</Text>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 118 }}>{t(locale, 'debug_compare_current')}</Text>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 72 }}>{t(locale, 'debug_melody_delta')}</Text>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 74 }}>{t(locale, 'debug_melody_score')}</Text>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 118 }}>{t(locale, 'debug_compare_experimental')}</Text>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 72 }}>{t(locale, 'debug_melody_delta')}</Text>
                      <Text style={{ color: colors.textMuted, fontWeight: '700', width: 74 }}>{t(locale, 'debug_melody_score')}</Text>
                    </View>

                    {melodyNoteResults.map((result, index) => {
                      const experimentalResult = experimentalMelodyNoteResults[index] ?? null;
                      return (
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
                          <Text style={{ color: colors.textSecondary, width: 118 }}>{formatDetectedMidi(experimentalResult)}</Text>
                          <Text style={{ color: experimentalResult?.correct ? colors.success : colors.danger, width: 72, fontWeight: '700' }}>
                            {experimentalResult ? formatSignedCents(experimentalResult) : 'n/a'}
                          </Text>
                          <Text style={{ color: colors.textPrimary, width: 74, fontWeight: '700' }}>
                            {experimentalResult ? `${Math.round(experimentalResult.score * 100)}%` : 'n/a'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>

                {experimentalMelodyNoteResults.length === 0 ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t(locale, 'debug_compare_unavailable')}</Text>
                ) : null}
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
              <SummaryBlock locale={locale} detector="autocorrelation" summary={autoSummary} statusMessage={autoStatusMessage} />
              <SummaryBlock locale={locale} detector="studio_pitch" summary={studioSummary} statusMessage={studioStatusMessage} />
            </View>

            <Text style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 8 }}>{t(locale, 'debug_compare_samples_title')}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t(locale, 'debug_compare_samples_hint')}</Text>
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: 640 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderLight,
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontWeight: '600', width: 86 }}>{t(locale, 'debug_pitch_time_ms')}</Text>
                  <Text style={{ color: colors.textMuted, fontWeight: '600', width: 64 }}>{t(locale, 'debug_compare_slot_nr')}</Text>
                  <Text style={{ color: colors.textMuted, fontWeight: '600', width: 114 }}>{t(locale, 'debug_compare_current')}</Text>
                  <Text style={{ color: colors.textMuted, fontWeight: '600', width: 120 }}>{t(locale, 'debug_compare_experimental')}</Text>
                  <Text style={{ color: colors.textMuted, fontWeight: '600', flex: 1 }}>{t(locale, 'debug_compare_delta_hz')}</Text>
                </View>
                <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
                  {comparisonRows.map((row, index) => {
                    const deltaHz = row.auto && row.studio ? Math.abs(row.auto.frequency - row.studio.frequency) : null;
                    const nextRow = comparisonRows[index + 1] ?? null;
                    const slotFinished = row.slotNr != null && nextRow?.slotNr !== row.slotNr;
                    const slotSummary = row.slotNr != null ? slotSummaryByNr.get(row.slotNr) ?? null : null;
                    return (
                      <React.Fragment key={`${row.timeMs}-${index}`}>
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
                          <Text style={{ color: colors.textSecondary, width: 114, fontSize: 12 }}>
                            {row.auto ? `${row.auto.note} • ${formatHz(row.auto.frequency)}` : 'n/a'}
                          </Text>
                          <Text style={{ color: colors.textSecondary, width: 120, fontSize: 12 }}>
                            {row.studio ? `${row.studio.note} • ${formatHz(row.studio.frequency)}` : 'n/a'}
                          </Text>
                          <Text style={{ color: colors.textSecondary, flex: 1, fontSize: 12 }}>
                            {deltaHz == null ? 'n/a' : formatHz(deltaHz)}
                          </Text>
                        </View>
                        {slotFinished && slotSummary ? (
                          <>
                            <View
                              style={{
                                flexDirection: 'row',
                                paddingVertical: 6,
                                backgroundColor: colors.surfaceInfo,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.borderBlue,
                              }}
                            >
                              <Text style={{ color: colors.accent, width: 86, fontSize: 12, fontWeight: '700' }}>slot total</Text>
                              <Text style={{ color: colors.accent, width: 64, fontSize: 12, fontWeight: '700' }}>{slotSummary.slotNr}</Text>
                              <Text style={{ color: colors.textPrimary, width: 114, fontSize: 12 }}>
                                median: {slotSummary.auto.medianNote ?? 'n/a'} • {formatHz(slotSummary.auto.medianHz)}
                              </Text>
                              <Text style={{ color: colors.textMuted, width: 120, fontSize: 12 }}>mode: {slotSummary.auto.modeNote ?? 'n/a'}</Text>
                              <Text style={{ color: colors.textSecondary, flex: 1, fontSize: 12 }}>
                                counts: {slotSummary.auto.noteCountsLabel}
                              </Text>
                            </View>
                            <View
                              style={{
                                flexDirection: 'row',
                                paddingVertical: 6,
                                backgroundColor: colors.surfaceNeutral,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.borderLight,
                              }}
                            >
                              <Text style={{ color: colors.primaryStrong, width: 86, fontSize: 12, fontWeight: '700' }}>studio total</Text>
                              <Text style={{ color: colors.primaryStrong, width: 64, fontSize: 12, fontWeight: '700' }}>{slotSummary.slotNr}</Text>
                              <Text style={{ color: colors.textPrimary, width: 114, fontSize: 12 }}>
                                median: {slotSummary.studio.medianNote ?? 'n/a'} • {formatHz(slotSummary.studio.medianHz)}
                              </Text>
                              <Text style={{ color: colors.textMuted, width: 120, fontSize: 12 }}>mode: {slotSummary.studio.modeNote ?? 'n/a'}</Text>
                              <Text style={{ color: colors.textSecondary, flex: 1, fontSize: 12 }}>
                                counts: {slotSummary.studio.noteCountsLabel}
                              </Text>
                            </View>
                          </>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>
          </>
        )}
      </Card>
    </Screen>
  );
}

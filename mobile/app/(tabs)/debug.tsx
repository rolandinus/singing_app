import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { t } from '../../src/core/i18n/translator';
import { useAppStore } from '../../src/state/use-app-store';
import { Screen } from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { useThemeColors } from '../../src/ui/hooks/use-theme-colors';
import { midiToScientific } from '../../src/core/utils/note-helpers';
import { noteFromPitch } from '../../src/core/utils/pitch';
import type { PitchCaptureDebugSnapshot } from '../../src/adapters/pitch/expo-pitch-capture-port';

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

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function toNoteName(frequency: number): string {
  if (!Number.isFinite(frequency) || frequency <= 0) return 'n/a';
  return midiToScientific(noteFromPitch(frequency));
}

function buildLatestCapture(events: PitchCaptureDebugSnapshot[]): CaptureSummary | null {
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
  const captureEvents = completeIndex >= 0 ? tail.slice(0, completeIndex + 1) : tail;

  const samples: CaptureSample[] = captureEvents
    .filter((event) => event.phase === 'analysis_sample' && Number.isFinite(event.frequency))
    .map((event) => ({
      timeMs: Number(event.sampleTimeMs ?? 0),
      frequency: Number(event.frequency),
      note: toNoteName(Number(event.frequency)),
    }));

  if (samples.length === 0) {
    return {
      samples: [],
      medianHz: null,
      medianNote: null,
      minHz: null,
      maxHz: null,
      spreadHz: null,
      topNotes: [],
    };
  }

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

function formatHz(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(2)} Hz`;
}

function formatMs(value: number): string {
  if (!Number.isFinite(value)) return 'n/a';
  return `${Math.round(value)} ms`;
}

export default function DebugScreen() {
  const colors = useThemeColors();
  const locale = useAppStore((s) => s.settings.locale);
  const events = useAppStore((s) => s.pitchDebugEvents);
  const latestState = useAppStore((s) => s.pitchDebug);
  const clearPitchDebugEvents = useAppStore((s) => s.clearPitchDebugEvents);

  if (!__DEV__) {
    return (
      <Screen>
        <Card>
          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Debug disabled in production builds.</Text>
        </Card>
      </Screen>
    );
  }

  const latestCapture = buildLatestCapture(events);
  const rawSamples = latestCapture?.samples.slice(-250) ?? [];

  return (
    <Screen>
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

        {!latestCapture ? (
          <Text style={{ color: colors.textSecondary }}>{t(locale, 'debug_pitch_no_capture')}</Text>
        ) : (
          <>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 6 }}>{t(locale, 'debug_pitch_latest')}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t(locale, 'debug_pitch_samples')}: {latestCapture.samples.length}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t(locale, 'debug_pitch_median_hz')}: {formatHz(latestCapture.medianHz)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t(locale, 'debug_pitch_median_note')}: {latestCapture.medianNote ?? 'n/a'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t(locale, 'debug_pitch_min_hz')}: {formatHz(latestCapture.minHz)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t(locale, 'debug_pitch_max_hz')}: {formatHz(latestCapture.maxHz)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t(locale, 'debug_pitch_spread_hz')}: {formatHz(latestCapture.spreadHz)}
            </Text>

            <Text style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 8 }}>{t(locale, 'debug_pitch_top_notes')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {latestCapture.topNotes.length === 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>n/a</Text>
              ) : (
                latestCapture.topNotes.map((entry) => (
                  <View
                    key={`${entry.note}-${entry.count}`}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      backgroundColor: colors.surfaceNeutral,
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{entry.note} ({entry.count})</Text>
                  </View>
                ))
              )}
            </View>

            <Text style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 8 }}>{t(locale, 'debug_pitch_raw_samples')}</Text>
            <View
              style={{
                flexDirection: 'row',
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderLight,
              }}
            >
              <Text style={{ color: colors.textMuted, fontWeight: '600', width: 92 }}>{t(locale, 'debug_pitch_time_ms')}</Text>
              <Text style={{ color: colors.textMuted, fontWeight: '600', width: 84 }}>{t(locale, 'debug_pitch_note')}</Text>
              <Text style={{ color: colors.textMuted, fontWeight: '600', flex: 1 }}>{t(locale, 'debug_pitch_frequency')}</Text>
            </View>
            <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
              {rawSamples.map((sample, index) => (
                <View
                  key={`${sample.timeMs}-${sample.frequency}-${index}`}
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 5,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, width: 92, fontSize: 12 }}>{formatMs(sample.timeMs)}</Text>
                  <Text style={{ color: colors.textSecondary, width: 84, fontSize: 12 }}>{sample.note}</Text>
                  <Text style={{ color: colors.textSecondary, flex: 1, fontSize: 12 }}>{formatHz(sample.frequency)}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </Card>
    </Screen>
  );
}

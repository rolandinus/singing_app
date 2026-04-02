import { useColorScheme } from 'react-native';

export type ThemeColors = {
  /** Page / screen background */
  background: string;
  /** Card / surface background */
  surface: string;
  /** Hero / tinted card background (primary-tinted) */
  surfaceBlue: string;
  /** Elevated / info panel background (very light primary) */
  surfaceInfo: string;
  /** Neutral panel background (settings panel, debug panel, level detail) */
  surfaceNeutral: string;
  /** Melody options panel background */
  surfaceMelodyOptions: string;
  /** Confirm / danger panel background */
  surfaceDanger: string;
  /** Grouped surface container */
  surfaceContainer: string;
  /** Slightly elevated surface */
  surfaceHigh: string;
  /** Primary text */
  textPrimary: string;
  /** Secondary / body text */
  textSecondary: string;
  /** Muted / label text */
  textMuted: string;
  /** Subtle / placeholder text */
  textSubtle: string;
  /** Default card border */
  border: string;
  /** Light border for tracks / separators */
  borderLight: string;
  /** Tinted primary border */
  borderBlue: string;
  /** Danger / pink border */
  borderDanger: string;
  /** Progress track background */
  progressTrack: string;
  /** Mastery track background */
  masteryTrack: string;
  /** Primary brand color (indigo) */
  primary: string;
  /** Strong primary (dark indigo) */
  primaryStrong: string;
  /** Accent / primary-container */
  accent: string;
  /** Danger red */
  danger: string;
  /** Strong danger text (dark red) */
  dangerText: string;
  /** Success green */
  success: string;
  /** Amber / warning */
  warning: string;
  /** Warning surface */
  warningContainer: string;
  /** Warning text (dark amber) */
  warningText: string;
  /** Tertiary purple accent */
  tertiary: string;
  /** Tertiary surface */
  tertiaryContainer: string;
  /** White surface (explicit white needed for some elements) */
  white: string;
  /** Count-in dot inactive */
  countInDotInactive: string;
  /** Toggle active background */
  toggleActiveBg: string;
  /** Toggle active border */
  toggleActiveBorder: string;
  /** Choice correct background */
  choiceCorrectBg: string;
  /** Choice wrong background */
  choiceWrongBg: string;
  /** Note result ok background */
  noteResultOkBg: string;
  /** Note result bad background */
  noteResultBadBg: string;
  /** Mastery color: low (gray) */
  masteryLow: string;
  /** Mastery color: mid (amber) */
  masteryMid: string;
  /** Mastery color: high (green) */
  masteryHigh: string;
  /** Deprecated alias for warning */
  amber: string;
};

const light: ThemeColors = {
  background: '#f6f6f8',
  surface: '#ffffff',
  surfaceBlue: '#e8eaff',
  surfaceInfo: '#f0f1ff',
  surfaceNeutral: '#f6f6f8',
  surfaceMelodyOptions: '#f0f1ff',
  surfaceDanger: '#fff1f2',
  surfaceContainer: '#e7e8ea',
  surfaceHigh: '#e1e2e5',
  textPrimary: '#2d2f31',
  textSecondary: '#3d3f41',
  textMuted: '#5a5c5d',
  textSubtle: '#acadaf',
  border: 'rgba(45,47,49,0.08)',
  borderLight: '#dbdde0',
  borderBlue: '#c0c8ff',
  borderDanger: '#fecdd3',
  progressTrack: '#c0c8ff',
  masteryTrack: '#dbdde0',
  primary: '#4052b6',
  primaryStrong: '#3346a9',
  accent: '#8899ff',
  danger: '#be123c',
  dangerText: '#881337',
  success: '#047857',
  warning: '#f59e0b',
  warningContainer: '#fffbeb',
  warningText: '#92400e',
  tertiary: '#9720ab',
  tertiaryContainer: '#f4d0ff',
  white: '#ffffff',
  countInDotInactive: '#dbdde0',
  toggleActiveBg: '#e8eaff',
  toggleActiveBorder: '#9099e8',
  choiceCorrectBg: '#ecfdf5',
  choiceWrongBg: '#fff1f2',
  noteResultOkBg: '#dcfce7',
  noteResultBadBg: '#ffe4e6',
  masteryLow: '#acadaf',
  masteryMid: '#d97706',
  masteryHigh: '#059669',
  amber: '#f59e0b',
};

const dark: ThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceBlue: '#1e2a4f',
  surfaceInfo: '#1a1f40',
  surfaceNeutral: '#1e293b',
  surfaceMelodyOptions: '#1a1f40',
  surfaceDanger: '#2d1a20',
  surfaceContainer: '#263045',
  surfaceHigh: '#2c3550',
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',
  border: 'rgba(241,245,249,0.10)',
  borderLight: '#334155',
  borderBlue: '#4a5ab6',
  borderDanger: '#9f1239',
  progressTrack: '#1e2a4f',
  masteryTrack: '#334155',
  primary: '#818cf8',
  primaryStrong: '#6366f1',
  accent: '#a5b4fc',
  danger: '#f43f5e',
  dangerText: '#fca5a5',
  success: '#10b981',
  warning: '#f59e0b',
  warningContainer: '#422006',
  warningText: '#fcd34d',
  tertiary: '#d946ef',
  tertiaryContainer: '#4a1566',
  white: '#1e293b',
  countInDotInactive: '#334155',
  toggleActiveBg: '#1e2a4f',
  toggleActiveBorder: '#6366f1',
  choiceCorrectBg: '#052e16',
  choiceWrongBg: '#2d1a20',
  noteResultOkBg: '#052e16',
  noteResultBadBg: '#2d1a20',
  masteryLow: '#64748b',
  masteryMid: '#d97706',
  masteryHigh: '#10b981',
  amber: '#f59e0b',
};

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

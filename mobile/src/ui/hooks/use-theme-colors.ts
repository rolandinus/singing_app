import { useColorScheme } from 'react-native';

export type ThemeColors = {
  /** Page / screen background */
  background: string;
  /** Card / surface background */
  surface: string;
  /** Hero / tinted card background (blue-tinted) */
  surfaceBlue: string;
  /** Elevated / info panel background (very light blue) */
  surfaceInfo: string;
  /** Neutral panel background (settings panel, debug panel, level detail) */
  surfaceNeutral: string;
  /** Melody options panel background */
  surfaceMelodyOptions: string;
  /** Confirm / danger panel background */
  surfaceDanger: string;
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
  /** Tinted blue border */
  borderBlue: string;
  /** Danger / pink border */
  borderDanger: string;
  /** Progress track background */
  progressTrack: string;
  /** Mastery track background */
  masteryTrack: string;
  /** Primary brand color (blue) */
  primary: string;
  /** Strong primary (dark blue) */
  primaryStrong: string;
  /** Accent info blue */
  accent: string;
  /** Danger red */
  danger: string;
  /** Success green */
  success: string;
  /** Amber / warning */
  amber: string;
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
};

const light: ThemeColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceBlue: '#dbeafe',
  surfaceInfo: '#eff6ff',
  surfaceNeutral: '#f8fafc',
  surfaceMelodyOptions: '#eff6ff',
  surfaceDanger: '#fff1f2',
  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  textSubtle: '#94a3b8',
  border: 'rgba(15,23,42,0.08)',
  borderLight: '#e2e8f0',
  borderBlue: '#bfdbfe',
  borderDanger: '#fecdd3',
  progressTrack: '#bfdbfe',
  masteryTrack: '#e2e8f0',
  primary: '#2563eb',
  primaryStrong: '#1d4ed8',
  accent: '#1e40af',
  danger: '#be123c',
  success: '#047857',
  amber: '#f59e0b',
  white: '#ffffff',
  countInDotInactive: '#e2e8f0',
  toggleActiveBg: '#dbeafe',
  toggleActiveBorder: '#93c5fd',
  choiceCorrectBg: '#ecfdf5',
  choiceWrongBg: '#fff1f2',
  noteResultOkBg: '#dcfce7',
  noteResultBadBg: '#ffe4e6',
};

const dark: ThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceBlue: '#1e3a5f',
  surfaceInfo: '#172554',
  surfaceNeutral: '#1e293b',
  surfaceMelodyOptions: '#172554',
  surfaceDanger: '#2d1a20',
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',
  border: 'rgba(241,245,249,0.10)',
  borderLight: '#334155',
  borderBlue: '#1e40af',
  borderDanger: '#9f1239',
  progressTrack: '#1e3a5f',
  masteryTrack: '#334155',
  primary: '#3b82f6',
  primaryStrong: '#2563eb',
  accent: '#60a5fa',
  danger: '#f43f5e',
  success: '#10b981',
  amber: '#f59e0b',
  white: '#1e293b',
  countInDotInactive: '#334155',
  toggleActiveBg: '#1e3a5f',
  toggleActiveBorder: '#3b82f6',
  choiceCorrectBg: '#052e16',
  choiceWrongBg: '#2d1a20',
  noteResultOkBg: '#052e16',
  noteResultBadBg: '#2d1a20',
};

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

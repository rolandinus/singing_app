import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { useThemeColors } from '../hooks/use-theme-colors';

export function HearingPromptSvg() {
  const colors = useThemeColors();
  return (
    <Svg width="100%" height={180} viewBox="0 0 240 180" accessibilityRole="image">
      <Circle cx="120" cy="90" r="82" fill={colors.surfaceInfo} />
      <Path
        d="M134 43c-19 0-35 15-35 34v13c0 12-8 22-19 26-9 4-15 13-15 23 0 14 12 26 27 26 16 0 29-12 29-27v-9"
        fill="none"
        stroke={colors.textPrimary}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M135 67c-9 0-17 7-17 17v24c0 7-6 13-13 13"
        fill="none"
        stroke={colors.textPrimary}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M165 69c12 8 20 21 20 36s-8 28-20 36"
        fill="none"
        stroke={colors.primary}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <Path
        d="M184 54c17 12 28 31 28 51s-11 39-28 51"
        fill="none"
        stroke={colors.borderBlue}
        strokeWidth="8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

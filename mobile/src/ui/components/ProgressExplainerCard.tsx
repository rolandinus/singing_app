import React from 'react';
import { Text, View } from 'react-native';
import { MASTERY_THRESHOLD, MAX_LEVEL, ROLLING_WINDOW_SIZE } from '../../core/config/curriculum';
import type { Locale } from '../../core/types';
import { t } from '../../core/i18n/translator';
import { useThemeColors } from '../hooks/use-theme-colors';

export function ProgressExplainerCard({ locale }: { locale: Locale }) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.borderBlue,
        backgroundColor: colors.surfaceInfo,
        borderRadius: 10,
        padding: 12,
        gap: 6,
      }}
    >
      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>
        {t(locale, 'progress_explainer_title')}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
        {t(locale, 'progress_explainer_body', {
          maxLevel: MAX_LEVEL,
          window: ROLLING_WINDOW_SIZE,
          threshold: Math.round(MASTERY_THRESHOLD * 100),
        })}
      </Text>
    </View>
  );
}

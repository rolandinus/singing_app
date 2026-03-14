import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MASTERY_THRESHOLD, MAX_LEVEL, ROLLING_WINDOW_SIZE } from '../../core/config/curriculum';
import type { Locale } from '../../core/types';
import { t } from '../../core/i18n/translator';

export function ProgressExplainerCard({ locale }: { locale: Locale }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t(locale, 'progress_explainer_title')}</Text>
      <Text style={styles.body}>
        {t(locale, 'progress_explainer_body', {
          maxLevel: MAX_LEVEL,
          window: ROLLING_WINDOW_SIZE,
          threshold: Math.round(MASTERY_THRESHOLD * 100),
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  title: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
});

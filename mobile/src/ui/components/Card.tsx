import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useThemeColors } from '../hooks/use-theme-colors';
import { radius, spacing } from '../tokens/spacing';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.md,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

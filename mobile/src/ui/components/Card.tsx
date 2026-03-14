import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useThemeColors } from '../hooks/use-theme-colors';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          gap: 8,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

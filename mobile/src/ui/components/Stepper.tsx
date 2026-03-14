import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../hooks/use-theme-colors';

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
};

export function Stepper({ label, value, min, max, step = 1, onChange, disabled = false }: StepperProps) {
  const colors = useThemeColors();
  const canDec = !disabled && value > min;
  const canInc = !disabled && value < max;

  const buttonStyle = {
    width: 44,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.surface,
  };

  const valueWrapStyle = {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.surface,
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable style={[buttonStyle, !canDec && { opacity: 0.4 }]} onPress={() => onChange(Math.max(min, value - step))} disabled={!canDec}>
          <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 20, lineHeight: 22 }}>-</Text>
        </Pressable>
        <View style={valueWrapStyle}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>{value}</Text>
        </View>
        <Pressable style={[buttonStyle, !canInc && { opacity: 0.4 }]} onPress={() => onChange(Math.min(max, value + step))} disabled={!canInc}>
          <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 20, lineHeight: 22 }}>+</Text>
        </Pressable>
      </View>
      <Text style={{ color: colors.textSubtle, fontSize: 12 }}>{min}-{max}</Text>
    </View>
  );
}

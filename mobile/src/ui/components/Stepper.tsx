import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
};

export function Stepper({ label, value, min, max, onChange, disabled = false }: StepperProps) {
  const canDec = !disabled && value > min;
  const canInc = !disabled && value < max;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={[styles.button, !canDec && styles.buttonDisabled]} onPress={() => onChange(value - 1)} disabled={!canDec}>
          <Text style={styles.buttonText}>-</Text>
        </Pressable>
        <View style={styles.valueWrap}>
          <Text style={styles.value}>{value}</Text>
        </View>
        <Pressable style={[styles.button, !canInc && styles.buttonDisabled]} onPress={() => onChange(value + 1)} disabled={!canInc}>
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.range}>{min}-{max}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  label: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    width: 44,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#334155', fontWeight: '700', fontSize: 20, lineHeight: 22 },
  valueWrap: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  value: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  range: { color: '#94a3b8', fontSize: 12 },
});

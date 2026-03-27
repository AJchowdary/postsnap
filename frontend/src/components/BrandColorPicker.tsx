import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '../constants/theme';

const SWATCHES = [
  ['#E63946', '#F4A261', '#E9C46A', '#2A9D8F'],
  ['#264653', '#6A0572', '#1D3557', '#457B9D'],
  ['#2D6A4F', '#8B4513', '#1B1B1B', '#ba9eff'],
];

function normalizeHex(raw: string): string | null {
  const t = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t}`;
  return null;
}

type Props = {
  value: string;
  onChange: (color: string) => void;
};

export default function BrandColorPicker({ value, onChange }: Props) {
  const [custom, setCustom] = useState('');
  const preview = useMemo(() => normalizeHex(value) || value || '#2A9D8F', [value]);

  const applyCustom = () => {
    const n = normalizeHex(custom);
    if (n) onChange(n);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.previewBar, { backgroundColor: preview }]} />
      <View style={styles.grid}>
        {SWATCHES.flat().map((hex) => {
          const selected = value.toLowerCase() === hex.toLowerCase();
          return (
            <TouchableOpacity
              key={hex}
              onPress={() => onChange(hex)}
              activeOpacity={0.85}
              style={[styles.swatchOuter, selected && styles.swatchOuterSelected]}
            >
              <View style={[styles.swatch, { backgroundColor: hex }]}>
                {selected && (
                  <Ionicons name="checkmark" size={20} color={Colors.white} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.label}>Custom hex</Text>
      <TextInput
        value={custom}
        onChangeText={setCustom}
        onBlur={applyCustom}
        onSubmitEditing={applyCustom}
        placeholder="#2A9D8F"
        placeholderTextColor={Colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  previewBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  swatchOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    padding: 3,
    borderWidth: 0,
  },
  swatchOuterSelected: {
    borderWidth: 3,
    borderColor: Colors.white,
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  input: {
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, BorderRadius } from '../constants/theme';
import type { BrandVibe } from '../types';

const OPTIONS: { id: BrandVibe; emoji: string; title: string; subtitle: string }[] = [
  {
    id: 'professional',
    emoji: '🎯',
    title: 'Professional & Clean',
    subtitle: 'Expert, trustworthy, polished',
  },
  {
    id: 'bold',
    emoji: '🔥',
    title: 'Bold & Energetic',
    subtitle: 'Exciting, powerful, makes people stop scrolling',
  },
  {
    id: 'warm',
    emoji: '🌿',
    title: 'Warm & Friendly',
    subtitle: 'Community feel, welcoming, like a local favourite',
  },
];

type Props = {
  value: string;
  onChange: (vibe: BrandVibe) => void;
};

export default function BrandVibePicker({ value, onChange }: Props) {
  return (
    <View style={styles.stack}>
      {OPTIONS.map((o) => {
        const selected = value === o.id;
        return (
          <TouchableOpacity
            key={o.id}
            activeOpacity={0.88}
            onPress={() => onChange(o.id)}
            style={[styles.card, selected ? styles.cardSelected : styles.cardIdle]}
          >
            <Text style={styles.emoji}>{o.emoji}</Text>
            <View style={styles.textCol}>
              <Text style={styles.title}>{o.title}</Text>
              <Text style={styles.sub}>{o.subtitle}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  card: {
    minHeight: 80,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderLeftWidth: 4,
  },
  cardIdle: {
    backgroundColor: '#141f38',
    borderLeftColor: 'transparent',
  },
  cardSelected: {
    backgroundColor: 'rgba(186,158,255,0.1)',
    borderLeftColor: Colors.primary,
  },
  emoji: { fontSize: 48, lineHeight: 52 },
  textCol: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  sub: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
});

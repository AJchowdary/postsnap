import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '../constants/theme';

interface Props {
  visible: boolean;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

function getDefaultDate(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  // round to nearest 15 min
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

export function SchedulePicker({ visible, onConfirm, onCancel }: Props) {
  const [date, setDate] = useState<Date>(getDefaultDate);

  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const hours12 = date.getHours() % 12 || 12;
  const minutes = date.getMinutes();
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';

  const adjustDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d);
  };

  const adjustHours = (n: number) => {
    const d = new Date(date);
    d.setHours(d.getHours() + n);
    setDate(d);
  };

  const adjustMinutes = (n: number) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + n);
    setDate(d);
  };

  const toggleAmPm = () => {
    const d = new Date(date);
    d.setHours(d.getHours() >= 12 ? d.getHours() - 12 : d.getHours() + 12);
    setDate(d);
  };

  const handleConfirm = () => {
    const minDate = new Date();
    minDate.setMinutes(minDate.getMinutes() + 5);
    onConfirm(date > minDate ? date : minDate);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onCancel} activeOpacity={1} />
        <View style={s.sheet}>
          <View style={s.handle} />

          <Text style={s.title}>Schedule Post</Text>
          <Text style={s.subtitle}>Choose when to publish this post</Text>

          {/* Date row */}
          <View style={s.section}>
            <Text style={s.label}>DATE</Text>
            <View style={s.pickerRow}>
              <TouchableOpacity
                testID="schedule-prev-day"
                onPress={() => adjustDate(-1)}
                style={s.arrowBtn}
              >
                <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={s.pickerValue} testID="schedule-date-display">{formattedDate}</Text>
              <TouchableOpacity
                testID="schedule-next-day"
                onPress={() => adjustDate(1)}
                style={s.arrowBtn}
              >
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Time row */}
          <View style={s.section}>
            <Text style={s.label}>TIME</Text>
            <View style={s.timeRow}>
              {/* Hours */}
              <View style={s.timeUnit}>
                <TouchableOpacity
                  testID="schedule-hour-up"
                  onPress={() => adjustHours(1)}
                  style={s.timeArrow}
                >
                  <Ionicons name="chevron-up" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
                <Text style={s.timeValue} testID="schedule-hour-display">
                  {String(hours12).padStart(2, '0')}
                </Text>
                <TouchableOpacity
                  testID="schedule-hour-down"
                  onPress={() => adjustHours(-1)}
                  style={s.timeArrow}
                >
                  <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={s.colon}>:</Text>

              {/* Minutes */}
              <View style={s.timeUnit}>
                <TouchableOpacity
                  testID="schedule-min-up"
                  onPress={() => adjustMinutes(15)}
                  style={s.timeArrow}
                >
                  <Ionicons name="chevron-up" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
                <Text style={s.timeValue} testID="schedule-minute-display">
                  {String(minutes).padStart(2, '0')}
                </Text>
                <TouchableOpacity
                  testID="schedule-min-down"
                  onPress={() => adjustMinutes(-15)}
                  style={s.timeArrow}
                >
                  <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* AM/PM */}
              <TouchableOpacity
                testID="schedule-ampm-toggle"
                onPress={toggleAmPm}
                style={s.ampmBtn}
              >
                <Text style={s.ampmText} testID="schedule-ampm-display">{ampm}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity
              testID="schedule-cancel-btn"
              onPress={onCancel}
              style={s.cancelBtn}
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="schedule-confirm-btn"
              onPress={handleConfirm}
              style={s.confirmBtn}
            >
              <Text style={s.confirmText}>Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 36,
  },
  handle: {
    width: 36, height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 8,
  },
  title: {
    fontSize: 18, fontWeight: '700',
    color: Colors.text, textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', marginTop: 4, marginBottom: Spacing.xl,
  },
  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },
  label: {
    fontSize: 11, fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.subtle,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  arrowBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerValue: {
    flex: 1, textAlign: 'center',
    fontSize: 15, fontWeight: '600', color: Colors.text,
  },
  timeRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.subtle,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  timeUnit: { flex: 1, alignItems: 'center', gap: 2 },
  timeArrow: {
    width: 36, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  timeValue: { fontSize: 22, fontWeight: '700', color: Colors.text },
  colon: { fontSize: 22, fontWeight: '700', color: Colors.textTertiary, marginBottom: 2 },
  ampmBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    minWidth: 52, alignItems: 'center',
  },
  ampmText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md, marginTop: 4,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.subtle,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: {
    flex: 2, paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});

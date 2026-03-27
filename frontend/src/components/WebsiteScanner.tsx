import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, GradientColors } from '../constants/theme';
import type { WebsiteScanResult } from '../services/api';

type Props = {
  onScanSuccess: (result: WebsiteScanResult) => void;
  onSkip: () => void;
  onScan?: (url: string) => Promise<WebsiteScanResult | null>;
};

export default function WebsiteScanner({ onScanSuccess, onSkip, onScan }: Props) {
  const [state, setState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const runScan = async () => {
    const u = url.trim();
    if (!u) return;
    setState('scanning');
    setErrMsg(null);
    try {
      if (onScan) {
        const res = await onScan(u);
        if (!res) {
          setState('error');
          setErrMsg('Could not read this URL.');
          return;
        }
        setSummary(res.brandSummary || '');
        setColor(res.suggestedColor || null);
        setState('success');
        onScanSuccess(res);
        return;
      }
      setState('error');
      setErrMsg('Scanner not configured.');
    } catch (e) {
      setState('error');
      setErrMsg(e instanceof Error ? e.message : 'Scan failed');
    }
  };

  if (state === 'scanning') {
    return (
      <View style={styles.centerBlock}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.scanningText}>Analyzing your brand… 🔍</Text>
      </View>
    );
  }

  if (state === 'success') {
    return (
      <View style={styles.centerBlock}>
        <Ionicons name="checkmark-circle" size={44} color={Colors.success} />
        <Text style={styles.okTitle}>Looks good</Text>
        {!!summary && <Text style={styles.summary}>{summary}</Text>}
        {!!color && (
          <View style={styles.colorRow}>
            <View style={[styles.colorDot, { backgroundColor: color }]} />
            <Text style={styles.colorHex}>{color}</Text>
          </View>
        )}
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={styles.centerBlock}>
        <Ionicons name="warning-outline" size={40} color={Colors.warning} />
        <Text style={styles.errTitle}>Couldn&apos;t scan</Text>
        <Text style={styles.errSub}>{errMsg || 'Try again or set up manually.'}</Text>
        <TouchableOpacity onPress={() => setState('idle')} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
          <Text style={styles.skipManual}>Try manual setup</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://yourbusiness.com"
        placeholderTextColor={Colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
      />
      <TouchableOpacity activeOpacity={0.9} onPress={runScan} disabled={!url.trim()}>
        <LinearGradient
          colors={GradientColors.purple}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradBtn, !url.trim() && { opacity: 0.45 }]}
        >
          <Text style={styles.gradBtnText}>Scan Website</Text>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSkip} style={styles.skipLink}>
        <Text style={styles.skipLinkText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  input: {
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  gradBtn: {
    borderRadius: BorderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  gradBtnText: { color: Colors.background, fontWeight: '900', fontSize: 15 },
  skipLink: { alignItems: 'center', paddingVertical: 8 },
  skipLinkText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  centerBlock: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  scanningText: { color: Colors.textSecondary, fontWeight: '700', marginTop: 8 },
  okTitle: { fontSize: 18, fontWeight: '900', color: Colors.textPrimary },
  summary: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.white },
  colorHex: { color: Colors.textPrimary, fontWeight: '700' },
  errTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  errSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
  },
  retryText: { color: Colors.primary, fontWeight: '800' },
  skipBtn: { paddingVertical: 8 },
  skipManual: { color: Colors.primary, fontWeight: '700' },
});

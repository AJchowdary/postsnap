import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, GradientColors } from '../constants/theme';
import { useAppStore } from '../store/appStore';
import type { SocialAccount } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPost: (selectedAccountIds: string[], platforms: string[]) => Promise<void>;
  onSaveDraft?: () => Promise<void>;
  onDraftSaved?: () => void;
  onPosted?: () => void;
};

type RowPlatform = 'instagram' | 'facebook';

function platformLabel(p: RowPlatform): string {
  return p === 'instagram' ? 'Instagram' : 'Facebook';
}

function accountHandle(account: SocialAccount | null, p: RowPlatform): string {
  if (!account) return '';
  if (p === 'instagram') {
    const u = account.igUsername || account.handle || '';
    return u.startsWith('@') ? u : `@${u}`;
  }
  return account.pageName || account.handle || 'Facebook Page';
}

export default function AccountSelectorSheet({
  visible,
  onClose,
  onPost,
  onSaveDraft,
  onDraftSaved,
  onPosted,
}: Props) {
  const router = useRouter();
  const socialAccounts = useAppStore((s) => s.socialAccounts);

  const [selected, setSelected] = useState<Set<RowPlatform>>(new Set());
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const out: { platform: RowPlatform; account: SocialAccount }[] = [];
    if (socialAccounts.instagram?.connected) {
      out.push({ platform: 'instagram', account: socialAccounts.instagram });
    }
    if (socialAccounts.facebook?.connected) {
      out.push({ platform: 'facebook', account: socialAccounts.facebook });
    }
    return out;
  }, [socialAccounts.facebook, socialAccounts.instagram]);

  useEffect(() => {
    if (!visible) {
      setSelected(new Set());
      setPosting(false);
      setPosted(false);
      setError(null);
      return;
    }
    const initial = new Set<RowPlatform>();
    if (socialAccounts.instagram?.connected) initial.add('instagram');
    if (socialAccounts.facebook?.connected) initial.add('facebook');
    setSelected(initial);
    setError(null);
    setPosted(false);
  }, [visible, socialAccounts.facebook?.connected, socialAccounts.instagram?.connected]);

  const toggle = useCallback((p: RowPlatform) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) {
        if (next.size <= 1) return next;
        next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  }, []);

  const selectedList = useMemo(() => Array.from(selected), [selected]);
  const canSubmit = selectedList.length > 0 && !posted;

  const goSettings = useCallback(() => {
    onClose();
    router.push('/(tabs)/settings' as any);
  }, [onClose, router]);

  const onContinue = useCallback(async () => {
    if (!canSubmit || posting || posted) return;
    setError(null);
    setPosting(true);
    const ids = selectedList.map((p) => p);
    try {
      await onPost(ids, ids);
      setPosting(false);
      setPosted(true);
      setTimeout(() => {
        onPosted?.();
        onClose();
      }, 1500);
    } catch (e) {
      setPosting(false);
      if (e instanceof Error && e.message === 'PAYWALL') {
        onClose();
        return;
      }
      setError('Failed to post. Please try again.');
    }
  }, [canSubmit, onClose, onPost, onPosted, posting, posted, selectedList]);

  const onSave = useCallback(async () => {
    if (!onSaveDraft || posting || posted) return;
    setError(null);
    setPosting(true);
    try {
      await onSaveDraft();
      setPosting(false);
      onDraftSaved?.();
      onClose();
    } catch (e) {
      setPosting(false);
      if (e instanceof Error && e.message === 'PAYWALL') {
        onClose();
        return;
      }
      setError('Failed to save draft. Please try again.');
    }
  }, [onClose, onDraftSaved, onSaveDraft, posted, posting]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <Pressable style={styles.backdrop} onPress={posting ? undefined : onClose}>
          <View />
        </Pressable>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />

          <Text style={styles.sheetTitle}>Post to…</Text>
          <Text style={styles.sheetSubtitle}>
            Choose accounts to post now, or save as a draft for later
          </Text>

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {rows.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="link-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No social accounts connected</Text>
                <Text style={styles.emptySub}>
                  Connect your Instagram or Facebook account in Settings
                </Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={goSettings} activeOpacity={0.88}>
                  <Text style={styles.emptyBtnText}>Go to Settings</Text>
                </TouchableOpacity>
              </View>
            ) : (
              rows.map(({ platform: p, account }, idx) => {
                const on = selected.has(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.row, on && styles.rowSelected, idx < rows.length - 1 && styles.rowBorder]}
                    onPress={() => toggle(p)}
                    activeOpacity={0.88}
                  >
                    <View style={styles.rowLeft}>
                      {p === 'instagram' ? (
                        <LinearGradient
                          colors={[Colors.instagram, Colors.primaryDark]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.platformOrb}
                        >
                          <Text style={styles.platformOrbText}>IG</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.platformOrb, styles.platformOrbFb]}>
                          <Text style={styles.platformOrbText}>FB</Text>
                        </View>
                      )}
                      <View style={styles.rowTextCol}>
                        <Text style={styles.rowHandle}>{accountHandle(account, p)}</Text>
                        <Text style={styles.rowLabel}>{platformLabel(p)}</Text>
                      </View>
                    </View>
                    <View style={[styles.checkbox, on && styles.checkboxOn]}>
                      {on ? (
                        <Ionicons name="checkmark" size={14} color={Colors.white} />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

          <View style={styles.footer}>
            {selectedList.length > 0 && rows.length > 0 ? (
              <Text style={styles.countLine}>
                Posting to {selectedList.length} account{selectedList.length === 1 ? '' : 's'}
              </Text>
            ) : null}

            {posted ? (
              <View style={styles.successBlock}>
                <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
                <Text style={styles.successText}>Posted successfully!</Text>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.saveDraftBtn, posting && styles.continueDisabled]}
                  onPress={() => void onSave()}
                  disabled={posting}
                  activeOpacity={0.9}
                >
                  <Text style={styles.saveDraftLabel}>Save as Draft</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.continueOuter,
                    !posting && !canSubmit && styles.continueDisabled,
                  ]}
                  onPress={() => void onContinue()}
                  disabled={!canSubmit || posting}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={GradientColors.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.continueGradient}
                  >
                    {posting ? (
                      <>
                        <ActivityIndicator color={Colors.textOnPrimary} />
                        <Text style={styles.continueLabel}>Working…</Text>
                      </>
                    ) : (
                      <Text style={styles.continueLabel}>Continue to Post</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {!posting && !posted ? (
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn} hitSlop={12}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay55,
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: Colors.paper,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
    marginBottom: Spacing.md,
  },
  listScroll: { maxHeight: 320 },
  listContent: { paddingBottom: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowSelected: {
    backgroundColor: Colors.bgElevated,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  platformOrb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformOrbFb: {
    backgroundColor: Colors.facebook,
  },
  platformOrbText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
  },
  rowTextCol: { flex: 1 },
  rowHandle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rowLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
    paddingHorizontal: Spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBtn: {
    marginTop: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  errorBanner: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  footer: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  countLine: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveDraftBtn: {
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDraftLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  continueOuter: {
    flex: 1,
    borderRadius: 26,
    overflow: 'hidden',
  },
  continueDisabled: { opacity: 0.5 },
  continueGradient: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  continueLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textOnPrimary,
  },
  cancelBtn: { alignItems: 'center', marginTop: Spacing.md },
  cancelText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  successBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 8,
  },
  successText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success,
  },
});

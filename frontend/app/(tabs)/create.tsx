import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';
import { generateCaption, generatePostImage, savePostToBackend, publishPostToBackend } from '../../src/services/api';
import StatusChip from '../../src/components/StatusChip';
import PrimaryButton from '../../src/components/PrimaryButton';
import SecondaryButton from '../../src/components/SecondaryButton';
import { SchedulePicker } from '../../src/components/SchedulePicker';
import { TEMPLATES_BY_TYPE, Platform as SocialPlatform, Post } from '../../src/types';

export default function CreateScreen() {
  const businessProfile = useAppStore((s) => s.businessProfile);
  const subscription = useAppStore((s) => s.subscription);
  const socialAccounts = useAppStore((s) => s.socialAccounts);
  const addPost = useAppStore((s) => s.addPost);
  const updatePost = useAppStore((s) => s.updatePost);
  const showToast = useAppStore((s) => s.showToast);
  const setShowPaywall = useAppStore((s) => s.setShowPaywall);
  const setPaywallSuccessCallback = useAppStore((s) => s.setPaywallSuccessCallback);
  const checkEntitlement = useAppStore((s) => s.checkEntitlement);
  const currentEdit = useAppStore((s) => s.currentEdit);
  const setCurrentEdit = useAppStore((s) => s.setCurrentEdit);

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplate, setSelectedTemplate] = useState('auto');
  const [photo, setPhoto] = useState<string | null>(null);
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [caption, setCaption] = useState('');
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({
    instagram: !!socialAccounts.instagram?.connected,
    facebook: !!socialAccounts.facebook?.connected,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  const templates = TEMPLATES_BY_TYPE[businessProfile.type] || TEMPLATES_BY_TYPE.restaurant;
  const selectedTpl = templates.find((t) => t.id === selectedTemplate);
  const isBeforeAfter = selectedTpl?.beforeAfter;

  // Load currentEdit on mount
  useEffect(() => {
    if (currentEdit) {
      if (currentEdit.id) setDraftId(currentEdit.id);
      if (currentEdit.template) setSelectedTemplate(currentEdit.template);
      if (currentEdit.photo) setPhoto(currentEdit.photo);
      if (currentEdit.description) setDescription(currentEdit.description);
      if (currentEdit.caption) { setCaption(currentEdit.caption); setStep(2); }
      if (currentEdit.processedImage) setProcessedImage(currentEdit.processedImage);
    }
    return () => setCurrentEdit(null);
  }, []);

  const pickPhoto = async (field: 'main' | 'before') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to pick photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      if (field === 'before') setBeforePhoto(result.assets[0].base64);
      else setPhoto(result.assets[0].base64);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPhoto(result.assets[0].base64);
    }
  };

  const handleGeneratePost = async () => {
    if (!description.trim()) {
      showToast('Add a one-line description first', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const photoToUse = isBeforeAfter ? (beforePhoto || photo) : photo;
      const [cap, img] = await Promise.all([
        generateCaption({
          description,
          template: selectedTemplate,
          businessName: businessProfile.name,
          businessType: businessProfile.type,
          brandStyle: businessProfile.brandStyle,
        }),
        photoToUse
          ? generatePostImage({
              photo: photoToUse,
              template: selectedTemplate,
              businessName: businessProfile.name,
              businessType: businessProfile.type,
              brandStyle: businessProfile.brandStyle,
              description,
            })
          : Promise.resolve(null),
      ]);
      setCaption(cap);
      if (img) setProcessedImage(img);

      // Auto-save draft
      const enabledPlatforms = Object.keys(platforms).filter((k) => platforms[k]) as SocialPlatform[];
      const draft = await savePostToBackend({
        template: selectedTemplate,
        photo: photo || undefined,
        description,
        caption: cap,
        processedImage: img || undefined,
        platforms: enabledPlatforms,
        status: 'draft',
      });
      addPost(draft);
      setDraftId(draft.id);
      setStep(2);
    } catch {
      showToast('Generation failed — try again.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    const enabledPlatforms = Object.keys(platforms).filter((k) => platforms[k]) as SocialPlatform[];
    const draft = await savePostToBackend({
      id: draftId || undefined,
      template: selectedTemplate,
      photo: photo || undefined,
      description,
      caption,
      processedImage: processedImage || undefined,
      platforms: enabledPlatforms,
      status: 'draft',
    });
    if (draftId) {
      updatePost(draftId, draft);
    } else {
      addPost(draft);
      setDraftId(draft.id);
    }
    showToast('Draft saved!', 'success');
  };

  const handlePostNow = async () => {
    if (!checkEntitlement()) {
      setShowPaywall(true);
      return;
    }
    if (!draftId) {
      showToast('Save a draft first', 'error');
      return;
    }
    setIsPosting(true);
    try {
      const enabledPlatforms = Object.keys(platforms).filter((k) => platforms[k]);
      const result = await publishPostToBackend(draftId, enabledPlatforms);
      if (result.success) {
        updatePost(draftId, { status: 'published', publishedAt: new Date().toISOString() });
        showToast('Posted successfully! 🎉', 'success');
        resetForm();
      } else {
        showToast(result.message || 'Failed to post', 'error');
      }
    } catch (err: any) {
      if (err?.payload != null) {
        setPaywallSuccessCallback(() => handlePostNow());
        setShowPaywall(true);
      } else {
        showToast(err?.message || 'Posting failed — check your connection.', 'error');
      }
    } finally {
      setIsPosting(false);
    }
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      const cap = await generateCaption({
        description,
        template: selectedTemplate,
        businessName: businessProfile.name,
        businessType: businessProfile.type,
        brandStyle: businessProfile.brandStyle,
      });
      setCaption(cap);
      if (draftId) updatePost(draftId, { caption: cap });
    } catch {
      showToast('Regeneration failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSchedulePost = async (scheduleDate: Date) => {
    if (!checkEntitlement()) { setShowPaywall(true); return; }
    setShowSchedulePicker(false);
    try {
      const enabledPlatforms = Object.keys(platforms).filter((k) => platforms[k]) as SocialPlatform[];
      const post = await savePostToBackend({
        id: draftId || undefined,
        template: selectedTemplate,
        photo: photo || undefined,
        description,
        caption,
        processedImage: processedImage || undefined,
        platforms: enabledPlatforms,
        status: 'scheduled',
        scheduledAt: scheduleDate.toISOString(),
      });
      if (draftId) {
        updatePost(draftId, post);
      } else {
        addPost(post);
      }
      const dateStr = scheduleDate.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
      showToast(`Post scheduled for ${dateStr}`, 'success');
      resetForm();
    } catch {
      showToast('Failed to schedule post', 'error');
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedTemplate('auto');
    setPhoto(null);
    setBeforePhoto(null);
    setDescription('');
    setCaption('');
    setProcessedImage(null);
    setDraftId(null);
    setPlatforms({
      instagram: !!socialAccounts.instagram?.connected,
      facebook: !!socialAccounts.facebook?.connected,
    });
  };

  const displayImage = processedImage || photo;
  const enabledCount = Object.values(platforms).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle} testID="create-header-title">Create</Text>
            </View>
            <StatusChip
              status={subscription.status}
              daysLeft={subscription.daysLeft}
              testID="create-status-chip"
            />
          </View>

          {/* Stepper */}
          <View style={styles.stepper}>
            <View style={styles.stepperItem}>
              <View style={[styles.stepDot, styles.stepDotActive]}>
                <Text style={styles.stepNum}>1</Text>
              </View>
              <Text style={[styles.stepLabel, step === 1 && styles.stepLabelActive]}>Build</Text>
            </View>
            <View style={[styles.stepLine, step === 2 && styles.stepLineActive]} />
            <View style={styles.stepperItem}>
              <View style={[styles.stepDot, step === 2 && styles.stepDotActive, step === 1 && styles.stepDotInactive]}>
                <Text style={[styles.stepNum, step === 1 && styles.stepNumInactive]}>2</Text>
              </View>
              <Text style={[styles.stepLabel, step === 2 && styles.stepLabelActive]}>Preview</Text>
            </View>
          </View>

          {/* ===== STEP 1 ===== */}
          {step === 1 && (
            <>
              {/* Template Chips */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Template</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  {templates.map((tpl) => (
                    <TouchableOpacity
                      key={tpl.id}
                      testID={`template-chip-${tpl.id}`}
                      onPress={() => setSelectedTemplate(tpl.id)}
                      activeOpacity={0.8}
                      style={[styles.chip, selectedTemplate === tpl.id && styles.chipActive]}
                    >
                      <Text style={styles.chipEmoji}>{tpl.emoji}</Text>
                      <Text style={[styles.chipText, selectedTemplate === tpl.id && styles.chipTextActive]}>
                        {tpl.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {selectedTpl?.helper && (
                  <Text style={styles.helperText}>{selectedTpl.helper}</Text>
                )}
              </View>

              {/* Photo Picker */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  Photo {isBeforeAfter ? '(Before)' : '(optional)'}
                </Text>
                {photo ? (
                  <View style={styles.photoPreviewWrap}>
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${photo}` }}
                      style={styles.photoPreview}
                    />
                    <TouchableOpacity
                      testID="photo-remove-btn"
                      onPress={() => setPhoto(null)}
                      style={styles.photoRemove}
                    >
                      <Ionicons name="close-circle" size={24} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.photoPicker}>
                    <TouchableOpacity
                      testID="photo-camera-btn"
                      onPress={takePhoto}
                      activeOpacity={0.8}
                      style={styles.photoPickerBtn}
                    >
                      <Ionicons name="camera-outline" size={22} color={Colors.primary} />
                      <Text style={styles.photoPickerBtnText}>Take Photo</Text>
                    </TouchableOpacity>
                    <View style={styles.photoPickerDivider} />
                    <TouchableOpacity
                      testID="photo-library-btn"
                      onPress={() => pickPhoto('main')}
                      activeOpacity={0.8}
                      style={styles.photoPickerBtn}
                    >
                      <Ionicons name="image-outline" size={22} color={Colors.primary} />
                      <Text style={styles.photoPickerBtnText}>Upload</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Before photo for before/after */}
                {isBeforeAfter && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 12 }]}>After Photo</Text>
                    {beforePhoto ? (
                      <View style={styles.photoPreviewWrap}>
                        <Image
                          source={{ uri: `data:image/jpeg;base64,${beforePhoto}` }}
                          style={styles.photoPreview}
                        />
                        <TouchableOpacity onPress={() => setBeforePhoto(null)} style={styles.photoRemove}>
                          <Ionicons name="close-circle" size={24} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        testID="before-photo-btn"
                        onPress={() => pickPhoto('before')}
                        activeOpacity={0.8}
                        style={styles.photoPickerCompact}
                      >
                        <Ionicons name="image-outline" size={18} color={Colors.primary} />
                        <Text style={styles.photoPickerBtnText}>Add After Photo</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>

              {/* Description */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Describe this in one line *</Text>
                <TextInput
                  testID="description-input"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. Chef's special pasta carbonara today"
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.input}
                  returnKeyType="done"
                  maxLength={120}
                />
                <Text style={styles.charCount}>{description.length}/120</Text>
              </View>

              {/* Buttons */}
              <View style={styles.btnStack}>
                <PrimaryButton
                  testID="generate-post-btn"
                  title="Generate Post"
                  onPress={handleGeneratePost}
                  loading={isGenerating}
                  disabled={!description.trim()}
                  icon={<Ionicons name="flash" size={18} color={Colors.white} />}
                />
                <SecondaryButton
                  testID="save-draft-btn-step1"
                  title="Save Draft"
                  onPress={handleSaveDraft}
                  disabled={!description.trim()}
                />
              </View>
            </>
          )}

          {/* ===== STEP 2 ===== */}
          {step === 2 && (
            <>
              {/* Back */}
              <TouchableOpacity
                testID="back-to-step1-btn"
                onPress={() => setStep(1)}
                style={styles.backBtn}
              >
                <Ionicons name="chevron-back" size={18} color={Colors.primary} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>

              {/* Platform Toggles */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Post to</Text>
                <View style={styles.platformToggles}>
                  {(['instagram', 'facebook'] as SocialPlatform[]).map((platform) => {
                    const account = socialAccounts[platform];
                    const isConnected = !!account?.connected;
                    const isEnabled = platforms[platform];
                    const platformColor = platform === 'instagram' ? Colors.instagram : Colors.facebook;
                    return (
                      <TouchableOpacity
                        key={platform}
                        testID={`platform-toggle-${platform}`}
                        onPress={() => {
                          if (!isConnected) {
                            showToast(`Connect ${platform} in Settings first`, 'info');
                            return;
                          }
                          setPlatforms((p) => ({ ...p, [platform]: !p[platform] }));
                        }}
                        activeOpacity={0.8}
                        style={[styles.platformToggle, isEnabled && isConnected && styles.platformToggleActive, { borderColor: isEnabled && isConnected ? platformColor : Colors.border }]}
                      >
                        <Ionicons
                          name={platform === 'instagram' ? 'logo-instagram' : 'logo-facebook'}
                          size={20}
                          color={isEnabled && isConnected ? platformColor : Colors.textTertiary}
                        />
                        <Text style={[styles.platformToggleText, isEnabled && isConnected && { color: platformColor }]}>
                          {platform.charAt(0).toUpperCase() + platform.slice(1)}
                        </Text>
                        {!isConnected && (
                          <Text style={styles.connectLink}>Connect</Text>
                        )}
                        {isConnected && (
                          <View style={[styles.toggleDot, { backgroundColor: isEnabled ? platformColor : Colors.border }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Preview Image */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Preview</Text>
                <View style={styles.previewCard}>
                  {displayImage ? (
                    <Image
                      testID="preview-image"
                      source={{ uri: `data:image/jpeg;base64,${displayImage}` }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.previewPlaceholder}>
                      <Ionicons name="image-outline" size={40} color={Colors.textTertiary} />
                      <Text style={styles.previewPlaceholderText}>No image — text-only post</Text>
                    </View>
                  )}
                  {processedImage && (
                    <View style={styles.aiTag}>
                      <Ionicons name="sparkles" size={10} color={Colors.primary} />
                      <Text style={styles.aiTagText}>AI Enhanced</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Caption Editor */}
              <View style={styles.section}>
                <View style={styles.captionHeader}>
                  <Text style={styles.sectionLabel}>Caption</Text>
                  {isGenerating && <ActivityIndicator size="small" color={Colors.primary} />}
                </View>
                <TextInput
                  testID="caption-input"
                  value={caption}
                  onChangeText={setCaption}
                  style={styles.captionInput}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  placeholderTextColor={Colors.textTertiary}
                  placeholder="Your caption will appear here..."
                />
                <View style={styles.captionFooter}>
                  <Text style={styles.charCount}>{caption.length} chars</Text>
                  <View style={styles.quickActions}>
                    <TouchableOpacity
                      testID="make-shorter-btn"
                      onPress={async () => {
                        if (!caption) return;
                        setIsGenerating(true);
                        try {
                          const cap = await generateCaption({
                            description: `SHORT VERSION: ${description}`,
                            template: selectedTemplate,
                            businessName: businessProfile.name,
                            businessType: businessProfile.type,
                            brandStyle: businessProfile.brandStyle,
                          });
                          setCaption(cap);
                        } finally { setIsGenerating(false); }
                      }}
                      style={styles.quickActionBtn}
                    >
                      <Text style={styles.quickActionText}>Make shorter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="more-playful-btn"
                      onPress={async () => {
                        if (!caption) return;
                        setIsGenerating(true);
                        try {
                          const cap = await generateCaption({
                            description: `FUN & PLAYFUL VERSION: ${description}`,
                            template: selectedTemplate,
                            businessName: businessProfile.name,
                            businessType: businessProfile.type,
                            brandStyle: 'bold',
                          });
                          setCaption(cap);
                        } finally { setIsGenerating(false); }
                      }}
                      style={styles.quickActionBtn}
                    >
                      <Text style={styles.quickActionText}>More playful</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.btnStack}>
                <PrimaryButton
                  testID="post-now-btn"
                  title={`Post Now${enabledCount > 0 ? ` (${enabledCount})` : ''}`}
                  onPress={handlePostNow}
                  loading={isPosting}
                  disabled={enabledCount === 0 || !caption}
                  icon={<Ionicons name="paper-plane" size={18} color={Colors.white} />}
                />
                <TouchableOpacity
                  testID="schedule-post-btn"
                  onPress={() => {
                    if (!checkEntitlement()) { setShowPaywall(true); return; }
                    if (!caption) { showToast('Generate or write a caption first', 'error'); return; }
                    setShowSchedulePicker(true);
                  }}
                  activeOpacity={0.8}
                  style={styles.scheduleBtn}
                >
                  <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                  <Text style={styles.scheduleBtnText}>Schedule for Later</Text>
                </TouchableOpacity>
                <View style={styles.btnRow}>
                  <SecondaryButton
                    testID="regenerate-btn"
                    title="Regenerate"
                    onPress={handleRegenerate}
                    loading={isGenerating}
                    icon={<Ionicons name="refresh" size={16} color={Colors.textSecondary} />}
                  />
                  <SecondaryButton
                    testID="save-draft-btn-step2"
                    title="Save Draft"
                    onPress={handleSaveDraft}
                    icon={<Ionicons name="bookmark-outline" size={16} color={Colors.textSecondary} />}
                  />
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <SchedulePicker
        visible={showSchedulePicker}
        onConfirm={handleSchedulePost}
        onCancel={() => setShowSchedulePicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  kav: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  headerTitle: { ...Typography.h2 },
  stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, marginBottom: Spacing.lg, gap: 0 },
  stepperItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotInactive: { backgroundColor: Colors.border },
  stepNum: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  stepNumInactive: { color: Colors.textTertiary },
  stepLabel: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary },
  stepLabelActive: { color: Colors.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginBottom: 14, marginHorizontal: 6 },
  stepLineActive: { backgroundColor: Colors.primary },
  section: { paddingHorizontal: Spacing.base, marginBottom: Spacing.lg },
  sectionLabel: { ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.sm },
  chipsRow: { gap: Spacing.sm, paddingRight: Spacing.base },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.subtle, borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary },
  helperText: { marginTop: 8, fontSize: 12, color: Colors.textTertiary, fontStyle: 'italic' },
  photoPicker: { flexDirection: 'row', borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.paper, overflow: 'hidden', ...Shadows.sm },
  photoPickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  photoPickerBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  photoPickerDivider: { width: 1, backgroundColor: Colors.border },
  photoPickerCompact: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.paper },
  photoPreviewWrap: { position: 'relative' },
  photoPreview: { width: '100%', height: 200, borderRadius: BorderRadius.lg, backgroundColor: Colors.subtle },
  photoRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: Colors.white, borderRadius: 12 },
  input: { backgroundColor: Colors.paper, borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary, ...Shadows.sm },
  charCount: { fontSize: 11, color: Colors.textTertiary, textAlign: 'right', marginTop: 4 },
  btnStack: { paddingHorizontal: Spacing.base, gap: Spacing.md },
  btnRow: { flexDirection: 'row', gap: Spacing.md },
  scheduleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  scheduleBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.base, paddingBottom: Spacing.md },
  backBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  platformToggles: { flexDirection: 'row', gap: Spacing.md },
  platformToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.paper, ...Shadows.sm },
  platformToggleActive: { backgroundColor: Colors.paper },
  platformToggleText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textTertiary },
  connectLink: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  toggleDot: { width: 10, height: 10, borderRadius: 5 },
  previewCard: { borderRadius: BorderRadius.xl, overflow: 'hidden', backgroundColor: Colors.subtle, ...Shadows.md, position: 'relative' },
  previewImage: { width: '100%', height: 260 },
  previewPlaceholder: { height: 180, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewPlaceholderText: { ...Typography.bodySmall, color: Colors.textTertiary },
  aiTag: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full },
  aiTagText: { fontSize: 10, color: Colors.primary, fontWeight: '700' },
  captionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  captionInput: { backgroundColor: Colors.paper, borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingHorizontal: 14, paddingVertical: 14, fontSize: 14, color: Colors.textPrimary, lineHeight: 22, minHeight: 120, ...Shadows.sm },
  captionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  quickActions: { flexDirection: 'row', gap: 8 },
  quickActionBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, backgroundColor: Colors.primaryLight },
  quickActionText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
});

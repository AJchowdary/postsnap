import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';
import { generateCaption, generatePostImage, savePostToBackend, publishPostToBackend } from '../../src/services/api';
import PrimaryButton from '../../src/components/PrimaryButton';
import SecondaryButton from '../../src/components/SecondaryButton';
import { SchedulePicker } from '../../src/components/SchedulePicker';
import { TEMPLATES_BY_TYPE, Platform as SocialPlatform, BusinessType, Template } from '../../src/types';

const CREATE_BG = '#0d0d0d';
const CREATE_CARD = '#141414';
type TemplatePreview = { id: string; label: string; uri: string; mediaType: 'photo' | 'video' };

/** Raw base64 or full data URL from API */
function imageDataUri(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  if (s.startsWith('data:') || s.startsWith('http')) return s;
  return `data:image/jpeg;base64,${s}`;
}

const BUSINESS_TEMPLATE_MEDIA: Record<BusinessType, { uri: string; mediaType: 'photo' | 'video' }[]> = {
  restaurant: [
    { uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=300&h=380&fit=crop', mediaType: 'video' },
  ],
  salon: [
    { uri: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1582095133179-bfd08e2fc6b3?w=300&h=380&fit=crop', mediaType: 'video' },
  ],
  retail: [
    { uri: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1557821552-17105176677c?w=300&h=380&fit=crop', mediaType: 'video' },
  ],
  gym: [
    { uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=300&h=380&fit=crop', mediaType: 'video' },
  ],
  cafe: [
    { uri: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1511537190424-bbbab87ac5eb?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1494314671902-399b18174975?w=300&h=380&fit=crop', mediaType: 'video' },
    { uri: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=300&h=380&fit=crop', mediaType: 'photo' },
    { uri: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300&h=380&fit=crop', mediaType: 'video' },
  ],
};

function getBusinessTemplatePreviews(type: BusinessType, templates: Template[]): TemplatePreview[] {
  const media = BUSINESS_TEMPLATE_MEDIA[type] || BUSINESS_TEMPLATE_MEDIA.restaurant;
  return templates
    .filter((t) => t.id !== 'auto')
    .slice(0, 12)
    .map((t, i) => ({
      id: t.id,
      label: t.label,
      uri: media[i % media.length].uri,
      mediaType: media[i % media.length].mediaType,
    }));
}

export default function CreateScreen() {
  const router = useRouter();
  const businessProfile = useAppStore((s) => s.businessProfile);
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
  const [processedImageWithOverlay, setProcessedImageWithOverlay] = useState<string | null>(null);
  const [processedImageClean, setProcessedImageClean] = useState<string | null>(null);
  const [processedImageChoice, setProcessedImageChoice] = useState<'with' | 'clean'>('with');
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({
    instagram: !!socialAccounts.instagram?.connected,
    facebook: !!socialAccounts.facebook?.connected,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  const genBiz = {
    businessName: businessProfile.name,
    businessType: businessProfile.type,
    brandStyle: businessProfile.brandStyle,
    displayType: businessProfile.displayType,
    aiCategory: businessProfile.type,
    customDescription: businessProfile.customDescription || '',
  };

  const templates = TEMPLATES_BY_TYPE[businessProfile.type] || TEMPLATES_BY_TYPE.restaurant;
  const templatePreviews = useMemo(
    () => getBusinessTemplatePreviews(businessProfile.type, templates),
    [businessProfile.type, templates]
  );
  const photoTemplates = useMemo(
    () => templatePreviews.filter((t) => t.mediaType === 'photo'),
    [templatePreviews]
  );
  const videoTemplates = useMemo(
    () => templatePreviews.filter((t) => t.mediaType === 'video'),
    [templatePreviews]
  );
  const selectedTpl = templates.find((t) => t.id === selectedTemplate);
  const isBeforeAfter = selectedTpl?.beforeAfter;

  useEffect(() => {
    if (!currentEdit) return;
    if (currentEdit.id) setDraftId(currentEdit.id);
    if (currentEdit.template) setSelectedTemplate(currentEdit.template);
    if (currentEdit.photo) setPhoto(currentEdit.photo);
    if (currentEdit.description) setDescription(currentEdit.description);
    if (currentEdit.caption) {
      setCaption(currentEdit.caption);
      setStep(2);
    }
    if (currentEdit.processedImage) {
      setProcessedImage(currentEdit.processedImage);
      setProcessedImageWithOverlay(currentEdit.processedImage);
      setProcessedImageClean(currentEdit.processedImage);
      setProcessedImageChoice('with');
    }
  }, [currentEdit]);

  useEffect(() => {
    return () => setCurrentEdit(null);
  }, [setCurrentEdit]);

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
    if (!photo) {
      showToast('Upload a photo first', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const photoToUse = isBeforeAfter ? (beforePhoto || photo) : photo;
      const effectiveTemplate = 'auto';
      const effectiveDescription = description.trim() || `Create a polished post for ${businessProfile.displayType}`;
      const [cap, imgResult] = await Promise.all([
        generateCaption({
          description: effectiveDescription,
          template: effectiveTemplate,
          ...genBiz,
        }),
        photoToUse
          ? generatePostImage({
              photo: photoToUse,
              template: effectiveTemplate,
              description: effectiveDescription,
              ...genBiz,
            })
          : Promise.resolve(null),
      ]);
      setCaption(cap);
      let savedProcessed: string | undefined;
      if (imgResult) {
        setProcessedImageWithOverlay(imgResult.withOverlay);
        setProcessedImageClean(imgResult.clean);
        const pick = imgResult.withOverlay ?? imgResult.clean ?? null;
        setProcessedImage(pick);
        setProcessedImageChoice(imgResult.withOverlay ? 'with' : 'clean');
        savedProcessed = pick ?? undefined;
      } else {
        setProcessedImageWithOverlay(null);
        setProcessedImageClean(null);
        setProcessedImage(null);
        savedProcessed = undefined;
      }

      // Auto-save draft
      const enabledPlatforms = Object.keys(platforms).filter((k) => platforms[k]) as SocialPlatform[];
      const draft = await savePostToBackend({
        template: effectiveTemplate,
        photo: photo || undefined,
        description: effectiveDescription,
        caption: cap,
        processedImage: savedProcessed,
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
      template: 'auto',
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
        template: 'auto',
        ...genBiz,
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
        template: 'auto',
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
    setProcessedImageWithOverlay(null);
    setProcessedImageClean(null);
    setProcessedImageChoice('with');
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
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <Ionicons name="sparkles" size={14} color={Colors.primary} />
              <Text style={styles.brandText}>Quickpost</Text>
            </View>
            <View style={styles.avatarDot}>
              <Ionicons name="person" size={12} color={Colors.white} />
            </View>
          </View>

          {/* ===== STEP 1 ===== */}
          {step === 1 && (
            <>
              <View style={[styles.section, styles.blockCard]}>
                <Text style={styles.vibeTitle}>What&apos;s the vibe today?</Text>
                <TextInput
                  testID="description-input"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe your post in one line..."
                  placeholderTextColor="#666"
                  style={styles.vibeInput}
                  returnKeyType="done"
                  maxLength={120}
                  multiline
                  textAlignVertical="top"
                />
                <View style={styles.vibeActions}>
                  <TouchableOpacity
                    testID="photo-library-btn"
                    onPress={() => pickPhoto('main')}
                    activeOpacity={0.85}
                    style={styles.uploadChip}
                  >
                    <Ionicons name="cloud-upload-outline" size={14} color={Colors.textPrimary} />
                    <Text style={styles.uploadChipText}>{photo ? 'Change Upload' : 'Upload'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="photo-camera-btn"
                    onPress={takePhoto}
                    activeOpacity={0.85}
                    style={styles.uploadChip}
                  >
                    <Ionicons name="camera-outline" size={14} color={Colors.textPrimary} />
                    <Text style={styles.uploadChipText}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="generate-post-btn"
                    onPress={handleGeneratePost}
                    activeOpacity={0.9}
                    disabled={!photo || isGenerating}
                    style={styles.generateMiniBtn}
                  >
                    {isGenerating ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={styles.generateMiniBtnText}>Generate</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {!!photo && (
                <View style={[styles.section, styles.blockCard]}>
                  <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.photoPreview} />
                </View>
              )}

              <View style={styles.section}>
                <View style={styles.sectionHeadRow}>
                  <Text style={styles.sectionHeaderTitle}>Photo Templates</Text>
                  <Text style={styles.viewAllText}>Tap to open</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageTplRow}>
                  {photoTemplates.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      testID={`business-template-${t.id}`}
                      activeOpacity={0.85}
                      onPress={() =>
                        router.push({
                          pathname: '/template-workflow',
                          params: { templateId: t.id },
                        } as any)
                      }
                      style={styles.imageTplWrap}
                    >
                      <View style={styles.templateMediaWrap}>
                        <Image source={{ uri: t.uri }} style={styles.imageTplImg} />
                        {t.mediaType === 'video' && (
                          <View style={styles.videoBadge}>
                            <Ionicons name="play" size={12} color={Colors.white} />
                            <Text style={styles.videoBadgeText}>Video</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.imageTplLabel} numberOfLines={1}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeadRow}>
                  <Text style={styles.sectionHeaderTitle}>Video Templates</Text>
                  <Text style={styles.viewAllText}>Tap to open</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageTplRow}>
                  {videoTemplates.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      testID={`business-video-template-${t.id}`}
                      activeOpacity={0.85}
                      onPress={() =>
                        router.push({
                          pathname: '/template-workflow',
                          params: { templateId: t.id },
                        } as any)
                      }
                      style={styles.imageTplWrap}
                    >
                      <View style={styles.templateMediaWrap}>
                        <Image source={{ uri: t.uri }} style={styles.imageTplImg} />
                        <View style={styles.videoBadge}>
                          <Ionicons name="play" size={12} color={Colors.white} />
                          <Text style={styles.videoBadgeText}>Video</Text>
                        </View>
                      </View>
                      <Text style={styles.imageTplLabel} numberOfLines={1}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Buttons */}
              <View style={styles.btnStack}>
                <SecondaryButton
                  testID="save-draft-btn-step1"
                  title="Save Draft"
                  onPress={handleSaveDraft}
                  disabled={!photo}
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
                {processedImageWithOverlay && processedImageClean && (
                  <View style={styles.photoVariantRow}>
                    <TouchableOpacity
                      testID="preview-variant-with-text"
                      activeOpacity={0.85}
                      onPress={() => {
                        setProcessedImageChoice('with');
                        if (processedImageWithOverlay) setProcessedImage(processedImageWithOverlay);
                      }}
                      style={[
                        styles.photoVariantThumb,
                        processedImageChoice === 'with' && styles.photoVariantThumbSelected,
                      ]}
                    >
                      <Image
                        source={{ uri: imageDataUri(processedImageWithOverlay) ?? '' }}
                        style={styles.photoVariantImg}
                        resizeMode="cover"
                      />
                      <Text style={styles.photoVariantLabel}>With Text</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="preview-variant-clean"
                      activeOpacity={0.85}
                      onPress={() => {
                        setProcessedImageChoice('clean');
                        if (processedImageClean) setProcessedImage(processedImageClean);
                      }}
                      style={[
                        styles.photoVariantThumb,
                        processedImageChoice === 'clean' && styles.photoVariantThumbSelected,
                      ]}
                    >
                      <Image
                        source={{ uri: imageDataUri(processedImageClean) ?? '' }}
                        style={styles.photoVariantImg}
                        resizeMode="cover"
                      />
                      <Text style={styles.photoVariantLabel}>Clean</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.previewCard}>
                  {displayImage ? (
                    <Image
                      testID="preview-image"
                      source={{ uri: imageDataUri(displayImage) ?? `data:image/jpeg;base64,${displayImage}` }}
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
                            template: 'auto',
                            ...genBiz,
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
                            template: 'auto',
                            ...genBiz,
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
                  title={`Confirm & Post${enabledCount > 0 ? ` (${enabledCount})` : ''}`}
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
                  <Text style={styles.scheduleBtnText}>Confirm & Schedule</Text>
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
  safe: { flex: 1, backgroundColor: CREATE_BG },
  kav: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 120 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  avatarDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  headerTitle: { ...Typography.h2, color: Colors.textPrimary },
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
  blockCard: {
    backgroundColor: CREATE_CARD,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  sectionLabel: { ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: Spacing.sm, color: Colors.textSecondary },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionHeaderTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  viewAllText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  vibeTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  vibeInput: {
    backgroundColor: '#101522',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 84,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  vibeActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: '#111827',
  },
  uploadChipText: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600' },
  generateMiniBtn: {
    marginLeft: 'auto',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  generateMiniBtnText: { color: Colors.white, fontWeight: '800', fontSize: 12 },
  modeRow: { gap: 8 },
  modeChip: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: '#101010',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  modeTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2 },
  modeTitleActive: { color: Colors.primary },
  modeDesc: { fontSize: 12, color: Colors.textSecondary },
  modeHintBox: {
    marginTop: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modeHintText: { fontSize: 12, color: Colors.textSecondary },
  sectionLabelMuted: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: '#888', marginBottom: 4 },
  sectionLabelSpaced: { marginTop: Spacing.md },
  templatesLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  templatesLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  templatesLinkText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  exploreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    marginBottom: Spacing.md,
    maxWidth: '100%',
  },
  exploreChipText: { fontSize: 12, fontWeight: '600', color: Colors.primary, flexShrink: 1 },
  trendRow: { gap: 10, paddingVertical: 4 },
  trendThumbWrap: {
    width: 90,
    alignItems: 'center',
    gap: 6,
    borderRadius: BorderRadius.sm,
    padding: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  trendThumbWrapSelected: { borderColor: Colors.primary },
  trendThumb: { width: 90, height: 90, borderRadius: BorderRadius.sm, backgroundColor: '#222' },
  trendLabel: { fontSize: 11, color: '#888', fontWeight: '600', maxWidth: 90, textAlign: 'center' },
  trendLabelSelected: { color: Colors.primary },
  imageTplRow: { gap: 10, paddingVertical: 4 },
  imageTplWrap: {
    width: 110,
    alignItems: 'center',
    gap: 6,
    borderRadius: BorderRadius.sm,
    padding: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  imageTplWrapSelected: { borderColor: Colors.primary },
  templateMediaWrap: { width: 110, height: 140, borderRadius: BorderRadius.sm, overflow: 'hidden', position: 'relative' },
  imageTplImg: { width: 110, height: 140, borderRadius: BorderRadius.sm, backgroundColor: '#222' },
  videoBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  videoBadgeText: { fontSize: 10, color: Colors.white, fontWeight: '700' },
  imageTplLabel: { fontSize: 11, color: '#888', fontWeight: '600', maxWidth: 110, textAlign: 'center' },
  imageTplLabelSelected: { color: Colors.primary },
  promptTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: Spacing.md },
  helperText: { marginTop: 8, fontSize: 12, color: Colors.textTertiary, fontStyle: 'italic' },
  genBtnOuter: { borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.sm },
  genBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  genBtnGradDisabled: { opacity: 0.45 },
  genBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  photoPicker: { flexDirection: 'row', borderRadius: BorderRadius.lg, backgroundColor: Colors.surfaceContainerHighest, overflow: 'hidden', ...Shadows.sm },
  photoPickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  photoPickerBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  photoPickerDivider: { width: 10 },
  photoPickerCompact: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: BorderRadius.lg, backgroundColor: Colors.surfaceContainerHighest },
  photoPreviewWrap: { position: 'relative' },
  photoPreview: { width: '100%', height: 200, borderRadius: BorderRadius.lg, backgroundColor: Colors.subtle },
  photoRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: Colors.white, borderRadius: 12 },
  input: { backgroundColor: Colors.surfaceContainerHighest, borderRadius: BorderRadius.lg, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary, ...Shadows.sm },
  promptInput: {
    backgroundColor: '#0a0a0a',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  charCount: { fontSize: 11, color: Colors.textTertiary, textAlign: 'right', marginTop: 4 },
  btnStack: { paddingHorizontal: Spacing.base, gap: Spacing.md },
  btnRow: { flexDirection: 'row', gap: Spacing.md },
  scheduleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  scheduleBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.base, paddingBottom: Spacing.md },
  backBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  platformToggles: { flexDirection: 'row', gap: Spacing.md },
  platformToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: BorderRadius.lg, backgroundColor: Colors.surfaceContainer, ...Shadows.sm },
  platformToggleActive: { backgroundColor: Colors.surfaceContainerHighest },
  platformToggleText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textTertiary },
  connectLink: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  toggleDot: { width: 10, height: 10, borderRadius: 5 },
  photoVariantRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.md,
  },
  photoVariantThumb: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: CREATE_CARD,
  },
  photoVariantThumbSelected: {
    borderColor: Colors.primary,
  },
  photoVariantImg: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#222',
  },
  photoVariantLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    paddingVertical: 8,
  },
  previewCard: { borderRadius: BorderRadius.xl, overflow: 'hidden', backgroundColor: Colors.subtle, ...Shadows.md, position: 'relative' },
  previewImage: { width: '100%', height: 260 },
  previewPlaceholder: { height: 180, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewPlaceholderText: { ...Typography.bodySmall, color: Colors.textTertiary },
  aiTag: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full },
  aiTagText: { fontSize: 10, color: Colors.primary, fontWeight: '700' },
  captionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  captionInput: { backgroundColor: Colors.surfaceContainerHighest, borderRadius: BorderRadius.lg, paddingHorizontal: 14, paddingVertical: 14, fontSize: 14, color: Colors.textPrimary, lineHeight: 22, minHeight: 120, ...Shadows.sm },
  captionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  quickActions: { flexDirection: 'row', gap: 8 },
  quickActionBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, backgroundColor: Colors.primaryLight },
  quickActionText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
});

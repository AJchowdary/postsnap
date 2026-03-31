import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Image,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius, GradientColors } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/appStore';
import {
  editCaptionWithAI,
  generateCaptionDetailed,
  generatePostImage,
  getCampaignSuggestions,
  publishPostToBackend,
  savePostToBackend,
  type EditCaptionChatTurn,
} from '../../src/services/api';
import type { BusinessType, Platform as SocialPlatform, Post, SuggestionCard } from '../../src/types';
import { getTopicSuggestions } from '../../src/constants/quickTopicFallbacks';
import AccountSelectorSheet from '../../src/components/AccountSelectorSheet';

const ASPECT_FOUR_FIVE: [number, number] = [4, 5];
const IDEA_MAX = 280;
const WARN_LEN = 260;
const SCROLL_TO_INPUT_Y = 200;
const TEMP_POST_PREFIX = 'temp-';

const AI_QUICK_CHIPS = [
  'Improve the style',
  'Rewrite the post',
  'Enhance the image',
  'Change the tone',
  'Make it shorter',
  'Make it punchier',
  'Add a stronger CTA',
  'Make it more local',
] as const;

type PreviewChatMsg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  apply?: { caption: string; tags: string[] };
};

function mergeCaptionAndHashtags(body: string, tags: string[]): string {
  const trimmed = body.trim();
  const tagStr = tags.map((t) => `#${t.replace(/^#/, '')}`).join(' ');
  return tagStr ? `${trimmed}\n\n${tagStr}` : trimmed;
}

function PreviewTypingIndicator() {
  const d1 = useRef(new Animated.Value(0.35)).current;
  const d2 = useRef(new Animated.Value(0.35)).current;
  const d3 = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 280, useNativeDriver: true }),
        ])
      );
    const a1 = pulse(d1, 0);
    const a2 = pulse(d2, 120);
    const a3 = pulse(d3, 240);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [d1, d2, d3]);
  return (
    <View style={styles.aiTypingRow}>
      <Animated.View style={[styles.aiTypingDot, { opacity: d1 }]} />
      <Animated.View style={[styles.aiTypingDot, { opacity: d2 }]} />
      <Animated.View style={[styles.aiTypingDot, { opacity: d3 }]} />
    </View>
  );
}

function extractHashtagsFromCaption(caption: string): string[] {
  const m = caption.match(/#[\w\u0080-\uFFFF]+/g) ?? [];
  const tags = m.map((t) => t.slice(1));
  return [...new Set(tags)];
}

/** Prose line for preview; falls back to full caption if stripping removes everything. */
function captionBodyForPreview(caption: string): string {
  const stripped = caption.replace(/#[\w\u0080-\uFFFF]+/g, '').replace(/\s{2,}/g, ' ').trim();
  return stripped.length > 0 ? stripped : caption;
}

function resolvePreviewImageUri(post: Post): string | null {
  if (post.processedImageUrl) return post.processedImageUrl;
  if (post.photoUrl) return post.photoUrl;
  const raw = post.processedImage || post.photo;
  if (!raw) return null;
  if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

function safeOptString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}

function safeOptStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return out.length ? out : undefined;
}

function safeStudioStyle(
  v: unknown
): 'clean-white' | 'lifestyle' | 'dark-dramatic' | 'flat-lay' | 'outdoor-natural' | undefined {
  if (v !== 'clean-white' && v !== 'lifestyle' && v !== 'dark-dramatic' && v !== 'flat-lay' && v !== 'outdoor-natural') {
    return undefined;
  }
  return v;
}

function isPersistedPostId(id: string | undefined): boolean {
  return !!id && !id.startsWith(TEMP_POST_PREFIX);
}

function imageUnavailableMessage(meta?: { aiProvider?: string; openaiConfigured?: boolean; imageError?: string | null }): string {
  if (!meta) return 'No AI image available right now.';
  if (meta.aiProvider === 'mock') {
    return 'Image generation is unavailable because the backend is using mock AI.';
  }
  if (meta.openaiConfigured === false) {
    return 'Image generation is unavailable because OpenAI is not configured on the backend.';
  }
  if (meta.imageError === 'NO_IMAGE_OUTPUT') {
    return 'No image came back for this idea. Try adding a photo or making the offer text more specific.';
  }
  return 'No AI image was returned for this prompt. Try a more specific idea or add a source photo.';
}

function SkeletonChip() {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <Animated.View style={[styles.skeletonPill, { opacity: pulse }]}>
      <View style={styles.skeletonInner} />
    </Animated.View>
  );
}

function PreviewPanelSkeleton() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.95, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <View style={styles.previewSkelBody}>
      <Animated.View style={[styles.previewSkelHero, { opacity: pulse }]} />
      <Animated.View style={[styles.previewSkelLine, { opacity: pulse, width: '92%' }]} />
      <Animated.View style={[styles.previewSkelLine, { opacity: pulse, width: '78%' }]} />
      <Animated.View style={[styles.previewSkelLine, { opacity: pulse, width: '85%' }]} />
      <Animated.View style={[styles.previewSkelLine, { opacity: pulse, width: '40%' }]} />
    </View>
  );
}

export default function CreateScreen() {
  const router = useRouter();
  const businessProfile = useAppStore((s) => s.businessProfile);
  const addPost = useAppStore((s) => s.addPost);
  const updatePost = useAppStore((s) => s.updatePost);
  const showToast = useAppStore((s) => s.showToast);
  const setCurrentEdit = useAppStore((s) => s.setCurrentEdit);
  const checkEntitlement = useAppStore((s) => s.checkEntitlement);
  const setShowPaywall = useAppStore((s) => s.setShowPaywall);
  const setPaywallSuccessCallback = useAppStore((s) => s.setPaywallSuccessCallback);

  const [ideaText, setIdeaText] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionCard[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [ideaFocused, setIdeaFocused] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<Post | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [aiChatVisible, setAiChatVisible] = useState(false);
  const [chatHistory, setChatHistory] = useState<PreviewChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedAiChip, setSelectedAiChip] = useState<string | null>(null);
  const [appliedMsgId, setAppliedMsgId] = useState<string | null>(null);
  const [accountSelectorVisible, setAccountSelectorVisible] = useState(false);
  const [previewRegenerating, setPreviewRegenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [captionAiProvider, setCaptionAiProvider] = useState<string | null>(null);
  const [imageEnhancing, setImageEnhancing] = useState(false);
  const panelAnim = useRef(new Animated.Value(0)).current;
  const aiChatSlideAnim = useRef(new Animated.Value(0)).current;
  const pendingScrollToPreviewRef = useRef(false);
  const previewPanelLayoutYRef = useRef(0);
  const aiChatScrollRef = useRef<ScrollView>(null);
  const chatHistoryRef = useRef<PreviewChatMsg[]>([]);

  const scrollRef = useRef<ScrollView>(null);
  const ideaInputRef = useRef<TextInput>(null);

  const genBiz = useMemo(
    () => ({
      businessName: businessProfile.name,
      businessType: businessProfile.type,
      brandStyle: businessProfile.brandStyle,
      displayType: businessProfile.displayType,
      aiCategory: businessProfile.type,
      customDescription: businessProfile.customDescription || '',
      brandColor: safeOptString(businessProfile.brandColor),
      brandVibe: safeOptString(businessProfile.brandVibe),
      dominantColors: safeOptStringArray(businessProfile.dominantColors),
      websiteSummary: safeOptString(businessProfile.websiteSummary),
      city: safeOptString(businessProfile.city),
      instagramHandle: safeOptString(businessProfile.instagramHandle),
      toneOfVoice: safeOptString(businessProfile.toneOfVoice),
      contentPersona: safeOptString(businessProfile.contentPersona),
      uniqueDifferentiator: safeOptString(businessProfile.uniqueDifferentiator),
      visualStyle: safeOptString(businessProfile.visualStyle),
      studioBgColor: safeOptString(businessProfile.studioBgColor),
      studioStylePreference: safeStudioStyle(businessProfile.studioStylePreference),
    }),
    [businessProfile]
  );

  const previewBrandGradient = useMemo((): [string, string] => {
    const a = businessProfile.brandColor || Colors.primary;
    const b = businessProfile.dominantColors?.[0] || Colors.primaryDark;
    return [a, b];
  }, [businessProfile.brandColor, businessProfile.dominantColors]);

  const loadSuggestions = useCallback(
    async (hint?: string) => {
      setSuggestionsLoading(true);
      try {
        const res = await getCampaignSuggestions(hint?.trim() || undefined);
        if (res.ideas?.length) {
          setSuggestions(res.ideas as SuggestionCard[]);
        } else {
          setSuggestions(getTopicSuggestions(businessProfile.type as BusinessType));
        }
      } catch {
        setSuggestions(getTopicSuggestions(businessProfile.type as BusinessType));
      } finally {
        setSuggestionsLoading(false);
      }
    },
    [businessProfile.type]
  );

  useFocusEffect(
    useCallback(() => {
      setIdeaText('');
      setSelectedPhoto(null);
      setSelectedChip(null);
      setIdeaFocused(false);
      setIsGenerating(false);
      setGeneratedPost(null);
      setPreviewVisible(false);
      setPreviewRegenerating(false);
      setGenerateError(null);
      setCaptionAiProvider(null);
      setImageEnhancing(false);
      setAiChatVisible(false);
      panelAnim.setValue(0);
      setCurrentEdit(null);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      void loadSuggestions();
      return undefined;
    }, [loadSuggestions, setCurrentEdit, panelAnim])
  );

  useEffect(() => {
    if (!aiChatVisible) {
      setChatHistory([]);
      setChatInput('');
      setSelectedAiChip(null);
      setIsAiLoading(false);
      aiChatSlideAnim.setValue(0);
      return;
    }
    aiChatSlideAnim.setValue(0);
    Animated.spring(aiChatSlideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [aiChatVisible, aiChatSlideAnim]);

  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  useEffect(() => {
    if (!previewVisible || !generatedPost?.id || previewRegenerating) return;
    const t = requestAnimationFrame(() => {
      const y = previewPanelLayoutYRef.current;
      if (y > 0) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
      }
    });
    return () => cancelAnimationFrame(t);
  }, [generatedPost?.id, previewRegenerating, previewVisible]);

  const pickPhotoFromLibrary = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to pick photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: ASPECT_FOUR_FIVE,
        quality: 0.72,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setSelectedPhoto(result.assets[0].base64);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open photo library.';
      Alert.alert('Photo library unavailable', msg);
    }
  }, []);

  const takePhotoWithCamera = useCallback(async () => {
    try {
      // iOS simulator does not provide a real camera feed.
      if (Platform.OS === 'ios' && !Constants.isDevice) {
        Alert.alert('Camera unavailable', 'Camera is not available on iOS simulator. Use Choose Photo instead.');
        return;
      }
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow camera access to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: ASPECT_FOUR_FIVE,
        quality: 0.72,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setSelectedPhoto(result.assets[0].base64);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open camera.';
      Alert.alert('Camera unavailable', msg);
    }
  }, []);

  const onChipPress = useCallback(
    (card: SuggestionCard) => {
      setIdeaText(card.headline);
      setSelectedChip(card.id);
      setTimeout(() => {
        ideaInputRef.current?.focus();
        scrollRef.current?.scrollTo({ y: SCROLL_TO_INPUT_Y, animated: true });
      }, 80);
    },
    []
  );

  const onMoreIdeas = useCallback(() => {
    void loadSuggestions(ideaText.trim() || undefined);
  }, [loadSuggestions, ideaText]);

  const dismissPreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewRegenerating(false);
    setGeneratedPost(null);
    setAiChatVisible(false);
    panelAnim.setValue(0);
  }, [panelAnim]);

  const handlePreviewPostPress = useCallback(() => {
    if (previewRegenerating || !generatedPost) return;
    setAccountSelectorVisible(true);
  }, [generatedPost, previewRegenerating]);

  const persistPostDraft = useCallback(
    async (post: Post, platforms: SocialPlatform[]): Promise<Post> => {
      const saved = await savePostToBackend({
        id: isPersistedPostId(post.id) ? post.id : undefined,
        template: post.template,
        description: post.description,
        caption: post.caption,
        photo: post.photo,
        processedImage: post.processedImage,
        platforms,
        status: 'draft',
      });

      if (isPersistedPostId(post.id)) {
        updatePost(saved.id, saved);
      } else {
        addPost(saved);
      }
      setGeneratedPost(saved);
      return saved;
    },
    [addPost, updatePost]
  );

  const handlePublishFromSheet = useCallback(
    async (_accountIds: string[], platforms: string[]) => {
      const post = generatedPostRef.current;
      if (!post) {
        throw new Error('No post to publish');
      }

      if (!checkEntitlement()) {
        setPaywallSuccessCallback(() => setAccountSelectorVisible(true));
        setShowPaywall(true);
        throw new Error('PAYWALL');
      }

      const plats = platforms.filter((p): p is SocialPlatform => p === 'instagram' || p === 'facebook');
      if (plats.length === 0) {
        throw new Error('No platforms');
      }

      const saved = await persistPostDraft(post, plats);

      try {
        const result = await publishPostToBackend(saved.id, plats);
        if (!result.success) {
          throw new Error(result.message || 'Failed to post');
        }
      } catch (e: unknown) {
        const payload = (e as { payload?: unknown })?.payload;
        if (payload != null) {
          setPaywallSuccessCallback(() => setAccountSelectorVisible(true));
          setShowPaywall(true);
          throw new Error('PAYWALL');
        }
        throw e instanceof Error ? e : new Error('Failed to post');
      }

      updatePost(saved.id, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        caption: saved.caption,
        platforms: plats,
      });
    },
    [checkEntitlement, persistPostDraft, setPaywallSuccessCallback, setShowPaywall, updatePost]
  );

  const handleSaveDraftFromSheet = useCallback(async () => {
    const post = generatedPostRef.current;
    if (!post) throw new Error('No post to save');
    await persistPostDraft(post, post.platforms.length ? post.platforms : ['instagram', 'facebook']);
  }, [persistPostDraft]);

  const onAccountSheetPosted = useCallback(() => {
    showToast('Your post is live! 🎉', 'success');
    setIdeaText('');
    setSelectedPhoto(null);
    setSelectedChip(null);
    setGeneratedPost(null);
    setPreviewVisible(false);
    setPreviewRegenerating(false);
    setAiChatVisible(false);
    panelAnim.setValue(0);
    setCurrentEdit(null);
    setAccountSelectorVisible(false);
    router.replace('/(tabs)/home' as any);
  }, [panelAnim, router, setCurrentEdit, showToast]);

  const onAccountSheetDrafted = useCallback(() => {
    setAccountSelectorVisible(false);
    showToast('Saved to drafts', 'success');
  }, [showToast]);

  const previewHashtags = useMemo(
    () => (generatedPost ? extractHashtagsFromCaption(generatedPost.caption) : []),
    [generatedPost]
  );

  const generatedPostRef = useRef(generatedPost);
  useEffect(() => {
    generatedPostRef.current = generatedPost;
  }, [generatedPost]);

  const scrollAiChatToEnd = useCallback(() => {
    setTimeout(() => aiChatScrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const scrollMainToPreviewTop = useCallback(() => {
    const y = previewPanelLayoutYRef.current;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, []);

  const sendAiMessage = useCallback(
    async (raw: string, fromQuickChip: boolean) => {
      const text = raw.trim();
      const post = generatedPostRef.current;
      if (!text || isAiLoading || !post) return;
      const isEnhanceImageRequest = fromQuickChip && /enhance.*image/i.test(text);

      if (!fromQuickChip) setSelectedAiChip(null);
      if (fromQuickChip) setSelectedAiChip(text);

      const prior: EditCaptionChatTurn[] = chatHistoryRef.current.slice(-10).map(({ role, content }) => ({
        role,
        content,
      }));

      const uid = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setChatHistory((h) => [...h, { id: uid, role: 'user', content: text }]);
      setChatInput('');
      setIsAiLoading(true);
      if (isEnhanceImageRequest) setImageEnhancing(true);
      scrollAiChatToEnd();

      try {
        if (isEnhanceImageRequest) {
          const img = await generatePostImage({
            ...(post.photo ? { photo: post.photo } : {}),
            template: post.template || 'auto',
            description: post.description || ideaText || 'Enhance image',
            aspectPreset: 'story',
            ...genBiz,
          });
          const processed = img?.withOverlay ?? img?.clean ?? img?.variants?.[0] ?? undefined;
          const aid = `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

          if (!processed) {
            setChatHistory((h) => [
              ...h,
              {
                id: aid,
                role: 'assistant',
                content: imageUnavailableMessage(img ?? undefined),
                isError: true,
              },
            ]);
            return;
          }

          setGeneratedPost((curr) =>
            curr && curr.id === post.id ? { ...curr, processedImage: processed } : curr
          );
          if (isPersistedPostId(post.id)) {
            updatePost(post.id, { processedImage: processed });
          }
          setChatHistory((h) => [
            ...h,
            {
              id: aid,
              role: 'assistant',
              content: 'Image enhanced. Applied to the preview.',
            },
          ]);
          return;
        }

        const data = await editCaptionWithAI({
          userRequest: text,
          currentCaption: post.caption,
          currentHashtags: extractHashtagsFromCaption(post.caption),
          businessName: businessProfile.name,
          city: businessProfile.city || '',
          ideaText,
          chatHistory: prior,
        });
        const aid = `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setChatHistory((h) => [
          ...h,
          {
            id: aid,
            role: 'assistant',
            content: data.message,
            apply: { caption: data.newCaption, tags: data.newHashtags },
          },
        ]);
      } catch (err) {
        const detail =
          err instanceof Error && err.message === 'UNAUTHORIZED'
            ? 'Session expired. Please log in again.'
            : err instanceof Error && err.message
              ? err.message
              : 'Something went wrong. Try again.';
        const aid = `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setChatHistory((h) => [
          ...h,
          { id: aid, role: 'assistant', content: detail, isError: true },
        ]);
      } finally {
        setIsAiLoading(false);
        if (isEnhanceImageRequest) setImageEnhancing(false);
        setSelectedAiChip(null);
        scrollAiChatToEnd();
      }
    },
    [isAiLoading, businessProfile.name, businessProfile.city, genBiz, ideaText, scrollAiChatToEnd, updatePost]
  );

  const applyAiSuggestion = useCallback(
    (msg: PreviewChatMsg) => {
      if (!msg.apply || !generatedPostRef.current) return;
      const nextCaption = mergeCaptionAndHashtags(msg.apply.caption, msg.apply.tags);
      const id = generatedPostRef.current.id;
      setGeneratedPost((p) => (p ? { ...p, caption: nextCaption } : null));
      if (isPersistedPostId(id)) {
        updatePost(id, { caption: nextCaption });
      }
      setAppliedMsgId(msg.id);
      setTimeout(() => setAppliedMsgId(null), 1200);
      scrollMainToPreviewTop();
    },
    [updatePost, scrollMainToPreviewTop]
  );

  const handleCreatePost = async () => {
    const text = ideaText.trim();
    if (!text || isGenerating) return;

    setGenerateError(null);
    setCaptionAiProvider(null);
    const hadPreview = Boolean(previewVisible && generatedPost);
    setGeneratedPost(null);
    setAiChatVisible(false);
    setChatHistory([]);
    chatHistoryRef.current = [];
    setPreviewRegenerating(true);
    setPreviewVisible(true);
    panelAnim.setValue(1);

    setIsGenerating(true);
    try {
      const cap = await generateCaptionDetailed({
        description: text,
        template: 'auto',
        ...genBiz,
      });
      setCaptionAiProvider(cap.aiProvider ?? null);
      const post: Post = {
        id: `${TEMP_POST_PREFIX}${Date.now()}`,
        template: 'auto',
        description: text,
        caption: cap.caption,
        photo: selectedPhoto ?? undefined,
        processedImage: undefined,
        platforms: ['instagram', 'facebook'],
        status: 'draft',
        createdAt: new Date().toISOString(),
      };

      setPreviewRegenerating(false);
      setGeneratedPost(post);
      setPreviewVisible(true);
      pendingScrollToPreviewRef.current = true;
      if (!hadPreview) {
        panelAnim.setValue(0);
        Animated.spring(panelAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 10,
        }).start();
      } else {
        panelAnim.setValue(1);
      }

      // Generate image after preview is already visible so user isn't blocked.
      setImageEnhancing(true);
      void (async () => {
        try {
          const img = await generatePostImage({
            ...(selectedPhoto ? { photo: selectedPhoto } : {}),
            template: 'auto',
            description: text,
            aspectPreset: 'story',
            ...genBiz,
          });
          const processed = img?.withOverlay ?? img?.clean ?? img?.variants?.[0] ?? undefined;
          if (!processed) {
            showToast(imageUnavailableMessage(img ?? undefined), 'info');
            return;
          }
          setGeneratedPost((curr) => (curr && curr.id === post.id ? { ...curr, processedImage: processed } : curr));
        } catch (err) {
          const msg = err instanceof Error && err.message ? err.message : 'Image generation failed';
          showToast(msg, 'error');
        } finally {
          setImageEnhancing(false);
        }
      })();
    } catch (e) {
      setImageEnhancing(false);
      setPreviewRegenerating(false);
      setPreviewVisible(false);
      const msg =
        e instanceof Error && e.message === 'UNAUTHORIZED'
          ? 'Session expired. Please log in again.'
          : e instanceof Error && e.message
            ? e.message
            : 'Could not create your post. Try again.';
      setGenerateError(msg);
      showToast(msg, 'error');
      if (e instanceof Error && e.message === 'UNAUTHORIZED') {
        router.replace('/auth' as any);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const len = ideaText.length;
  const counterColor = len >= WARN_LEN ? Colors.warning : Colors.textMuted;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)/home');
              }}
              hitSlop={12}
              accessibilityLabel="Back to home"
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Create</Text>
            <View style={styles.topBarSpacer} />
          </View>
          <Text style={styles.subtitle}>What&apos;s today&apos;s post about?</Text>

          <Text style={styles.stripLabel}>Quick ideas</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripRow}
            style={styles.stripScroll}
          >
            {suggestionsLoading
              ? [0, 1, 2, 3].map((i) => <SkeletonChip key={`sk-${i}`} />)
              : suggestions.map((card) => {
                  const selected = selectedChip === card.id;
                  return (
                    <TouchableOpacity
                      key={card.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => onChipPress(card)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.angleDot, selected && styles.angleDotOn]} />
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
                        {card.headline}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            <TouchableOpacity style={styles.moreIdeas} onPress={onMoreIdeas} disabled={suggestionsLoading}>
              <Text style={styles.moreIdeasText}>More ideas →</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.inputWrap}>
            <TextInput
              ref={ideaInputRef}
              style={[
                styles.ideaInput,
                ideaFocused && styles.ideaInputFocused,
              ]}
              placeholder="e.g. We just got new summer products in store — come check them out"
              placeholderTextColor={Colors.textMuted}
              value={ideaText}
              onChangeText={(t) => setIdeaText(t.slice(0, IDEA_MAX))}
              onFocus={() => setIdeaFocused(true)}
              onBlur={() => setIdeaFocused(false)}
              multiline
              textAlignVertical="top"
              maxLength={IDEA_MAX}
            />
            <Text style={[styles.counter, { color: counterColor }]}>
              {len}/{IDEA_MAX}
            </Text>
            <View style={styles.ideaInputActions}>
              {ideaText.length > 0 ? (
                <TouchableOpacity
                  style={styles.ideaClearBtn}
                  onPress={() => {
                    setIdeaText('');
                    setSelectedChip(null);
                  }}
                  activeOpacity={0.85}
                  accessibilityLabel="Clear idea"
                >
                  <Text style={styles.ideaClearBtnText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.ideaGenerateBtn,
                  (!ideaText.trim() || isGenerating) && styles.ideaGenerateBtnDisabled,
                ]}
                onPress={() => void handleCreatePost()}
                disabled={!ideaText.trim() || isGenerating}
                activeOpacity={0.85}
                accessibilityLabel="Generate post"
              >
                <Text style={styles.ideaGenerateBtnText}>{isGenerating ? 'Generating...' : 'Generate'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {generateError ? <Text style={styles.generateErrorText}>{generateError}</Text> : null}

          <Text style={styles.sectionLabel}>Add a photo (optional)</Text>
          {!selectedPhoto ? (
            <View style={styles.photoDashed}>
              <View style={styles.photoBtnRow}>
                <TouchableOpacity style={styles.ghostBtn} onPress={takePhotoWithCamera} activeOpacity={0.85}>
                  <Ionicons name="camera-outline" size={18} color={Colors.primary} />
                  <Text style={styles.ghostBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={pickPhotoFromLibrary} activeOpacity={0.85}>
                  <Ionicons name="image-outline" size={18} color={Colors.primary} />
                  <Text style={styles.ghostBtnText}>Choose Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.photoSelected}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${selectedPhoto}` }}
                style={styles.photoPreview}
                resizeMode="cover"
              />
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={styles.secondarySmall}
                  onPress={() => {
                    Alert.alert('Replace photo', undefined, [
                      { text: 'Camera', onPress: () => void takePhotoWithCamera() },
                      { text: 'Library', onPress: () => void pickPhotoFromLibrary() },
                      { text: 'Cancel', style: 'cancel' },
                    ]);
                  }}
                >
                  <Text style={styles.secondarySmallText}>Replace</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedPhoto(null)} hitSlop={8}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.photoHint}>
                AI will enhance this photo and match it to your brand
              </Text>
            </View>
          )}

          <Text style={styles.aiDisclaimer}>AI-generated — review before posting</Text>

          {previewRegenerating || (previewVisible && generatedPost) ? (
            <Animated.View
              key={previewRegenerating ? 'preview-loading' : generatedPost?.id ?? 'preview'}
              style={[
                styles.previewPanelWrap,
                {
                  opacity: panelAnim,
                  transform: [
                    {
                      translateY: panelAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [40, 0],
                      }),
                    },
                  ],
                },
              ]}
              onLayout={(e) => {
                previewPanelLayoutYRef.current = e.nativeEvent.layout.y;
                if (!pendingScrollToPreviewRef.current) return;
                pendingScrollToPreviewRef.current = false;
                const y = e.nativeEvent.layout.y;
                scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
              }}
            >
              {previewRegenerating ? (
                <View style={styles.previewCard}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewHeaderTitle}>Preview</Text>
                    <Text style={styles.previewUpdatingLabel}>Updating…</Text>
                  </View>
                  <PreviewPanelSkeleton />
                </View>
              ) : generatedPost ? (
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <View style={styles.previewHeaderLeft}>
                    <Text style={styles.previewHeaderTitle}>Preview</Text>
                    {captionAiProvider || imageEnhancing ? (
                      <Text style={styles.previewAiProviderLabel}>
                        {captionAiProvider ? `AI: ${captionAiProvider}` : 'AI'}
                        {imageEnhancing ? ' • Enhancing image...' : ''}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={dismissPreview}
                    hitSlop={12}
                    accessibilityLabel="Dismiss preview"
                  >
                    <Text style={styles.previewDismiss}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.previewImageArea}>
                  {(() => {
                    const uri = resolvePreviewImageUri(generatedPost);
                    return uri ? (
                      <Image source={{ uri }} style={styles.previewHeroImage} resizeMode="cover" />
                    ) : (
                      <LinearGradient
                        colors={previewBrandGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.previewHeroImage}
                      >
                        <Text style={styles.previewPlaceholderBizName} numberOfLines={2}>
                          {businessProfile.name || 'Your business'}
                        </Text>
                      </LinearGradient>
                    );
                  })()}
                  <View style={styles.previewPlatformChips}>
                    <View style={styles.previewPlatformChip}>
                      <Text style={styles.previewPlatformChipText}>IG</Text>
                    </View>
                    <View style={styles.previewPlatformChip}>
                      <Text style={styles.previewPlatformChipText}>FB</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.previewCaptionBlock}>
                  <Text style={styles.previewCaptionText}>
                    {captionBodyForPreview(generatedPost.caption)}
                  </Text>
                  {previewHashtags.length > 0 ? (
                    <View style={styles.previewHashtagRow}>
                      {previewHashtags.map((tag) => (
                        <View key={tag} style={styles.previewHashtagPill}>
                          <Text style={styles.previewHashtagText}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                {aiChatVisible ? (
                  <Animated.View
                    style={[
                      styles.previewAiChatOuter,
                      {
                        opacity: aiChatSlideAnim,
                        transform: [
                          {
                            translateY: aiChatSlideAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [16, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Text style={styles.previewAiQuickLabel}>Quick edits</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.previewAiChipScroll}
                      keyboardShouldPersistTaps="handled"
                    >
                      {AI_QUICK_CHIPS.map((label) => {
                        const selected = selectedAiChip === label;
                        return (
                          <TouchableOpacity
                            key={label}
                            style={[styles.previewAiChip, selected && styles.previewAiChipSelected]}
                            onPress={() => void sendAiMessage(label, true)}
                            disabled={isAiLoading}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.previewAiChipText, selected && styles.previewAiChipTextSelected]}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <ScrollView
                      ref={aiChatScrollRef}
                      style={styles.previewAiMessages}
                      contentContainerStyle={styles.previewAiMessagesContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {chatHistory.map((msg) =>
                        msg.role === 'user' ? (
                          <View key={msg.id} style={styles.aiMsgUserWrap}>
                            <Text style={styles.aiMsgUserText}>{msg.content}</Text>
                          </View>
                        ) : (
                          <View key={msg.id}>
                            <View
                              style={[styles.aiMsgAssistantWrap, msg.isError && styles.aiMsgAssistantError]}
                            >
                              <Text
                                style={[styles.aiMsgAssistantText, msg.isError && styles.aiMsgAssistantTextError]}
                              >
                                {msg.content}
                              </Text>
                            </View>
                            {msg.apply && !msg.isError ? (
                              <TouchableOpacity
                                style={styles.aiApplyBtn}
                                onPress={() => applyAiSuggestion(msg)}
                                activeOpacity={0.88}
                              >
                                <Text style={styles.aiApplyBtnText}>
                                  {appliedMsgId === msg.id ? '✓ Applied' : 'Apply changes'}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        )
                      )}
                      {isAiLoading ? (
                        <View style={styles.aiMsgAssistantWrap}>
                          <PreviewTypingIndicator />
                        </View>
                      ) : null}
                    </ScrollView>

                    <View style={styles.previewAiInputRow}>
                      <TextInput
                        style={styles.previewAiTextInput}
                        placeholder="Ask AI to change anything..."
                        placeholderTextColor={Colors.textMuted}
                        value={chatInput}
                        onChangeText={setChatInput}
                        multiline
                        maxLength={500}
                        editable={!isAiLoading}
                      />
                      <TouchableOpacity
                        style={[
                          styles.previewAiSendBtn,
                          (!chatInput.trim() || isAiLoading) && styles.previewAiSendBtnDisabled,
                        ]}
                        onPress={() => void sendAiMessage(chatInput, false)}
                        disabled={!chatInput.trim() || isAiLoading}
                        accessibilityLabel="Send message"
                      >
                        <Ionicons name="arrow-up" size={16} color={Colors.white} />
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                ) : null}

                <View style={styles.previewFooter}>
                  <TouchableOpacity
                    style={[
                      styles.previewAiBtn,
                      aiChatVisible && styles.previewAiBtnOpen,
                    ]}
                    onPress={() => setAiChatVisible((v) => !v)}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.previewAiEmoji}>✨</Text>
                    <Text style={styles.previewAiBtnLabel}>
                      {aiChatVisible ? 'Close AI' : 'Create with AI'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handlePreviewPostPress}
                    activeOpacity={0.9}
                    style={styles.previewPostBtnOuter}
                    disabled={previewRegenerating}
                  >
                    <LinearGradient
                      colors={GradientColors.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.previewPostBtnGrad, previewRegenerating && styles.previewPostBtnGradDisabled]}
                    >
                      <Text style={styles.previewPostBtnText}>Post →</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
              ) : null}
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <AccountSelectorSheet
        visible={accountSelectorVisible}
        onClose={() => setAccountSelectorVisible(false)}
        onPost={handlePublishFromSheet}
        onSaveDraft={handleSaveDraftFromSheet}
        onDraftSaved={onAccountSheetDrafted}
        onPosted={onAccountSheetPosted}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    paddingTop: Spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  topBarSpacer: { width: 24 },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  stripLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  stripScroll: { marginBottom: Spacing.md },
  stripRow: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.md,
  },
  skeletonPill: {
    width: 80,
    height: 36,
    borderRadius: 20,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  skeletonInner: {
    height: 10,
    borderRadius: 4,
    backgroundColor: Colors.border,
    width: '70%',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 220,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  angleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  angleDotOn: {
    backgroundColor: Colors.white,
  },
  chipText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: Colors.white,
  },
  moreIdeas: { justifyContent: 'center', paddingLeft: Spacing.sm },
  moreIdeasText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  inputWrap: { marginBottom: Spacing.lg, position: 'relative' },
  ideaInput: {
    minHeight: 96,
    maxHeight: 168,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    paddingBottom: 44,
  },
  ideaInputFocused: {
    borderColor: Colors.primary,
  },
  counter: {
    position: 'absolute',
    left: 14,
    bottom: 10,
    fontSize: 11,
  },
  ideaInputActions: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ideaClearBtn: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ideaClearBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  ideaGenerateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  ideaGenerateBtnDisabled: {
    opacity: 0.4,
  },
  ideaGenerateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  generateErrorText: {
    marginTop: 6,
    marginBottom: Spacing.sm,
    fontSize: 12,
    color: Colors.error,
  },
  sectionLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  photoDashed: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  photoBtnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ghostBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  photoSelected: { marginBottom: Spacing.lg },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
  },
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  secondarySmall: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  secondarySmallText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  removeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.error,
  },
  photoHint: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  previewPanelWrap: {
    marginTop: 16,
  },
  previewCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  previewHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  previewAiProviderLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  previewDismiss: {
    fontSize: 16,
    color: Colors.textSecondary,
    paddingHorizontal: 4,
  },
  previewUpdatingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  previewSkelBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  previewSkelHero: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
  },
  previewSkelLine: {
    height: 14,
    borderRadius: 6,
    backgroundColor: Colors.bgElevated,
  },
  previewImageArea: {
    width: '100%',
    position: 'relative',
  },
  previewHeroImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  previewPlaceholderBizName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
  },
  previewPlatformChips: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: 6,
  },
  previewPlatformChip: {
    backgroundColor: Colors.overlay55,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  previewPlatformChipText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '600',
  },
  previewCaptionBlock: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  previewCaptionText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  previewHashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  previewHashtagPill: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  previewHashtagText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  previewAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexShrink: 1,
  },
  previewAiBtnOpen: {
    borderColor: Colors.primary,
  },
  previewAiEmoji: {
    fontSize: 14,
  },
  previewAiBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  previewPostBtnOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    flexShrink: 0,
  },
  previewPostBtnGrad: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPostBtnGradDisabled: {
    opacity: 0.45,
  },
  previewPostBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  previewAiChatOuter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    overflow: 'hidden',
  },
  previewAiQuickLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  previewAiChipScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  previewAiChip: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewAiChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  previewAiChipText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  previewAiChipTextSelected: {
    color: Colors.white,
  },
  previewAiMessages: {
    maxHeight: 220,
    marginHorizontal: 12,
  },
  previewAiMessagesContent: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  aiMsgUserWrap: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  aiMsgUserText: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: '500',
  },
  aiMsgAssistantWrap: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    backgroundColor: Colors.bgElevated,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  aiMsgAssistantError: {
    backgroundColor: Colors.bgElevated,
  },
  aiMsgAssistantText: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  aiMsgAssistantTextError: {
    color: Colors.textMuted,
  },
  aiApplyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  aiApplyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
  },
  aiTypingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  aiTypingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
  },
  previewAiInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  previewAiTextInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 80,
    fontSize: 13,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgElevated,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewAiSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAiSendBtnDisabled: {
    opacity: 0.4,
  },
  aiDisclaimer: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});

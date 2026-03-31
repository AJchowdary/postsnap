import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../../src/constants/theme';
import PrimaryButton from '../../../src/components/PrimaryButton';
import SecondaryButton from '../../../src/components/SecondaryButton';
import AddProductModal from '../../../src/components/AddProductModal';
import BrandImagesPickerModal from '../../../src/components/BrandImagesPickerModal';
import {
  createCampaign,
  getCampaignSuggestions,
  type CampaignAspectRatio,
  type CampaignIdeaCard,
} from '../../../src/services/api';
import type { ProductContext } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { IMAGE_ASPECT_OPTIONS } from '../../../src/constants/imageAspect';

const ASPECT_IDS: CampaignAspectRatio[] = ['square', 'feed', 'story', 'landscape'];
const MAX_REFERENCE_IMAGES = 6;

export default function NewCampaignScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ prompt?: string }>();
  const showToast = useAppStore((s) => s.showToast);
  const pendingProductImageUrl = useAppStore((s) => s.pendingCampaignProductImageUrl);
  const setPendingCampaignProductImageUrl = useAppStore((s) => s.setPendingCampaignProductImageUrl);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [aspect, setAspect] = useState<CampaignAspectRatio>('square');
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<ProductContext | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [ideas, setIdeas] = useState<CampaignIdeaCard[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const clearProduct = () => {
    setProduct(null);
    setProductUrl('');
    setProductName('');
    setProductDescription('');
    setProductImageUrl('');
  };

  const onProductAttached = (p: ProductContext) => {
    setProduct(p);
    setProductUrl(p.url?.trim() || '');
    setProductName(p.name.trim());
    setProductDescription(p.description?.trim() || '');
    setProductImageUrl(p.imageUrl?.trim() || '');
  };

  const appendReferenceUris = (uris: string[]) => {
    const cleaned = uris.map((u) => u.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    setReferenceImageUrls((prev) => {
      const seen = new Set(prev);
      const next = [...prev];
      for (const u of cleaned) {
        if (next.length >= MAX_REFERENCE_IMAGES) break;
        if (seen.has(u)) continue;
        seen.add(u);
        next.push(u);
      }
      return next;
    });
  };

  const pickFromLibrary = async () => {
    if (referenceImageUrls.length >= MAX_REFERENCE_IMAGES) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Photo library permission is required', 'error');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.72,
      base64: true,
    });
    const asset = r.assets?.[0];
    if (r.canceled || !asset?.base64) return;
    const mimeFull =
      asset.mimeType && /^image\//i.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
    const dataUrl = `${mimeFull};base64,${asset.base64}`;
    appendReferenceUris([dataUrl]);
  };

  const takeReferencePhoto = async () => {
    if (referenceImageUrls.length >= MAX_REFERENCE_IMAGES) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast('Camera permission is required', 'error');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
      base64: true,
    });
    const asset = r.assets?.[0];
    if (r.canceled || !asset?.base64) return;
    const mimeFull =
      asset.mimeType && /^image\//i.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
    const dataUrl = `${mimeFull};base64,${asset.base64}`;
    appendReferenceUris([dataUrl]);
  };

  const showAddReferenceMenu = () => {
    const remaining = MAX_REFERENCE_IMAGES - referenceImageUrls.length;
    if (remaining <= 0) return;

    const openLibrary = () => void pickFromLibrary();
    const openCamera = () => void takeReferencePhoto();
    const openBrand = () => setBrandPickerOpen(true);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo library', 'Take a photo', 'From brand images'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) openLibrary();
          else if (buttonIndex === 2) openCamera();
          else if (buttonIndex === 3) openBrand();
        }
      );
    } else {
      Alert.alert('Add reference image', 'Choose a source', [
        { text: 'Photo library', onPress: openLibrary },
        { text: 'Take a photo', onPress: openCamera },
        { text: 'From brand images', onPress: openBrand },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const removeReferenceAt = (index: number) => {
    setReferenceImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const onSuggestIdeas = async () => {
    setSuggestLoading(true);
    try {
      const { ideas: list } = await getCampaignSuggestions(prompt.trim() || undefined);
      setIdeas(list);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not load ideas', 'error');
    } finally {
      setSuggestLoading(false);
    }
  };

  const applyIdea = (card: CampaignIdeaCard) => {
    setPrompt(card.prompt);
  };

  useFocusEffect(
    useCallback(() => {
      if (pendingProductImageUrl?.trim()) {
        setProductImageUrl(pendingProductImageUrl.trim());
        setPendingCampaignProductImageUrl(null);
      }
    }, [pendingProductImageUrl, setPendingCampaignProductImageUrl])
  );

  useEffect(() => {
    const raw = routeParams.prompt;
    if (typeof raw !== 'string' || !raw.trim()) return;
    try {
      setPrompt(decodeURIComponent(raw));
    } catch {
      setPrompt(raw);
    }
  }, [routeParams.prompt]);

  const onSave = async () => {
    const t = title.trim();
    const p = prompt.trim();
    if (!t || !p) {
      showToast('Title and prompt are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await createCampaign({
        title: t,
        prompt: p,
        product_url: (product?.url ?? productUrl).trim() || null,
        product_name: (product?.name ?? productName).trim() || null,
        product_description: (product?.description ?? productDescription).trim() || null,
        product_image_url: (product?.imageUrl ?? productImageUrl).trim() || null,
        reference_image_urls: referenceImageUrls,
        aspect_ratio: aspect,
      });
      showToast('Campaign created', 'success');
      router.replace(`/(tabs)/campaigns/${created.id}` as any);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not create campaign', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>New campaign</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Spring launch"
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={styles.label}>Prompt / brief</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="What should each creative focus on?"
            placeholderTextColor={Colors.textSecondary}
            multiline
          />

          <View style={styles.suggestRow}>
            <SecondaryButton
              title="Suggest ideas"
              onPress={onSuggestIdeas}
              loading={suggestLoading}
            />
          </View>
          <Text style={styles.hintMuted}>
            Cards use your Brand Brain. Your prompt text above is sent as an optional hint.
          </Text>
          {ideas.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.ideaStrip}
              contentContainerStyle={styles.ideaStripContent}
            >
              {ideas.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  style={styles.ideaCard}
                  onPress={() => applyIdea(card)}
                  activeOpacity={0.85}
                >
                  {!!card.contentAngle?.trim() && (
                    <View style={styles.ideaAnglePill}>
                      <Text style={styles.ideaAngleText} numberOfLines={1}>
                        {card.contentAngle}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.ideaEmoji}>{card.emoji}</Text>
                  <Text style={styles.ideaHeadline} numberOfLines={2}>
                    {card.headline}
                  </Text>
                  <Text style={styles.ideaRationale} numberOfLines={3}>
                    {card.rationale}
                  </Text>
                  <Text style={styles.ideaTap}>Tap to use brief</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          <Text style={styles.label}>Aspect</Text>
          <View style={styles.aspectRow}>
            {IMAGE_ASPECT_OPTIONS.filter((o) => ASPECT_IDS.includes(o.id as CampaignAspectRatio)).map(
              (o) => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.aspectChip, aspect === o.id && styles.aspectChipOn]}
                  onPress={() => setAspect(o.id as CampaignAspectRatio)}
                >
                  <Text style={[styles.aspectChipText, aspect === o.id && styles.aspectChipTextOn]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>

          <Text style={[styles.label, { marginTop: Spacing.md }]}>Reference images (optional)</Text>
          <Text style={styles.hintMuted}>
            Up to {MAX_REFERENCE_IMAGES} images for style and composition. If you do not set a product photo, the
            first reference is used as the main visual anchor.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.refStrip}
            contentContainerStyle={styles.refStripContent}
          >
            {referenceImageUrls.map((uri, i) => (
              <View key={`${i}-${uri.slice(0, 24)}`} style={styles.refThumbWrap}>
                <Image source={{ uri }} style={styles.refThumb} />
                {i === 0 ? (
                  <View style={styles.refPrimaryPill} pointerEvents="none">
                    <Text style={styles.refPrimaryText}>Primary</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.refRemove} onPress={() => removeReferenceAt(i)} hitSlop={8}>
                  <Ionicons name="close-circle" size={22} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            {referenceImageUrls.length < MAX_REFERENCE_IMAGES ? (
              <TouchableOpacity style={styles.refAdd} onPress={showAddReferenceMenu}>
                <Ionicons name="add" size={28} color={Colors.primary} />
                <Text style={styles.refAddLabel}>Add</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <Text style={[styles.label, { marginTop: Spacing.md }]}>Product (optional)</Text>
          <View style={styles.addProductBtnWrap}>
            <SecondaryButton title="Add product from URL" onPress={() => setAddProductOpen(true)} />
          </View>

          {product ? (
            <View style={styles.productChip}>
              {product.imageUrl ? (
                <Image source={{ uri: product.imageUrl }} style={styles.productChipImg} />
              ) : (
                <View style={[styles.productChipImg, styles.productChipImgPh]}>
                  <Ionicons name="cube-outline" size={20} color={Colors.textSecondary} />
                </View>
              )}
              <View style={styles.productChipText}>
                <Text style={styles.productChipName} numberOfLines={1}>
                  {product.name}
                </Text>
                {product.price ? (
                  <Text style={styles.productChipPrice} numberOfLines={1}>
                    {product.price}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={clearProduct} hitSlop={12} accessibilityLabel="Remove product">
                <Ionicons name="close-circle" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={[styles.labelSmall, { marginTop: Spacing.md }]}>Product URL</Text>
          <TextInput
            style={styles.input}
            value={productUrl}
            onChangeText={setProductUrl}
            placeholder="https://…"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={styles.labelSmall}>Product name</Text>
          <TextInput
            style={styles.input}
            value={productName}
            onChangeText={setProductName}
            placeholder="Name"
            placeholderTextColor={Colors.textSecondary}
          />
          <Text style={styles.labelSmall}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={productDescription}
            onChangeText={setProductDescription}
            placeholder="Short description"
            placeholderTextColor={Colors.textSecondary}
            multiline
          />
          <Text style={styles.labelSmall}>Product image URL</Text>
          <TextInput
            style={styles.input}
            value={productImageUrl}
            onChangeText={setProductImageUrl}
            placeholder="https://… (JPEG/PNG)"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={styles.aiDisclaimer}>
            AI can make mistakes. Review suggestions and generated creatives before posting.
          </Text>
        </ScrollView>

        <View style={styles.actions}>
          <View style={styles.actionHalf}>
            <SecondaryButton title="Cancel" onPress={() => router.back()} />
          </View>
          <View style={{ width: Spacing.sm }} />
          <View style={styles.actionHalf}>
            <PrimaryButton title="Create" onPress={onSave} loading={saving} />
          </View>
        </View>
      </KeyboardAvoidingView>

      <AddProductModal
        visible={addProductOpen}
        onClose={() => setAddProductOpen(false)}
        onProductAttached={onProductAttached}
      />
      <BrandImagesPickerModal
        visible={brandPickerOpen}
        onClose={() => setBrandPickerOpen(false)}
        maxSelectable={Math.max(0, MAX_REFERENCE_IMAGES - referenceImageUrls.length)}
        onImagesSelected={(uris) => appendReferenceUris(uris)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  topTitle: { ...Typography.h4, color: Colors.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  label: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  labelSmall: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.xs },
  hintMuted: {
    ...Typography.caption,
    color: Colors.textSecondary,
    opacity: 0.9,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  suggestRow: { marginTop: Spacing.sm, marginBottom: Spacing.xs },
  ideaStrip: { marginBottom: Spacing.md },
  ideaStripContent: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  ideaCard: {
    width: 200,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  ideaAnglePill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: 6,
  },
  ideaAngleText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  ideaEmoji: { fontSize: 22, marginBottom: 6 },
  ideaHeadline: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700' },
  ideaRationale: { ...Typography.caption, color: Colors.textSecondary, marginTop: 6 },
  ideaTap: { ...Typography.caption, color: Colors.primary, marginTop: Spacing.sm, fontWeight: '600' },
  refStrip: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
  refStripContent: { gap: Spacing.sm, alignItems: 'center', paddingVertical: Spacing.xs },
  refThumbWrap: { position: 'relative' },
  refPrimaryPill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  refPrimaryText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  refThumb: {
    width: 88,
    height: 110,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  refRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: Colors.background, borderRadius: 12 },
  refAdd: {
    width: 88,
    height: 110,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paper,
  },
  refAddLabel: { ...Typography.caption, color: Colors.primary, marginTop: 4, fontWeight: '600' },
  aiDisclaimer: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    fontStyle: 'italic',
    opacity: 0.85,
  },
  addProductBtnWrap: { marginTop: Spacing.xs, marginBottom: Spacing.xs },
  productChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  productChipImg: { width: 44, height: 44, borderRadius: BorderRadius.sm },
  productChipImgPh: {
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productChipText: { flex: 1, minWidth: 0 },
  productChipName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  productChipPrice: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  input: {
    ...Typography.body,
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  aspectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aspectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aspectChipOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  aspectChipText: { ...Typography.caption, color: Colors.textSecondary },
  aspectChipTextOn: { color: Colors.primaryDark, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    alignItems: 'stretch',
  },
  actionHalf: { flex: 1 },
});

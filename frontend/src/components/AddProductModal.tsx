import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import type { ProductContext } from '../types';
import { scrapeProductFromUrl, type ProductScrapeApiSuccess } from '../services/api';

type Step = 'url' | 'preview' | 'error' | 'manual';

type ErrorKind = 'BLOCKED' | 'EMPTY' | 'TIMEOUT' | 'NETWORK';

const ERROR_COPY: Record<ErrorKind, string> = {
  BLOCKED:
    'This site blocked automatic fetching. Add the product manually or paste an image URL.',
  EMPTY: 'We could not read product details from that page. Try another URL or add manually.',
  TIMEOUT: 'That took too long. Check the URL or try again.',
  NETWORK: 'Something went wrong. Check your connection and try again.',
};

function hostLabel(urlStr: string): string {
  try {
    const h = new URL(urlStr).hostname.replace(/^www\./i, '');
    return h || 'Product';
  } catch {
    return 'Product';
  }
}

interface AddProductModalProps {
  visible: boolean;
  onClose: () => void;
  onProductAttached: (product: ProductContext) => void;
}

export default function AddProductModal({ visible, onClose, onProductAttached }: AddProductModalProps) {
  const [step, setStep] = useState<Step>('url');
  const [urlInput, setUrlInput] = useState('');
  const [scraping, setScraping] = useState(false);
  const [preview, setPreview] = useState<ProductScrapeApiSuccess | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>('EMPTY');
  const [manualName, setManualName] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualImageDataUrl, setManualImageDataUrl] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('url');
    setUrlInput('');
    setScraping(false);
    setPreview(null);
    setErrorKind('EMPTY');
    setManualName('');
    setManualDesc('');
    setManualImageDataUrl(null);
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const goManual = () => {
    setStep('manual');
  };

  const runScrape = async () => {
    const u = urlInput.trim();
    if (!u) return;
    setScraping(true);
    try {
      const r = await scrapeProductFromUrl(u);
      if ('error' in r) {
        setErrorKind(r.error);
        setStep('error');
        return;
      }
      setPreview(r);
      setStep('preview');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/timeout|cancelled|aborted/i.test(msg)) setErrorKind('TIMEOUT');
      else setErrorKind('NETWORK');
      setStep('error');
    } finally {
      setScraping(false);
    }
  };

  const confirmPreview = () => {
    if (!preview) return;
    const name =
      (preview.name && preview.name.trim()) || hostLabel(preview.url || urlInput.trim());
    onProductAttached({
      name,
      description: preview.description?.trim() || undefined,
      imageUrl: preview.imageUrl?.trim() || undefined,
      price: preview.price?.trim() || undefined,
      url: preview.url || urlInput.trim(),
      isManual: false,
    });
    onClose();
  };

  const saveManual = () => {
    const n = manualName.trim();
    if (!n) return;
    onProductAttached({
      name: n,
      description: manualDesc.trim() || undefined,
      imageUrl: manualImageDataUrl || undefined,
      isManual: true,
    });
    onClose();
  };

  const pickManualImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });
    const asset = r.assets?.[0];
    if (r.canceled || !asset?.base64) return;
    const mimeFull =
      asset.mimeType && /^image\//i.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
    setManualImageDataUrl(`${mimeFull};base64,${asset.base64}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.title}>Add product</Text>

          {step === 'url' && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sub}>
                Paste a product page URL. We will try to read the name, description, image, and price.
              </Text>
              <TextInput
                style={styles.input}
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="https://…"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
                editable={!scraping}
              />
              <PrimaryButton
                title="Find product"
                onPress={runScrape}
                loading={scraping}
                disabled={!urlInput.trim()}
              />
              <TouchableOpacity onPress={goManual} style={styles.textLink} disabled={scraping}>
                <Text style={styles.textLinkLabel}>Add manually instead</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {step === 'preview' && preview && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {preview.imageUrl ? (
                <Image source={{ uri: preview.imageUrl }} style={styles.previewImg} resizeMode="cover" />
              ) : (
                <View style={[styles.previewImg, styles.previewImgPlaceholder]}>
                  <Ionicons name="image-outline" size={40} color={Colors.textSecondary} />
                </View>
              )}
              <Text style={styles.previewName}>
                {(preview.name && preview.name.trim()) || hostLabel(preview.url || urlInput)}
              </Text>
              {preview.price ? <Text style={styles.previewPrice}>{preview.price}</Text> : null}
              {preview.description ? (
                <Text style={styles.previewDesc} numberOfLines={6}>
                  {preview.description}
                </Text>
              ) : null}
              <PrimaryButton title="Use this product" onPress={confirmPreview} />
              <View style={{ height: Spacing.sm }} />
              <SecondaryButton title="Try another URL" onPress={() => { setStep('url'); setPreview(null); }} />
            </ScrollView>
          )}

          {step === 'error' && (
            <View>
              <Text style={styles.errorText}>{ERROR_COPY[errorKind]}</Text>
              <PrimaryButton title="Try again" onPress={() => setStep('url')} />
              <View style={{ height: Spacing.sm }} />
              <SecondaryButton title="Add manually" onPress={goManual} />
            </View>
          )}

          {step === 'manual' && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sub}>Enter at least a product name. Photo is optional.</Text>
              <Text style={styles.labelSmall}>Name</Text>
              <TextInput
                style={styles.input}
                value={manualName}
                onChangeText={setManualName}
                placeholder="Product name"
                placeholderTextColor={Colors.textSecondary}
              />
              <Text style={styles.labelSmall}>Description</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={manualDesc}
                onChangeText={setManualDesc}
                placeholder="Optional"
                placeholderTextColor={Colors.textSecondary}
                multiline
              />
              <SecondaryButton title={manualImageDataUrl ? 'Change product photo' : 'Add product photo'} onPress={pickManualImage} />
              {manualImageDataUrl ? (
                <Image source={{ uri: manualImageDataUrl }} style={styles.thumb} resizeMode="cover" />
              ) : null}
              <View style={{ height: Spacing.md }} />
              <PrimaryButton title="Save product" onPress={saveManual} disabled={!manualName.trim()} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '88%',
    ...Shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  closeBtn: { position: 'absolute', top: Spacing.md, right: Spacing.md, zIndex: 2 },
  title: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.sm, paddingRight: 36 },
  sub: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.md },
  labelSmall: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.xs },
  input: {
    ...Typography.body,
    backgroundColor: Colors.paper,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  textLink: { alignItems: 'center', paddingVertical: Spacing.md },
  textLinkLabel: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
  previewImg: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.paper,
    marginBottom: Spacing.md,
  },
  previewImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  previewName: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 4 },
  previewPrice: { ...Typography.body, color: Colors.primaryDark, fontWeight: '600', marginBottom: Spacing.sm },
  previewDesc: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.lg },
  errorText: { ...Typography.body, color: Colors.textPrimary, marginBottom: Spacing.lg },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    alignSelf: 'center',
  },
});

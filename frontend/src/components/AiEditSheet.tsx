import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { editCaptionWithAI, type EditCaptionChatTurn } from '../services/api';

export type AiEditSheetPostContext = {
  businessName: string;
  city: string;
  ideaText: string;
  platform: string[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  currentCaption: string;
  currentHashtags: string[];
  postContext: AiEditSheetPostContext;
  onApplyChanges: (newCaption: string, newHashtags: string[]) => void;
};

const QUICK_ACTIONS = [
  'Make it shorter',
  'More playful tone',
  'Add a clear call to action',
  'More local / neighborhood feel',
  'Tighten grammar and flow',
];

type ChatMsg = { role: 'user' | 'assistant'; content: string };

export default function AiEditSheet({
  visible,
  onClose,
  currentCaption,
  currentHashtags,
  postContext,
  onApplyChanges,
}: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<{ caption: string; tags: string[] } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setMessages([]);
      setInput('');
      setPending(null);
      setLoading(false);
    }
  }, [visible]);

  const scrollBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const sendText = async (text: string) => {
    const userRequest = text.trim();
    if (!userRequest || loading) return;

    const history: EditCaptionChatTurn[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, { role: 'user', content: userRequest }]);
    setInput('');
    setPending(null);
    setLoading(true);
    scrollBottom();

    try {
      const data = await editCaptionWithAI({
        userRequest,
        currentCaption,
        currentHashtags,
        businessName: postContext.businessName,
        city: postContext.city,
        ideaText: postContext.ideaText,
        chatHistory: history,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      setPending({ caption: data.newCaption, tags: data.newHashtags });
      scrollBottom();
    } catch (e) {
      setMessages((prev) => prev.slice(0, -1));
      Alert.alert('Could not edit', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  const onSend = () => void sendText(input);

  const apply = () => {
    if (!pending) return;
    onApplyChanges(pending.caption, pending.tags);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <View />
        </Pressable>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Edit with AI</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Describe changes or tap a quick action. Apply updates the preview when you are happy.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickScroll}
            contentContainerStyle={styles.quickInner}
          >
            {QUICK_ACTIONS.map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.quickChip}
                onPress={() => setInput(q)}
                activeOpacity={0.85}
              >
                <Text style={styles.quickChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollBottom}
          >
            {messages.length === 0 && !loading ? (
              <Text style={styles.empty}>Your conversation appears here.</Text>
            ) : null}
            {messages.map((m, i) => (
              <View
                key={`${i}-${m.role}`}
                style={[styles.bubbleWrap, m.role === 'user' ? styles.bubbleUser : styles.bubbleAsst]}
              >
                <Text style={styles.bubbleText}>{m.content}</Text>
              </View>
            ))}
            {loading ? (
              <View style={[styles.bubbleWrap, styles.bubbleAsst]}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : null}
          </ScrollView>

          {pending ? (
            <TouchableOpacity style={styles.applyBtn} onPress={apply} activeOpacity={0.9}>
              <Text style={styles.applyBtnText}>Apply changes to preview</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask for edits..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
              editable={!loading}
              onSubmitEditing={onSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
              onPress={onSend}
              disabled={!input.trim() || loading}
            >
              <Ionicons name="send" size={20} color={Colors.white} />
            </TouchableOpacity>
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
    maxHeight: '78%',
    backgroundColor: Colors.paper,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  title: { ...Typography.h4 },
  hint: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.sm },
  quickScroll: { maxHeight: 40, marginBottom: Spacing.sm },
  quickInner: { gap: Spacing.sm, paddingRight: Spacing.lg },
  quickChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickChipText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  chatScroll: { flexGrow: 0, maxHeight: 280 },
  chatContent: { paddingBottom: Spacing.sm, gap: Spacing.sm },
  empty: { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
  bubbleWrap: {
    maxWidth: '88%',
    padding: 12,
    borderRadius: 14,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  bubbleAsst: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: { fontSize: 14, lineHeight: 20, color: Colors.textPrimary },
  applyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  applyBtnText: { fontSize: 15, fontWeight: '800', color: Colors.white },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgSurface,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.45 },
});

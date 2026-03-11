import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BusinessProfile,
  SocialAccount,
  Subscription,
  Post,
  Platform,
  ToastMessage,
} from '../types';
import { saveToken, clearToken } from '../services/api';

interface AuthState {
  userId: string | null;
  userEmail: string | null;
  token: string | null;
}

interface AppState extends AuthState {
  isOnboarded: boolean;
  businessProfile: BusinessProfile;
  socialAccounts: { instagram: SocialAccount | null; facebook: SocialAccount | null };
  subscription: Subscription;
  posts: Post[];
  toast: ToastMessage | null;
  showPaywall: boolean;
  currentEdit: Partial<Post> | null;
  /** Invoked after paywall upgrade succeeds (purchase + verify); e.g. retry publish. */
  paywallSuccessCallback: (() => void) | null;

  // Auth
  setAuth: (userId: string, email: string, token: string) => Promise<void>;
  clearAuth: () => Promise<void>;

  // Profile
  setIsOnboarded: (v: boolean) => void;
  setBusinessProfile: (profile: Partial<BusinessProfile>) => void;
  setSocialAccount: (platform: Platform, account: SocialAccount | null) => void;
  setSubscription: (sub: Partial<Subscription>) => void;

  // Posts
  addPost: (post: Post) => void;
  updatePost: (id: string, updates: Partial<Post>) => void;
  deletePost: (id: string) => void;
  setPosts: (posts: Post[]) => void;

  // UI
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  setShowPaywall: (show: boolean) => void;
  setPaywallSuccessCallback: (cb: (() => void) | null) => void;
  setCurrentEdit: (post: Partial<Post> | null) => void;
  checkEntitlement: () => boolean;
}

const DEFAULT_PROFILE: BusinessProfile = {
  name: '',
  type: 'restaurant',
  brandStyle: 'clean',
  useLogoOverlay: false,
};

const DEFAULT_SUBSCRIPTION: Subscription = {
  status: 'trial',
  daysLeft: 7,
  postsLeft: 10,
  planName: 'Quickpost Pro',
  price: '$12/month',
};

export const useAppStore = create<AppState>()((set, get) => ({
  // Auth
  userId: null,
  userEmail: null,
  token: null,

  isOnboarded: false,
  businessProfile: DEFAULT_PROFILE,
  socialAccounts: { instagram: null, facebook: null },
  subscription: DEFAULT_SUBSCRIPTION,
  posts: [],
  toast: null,
  showPaywall: false,
  currentEdit: null,
  paywallSuccessCallback: null,

  setAuth: async (userId, email, token) => {
    await saveToken(token);
    set({ userId, userEmail: email, token });
  },

  clearAuth: async () => {
    await clearToken();
    set({
      userId: null,
      userEmail: null,
      token: null,
      isOnboarded: false,
      businessProfile: DEFAULT_PROFILE,
      socialAccounts: { instagram: null, facebook: null },
      subscription: DEFAULT_SUBSCRIPTION,
      posts: [],
    });
  },

  setIsOnboarded: (v) => set({ isOnboarded: v }),

  setBusinessProfile: (profile) =>
    set((state) => ({ businessProfile: { ...state.businessProfile, ...profile } })),

  setSocialAccount: (platform, account) =>
    set((state) => ({ socialAccounts: { ...state.socialAccounts, [platform]: account } })),

  setSubscription: (sub) =>
    set((state) => ({ subscription: { ...state.subscription, ...sub } })),

  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),

  updatePost: (id, updates) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  deletePost: (id) =>
    set((state) => ({ posts: state.posts.filter((p) => p.id !== id) })),

  setPosts: (posts) => set({ posts }),

  showToast: (message, type) => {
    const id = Date.now().toString();
    set({ toast: { id, message, type } });
    setTimeout(() => {
      const current = get().toast;
      if (current?.id === id) set({ toast: null });
    }, 3500);
  },

  hideToast: () => set({ toast: null }),

  setShowPaywall: (show) => set({ showPaywall: show }),

  setPaywallSuccessCallback: (cb) => set({ paywallSuccessCallback: cb }),

  setCurrentEdit: (post) => set({ currentEdit: post }),

  checkEntitlement: () => {
    const { subscription } = get();
    if (subscription.status === 'subscribed') return true;
    if (
      subscription.status === 'trial' &&
      subscription.daysLeft > 0 &&
      subscription.postsLeft > 0
    )
      return true;
    return false;
  },
}));

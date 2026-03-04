// Shared template definitions – mirrors frontend src/types/index.ts
export const TEMPLATES_BY_TYPE: Record<string, Array<{ id: string; label: string; emoji: string; helper?: string; beforeAfter?: boolean }>> = {
  restaurant: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.' },
    { id: 'today-special', label: "Today's Special", emoji: '🍽️' },
    { id: 'new-item', label: 'New Item', emoji: '🆕' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '👨‍🍳' },
    { id: 'promo', label: 'Promo', emoji: '🎉' },
  ],
  salon: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.' },
    { id: 'before-after', label: 'Before & After', emoji: '💇', beforeAfter: true },
    { id: 'new-look', label: 'New Look', emoji: '💅' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🪤' },
    { id: 'promo', label: 'Promo', emoji: '🎉' },
  ],
  retail: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.' },
    { id: 'new-arrival', label: 'New Arrival', emoji: '🛍️' },
    { id: 'sale', label: 'Sale', emoji: '💸' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🏠' },
    { id: 'promo', label: 'Promo', emoji: '🎉' },
  ],
  gym: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.' },
    { id: 'transformation', label: 'Transformation', emoji: '💪', beforeAfter: true },
    { id: 'new-class', label: 'New Class', emoji: '🏋️' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🎯' },
    { id: 'promo', label: 'Promo', emoji: '🎉' },
  ],
  cafe: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.' },
    { id: 'today-special', label: "Today's Special", emoji: '☕' },
    { id: 'new-item', label: 'New Item', emoji: '🥐' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🫖' },
    { id: 'promo', label: 'Promo', emoji: '🎉' },
  ],
};

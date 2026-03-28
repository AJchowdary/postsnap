import type { BusinessType } from '../types';

export { defaultDisplayForBusinessType } from './categoryDefaults';

export type CatalogItem = {
  id: string;
  emoji: string;
  label: string;
  aiCategory: BusinessType;
  group: string;
};

/** Six quick picks shown before “See all”. */
export const QUICK_PICK_ITEMS: CatalogItem[] = [
  { id: 'qp-restaurant', emoji: '🍽️', label: 'Restaurant', aiCategory: 'restaurant', group: 'FOOD & BEVERAGE' },
  { id: 'qp-salon', emoji: '💇', label: 'Salon & Beauty', aiCategory: 'salon', group: 'BEAUTY & WELLNESS' },
  { id: 'qp-retail', emoji: '🛍️', label: 'Retail Store', aiCategory: 'retail', group: 'RETAIL & SHOPPING' },
  { id: 'qp-gym', emoji: '💪', label: 'Gym & Fitness', aiCategory: 'gym', group: 'BEAUTY & WELLNESS' },
  { id: 'qp-cafe', emoji: '☕', label: 'Cafe & Coffee Shop', aiCategory: 'cafe', group: 'FOOD & BEVERAGE' },
  { id: 'qp-health', emoji: '🏥', label: 'Healthcare & Clinic', aiCategory: 'retail', group: 'BEAUTY & WELLNESS' },
];

export const FULL_BUSINESS_CATALOG: CatalogItem[] = [
  // FOOD & BEVERAGE
  { id: 'fb-restaurant', emoji: '🍽️', label: 'Restaurant', aiCategory: 'restaurant', group: 'FOOD & BEVERAGE' },
  { id: 'fb-cafe', emoji: '☕', label: 'Cafe & Coffee Shop', aiCategory: 'cafe', group: 'FOOD & BEVERAGE' },
  { id: 'fb-pizza', emoji: '🍕', label: 'Pizza & Fast Food', aiCategory: 'restaurant', group: 'FOOD & BEVERAGE' },
  { id: 'fb-bar', emoji: '🍺', label: 'Bar & Pub', aiCategory: 'restaurant', group: 'FOOD & BEVERAGE' },
  { id: 'fb-bakery', emoji: '🧁', label: 'Bakery & Desserts', aiCategory: 'cafe', group: 'FOOD & BEVERAGE' },
  { id: 'fb-healthy', emoji: '🥗', label: 'Healthy Food & Juice Bar', aiCategory: 'restaurant', group: 'FOOD & BEVERAGE' },
  { id: 'fb-truck', emoji: '🍱', label: 'Food Truck', aiCategory: 'restaurant', group: 'FOOD & BEVERAGE' },
  { id: 'fb-wine', emoji: '🍷', label: 'Wine & Spirits', aiCategory: 'retail', group: 'FOOD & BEVERAGE' },
  // BEAUTY & WELLNESS
  { id: 'bw-hair', emoji: '💇', label: 'Hair Salon', aiCategory: 'salon', group: 'BEAUTY & WELLNESS' },
  { id: 'bw-nail', emoji: '💅', label: 'Nail Salon', aiCategory: 'salon', group: 'BEAUTY & WELLNESS' },
  { id: 'bw-spa', emoji: '🧖', label: 'Spa & Massage', aiCategory: 'salon', group: 'BEAUTY & WELLNESS' },
  { id: 'bw-gym', emoji: '💪', label: 'Gym & Fitness', aiCategory: 'gym', group: 'BEAUTY & WELLNESS' },
  { id: 'bw-yoga', emoji: '🧘', label: 'Yoga & Pilates Studio', aiCategory: 'gym', group: 'BEAUTY & WELLNESS' },
  { id: 'bw-tattoo', emoji: '💉', label: 'Tattoo & Piercing', aiCategory: 'salon', group: 'BEAUTY & WELLNESS' },
  { id: 'bw-makeup', emoji: '👄', label: 'Makeup & Cosmetics', aiCategory: 'salon', group: 'BEAUTY & WELLNESS' },
  { id: 'bw-dental', emoji: '🦷', label: 'Dental Clinic', aiCategory: 'salon', group: 'BEAUTY & WELLNESS' },
  { id: 'bw-health', emoji: '🏥', label: 'Healthcare & Clinic', aiCategory: 'retail', group: 'BEAUTY & WELLNESS' },
  // RETAIL & SHOPPING
  { id: 'rs-retail', emoji: '🛍️', label: 'Retail Store', aiCategory: 'retail', group: 'RETAIL & SHOPPING' },
  { id: 'rs-fashion', emoji: '👗', label: 'Fashion & Clothing', aiCategory: 'retail', group: 'RETAIL & SHOPPING' },
  { id: 'rs-shoes', emoji: '👟', label: 'Shoes & Accessories', aiCategory: 'retail', group: 'RETAIL & SHOPPING' },
  { id: 'rs-electronics', emoji: '📱', label: 'Electronics Store', aiCategory: 'retail', group: 'RETAIL & SHOPPING' },
  { id: 'rs-books', emoji: '📚', label: 'Bookstore', aiCategory: 'retail', group: 'RETAIL & SHOPPING' },
  { id: 'rs-plants', emoji: '🌿', label: 'Plant & Garden Store', aiCategory: 'retail', group: 'RETAIL & SHOPPING' },
  { id: 'rs-pet', emoji: '🐾', label: 'Pet Store', aiCategory: 'retail', group: 'RETAIL & SHOPPING' },
  { id: 'rs-gift', emoji: '🎁', label: 'Gift & Specialty Shop', aiCategory: 'retail', group: 'RETAIL & SHOPPING' },
  { id: 'rs-home', emoji: '🏠', label: 'Home & Furniture', aiCategory: 'retail', group: 'RETAIL & SHOPPING' },
  // SERVICES & PROFESSIONAL
  { id: 'sv-realestate', emoji: '🏠', label: 'Real Estate', aiCategory: 'retail', group: 'SERVICES & PROFESSIONAL' },
  { id: 'sv-legal', emoji: '⚖️', label: 'Legal Services', aiCategory: 'retail', group: 'SERVICES & PROFESSIONAL' },
  { id: 'sv-finance', emoji: '💰', label: 'Financial Services', aiCategory: 'retail', group: 'SERVICES & PROFESSIONAL' },
  { id: 'sv-photo', emoji: '📸', label: 'Photography & Videography', aiCategory: 'retail', group: 'SERVICES & PROFESSIONAL' },
  { id: 'sv-art', emoji: '🎨', label: 'Art & Design Studio', aiCategory: 'retail', group: 'SERVICES & PROFESSIONAL' },
  { id: 'sv-music', emoji: '🎵', label: 'Music School', aiCategory: 'retail', group: 'SERVICES & PROFESSIONAL' },
  { id: 'sv-edu', emoji: '🎓', label: 'Education & Tutoring', aiCategory: 'retail', group: 'SERVICES & PROFESSIONAL' },
  { id: 'sv-auto', emoji: '🚗', label: 'Auto Repair & Detailing', aiCategory: 'retail', group: 'SERVICES & PROFESSIONAL' },
  { id: 'sv-home', emoji: '🔧', label: 'Home Services & Repair', aiCategory: 'retail', group: 'SERVICES & PROFESSIONAL' },
  { id: 'sv-marketing', emoji: '🌐', label: 'Digital Marketing Agency', aiCategory: 'retail', group: 'SERVICES & PROFESSIONAL' },
  { id: 'sv-tech', emoji: '💻', label: 'Tech & IT Services', aiCategory: 'retail', group: 'SERVICES & PROFESSIONAL' },
  // ENTERTAINMENT & HOSPITALITY
  { id: 'eh-hotel', emoji: '🏨', label: 'Hotel & Accommodation', aiCategory: 'restaurant', group: 'ENTERTAINMENT & HOSPITALITY' },
  { id: 'eh-event', emoji: '🎭', label: 'Event Planning', aiCategory: 'retail', group: 'ENTERTAINMENT & HOSPITALITY' },
  { id: 'eh-gaming', emoji: '🎮', label: 'Gaming & Entertainment', aiCategory: 'retail', group: 'ENTERTAINMENT & HOSPITALITY' },
  { id: 'eh-kids', emoji: '🎪', label: 'Kids Entertainment', aiCategory: 'retail', group: 'ENTERTAINMENT & HOSPITALITY' },
  { id: 'eh-travel', emoji: '🌴', label: 'Travel & Tourism', aiCategory: 'retail', group: 'ENTERTAINMENT & HOSPITALITY' },
  { id: 'eh-film', emoji: '🎬', label: 'Film & Media Production', aiCategory: 'retail', group: 'ENTERTAINMENT & HOSPITALITY' },
  // OTHER
  { id: 'ot-construction', emoji: '🏗️', label: 'Construction & Architecture', aiCategory: 'retail', group: 'OTHER' },
  { id: 'ot-farm', emoji: '🌾', label: 'Agriculture & Farming', aiCategory: 'retail', group: 'OTHER' },
  { id: 'ot-eco', emoji: '♻️', label: 'Eco & Sustainable Business', aiCategory: 'retail', group: 'OTHER' },
  { id: 'ot-nonprofit', emoji: '🙏', label: 'Non-profit & Community', aiCategory: 'retail', group: 'OTHER' },
  { id: 'ot-other', emoji: '📝', label: 'Other (custom)', aiCategory: 'restaurant', group: 'OTHER' },
];

export function titleCaseDisplay(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const RULES: { re: RegExp; category: BusinessType; hint?: string }[] = [
  { re: /\b(coffee|espresso|latte|cafe|café|roaster|barista)\b/i, category: 'cafe' },
  { re: /\b(restaurant|diner|bistro|kitchen|chef|menu|food truck|pizza|burger|taco|sushi|bbq|brewpub|brewery|bar|pub|bakery|pastry|juice)\b/i, category: 'restaurant' },
  { re: /\b(gym|fitness|crossfit|workout|weights|personal training|pt\b)\b/i, category: 'gym' },
  { re: /\b(yoga|pilates|studio)\b/i, category: 'gym' },
  { re: /\b(salon|hair|barber|nail|spa|massage|beauty|tattoo|piercing|grooming|cosmetic|dental)\b/i, category: 'salon' },
  { re: /\b(dog|cat|pet)\b.*\b(groom|wash|trim)\b|\b(grooming)\b.*\b(pet|dog|cat)\b/i, category: 'salon', hint: 'Pet grooming and animal care' },
  { re: /\b(flower|florist|bouquet|plants)\b/i, category: 'retail', hint: 'Florist / plant retail' },
  { re: /\b(shop|store|retail|boutique|fashion|clothing|electronics|book|gift|furniture|grocery|market)\b/i, category: 'retail' },
  { re: /\b(hotel|motel|bnb|accommodation|resort)\b/i, category: 'restaurant' },
  { re: /\b(clinic|health|medical|doctor|dental|vet|pharmacy)\b/i, category: 'retail', hint: 'Healthcare or professional services' },
];

/**
 * Maps free-text business description to internal AI category (tone).
 */
export function inferAiCategoryFromText(input: string): BusinessType {
  const s = input.trim();
  if (!s) return 'restaurant';
  for (const r of RULES) {
    if (r.re.test(s)) return r.category;
  }
  return 'retail';
}

export function inferCustomDescriptionHint(typed: string, aiCategory: BusinessType): string {
  const t = typed.trim();
  if (!t) return '';
  for (const r of RULES) {
    if (r.re.test(t) && r.hint) return r.hint;
  }
  const lower = t.toLowerCase();
  if (lower.includes('flower') || lower.includes('florist')) return 'This is a flower shop / florist.';
  if (/\b(dog|pet|cat)\b/.test(lower) && lower.includes('groom')) return 'This is a pet grooming salon.';
  return `User typed: ${t}. Tailor tone using the ${aiCategory} category while reflecting this exact business.`;
}

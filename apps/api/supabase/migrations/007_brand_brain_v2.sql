-- Brand Brain v2 foundation fields (Pomelli-style context depth)
-- Keeps existing columns; extends business_profiles for confidence + memory.

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS business_subcategory TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS tone_of_voice TEXT,
  ADD COLUMN IF NOT EXISTS content_persona TEXT,
  ADD COLUMN IF NOT EXISTS core_services JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hero_product TEXT,
  ADD COLUMN IF NOT EXISTS price_positioning TEXT,
  ADD COLUMN IF NOT EXISTS unique_differentiator TEXT,
  ADD COLUMN IF NOT EXISTS visual_style TEXT,
  ADD COLUMN IF NOT EXISTS photo_style_examples JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS studio_style_preference TEXT,
  ADD COLUMN IF NOT EXISTS studio_bg_color TEXT,
  ADD COLUMN IF NOT EXISTS seasonal_context TEXT,
  ADD COLUMN IF NOT EXISTS local_events JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_post_topics JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS top_performing_angles JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_caption_length TEXT,
  ADD COLUMN IF NOT EXISTS preferred_posting_days JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_studio_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_overall DOUBLE PRECISION DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS enrichment_version INTEGER DEFAULT 1;

COMMENT ON COLUMN business_profiles.core_services IS 'Brand Brain v2: key services/products';
COMMENT ON COLUMN business_profiles.top_performing_angles IS 'Learned topic/angle memory from publish outcomes';
COMMENT ON COLUMN business_profiles.photo_studio_history IS 'AI Photo Studio variant approvals and feedback';

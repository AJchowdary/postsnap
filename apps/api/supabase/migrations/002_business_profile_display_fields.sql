-- Optional display label + AI context for business type
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS display_type TEXT,
  ADD COLUMN IF NOT EXISTS custom_description TEXT DEFAULT '';

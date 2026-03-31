-- Up to 6 extra reference images per campaign (URLs or data URLs stored client-side as strings in JSON).
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS reference_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

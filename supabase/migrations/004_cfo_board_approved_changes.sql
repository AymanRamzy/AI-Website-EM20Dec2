-- CFO Application Board-Approved Changes Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ADD NEW COLUMN: cfo_readiness_commitment (merged question)
-- ============================================
ALTER TABLE cfo_applications
ADD COLUMN IF NOT EXISTS cfo_readiness_commitment TEXT;

-- ============================================
-- 2. ADD CV UPLOAD COLUMNS
-- ============================================
ALTER TABLE cfo_applications
ADD COLUMN IF NOT EXISTS cv_url TEXT;

ALTER TABLE cfo_applications
ADD COLUMN IF NOT EXISTS cv_uploaded_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 3. CREATE STORAGE BUCKET FOR CVs (if not exists)
-- ============================================
-- Note: Run this separately in Supabase Dashboard > Storage
-- Or via SQL if you have storage admin rights:
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('cfo-cvs', 'cfo-cvs', true)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================
-- VERIFY MIGRATION
-- ============================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cfo_applications'
AND column_name IN ('cfo_readiness_commitment', 'cv_url', 'cv_uploaded_at');

-- ============================================================
-- AIAS Dashboard — Neon Postgres Schema
-- Run this entire file once against your Neon database
-- (Neon dashboard → SQL Editor, or: psql "$DATABASE_URL" -f neon_schema.sql)
-- ============================================================

-- 1. Sheet cache (20-min TTL for live sheets, forever for past dates)
CREATE TABLE IF NOT EXISTS sheet_cache (
  sheet_name  TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  row_count   INTEGER     NOT NULL DEFAULT 0
);

-- 2. AI analysis cache (permanent — never expires)
CREATE TABLE IF NOT EXISTS ai_cache (
  cache_key   TEXT        PRIMARY KEY,
  result      JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Lead static data (email as PK — inserted once, never updated)
CREATE TABLE IF NOT EXISTS lead_static (
  email             TEXT PRIMARY KEY,
  mobile            TEXT,
  name              TEXT,
  source            TEXT,
  medium            TEXT,
  campaign          TEXT,
  primary_source    TEXT,
  primary_medium    TEXT,
  primary_campaign  TEXT,
  city              TEXT,
  country_code      TEXT,
  lead_type         TEXT,
  lead_origin       TEXT,
  program           TEXT,
  registered_on     TEXT,
  extra_data        JSONB
);

-- 4. Lead daily snapshot (dynamic columns captured each night)
CREATE TABLE IF NOT EXISTS lead_history (
  id                            BIGSERIAL PRIMARY KEY,
  snapshot_date                 DATE        NOT NULL,
  email                         TEXT        NOT NULL,
  lead_score                    TEXT,
  user_type                     TEXT,
  mobile_verified               TEXT,
  email_verified                TEXT,
  payment_status                TEXT,
  updated_at                    TEXT,
  counsellor                    TEXT,
  lead_stage                    TEXT,
  lead_sub_stage                TEXT,
  app_form_start_date           TEXT,
  payment_initiated_date        TEXT,
  payment_last_initiated_date   TEXT,
  counsellor_first_activity     TEXT,
  counsellor_last_activity      TEXT,
  app_fee_paid_on               TEXT,
  last_stage_updated            TEXT,
  app_last_activity_date        TEXT,
  notes                         TEXT,
  tags                          TEXT,
  source_score                  TEXT,
  recency_score                 TEXT,
  stage_score                   TEXT,
  organic_bonus                 TEXT,
  ig_bonus                      TEXT,
  total_lead_score              TEXT,
  priority                      TEXT,
  UNIQUE (snapshot_date, email)
);

-- 5. App Start static data (application_number as PK — inserted once)
CREATE TABLE IF NOT EXISTS app_start_static (
  application_number  TEXT PRIMARY KEY,
  email               TEXT,
  mobile              TEXT,
  name                TEXT,
  source              TEXT,
  medium              TEXT,
  campaign            TEXT,
  primary_source      TEXT,
  primary_medium      TEXT,
  primary_campaign    TEXT,
  city                TEXT,
  state               TEXT,
  program             TEXT,
  registered_on       TEXT,
  extra_data          JSONB
);

-- 6. App Start daily snapshot (dynamic columns captured each night)
CREATE TABLE IF NOT EXISTS app_start_history (
  id                            BIGSERIAL PRIMARY KEY,
  snapshot_date                 DATE        NOT NULL,
  application_number            TEXT        NOT NULL,
  application_status            TEXT,
  payment_status                TEXT,
  payment_method                TEXT,
  payment_initiated             TEXT,
  coupon_code                   TEXT,
  form_completion_date          TEXT,
  app_form_initiated            TEXT,
  app_form_submitted            TEXT,
  last_interacted_section       TEXT,
  updated_date                  TEXT,
  lead_score                    TEXT,
  counsellor                    TEXT,
  counsellor_email              TEXT,
  lead_stage                    TEXT,
  application_stage             TEXT,
  application_sub_stage         TEXT,
  previous_lead_stage           TEXT,
  reassigned_by                 TEXT,
  reassigned_on                 TEXT,
  is_email_verified             TEXT,
  is_mobile_verified            TEXT,
  last_active_at                TEXT,
  app_form_start_date           TEXT,
  payment_initiated_date        TEXT,
  payment_last_initiated_date   TEXT,
  counsellor_first_activity     TEXT,
  counsellor_last_activity      TEXT,
  app_fee_paid_on               TEXT,
  last_stage_updated            TEXT,
  app_last_activity_date        TEXT,
  total_forms_initiated         TEXT,
  notes                         TEXT,
  video_link                    TEXT,
  application_tags              TEXT,
  tags                          TEXT,
  mu_baat_link                  TEXT,
  mu_baat_result                TEXT,
  mu_baat_report                TEXT,
  total_score_formula           TEXT,
  priority_app_start            TEXT,
  UNIQUE (snapshot_date, application_number)
);

-- ── Indexes for common query patterns ───────────────────────────────────────

-- lead_history: look up a lead's full history by email
CREATE INDEX IF NOT EXISTS idx_lead_history_email         ON lead_history (email);
-- lead_history: get all leads for a counsellor on a date
CREATE INDEX IF NOT EXISTS idx_lead_history_date_counsellor ON lead_history (snapshot_date, counsellor);
-- lead_history: filter by stage
CREATE INDEX IF NOT EXISTS idx_lead_history_stage         ON lead_history (lead_stage);

-- app_start_history: look up an app's full history
CREATE INDEX IF NOT EXISTS idx_app_history_appnum         ON app_start_history (application_number);
-- app_start_history: get all apps for a counsellor on a date
CREATE INDEX IF NOT EXISTS idx_app_history_date_counsellor ON app_start_history (snapshot_date, counsellor);
-- app_start_history: filter by stage
CREATE INDEX IF NOT EXISTS idx_app_history_stage          ON app_start_history (application_stage);
-- app_start_history: filter paid apps
CREATE INDEX IF NOT EXISTS idx_app_history_payment        ON app_start_history (payment_status);

-- lead_static: look up by email
CREATE INDEX IF NOT EXISTS idx_lead_static_email          ON lead_static (email);
-- app_start_static: look up by email (for joins)
CREATE INDEX IF NOT EXISTS idx_app_static_email           ON app_start_static (email);

-- 7. Paid-app classification (admin marks each completed paid app as Counseled or Inbound)
--    Pending = no row → excluded from the leaderboard. Counseled → credited to the
--    assigned counsellor. Inbound → never counted on the leaderboard.
CREATE TABLE IF NOT EXISTS paidapp_classification (
  application_number  TEXT PRIMARY KEY,
  classification      TEXT        NOT NULL CHECK (classification IN ('counseled', 'inbound')),
  classified_by       TEXT,
  classified_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

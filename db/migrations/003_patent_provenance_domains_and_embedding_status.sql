-- PatentScan migration 003
-- Additive and data-preserving. Safe to run more than once.
-- Run against the existing `patentscan` database after taking a backup.

BEGIN;

ALTER TABLE patents
    ADD COLUMN IF NOT EXISTS domain VARCHAR(80) NOT NULL DEFAULT 'Needs Review',
    ADD COLUMN IF NOT EXISTS source_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS source_identifier VARCHAR(160),
    ADD COLUMN IF NOT EXISTS source_license VARCHAR(160),
    ADD COLUMN IF NOT EXISTS source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS embedding_text_hash CHAR(64),
    ADD COLUMN IF NOT EXISTS embedding_error TEXT;

-- Backfill provenance for existing records without inventing a source.
UPDATE patents
SET source_identifier = publication_number
WHERE source_identifier IS NULL;

-- Existing vectors are retained and marked complete; records without vectors stay pending.
UPDATE patents p
SET embedding_status = 'COMPLETED'
WHERE EXISTS (SELECT 1 FROM patent_embeddings pe WHERE pe.patent_id = p.patent_id);

-- Keep the current source_url untouched. A URL is not proof of a source API.
CREATE INDEX IF NOT EXISTS patents_domain_idx ON patents(domain);
CREATE INDEX IF NOT EXISTS patents_source_name_idx ON patents(source_name);
CREATE UNIQUE INDEX IF NOT EXISTS patents_source_identifier_uq
    ON patents(source_name, source_identifier)
    WHERE source_name IS NOT NULL AND source_identifier IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'patents_embedding_status_check'
          AND conrelid = 'patents'::regclass
    ) THEN
        ALTER TABLE patents
            ADD CONSTRAINT patents_embedding_status_check
            CHECK (embedding_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'));
    END IF;
END $$;

-- Existing schema requires an investigation for every search. Make it optional
-- so public/standalone authenticated searches can be logged too.
ALTER TABLE search_logs
    ALTER COLUMN investigation_id DROP NOT NULL;

ALTER TABLE search_logs
    ADD COLUMN IF NOT EXISTS user_id BIGINT,
    ADD COLUMN IF NOT EXISTS domain VARCHAR(80);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'search_logs_user_id_fkey'
          AND conrelid = 'search_logs'::regclass
    ) THEN
        ALTER TABLE search_logs
            ADD CONSTRAINT search_logs_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES app_users(user_id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS search_logs_user_created_idx
    ON search_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS search_logs_domain_idx
    ON search_logs(domain);

COMMIT;

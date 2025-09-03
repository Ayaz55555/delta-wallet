-- Migration to add version column to comments table
-- Run this in your Supabase SQL Editor if you already have the comments table

-- Add version column to existing comments table
ALTER TABLE comments ADD COLUMN IF NOT EXISTS version TEXT DEFAULT 'v1' NOT NULL;

-- Create index for version column
CREATE INDEX IF NOT EXISTS idx_comments_version ON comments(version);

-- Update existing comments to have version 'v1' if they don't have one
UPDATE comments SET version = 'v1' WHERE version IS NULL;

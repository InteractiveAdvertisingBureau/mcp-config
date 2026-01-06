-- Migration: Add authentication fields to registered_apis table
-- Date: 2025-11-26

USE mcp_api_testing;

-- Add authentication columns
ALTER TABLE registered_apis
ADD COLUMN IF NOT EXISTS auth_required BOOLEAN DEFAULT FALSE AFTER description,
ADD COLUMN IF NOT EXISTS auth_type VARCHAR(50) DEFAULT NULL AFTER auth_required,
ADD COLUMN IF NOT EXISTS auth_token TEXT DEFAULT NULL AFTER auth_type;

-- Verify columns were added
DESCRIBE registered_apis;

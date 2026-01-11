-- src/core/database/migrations/001_initial_schema.sql

CREATE TABLE IF NOT EXISTS access_control (
    user_id VARCHAR(32) PRIMARY KEY,
    role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'SUDO', 'USER')),
    added_by VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_mappings (
    tiktok_username VARCHAR(50) NOT NULL,
    discord_channel_id VARCHAR(32) NOT NULL,
    role_id_to_tag VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (tiktok_username, discord_channel_id)
);

CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_system_config_key_format CHECK (key ~ '^[A-Z_]+$')
);

-- Indexes --
CREATE INDEX IF NOT EXISTS idx_user_mappings_tiktok_username ON user_mappings(tiktok_username);
CREATE INDEX IF NOT EXISTS idx_user_mappings_discord_channel_id ON user_mappings(discord_channel_id);
CREATE INDEX IF NOT EXISTS idx_access_control_role ON access_control(role);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Functions & Triggers (Postgres support CREATE OR REPLACE) --
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_mappings_updated_at ON user_mappings;
CREATE TRIGGER trg_user_mappings_updated_at
    BEFORE UPDATE ON user_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_system_config_updated_at ON system_config;
CREATE TRIGGER trg_system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Initial Data --
INSERT INTO system_config (key, value) VALUES
    ('VERSION', '2.0.0'),
    ('MAINTENANCE_MODE', 'false')
ON CONFLICT (key) DO NOTHING;
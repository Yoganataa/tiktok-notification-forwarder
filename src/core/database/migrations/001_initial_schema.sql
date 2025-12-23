-- src/core/database/migrations/001_initial_schema.sql

CREATE TABLE IF NOT EXISTS access_control (
    user_id VARCHAR(32) PRIMARY KEY,
    role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'SUDO', 'USER')),
    added_by VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_mapping (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    channel_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_username_format CHECK (username ~ '^[a-z0-9_.]{2,50}$'),
    CONSTRAINT chk_channel_id_format CHECK (channel_id ~ '^[0-9]+$')
);

CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_system_config_key_format CHECK (key ~ '^[A-Z_]+$')
);

-- Indexes --
CREATE INDEX IF NOT EXISTS idx_user_mapping_username ON user_mapping(username);
CREATE INDEX IF NOT EXISTS idx_user_mapping_channel_id ON user_mapping(channel_id);
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

DROP TRIGGER IF EXISTS trg_user_mapping_updated_at ON user_mapping;
CREATE TRIGGER trg_user_mapping_updated_at
    BEFORE UPDATE ON user_mapping
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
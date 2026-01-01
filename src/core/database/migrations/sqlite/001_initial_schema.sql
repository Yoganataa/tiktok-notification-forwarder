-- SQLite Schema

CREATE TABLE IF NOT EXISTS access_control (
    user_id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'SUDO', 'USER')),
    added_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    channel_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_username_format CHECK (LENGTH(username) >= 2 AND LENGTH(username) <= 50),
    CONSTRAINT chk_channel_id_format CHECK (channel_id GLOB '[0-9]*')
);

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_system_config_key_format CHECK (key GLOB '[A-Z_]*')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_mapping_username ON user_mapping(username);
CREATE INDEX IF NOT EXISTS idx_user_mapping_channel_id ON user_mapping(channel_id);
CREATE INDEX IF NOT EXISTS idx_access_control_role ON access_control(role);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Triggers for Updated At
-- SQLite does not support "OR REPLACE FUNCTION". Logic moves inside the trigger body.

DROP TRIGGER IF EXISTS trg_user_mapping_updated_at;
CREATE TRIGGER trg_user_mapping_updated_at
AFTER UPDATE ON user_mapping
FOR EACH ROW
BEGIN
    UPDATE user_mapping SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

DROP TRIGGER IF EXISTS trg_system_config_updated_at;
CREATE TRIGGER trg_system_config_updated_at
AFTER UPDATE ON system_config
FOR EACH ROW
BEGIN
    UPDATE system_config SET updated_at = CURRENT_TIMESTAMP WHERE key = OLD.key;
END;

-- Initial Data
INSERT OR IGNORE INTO system_config (key, value) VALUES ('VERSION', '2.0.0');
INSERT OR IGNORE INTO system_config (key, value) VALUES ('MAINTENANCE_MODE', 'false');
-- SQLite Schema

CREATE TABLE IF NOT EXISTS access_control (
    user_id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'SUDO', 'USER')),
    added_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_mappings (
    tiktok_username TEXT NOT NULL,
    discord_channel_id TEXT NOT NULL,
    role_id_to_tag TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tiktok_username, discord_channel_id)
);

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_system_config_key_format CHECK (key GLOB '[A-Z_]*')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_mappings_tiktok_username ON user_mappings(tiktok_username);
CREATE INDEX IF NOT EXISTS idx_user_mappings_discord_channel_id ON user_mappings(discord_channel_id);
CREATE INDEX IF NOT EXISTS idx_access_control_role ON access_control(role);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Triggers for Updated At
DROP TRIGGER IF EXISTS trg_user_mappings_updated_at;
CREATE TRIGGER trg_user_mappings_updated_at
AFTER UPDATE ON user_mappings
FOR EACH ROW
BEGIN
    UPDATE user_mappings SET updated_at = CURRENT_TIMESTAMP WHERE tiktok_username = OLD.tiktok_username AND discord_channel_id = OLD.discord_channel_id;
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
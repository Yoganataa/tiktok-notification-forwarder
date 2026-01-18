ALTER TABLE user_mapping ADD COLUMN role_id TEXT;

CREATE TABLE IF NOT EXISTS message_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payload TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FAILED', 'DONE')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON message_queue(status);

-- Trigger for Updated At
DROP TRIGGER IF EXISTS trg_message_queue_updated_at;
CREATE TRIGGER trg_message_queue_updated_at
AFTER UPDATE ON message_queue
FOR EACH ROW
BEGIN
    UPDATE message_queue SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

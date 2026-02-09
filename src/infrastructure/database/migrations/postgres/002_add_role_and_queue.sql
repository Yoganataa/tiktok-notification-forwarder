ALTER TABLE user_mapping ADD COLUMN role_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS message_queue (
    id SERIAL PRIMARY KEY,
    payload JSONB NOT NULL,
    attempts INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FAILED', 'DONE')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_queue_status ON message_queue(status);

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Directory used to store Telegram session files.
 * Resolved relative to project root.
 */
const SESSION_DIR = path.resolve(__dirname, '../../../sessions');

/**
 * Telegram session file path.
 */
const SESSION_FILE = path.join(SESSION_DIR, 'telegram.session');

/**
 * Persist Telegram session string to disk using atomic write.
 */
export async function saveTelegramSession(session: string): Promise<void> {
    await fs.mkdir(SESSION_DIR, { recursive: true });

    const tempFile = SESSION_FILE + '.tmp';

    // Write temp file first
    await fs.writeFile(tempFile, session.trim(), {
        encoding: 'utf-8',
        mode: 0o600
    });

    // Atomic rename
    await fs.rename(tempFile, SESSION_FILE);
}

/**
 * Load Telegram session from disk if available.
 */
export async function loadTelegramSession(): Promise<string | null> {
    try {
        const data = await fs.readFile(SESSION_FILE, 'utf-8');
        return data.trim();
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            return null; // file not found is normal
        }

        // Unexpected error should surface
        throw err;
    }
}

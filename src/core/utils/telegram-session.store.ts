import { promises as fs } from 'fs';
import path from 'path';

const SESSION_DIR = path.resolve(process.cwd(), 'sessions');
const SESSION_FILE = path.join(SESSION_DIR, 'telegram.session');

export async function saveTelegramSession(session: string): Promise<void> {
    await fs.mkdir(SESSION_DIR, { recursive: true });
    await fs.writeFile(SESSION_FILE, session, {
        encoding: 'utf-8',
        mode: 0o600
    });
}

export async function loadTelegramSession(): Promise<string | null> {
    try {
        return await fs.readFile(SESSION_FILE, 'utf-8');
    } catch {
        return null;
    }
}

import { BaseRepository } from './base.repository';

export interface QueueJob {
  id: number;
  payload: any;
  attempts: number;
  status: 'PENDING' | 'FAILED' | 'DONE';
  created_at: Date;
  updated_at: Date;
}

export class QueueRepository extends BaseRepository {
  async enqueue(payload: any): Promise<void> {
    const sql = `
      INSERT INTO message_queue (payload, status, attempts)
      VALUES ($1, 'PENDING', 0)
    `;
    await this.query(sql, [JSON.stringify(payload)]);
  }

  async getPending(limit: number = 10): Promise<QueueJob[]> {
    const sql = `
      SELECT * FROM message_queue
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT $1
    `;
    const result = await this.query<QueueJob>(sql, [limit]);
    return result.rows.map(row => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
    }));
  }

  async markDone(id: number): Promise<void> {
    await this.query('UPDATE message_queue SET status = \'DONE\' WHERE id = $1', [id]);
  }

  async markFailed(id: number): Promise<void> {
    await this.query('UPDATE message_queue SET status = \'FAILED\' WHERE id = $1', [id]);
  }

  async incrementAttempts(id: number): Promise<void> {
    await this.query('UPDATE message_queue SET attempts = attempts + 1 WHERE id = $1', [id]);
  }
}

import { IDomainEvent } from '../../domain/events/domain-event';
import { BaseRepository } from '../../../infra/database/base.repository';
import { TransactionContext } from '../../../infra/database/transaction';
import { logger } from '../../../infra/logger';

export class OutboxRepository extends BaseRepository {
  /**
   * Persists a domain event to the outbox table.
   * CRITICAL: Must be executed within the same transaction as the aggregate state change.
   */
  async save(event: IDomainEvent, tx: TransactionContext): Promise<void> {
    const jsonEvent = event.toJSON();
    const payload = JSON.stringify((jsonEvent as any).payload);
    
    // Check if Postgres or SQLite behavior is needed for Parameter Binding
    // Postgres uses $1, $2. SQLite via BaseRepo adapter uses ?
    // Let's use BaseRepo which handles normalization if passed correctly, 
    // BUT we need to ensure the SQL string is compatible.
    // 'INSERT INTO ... VALUES ($1)' is standard enough if BaseRepo replaces $ with ? for SQLite.

    const query = `
      INSERT INTO outbox_events (event_id, aggregate_id, event_type, payload, created_at, processed_at)
      VALUES ($1, $2, $3, $4, $5, NULL)
    `;

    await this.query(
      query,
      [
        event.eventId,
        event.aggregateId,
        event.constructor.name,
        payload,
        event.occurredAt
      ],
      tx
    );
    
    logger.debug(`Persisted outbox event ${event.eventId} (${event.constructor.name})`);
  }

  /**
   * Finds unprocessed events for the worker.
   * Locked for update in Postgres.
   */
  async findUnprocessedAndLock(limit: number, tx: TransactionContext): Promise<any[]> {
    const isPostgres = !!(tx as any).query;

    if (isPostgres) {
        const query = `
          SELECT * FROM outbox_events
          WHERE processed_at IS NULL
          ORDER BY created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        `;
        return (await this.query(query, [limit], tx)).rows;
    } else {
        // SQLite: Application-level locking with RETURNING
        // Claims pending events OR events stuck in PROCESSING for > 5 mins
        const query = `
          UPDATE outbox_events
          SET status = 'PROCESSING', locked_at = CURRENT_TIMESTAMP
          WHERE event_id IN (
            SELECT event_id FROM outbox_events
            WHERE processed_at IS NULL 
            AND (status = 'PENDING' OR (status = 'PROCESSING' AND locked_at < datetime('now', '-5 minutes')))
            ORDER BY created_at ASC
            LIMIT ?
          )
          RETURNING *
        `;
         // BaseRepository will detect 'RETURNING' makes it a reader (in better-sqlite3) and use .all()
         const result = await this.query(query, [limit], tx);
         return result.rows;
    }
  }

  /**
   * Marks events as processed.
   */
  async markAsProcessed(eventIds: string[], tx: TransactionContext): Promise<void> {
    if (eventIds.length === 0) return;

    // Parameter expansion $1, $2, etc.
    const placeholders = eventIds.map((_, i) => `$${i + 1}`).join(', ');
    // Removed unused query variable
    
    // SQLite uses CURRENT_TIMESTAMP or different 'NOW()'.
    // BaseRepo normalization of params handles $ -> ?.
    // query normalization? 
    // Let's be explicit:
     const isPostgres = !!(tx as any).query;
     const nowFn = isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP';
     
     const queryDialect = `
       UPDATE outbox_events
       SET processed_at = ${nowFn}
       WHERE event_id IN (${placeholders})
     `;

    await this.query(queryDialect, eventIds, tx);
  }
}

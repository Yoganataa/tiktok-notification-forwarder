import { DomainEventBus } from '../../domain/events/domain-event-bus'; // Shared kernel bus
import { TikTokVideoForwardedEvent } from '../../../modules/forwarder/domain/events/tiktok-video-forwarded.event';
import { OutboxRepository } from './outbox.repository';
import { withTransaction } from '../../../infra/database/transaction';
import { logger } from '../../../infra/logger';
// Note: In real app, we need a registry to deserialize correct event classes from JSON "event_type".
// For now, we only have one event type, so we can hardcode or simple switch.

export class OutboxProcessor {
  private isProcessing = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly outboxRepo: OutboxRepository,
    private readonly eventBus: DomainEventBus,
    private readonly pollIntervalMs: number = 2000
  ) {}

  start() {
    this.intervalId = setInterval(() => this.process(), this.pollIntervalMs);
    logger.info('Outbox Processor started.');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('Outbox Processor stopped.');
  }

  async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Transactional Polling Logic
      // 1. Get batch
      await withTransaction(async (tx) => {
         const events = await this.outboxRepo.findUnprocessedAndLock(10, tx);
         if (events.length === 0) return;

         logger.debug(`Outbox: found ${events.length} pending events.`);

         // 2. Dispatch
         // CRITICAL: Dispatch happens *inside* the transaction loop conceptually IF we want atomic mark-as-processed?
         // NO. If dispatch fails (handler fails), do we want to rollback "mark as processed"? YES.
         // Do we want to rollback the side-effect (Discord call)? We CANNOT rollback a HTTP call.
         // This is the classic "At Least Once" dilemma.
         // If we commit "processed" BEFORE dispatch -> we might lose event if crash.
         // If we commit "processed" AFTER dispatch -> we might duplicate event if crash after dispatch before commit.
         // "Exactly Once" is usually "Effectively Once" via idempotent handling on consumer side.
         // User requested: "Transactional Polling ... Dispatch ... UPDATE processed_at ... COMMIT"
         
         const processedIds: string[] = [];
         
         for (const record of events) {
             const event = this.reconstructEvent(record);
             if (event) {
                 try {
                     // Dispatch In-Memory
                     // Handlers should be idempotent!
                     await this.eventBus.publish(event);
                     processedIds.push(event.eventId);
                 } catch (dispatchError) {
                     logger.error(`Failed to dispatch event ${event.eventId}`, { error: (dispatchError as Error).message });
                     // If dispatch fails, do we mark as processed? 
                     // Usually: No, we retry later. 
                     // But if it's a permanent error (bug type), we might poison queue.
                     // For now: Skip marking as processed. It will be picked up again.
                 }
             } else {
                 // Unknown event type, mark processed or dead letter?
                 logger.warn(`Unknown event type ${record.event_type}, skipping/marking processed to avoid loop.`);
                 // Safety: mark processed so we don't loop forever on bad data
                 processedIds.push(record.event_id); 
             }
         }

         // 3. Mark processed
         if (processedIds.length > 0) {
             await this.outboxRepo.markAsProcessed(processedIds, tx);
         }
      });

    } catch (error) {
       logger.error('Outbox processing error', { error: (error as Error).message });
    } finally {
       this.isProcessing = false;
    }
  }

  // Helper to rehydrate event
  private reconstructEvent(record: any): any {
     // record.payload might be string (SQLite) or object (Postgres JSONB)
     // BaseRepo handles row parsing usually, but let's be safe.
     let payload = record.payload;
     if (typeof payload === 'string') {
         try { payload = JSON.parse(payload); } catch(e) {}
     }

     if (record.event_type === 'TikTokVideoForwardedEvent') {
         // Clean reconstruction using static factory
         return TikTokVideoForwardedEvent.reconstitute(payload);
     }
     return null;
  }
}

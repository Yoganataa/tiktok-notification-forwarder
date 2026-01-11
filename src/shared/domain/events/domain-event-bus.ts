import { IDomainEvent } from './domain-event';
import { IEventHandler } from './event-handler';
import { logger } from '../../../infra/logger';

export class DomainEventBus {
  private static instance: DomainEventBus;
  private handlers: Map<string, IEventHandler<IDomainEvent>[]> = new Map();

  private constructor() {}

  public static getInstance(): DomainEventBus {
    if (!DomainEventBus.instance) {
      DomainEventBus.instance = new DomainEventBus();
    }
    return DomainEventBus.instance;
  }

  public register<T extends IDomainEvent>(eventName: string, handler: IEventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler as IEventHandler<IDomainEvent>);
  }

  public async publish(event: IDomainEvent): Promise<void> {
    const eventName = event.constructor.name;
    const handlers = this.handlers.get(eventName);

    if (!handlers || handlers.length === 0) {
        logger.debug(`No handlers registered for event: ${eventName}`);
        return;
    }

    logger.info(`Publishing event: ${eventName}`);
    for (const handler of handlers) {
      try {
        await handler.handle(event);
      } catch (error) {
        logger.error(`Error handling event ${eventName}:`, { error: (error as Error).message });
        // We catch here to ensure one handler failing doesn't stop others or crash the transaction if we were sync
      }
    }
  }

  // Clear handlers, useful for testing
  public clear(): void {
    this.handlers.clear();
  }
}

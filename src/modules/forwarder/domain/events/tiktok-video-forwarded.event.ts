import { v4 as uuidv4 } from 'uuid';
import { IDomainEvent } from '../../../../shared/domain/events/domain-event';
import { DownloadResult } from '../../../tiktok/domain';

export interface MappingDTO {
    username: string;
    channelId: string;
    roleIdToTag: string | null;
}

export class TikTokVideoForwardedEvent implements IDomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: Date;
  public readonly aggregateId: string;

  constructor(
    public readonly mapping: MappingDTO,
    public readonly media: DownloadResult,
    public readonly originalUrl: string,
    id?: string,
    date?: Date
  ) {
    this.eventId = id || uuidv4();
    this.occurredAt = date || new Date();
    this.aggregateId = `${mapping.username}#${mapping.channelId}`;
  }

  static reconstitute(payload: any): TikTokVideoForwardedEvent {
      return new TikTokVideoForwardedEvent(
          payload.mapping,
          payload.media,
          payload.originalUrl,
          payload.eventId,
          new Date(payload.occurredAt)
      );
  }

  toJSON(): object {
    return {
      eventId: this.eventId,
      aggregateId: this.aggregateId,
      occurredAt: this.occurredAt,
      eventType: this.constructor.name,
      payload: {
        eventId: this.eventId, 
        occurredAt: this.occurredAt,
        mapping: this.mapping,
        media: this.media,
        originalUrl: this.originalUrl
      }
    };
  }
}

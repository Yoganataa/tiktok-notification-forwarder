import { DomainError } from '../errors/domain.error';

export class DiscordChannelId {
  private constructor(public readonly value: string) {}

  static create(raw: string): DiscordChannelId {
    if (!/^\d{17,19}$/.test(raw)) {
      throw new DomainError('Invalid Discord channel id');
    }
    return new DiscordChannelId(raw);
  }
}

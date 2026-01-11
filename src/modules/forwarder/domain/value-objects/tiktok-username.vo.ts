import { DomainError } from '../errors/domain.error';

export class TikTokUsername {
  private constructor(public readonly value: string) {}

  static create(raw: string): TikTokUsername {
    const normalized = raw.toLowerCase().replace(/^@/, '').trim();

    if (!/^[a-z0-9_.]{2,24}$/.test(normalized)) {
      throw new DomainError('Invalid TikTok username');
    }

    return new TikTokUsername(normalized);
  }
}

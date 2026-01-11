import { SystemConfig } from '../domain/system-config.entity';
import { TransactionContext } from '../../../infra/database/transaction';

export interface SystemConfigRepositoryPort {
  get(key: string, tx?: TransactionContext): Promise<string | null>;
  set(key: string, value: string, tx: TransactionContext): Promise<void>;
  delete(key: string, tx: TransactionContext): Promise<boolean>;
  findAll(tx?: TransactionContext): Promise<SystemConfig[]>;
}

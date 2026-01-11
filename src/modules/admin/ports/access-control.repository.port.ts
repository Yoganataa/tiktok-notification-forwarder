import { AccessControl } from '../domain/access-control.entity';
import { UserRole } from '../../../shared/types/database.types';
import { TransactionContext } from '../../../infra/database/transaction';

export interface AccessControlRepositoryPort {
  getUserRole(userId: string, tx?: TransactionContext): Promise<UserRole | null>;
  upsert(accessControl: Omit<AccessControl, 'createdAt' | 'updatedAt'>, tx: TransactionContext): Promise<AccessControl>;
  delete(userId: string, tx: TransactionContext): Promise<boolean>;
  findAll(tx?: TransactionContext): Promise<AccessControl[]>;
}

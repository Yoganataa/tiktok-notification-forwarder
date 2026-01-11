import { UserRole } from '../../../shared/types/database.types';

export class AccessControl {
  constructor(
    public readonly userId: string,
    public readonly role: UserRole,
    public readonly assignedBy: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}

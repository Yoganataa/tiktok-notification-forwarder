import { AccessControlRepository } from '../infrastructure/repositories/access-control.repository';
import { UserRole, ROLES } from '../types/database.types';
import { configManager } from '../infrastructure/config/config';
import { ValidationError } from '../infrastructure/errors/validation.error';

export class PermissionService {
  constructor(private accessControlRepo: AccessControlRepository) {}

  async isAdminOrHigher(userId: string): Promise<boolean> {
    const config = configManager.get();
    if (config.discord.ownerId === userId) return true;

    const role = await this.accessControlRepo.getUserRole(userId);
    return role === ROLES.ADMIN || role === ROLES.OWNER;
  }

  async isSudoOrHigher(userId: string): Promise<boolean> {
    const config = configManager.get();
    if (config.discord.ownerId === userId) return true;

    const role = await this.accessControlRepo.getUserRole(userId);
    return role === ROLES.ADMIN || role === ROLES.SUDO || role === ROLES.OWNER;
  }

  async assignRole(targetId: string, role: UserRole, assignedBy: string): Promise<void> {
    if (role === ROLES.OWNER) {
        throw new ValidationError('Cannot assign OWNER role.');
    }
    await this.accessControlRepo.upsert(targetId, role, assignedBy);
  }

  async revokeAccess(targetId: string): Promise<void> {
    await this.accessControlRepo.delete(targetId);
  }

  async getAllStaff() {
      return this.accessControlRepo.getAllStaff();
  }
}

// src/modules/admin/application/admin.service.ts
import { AccessControlRepositoryPort } from '../ports/access-control.repository.port';
import { UserRole, ROLES } from '../../../shared/types/database.types';
import { configManager } from '../../../infra/config/config';
import { ValidationError } from '../../../shared/errors/validation.error';
import { AccessControl } from '../domain/access-control.entity';
import { withTransaction } from '../../../infra/database/transaction';

export class PermissionService {
  constructor(private accessControlRepo: AccessControlRepositoryPort) {}

  /**
   * Retrieves the role of a specific user.
   */
  async getUserRole(userId: string): Promise<UserRole> {
    const config = configManager.get();
    
    // Check for hardcoded Owner ID
    if (userId === config.discord.ownerId) {
        return ROLES.OWNER;
    }

    const role = await this.accessControlRepo.getUserRole(userId);
    return role || ROLES.USER; // Default to USER if no role found
  }

  /**
   * Checks if a user has at least ADMIN privileges.
   */
  async isAdminOrHigher(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return [ROLES.OWNER, ROLES.SUDO, ROLES.ADMIN].includes(role);
  }

  /**
   * Checks if a user has at least SUDO privileges.
   */
  async isSudoOrHigher(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return [ROLES.OWNER, ROLES.SUDO].includes(role);
  }

  /**
   * Assigns a role to a user.
   */
  async assignRole(targetUserId: string, role: UserRole, assignerId: string): Promise<void> {
    if (!Object.values(ROLES).includes(role)) {
      throw new ValidationError(`Invalid role: ${role}`);
    }

    // Prevent assigning OWNER role
    if (role === ROLES.OWNER) {
        throw new ValidationError('Cannot assign OWNER role via command.');
    }

    // Verify assigner permissions (must be higher or equal?) 
    // Simplified: Only Owner/Sudo can assign roles usually, handled by command check.
    
    await withTransaction(async (tx) => {
        await this.accessControlRepo.upsert({
          userId: targetUserId,
          role: role,
          assignedBy: assignerId
        }, tx);
    });
  }

  /**
   * Revokes access (removes role) from a user.
   */
  async revokeAccess(targetUserId: string): Promise<void> {
    const config = configManager.get();
    if (targetUserId === config.discord.ownerId) {
        throw new ValidationError('Cannot revoke access from the Owner.');
    }

    await withTransaction(async (tx) => {
        const deleted = await this.accessControlRepo.delete(targetUserId, tx);
        if (!deleted) {
          throw new ValidationError('User does not have any assigned role.');
        }
    });
  }

  /**
   * Gets all staff members (non-USER roles).
   */
  async getAllStaff(): Promise<AccessControl[]> {
      const all = await this.accessControlRepo.findAll();
      return all.filter(u => u.role !== ROLES.USER);
  }
}

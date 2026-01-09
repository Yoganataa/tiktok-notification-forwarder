// src/controllers/admin/index.ts
import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  RepliableInteraction,
  Interaction
} from 'discord.js';
import { PermissionService } from '../../services/permission.service';
import { SystemConfigRepository } from '../../repositories/system-config.repository';
import { UserMappingRepository } from '../../repositories/user-mapping.repository';

// Import Sub-Handlers
import { EnvironmentHandler } from './environment.handler';
import { MappingHandler } from './mapping.handler';
import { RoleHandler } from './role.handler';
import { ServerHandler } from './server.handler';
import { MenuHandler } from './menu.handler';

export class AdminController {
  private envHandler: EnvironmentHandler;
  private mapHandler: MappingHandler;
  private roleHandler: RoleHandler;
  private srvHandler: ServerHandler;
  private menuHandler: MenuHandler;

  constructor(
    private permissionService: PermissionService,
    systemConfigRepo: SystemConfigRepository,
    userMappingRepo: UserMappingRepository,
    onConfigReload: () => Promise<void>
  ) {
    // Initialize Sub-Handlers with necessary dependencies
    this.envHandler = new EnvironmentHandler(systemConfigRepo, onConfigReload, this.showMainMenu.bind(this));
    this.mapHandler = new MappingHandler(userMappingRepo);
    this.roleHandler = new RoleHandler(permissionService);
    this.srvHandler = new ServerHandler();
    this.menuHandler = new MenuHandler();
  }

  /**
   * Main Router for Button Interactions
   */
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    if (!(await this.checkPermission(interaction))) return;

    const id = interaction.customId;

    // Navigation Routing
    switch (id) {
      // Main Menu
      case 'nav_back_main': await this.showMainMenu(interaction); break;
      
      // Environment Module
      case 'nav_env': await this.envHandler.showPage(interaction); break;
      case 'btn_edit_env': await this.envHandler.showEditModal(interaction); break;
      case 'btn_toggle_dl': await this.envHandler.toggleDownloader(interaction); break;
      case 'btn_switch_engine': await this.envHandler.switchEngine(interaction); break; // <-- Routing untuk switch engine

      // Server Module
      case 'nav_servers': await this.srvHandler.showPage(interaction); break;

      // Role Module
      case 'nav_roles': await this.roleHandler.showPage(interaction); break;
      case 'btn_add_staff': await this.roleHandler.showAddModal(interaction); break;

      // Mapping Module
      case 'nav_mappings': await this.mapHandler.showPage(interaction); break;
      case 'btn_add_mapping': await this.mapHandler.showAddModal(interaction); break;

      default:
        // Dynamic Routings
        if (id.startsWith('role_act_')) await this.roleHandler.handleActions(interaction);
        else if (id.startsWith('map_act_')) await this.mapHandler.handleActions(interaction);
        break;
    }
  }

  /**
   * Main Router for Modal Submissions
   */
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId === 'modal_env_edit') {
      await this.envHandler.handleEditSubmit(interaction);
    } 
    else if (interaction.customId === 'modal_add_staff') {
      await this.roleHandler.handleAddSubmit(interaction);
    } 
    else if (interaction.customId === 'modal_add_mapping') {
      await this.mapHandler.handleAddSubmit(interaction);
    } 
    else if (interaction.customId.startsWith('modal_edit_mapping_')) {
      await this.mapHandler.handleEditSubmit(interaction);
    }
  }

  /**
   * Main Router for Select Menus
   */
  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    if (interaction.customId === 'select_staff_manage') {
      await this.roleHandler.handleSelection(interaction);
    } 
    else if (interaction.customId === 'select_mapping_manage') {
      await this.mapHandler.handleSelection(interaction);
    }
  }

  // --- Helpers ---

  private async showMainMenu(interaction: RepliableInteraction) {
    await this.menuHandler.show(interaction);
  }

  private async checkPermission(interaction: Interaction): Promise<boolean> {
    if (!(await this.permissionService.isAdminOrHigher(interaction.user.id))) {
        if (interaction.isRepliable()) {
            await interaction.reply({ content: '⛔ Access Denied.', ephemeral: true });
        }
        return false;
    }
    return true;
  }
}
import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RepliableInteraction,
} from 'discord.js';
import { PermissionService } from '../admin/permission.service';
import { SystemConfigRepository } from '../../core/repositories/system-config.repository';
import { UserMappingRepository } from '../../core/repositories/user-mapping.repository';
import { configManager } from '../../core/config/config';
import { MappingController } from '../mapping/mapping.controller';
import { ConfigController } from '../admin/config.controller';
import { RoleController } from '../admin/role.controller';

export class MenuController {
  private mappingController: MappingController;
  private configController: ConfigController;
  private roleController: RoleController;

  constructor(
    private permissionService: PermissionService,
    systemConfigRepo: SystemConfigRepository,
    userMappingRepo: UserMappingRepository,
    onConfigReload: () => Promise<void>
  ) {
    this.mappingController = new MappingController(userMappingRepo);
    this.configController = new ConfigController(systemConfigRepo, onConfigReload);
    this.roleController = new RoleController(permissionService);
  }

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const id = interaction.customId;

    if (id === 'btn_help') {
        await interaction.reply({ content: 'Help menu coming soon.', ephemeral: true });
        return;
    }
    if (id === 'btn_about') {
        await interaction.reply({ content: 'TikTok Forwarder Bot v2.2.0', ephemeral: true });
        return;
    }
    if (id === 'btn_open_menu') {
        if (!(await this.permissionService.isAdminOrHigher(interaction.user.id))) {
            await interaction.reply({ content: '⛔ Access Denied.', ephemeral: true });
            return;
        }
        await this.showMainMenu(interaction);
        return;
    }

    if (!(await this.permissionService.isAdminOrHigher(interaction.user.id))) {
      await interaction.reply({ content: '⛔ Access Denied.', ephemeral: true });
      return;
    }

    if (id === 'nav_back_main') {
      await interaction.deferUpdate();
      await this.showMainMenu(interaction);
      return;
    }

    if (id === 'nav_env') {
        await interaction.deferUpdate();
        await this.configController.showEnvironmentPage(interaction);
        return;
    }
    if (id === 'btn_edit_env') {
        // Do NOT deferUpdate here because showModal must be the first response
        await this.configController.showEditModal(interaction);
        return;
    }
    if (id === 'btn_toggle_autodl') {
        await interaction.deferUpdate();
        await this.configController.handleToggleAutoDl(interaction);
        return;
    }

    if (id === 'nav_roles' || id === 'btn_add_staff' || id.startsWith('role_act_')) {
        if (id === 'nav_roles') {
            await interaction.deferUpdate();
            await this.roleController.showManager(interaction);
        }
        else if (id === 'btn_add_staff') {
            // Do NOT deferUpdate here
            await this.roleController.showAddModal(interaction);
        }
        else {
             await interaction.deferUpdate();
             const parts = id.split('_');
             await this.roleController.handleButton(interaction, parts[2], parts[3]);
        }
        return;
    }

    if (id === 'nav_mappings' || id === 'btn_add_mapping' || id.startsWith('map_act_')) {
        if (id === 'nav_mappings') {
            await interaction.deferUpdate();
            await this.mappingController.showManager(interaction);
        }
        else if (id === 'btn_add_mapping') {
            // Do NOT deferUpdate here
            await this.mappingController.showAddModal(interaction);
        }
        else {
             const parts = id.split('_');
             const action = parts[2];

             // If action is edit, it shows a modal, so do NOT defer.
             if (action === 'edit') {
                 // Do NOT defer
             } else {
                 await interaction.deferUpdate();
             }

             await this.mappingController.handleButton(interaction, action, parts[3]);
        }
        return;
    }

    if (id === 'nav_servers') {
        await interaction.deferUpdate();
        await this.showServersPage(interaction);
        return;
    }
  }

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const id = interaction.customId;

    if (id === 'modal_env_edit') {
        await this.configController.handleEditModal(interaction, this.showMainMenu.bind(this));
    } else if (id === 'modal_add_staff') {
        await this.roleController.handleAddModal(interaction);
    } else if (id === 'modal_add_mapping') {
        await this.mappingController.handleAddModal(interaction);
    } else if (id.startsWith('modal_edit_mapping_')) {
        const username = id.replace('modal_edit_mapping_', '');
        await this.mappingController.handleEditModal(interaction, username);
    }
  }

  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    if (interaction.customId === 'select_engine') {
        await interaction.deferUpdate();
        await this.configController.handleEngineSelect(interaction);
        return;
    }
    if (interaction.customId === 'select_staff_manage') {
        await interaction.deferUpdate();
        await this.roleController.handleSelectMenu(interaction);
    } else if (interaction.customId === 'select_mapping_manage') {
        await interaction.deferUpdate();
        await this.mappingController.handleSelectMenu(interaction);
    }
  }

  async showMainMenu(interaction: RepliableInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎛️ System Control Panel')
      .setColor(0x2b2d31)
      .setDescription('Select a module to manage:')
      .addFields(
        { name: '🗺️ Mappings', value: 'Manage TikTok users', inline: true },
        { name: '⚙️ Environment', value: 'Edit configuration', inline: true },
        { name: '👥 Roles', value: 'Manage staff', inline: true },
        { name: '🖥️ Servers', value: 'View guilds', inline: true }
      )
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('nav_mappings').setLabel('Mappings').setStyle(ButtonStyle.Success).setEmoji('🗺️'),
      new ButtonBuilder().setCustomId('nav_env').setLabel('Environment').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('nav_roles').setLabel('Roles').setStyle(ButtonStyle.Primary).setEmoji('👥'),
      new ButtonBuilder().setCustomId('nav_servers').setLabel('Servers').setStyle(ButtonStyle.Secondary).setEmoji('🖥️')
    );

    const payload = { embeds: [embed], components: [row1, row2] };

    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
      if (!interaction.deferred && !interaction.replied) await (interaction as any).update(payload);
      else await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, ephemeral: true });
    }
  }

  private async showServersPage(interaction: ButtonInteraction): Promise<void> {
    const client = interaction.client;
    const guilds = await client.guilds.fetch();
    const config = configManager.get();
    const coreId = config.discord.coreServerId;

    const subsServers: string[] = [];
    const coreServers: string[] = [];

    for (const [id, oauthGuild] of guilds) {
      const guild = await oauthGuild.fetch();
      const line = `${guild.name} (${guild.id})`;
      if (id === coreId) coreServers.push(line);
      else subsServers.push(line);
    }

    const description = [
      `Total Servers: ${guilds.size}`,
      ``,
      `**Subs Server ID:**`,
      subsServers.length > 0 ? subsServers.join('\n') : 'None',
      ``,
      `**Core Server ID**`,
      coreServers.length > 0 ? coreServers.join('\n') : 'Not Configured'
    ].join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🖥️ Server List')
      .setColor(0x2b2d31)
      .setDescription(description);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('nav_back_main').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}

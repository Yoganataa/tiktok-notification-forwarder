// src/controllers/admin.controller.ts
import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  RepliableInteraction,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { PermissionService } from '../services/permission.service';
import { SystemConfigRepository } from '../repositories/system-config.repository';
import { UserMappingRepository } from '../repositories/user-mapping.repository';
import { configManager } from '../core/config/config';
import { ROLES, UserRole } from '../core/types/database.types';

/**
 * Admin Panel Controller.
 * * Manages the interactive UI flow for the bot's administration dashboard.
 * * Handles Button clicks, Modal submissions, and Select Menu interactions.
 */
export class AdminController {
  /**
   * @param permissionService - Service for checking and managing user roles.
   * @param systemConfigRepo - Repository for persistent system configuration.
   * @param userMappingRepo - Repository for TikTok-to-Discord mappings.
   * @param onConfigReload - Callback function to trigger a hot-reload of the system config.
   */
  constructor(
    private permissionService: PermissionService,
    private systemConfigRepo: SystemConfigRepository,
    private userMappingRepo: UserMappingRepository,
    private onConfigReload: () => Promise<void>
  ) {}

  /**
   * Central router for all Button interactions within the Admin Panel.
   * * Validates permissions before routing to specific UI handlers.
   * * @param interaction - The button interaction event.
   */
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    if (!(await this.permissionService.isAdminOrHigher(interaction.user.id))) {
      await interaction.reply({ content: '⛔ Access Denied.', ephemeral: true });
      return;
    }

    const id = interaction.customId;

    switch (id) {
      // Navigation Handlers
      case 'nav_env': await this.showEnvironmentPage(interaction); break;
      case 'nav_servers': await this.showServersPage(interaction); break;
      case 'nav_roles': await this.showRoleManager(interaction); break;
      case 'nav_mappings': await this.showMappingManager(interaction); break;
      case 'nav_back_main': await this.showMainMenu(interaction); break;

      // Modal Triggers
      case 'btn_edit_env': await this.showEnvModal(interaction); break;
      case 'btn_add_staff': await this.showAddStaffModal(interaction); break;
      case 'btn_add_mapping': await this.showAddMappingModal(interaction); break;

      default:
        // Dynamic Action Handlers
        if (id.startsWith('role_act_')) await this.handleRoleActionButtons(interaction);
        else if (id.startsWith('map_act_')) await this.handleMappingActionButtons(interaction);
        break;
    }
  }

  /**
   * Central router for handling Modal form submissions.
   * * Processes data for environment config, staff management, and mapping updates.
   * * @param interaction - The modal submit interaction event.
   */
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    // 1. Handle Environment Configuration Update & Hot Reload
    if (interaction.customId === 'modal_env_edit') {
      const sourceBots = interaction.fields.getTextInputValue('env_source_bots');
      const fallbackChannel = interaction.fields.getTextInputValue('env_fallback_channel');
      const coreServer = interaction.fields.getTextInputValue('env_core_server');
      const dbMax = interaction.fields.getTextInputValue('env_db_max');
      const dbMin = interaction.fields.getTextInputValue('env_db_min');

      await this.systemConfigRepo.set('SOURCE_BOT_IDS', sourceBots);
      await this.systemConfigRepo.set('FALLBACK_CHANNEL_ID', fallbackChannel);
      await this.systemConfigRepo.set('CORE_SERVER_ID', coreServer);
      await this.systemConfigRepo.set('DB_MAX_CONNECTIONS', dbMax);
      await this.systemConfigRepo.set('DB_MIN_CONNECTIONS', dbMin);

      // Execute Hot Reload callback to refresh memory
      await this.onConfigReload();

      await this.showMainMenu(interaction);
      await interaction.followUp({ content: '✅ Configuration saved & **Hot Reloaded** successfully!', ephemeral: true });
    }

    // 2. Handle New Staff Assignment
    else if (interaction.customId === 'modal_add_staff') {
      const userId = interaction.fields.getTextInputValue('staff_id').trim();
      const roleStr = interaction.fields.getTextInputValue('staff_role').toUpperCase().trim();

      if (!/^\d{17,20}$/.test(userId)) {
        await interaction.reply({ content: '❌ Invalid User ID.', ephemeral: true });
        return;
      }

      let role: UserRole;
      if (roleStr === 'ADMIN') role = ROLES.ADMIN;
      else if (roleStr === 'SUDO') role = ROLES.SUDO;
      else {
        await interaction.reply({ content: '❌ Invalid Role.', ephemeral: true });
        return;
      }

      try {
        await this.permissionService.assignRole(userId, role, interaction.user.id);
        await this.showRoleManager(interaction);
        await interaction.followUp({ content: `✅ Added <@${userId}> as **${role}**`, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
      }
    }

    // 3. Handle New Mapping Creation
    else if (interaction.customId === 'modal_add_mapping') {
      const username = interaction.fields.getTextInputValue('map_user').trim();
      const channelId = interaction.fields.getTextInputValue('map_channel').trim();

      if (!/^\d{17,20}$/.test(channelId)) {
        await interaction.reply({ content: '❌ Invalid Channel ID.', ephemeral: true });
        return;
      }

      try {
        await this.userMappingRepo.upsert(username, channelId);
        await this.showMappingManager(interaction);
        await interaction.followUp({ content: `✅ Mapping added: **${username}** -> <#${channelId}>`, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
      }
    }

    // 4. Handle Existing Mapping Update (Channel Change)
    else if (interaction.customId.startsWith('modal_edit_mapping_')) {
      const username = interaction.customId.replace('modal_edit_mapping_', '');
      const newChannelId = interaction.fields.getTextInputValue('map_channel_new').trim();

      if (!/^\d{17,20}$/.test(newChannelId)) {
        await interaction.reply({ content: '❌ Invalid Channel ID.', ephemeral: true });
        return;
      }

      try {
        await this.userMappingRepo.upsert(username, newChannelId);
        await this.showMappingManager(interaction);
        await interaction.followUp({ content: `✅ Mapping updated: **${username}** -> <#${newChannelId}>`, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
      }
    }
  }

  /**
   * Central router for String Select Menu interactions.
   * * Handles selection events for Staff Management and Mapping Management contexts.
   * * @param interaction - The select menu interaction event.
   */
  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    if (interaction.customId === 'select_staff_manage') {
      const targetUserId = interaction.values[0];
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🛠️ Manage Staff Role')
        .setDescription(`Selected User: <@${targetUserId}>\n\nSelect action:`);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`role_act_admin_${targetUserId}`).setLabel('Set Admin').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`role_act_sudo_${targetUserId}`).setLabel('Set Sudo').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`role_act_revoke_${targetUserId}`).setLabel('Revoke').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('nav_roles').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
      );

      await interaction.update({ embeds: [embed], components: [row] });
    }
    else if (interaction.customId === 'select_mapping_manage') {
      const username = interaction.values[0];
      const mapping = await this.userMappingRepo.findByUsername(username);

      if (!mapping) {
        await interaction.reply({ content: '❌ Mapping not found in DB.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🛠️ Manage Mapping')
        .addFields(
          { name: 'TikTok User', value: mapping.username },
          { name: 'Channel', value: `<#${mapping.channel_id}> (${mapping.channel_id})` }
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`map_act_edit_${username}`).setLabel('Edit Channel').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
        new ButtonBuilder().setCustomId(`map_act_delete_${username}`).setLabel('Delete').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
        new ButtonBuilder().setCustomId('nav_mappings').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
      );

      await interaction.update({ embeds: [embed], components: [row] });
    }
  }

  // ================= PRIVATE UI RENDERING METHODS =================

  /**
   * Renders and sends the Main Menu dashboard.
   */
  private async showMainMenu(interaction: RepliableInteraction): Promise<void> {
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

    const payload = { embeds: [embed], components: [row1, row2], ephemeral: true };

    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
      await (interaction as any).update(payload);
    } else {
      await interaction.reply(payload);
    }
  }

  /**
   * Renders the Mapping Management interface.
   * * Includes a list preview and a dropdown menu for selecting specific mappings to manage.
   */
  private async showMappingManager(interaction: Interaction): Promise<void> {
    if (!interaction.isRepliable()) return;
    const mappings = await this.userMappingRepo.findAll();
    
    // Generate preview list (limited to 20 items to prevent overflow)
    const previewList = mappings.slice(0, 20).map(m => `• **${m.username}** → <#${m.channel_id}>`).join('\n');
    const footerText = mappings.length > 20 ? `...and ${mappings.length - 20} more.` : '';

    const embed = new EmbedBuilder()
      .setTitle('🗺️ User Mapping Manager')
      .setColor(0x2b2d31)
      .setDescription(mappings.length > 0 ? previewList + '\n' + footerText : 'No mappings found.')
      .addFields({ name: 'Total Mappings', value: mappings.length.toString() })
      .setFooter({ text: 'Use dropdown to Edit/Delete specific mapping' });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_mapping_manage')
      .setPlaceholder('Select a user to manage...');

    if (mappings.length > 0) {
      mappings.slice(0, 25).forEach(m => {
        selectMenu.addOptions({
          label: `@${m.username}`,
          description: `Channel: ${m.channel_id}`,
          value: m.username,
          emoji: '🎥'
        });
      });
    } else {
      selectMenu.addOptions({ label: 'No mappings', value: 'null', description: 'Add one first' });
      selectMenu.setDisabled(true);
    }

    const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('btn_add_mapping').setLabel('Add Mapping').setStyle(ButtonStyle.Success).setEmoji('➕'),
      new ButtonBuilder().setCustomId('nav_back_main').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
    );

    const payload = { embeds: [embed], components: [rowSelect, rowButtons], ephemeral: true };
    if (interaction.isButton() || interaction.isModalSubmit()) await (interaction as any).update(payload);
    else await (interaction as any).reply(payload);
  }

  /**
   * Renders the Environment Configuration page.
   * * Displays currently active system settings.
   */
  private async showEnvironmentPage(interaction: ButtonInteraction): Promise<void> {
    const config = configManager.get();
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Environment Configuration')
      .setColor(0x2b2d31)
      .setDescription('Current system configuration values (Active).')
      .addFields(
        { name: 'Source Bots', value: `\`${config.bot.sourceBotIds.join(', ')}\`` },
        { name: 'Fallback Channel', value: `\`${config.bot.fallbackChannelId}\``, inline: true },
        { name: 'Core Server', value: `\`${config.discord.coreServerId}\``, inline: true },
        { name: 'DB Connections', value: `Min: ${config.database.minConnections} / Max: ${config.database.maxConnections}`, inline: true }
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('btn_edit_env').setLabel('Edit Config').setStyle(ButtonStyle.Primary).setEmoji('📝'),
      new ButtonBuilder().setCustomId('nav_back_main').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
    );

    await interaction.update({ embeds: [embed], components: [row] });
  }

  /**
   * Renders the Server List page.
   * * Categorizes servers into 'Core Server' and 'Subscriber Servers'.
   */
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

    await interaction.update({ embeds: [embed], components: [row] });
  }

  /**
   * Renders the Staff Role Manager interface.
   * * Lists all users with elevated permissions.
   */
  private async showRoleManager(interaction: Interaction): Promise<void> {
    if (!interaction.isRepliable()) return;
    const staff = await this.permissionService.getAllStaff();
    const staffList = staff.length > 0
      ? staff.map(s => `• <@${s.user_id}> : **${s.role}**`).join('\n')
      : 'No staff configured.';

    const embed = new EmbedBuilder()
      .setTitle('👥 Staff Roles')
      .setColor(0x2b2d31)
      .setDescription(staffList + '\n\n👇 **Select a user to edit/revoke, or click Add to new:**');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_staff_manage')
      .setPlaceholder('Select a user to manage...');

    if (staff.length > 0) {
      staff.forEach(s => {
        selectMenu.addOptions({
          label: `User ID: ${s.user_id}`,
          description: `Current Role: ${s.role}`,
          value: s.user_id,
          emoji: '👤'
        });
      });
    } else {
      selectMenu.addOptions({ label: 'No staff found', value: 'null', description: 'Add staff first' });
      selectMenu.setDisabled(true);
    }

    const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('btn_add_staff').setLabel('Add Staff').setStyle(ButtonStyle.Success).setEmoji('➕'),
      new ButtonBuilder().setCustomId('nav_back_main').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
    );

    const payload = { embeds: [embed], components: [rowSelect, rowButtons], ephemeral: true };
    if (interaction.isButton() || interaction.isModalSubmit()) await (interaction as any).update(payload);
    else await (interaction as any).reply(payload);
  }

  /**
   * Presents the Modal for editing system configuration.
   */
  private async showEnvModal(interaction: ButtonInteraction) {
    const config = configManager.get();
    const modal = new ModalBuilder().setCustomId('modal_env_edit').setTitle('Edit Configuration');

    const inputs = [
      new TextInputBuilder().setCustomId('env_source_bots').setLabel("SOURCE_BOT_IDS").setValue(config.bot.sourceBotIds.join(',')).setStyle(TextInputStyle.Paragraph),
      new TextInputBuilder().setCustomId('env_fallback_channel').setLabel("FALLBACK_CHANNEL_ID").setValue(config.bot.fallbackChannelId).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('env_core_server').setLabel("CORE_SERVER_ID").setValue(config.discord.coreServerId).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('env_db_max').setLabel("DB_MAX").setValue(config.database.maxConnections.toString()).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('env_db_min').setLabel("DB_MIN").setValue(config.database.minConnections.toString()).setStyle(TextInputStyle.Short),
    ];

    // @ts-ignore
    modal.addComponents(inputs.map(i => new ActionRowBuilder().addComponents(i)));
    await interaction.showModal(modal);
  }

  /**
   * Presents the Modal for adding new staff.
   */
  private async showAddStaffModal(interaction: ButtonInteraction) {
    const modal = new ModalBuilder().setCustomId('modal_add_staff').setTitle('Add New Staff');
    const userIdInput = new TextInputBuilder().setCustomId('staff_id').setLabel("Discord User ID").setStyle(TextInputStyle.Short).setRequired(true);
    const roleInput = new TextInputBuilder().setCustomId('staff_role').setLabel("Role (ADMIN/SUDO)").setValue("SUDO").setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(userIdInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput)
    );
    await interaction.showModal(modal);
  }

  /**
   * Presents the Modal for adding a new mapping.
   */
  private async showAddMappingModal(interaction: ButtonInteraction) {
    const modal = new ModalBuilder().setCustomId('modal_add_mapping').setTitle('Add New Mapping');
    const userInput = new TextInputBuilder().setCustomId('map_user').setLabel("TikTok Username").setStyle(TextInputStyle.Short).setRequired(true);
    const channelInput = new TextInputBuilder().setCustomId('map_channel').setLabel("Channel ID").setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(userInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput)
    );
    await interaction.showModal(modal);
  }

  /**
   * Handles specific role management actions (Set Admin, Set Sudo, Revoke).
   * @param interaction - The button interaction containing the action and target ID.
   */
  private async handleRoleActionButtons(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split('_');
    const action = parts[2];
    const targetId = parts[3];

    try {
      if (action === 'revoke') await this.permissionService.revokeAccess(targetId);
      else {
        const role = action === 'admin' ? ROLES.ADMIN : ROLES.SUDO;
        await this.permissionService.assignRole(targetId, role, interaction.user.id);
      }
      await this.showRoleManager(interaction);
    } catch (error) {
      await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
    }
  }

  /**
   * Handles specific mapping management actions (Delete, Edit Channel).
   * @param interaction - The button interaction containing the action and username.
   */
  private async handleMappingActionButtons(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split('_');
    const action = parts[2];
    const username = parts[3];

    if (action === 'delete') {
      try {
        await this.userMappingRepo.delete(username);
        await this.showMappingManager(interaction);
        await interaction.followUp({ content: `🗑️ Mapping for **${username}** deleted.`, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
      }
    } else if (action === 'edit') {
      const modal = new ModalBuilder().setCustomId(`modal_edit_mapping_${username}`).setTitle(`Edit ${username}`);
      const channelInput = new TextInputBuilder().setCustomId('map_channel_new').setLabel("New Channel ID").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput));
      await interaction.showModal(modal);
    }
  }
}
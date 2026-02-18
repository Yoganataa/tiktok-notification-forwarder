import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RepliableInteraction,
  ChannelSelectMenuInteraction,
  AnySelectMenuInteraction
} from 'discord.js';
import si from 'systeminformation';
import { PermissionService } from '../../core/services/permission.service';
import { SystemConfigRepository } from '../../core/repositories/system-config.repository';
import { UserMappingRepository } from '../../core/repositories/user-mapping.repository';
import { configManager } from '../../core/config/config';
import { MappingController } from './admin/mapping.controller';
import { ConfigController } from './admin/config.controller';
import { RoleController } from './admin/role.controller';
import { TelegramLoginController } from './admin/telegram-login.controller';

export class MenuController {
  constructor(
    private permissionService: PermissionService,
    private systemConfigRepo: SystemConfigRepository,
    private userMappingRepo: UserMappingRepository,
    public configController: ConfigController,
    public mappingController: MappingController,
    public roleController: RoleController,
    public telegramLoginController: TelegramLoginController
  ) {}

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

    // New Menu Handlers
    if (id === 'menu_admin') {
         if (!(await this.permissionService.isAdminOrHigher(interaction.user.id))) {
            await interaction.reply({ content: '⛔ Access Denied.', ephemeral: true });
            return;
        }
        await interaction.deferUpdate();
        await this.showAdminPanel(interaction);
        return;
    }
    if (id === 'menu_mappings') {
        if (!(await this.permissionService.isAdminOrHigher(interaction.user.id))) {
            await interaction.reply({ content: '⛔ Access Denied.', ephemeral: true });
            return;
        }
        await interaction.deferUpdate();
        await this.mappingController.showManager(interaction);
        return;
    }
    if (id === 'menu_tiktok') {
        await interaction.reply({ content: 'Use /download command directly.', ephemeral: true });
        return;
    }

    // Stats Handler
    if (id === 'menu_stats') {
        if (!(await this.permissionService.isAdminOrHigher(interaction.user.id))) {
            await interaction.reply({ content: '⛔ Access Denied.', ephemeral: true });
            return;
        }
        await interaction.deferUpdate();
        await this.showStatsPage(interaction);
        return;
    }

    // Legacy support or internal navigation
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
    if (id === 'btn_conf_smart') {
        await interaction.deferUpdate();
        await this.configController.showSmartDownloadPage(interaction);
        return;
    }
    if (id === 'btn_toggle_manual') {
        await interaction.deferUpdate();
        await this.configController.handleToggleManualMode(interaction);
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

    // Telegram Login Button
    if (id === 'tg_btn_enter_otp') {
        await this.telegramLoginController.showOtpModal(interaction);
        return;
    }

    // Restart Bot Button (From Config Controller)
    if (id === 'btn_restart_bot') {
        await this.configController.handleButton(interaction);
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
    // --- New Setup Modals ---
    else if (id === 'setup_modal_identity') {
        await this.configController.handleIdentitySubmit(interaction);
    } else if (id === 'setup_modal_logic') {
        await this.configController.handleLogicSubmit(interaction);
    } else if (id === 'setup_modal_downloader') {
        await this.configController.handleDownloaderSubmit(interaction);
    } else if (id === 'setup_modal_system') {
        await this.configController.handleSystemSubmit(interaction);
    } else if (id === 'setup_modal_telegram') { // Missing in ConfigController earlier, assuming handled or needed
        await this.configController.handleTelegramSubmit(interaction); // ConfigController must expose this or we add it
    }
    // --- Telegram Login Modals ---
    else if (id === 'tg_login_step1') {
        await this.telegramLoginController.handlePhoneSubmit(interaction);
    } else if (id === 'tg_login_step2') {
        await this.telegramLoginController.handleOtpSubmit(interaction);
    }
  }

  async handleSelectMenu(interaction: AnySelectMenuInteraction): Promise<void> {
    const id = interaction.customId;

    if (id.startsWith('select_engine')) {
        await interaction.deferUpdate();
        await this.configController.handleEngineSelect(interaction as StringSelectMenuInteraction);
        return;
    }
    if (id === 'select_smart_add') {
        await interaction.deferUpdate();
        await this.configController.handleAddSmartChannels(interaction as ChannelSelectMenuInteraction);
        return;
    }
    if (id === 'select_smart_remove') {
        await interaction.deferUpdate();
        await this.configController.handleRemoveSmartChannels(interaction as StringSelectMenuInteraction);
        return;
    }

    // --- New Setup Category Select ---
    if (id === 'setup_category_select') {
        // Do NOT deferUpdate here because handleConfigMenuSelect shows a modal
        await this.configController.handleConfigMenuSelect(interaction as StringSelectMenuInteraction);
        return;
    }

    if (interaction.customId === 'select_staff_manage') {
        await interaction.deferUpdate();
        await this.roleController.handleSelectMenu(interaction as StringSelectMenuInteraction);
    } else if (interaction.customId === 'select_mapping_manage') {
        await interaction.deferUpdate();
        await this.mappingController.handleSelectMenu(interaction as StringSelectMenuInteraction);
    }
  }

  async showMainMenu(interaction: RepliableInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('🤖 Main Menu')
      .setDescription('Select an option below to manage the bot.')
      .addFields(
        { name: '🛡️ Admin', value: 'Manage configuration and roles', inline: true },
        { name: '🔀 Mappings', value: 'Manage user channel mappings', inline: true },
        { name: '⬇️ Download', value: 'Download TikTok videos', inline: true }
      )
      .setFooter({ text: 'TikTok Forwarder • v2.2.0' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('menu_admin')
          .setLabel('Admin Panel')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🛡️'),
        new ButtonBuilder()
          .setCustomId('menu_mappings')
          .setLabel('Mappings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔀'),
        new ButtonBuilder()
          .setCustomId('menu_tiktok')
          .setLabel('Download')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⬇️'),
        new ButtonBuilder()
          .setCustomId('menu_stats')
          .setLabel('Stats')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊')
      );

    const payload = { embeds: [embed], components: [row] };

    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
      if (!interaction.deferred && !interaction.replied) await (interaction as any).update(payload);
      else await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, ephemeral: true });
    }
  }

  async showStatsPage(interaction: ButtonInteraction | RepliableInteraction): Promise<void> {
    try {
        const osInfo = await si.osInfo();
        const cpu = await si.cpu();
        const mem = await si.mem();
        const load = await si.currentLoad();
        const netStats = await si.networkStats();

        const uptimeSeconds = si.time().uptime;
        const uptimeHours = (uptimeSeconds / 3600).toFixed(1);
        const processUptime = (process.uptime() / 3600).toFixed(2);

        const totalRx = (netStats.reduce((acc, iface) => acc + iface.rx_bytes, 0) / 1024 / 1024).toFixed(0);
        const totalTx = (netStats.reduce((acc, iface) => acc + iface.tx_bytes, 0) / 1024 / 1024).toFixed(0);

        const ping = interaction.client.ws.ping;

        const embed = new EmbedBuilder()
            .setTitle('📊 System Statistics')
            .setColor(0x3498db)
            .addFields(
                { name: '🖥️ OS', value: `${osInfo.distro} ${osInfo.release} (${osInfo.arch})\nKernel: ${osInfo.kernel}`, inline: true },
                { name: '⚙️ CPU', value: `${cpu.manufacturer} ${cpu.brand}\nLoad: ${load.currentLoad.toFixed(1)}%`, inline: true },
                { name: '🧠 RAM', value: `${(mem.active / 1024 / 1024 / 1024).toFixed(1)}GB / ${(mem.total / 1024 / 1024 / 1024).toFixed(1)}GB\n(${(mem.active / mem.total * 100).toFixed(0)}%)`, inline: true },
                { name: '🌐 Network', value: `⬇️ ${totalRx} MB\n⬆️ ${totalTx} MB`, inline: true },
                { name: '⏱️ Uptime', value: `System: ${uptimeHours}h\nBot: ${processUptime}h`, inline: true },
                { name: '📶 Ping', value: `${ping}ms`, inline: true },
                { name: '🏷️ Host', value: osInfo.hostname || 'N/A', inline: false }
            )
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder().setCustomId('nav_back_main').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('⬅️'),
                new ButtonBuilder().setCustomId('menu_stats').setLabel('Refresh').setStyle(ButtonStyle.Primary).setEmoji('🔄')
            );

        if (interaction.isButton()) {
             await interaction.editReply({ embeds: [embed], components: [row] });
        } else {
             await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

    } catch (error) {
        if (interaction.isRepliable() && !interaction.replied) {
             await interaction.reply({ content: '❌ Failed to fetch stats.', ephemeral: true });
        }
    }
  }

  async showAdminPanel(interaction: RepliableInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎛️ System Control Panel')
      .setColor(0x2b2d31)
      .setDescription('Select a module to manage:')
      .addFields(
        { name: '⚙️ Environment', value: 'Edit configuration', inline: true },
        { name: '👥 Roles', value: 'Manage staff', inline: true },
        { name: '🖥️ Servers', value: 'View guilds', inline: true }
      );

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('nav_env').setLabel('Environment').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
      new ButtonBuilder().setCustomId('nav_roles').setLabel('Roles').setStyle(ButtonStyle.Primary).setEmoji('👥'),
      new ButtonBuilder().setCustomId('nav_servers').setLabel('Servers').setStyle(ButtonStyle.Secondary).setEmoji('🖥️')
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('nav_back_main').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
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
      new ButtonBuilder().setCustomId('menu_admin').setLabel('Back to Admin').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}

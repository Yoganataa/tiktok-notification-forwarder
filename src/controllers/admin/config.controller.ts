import {
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  RepliableInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ChannelSelectMenuInteraction,
  User
} from 'discord.js';
import { SystemConfigRepository } from '../../repositories/system-config.repository';
import { configManager } from '../../core/config/config';
import { container } from '@sapphire/framework';
import { logger } from '../../shared/utils/logger';

export class ConfigController {
  constructor(
    private systemConfigRepo: SystemConfigRepository,
    private onConfigReload: () => Promise<void>
  ) {}

  // --- Main Setup Menu (Categorized) ---

  async showConfigMenu(interaction: RepliableInteraction | ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🛠️ System Configuration')
      .setDescription('Select a configuration category to edit.\nChanges are applied immediately after saving.')
      .setColor(0x2b2d31)
      .addFields(
        { name: 'Identity', value: 'Core Server, Fallback Channel', inline: true },
        { name: 'Logic', value: 'Source Bots, Manual Mode', inline: true },
        { name: 'Downloader', value: 'Engine, Cookie, Auto-DL', inline: true },
        { name: 'System', value: 'Update Repo, Log Level', inline: true }
      );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('setup_category_select')
      .setPlaceholder('Select a category to configure')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Core Identity').setValue('cat_identity').setDescription('Server ID, Fallback Channel, Auto-Category').setEmoji('🆔'),
        new StringSelectMenuOptionBuilder().setLabel('Bot Logic').setValue('cat_logic').setDescription('Source Bots, Extra Guilds, Manual Mode').setEmoji('🤖'),
        new StringSelectMenuOptionBuilder().setLabel('Downloader').setValue('cat_downloader').setDescription('Engine, Cookie, Auto-Download').setEmoji('⬇️'),
        new StringSelectMenuOptionBuilder().setLabel('System & Updates').setValue('cat_system').setDescription('Upstream Repo, Branch, Log Level, JRMA').setEmoji('⚙️')
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const payload = { embeds: [embed], components: [row], ephemeral: true };

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply(payload);
    } else {
        await interaction.editReply(payload);
    }
  }

  async handleConfigMenuSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const value = interaction.values[0];

    switch (value) {
      case 'cat_identity':
        await this.showIdentityModal(interaction);
        break;
      case 'cat_logic':
        await this.showLogicModal(interaction);
        break;
      case 'cat_downloader':
        await this.showDownloaderModal(interaction);
        break;
      case 'cat_system':
        await this.showSystemModal(interaction);
        break;
    }
  }

  // --- Modals ---

  async showIdentityModal(interaction: StringSelectMenuInteraction): Promise<void> {
    const config = configManager.get();
    const modal = new ModalBuilder().setCustomId('setup_modal_identity').setTitle('Core Identity Config');

    const coreServerInput = new TextInputBuilder().setCustomId('CORE_SERVER_ID').setLabel('Core Server ID').setStyle(TextInputStyle.Short).setValue(config.discord.coreServerId || '').setRequired(true);
    const fallbackChannelInput = new TextInputBuilder().setCustomId('FALLBACK_CHANNEL_ID').setLabel('Fallback Channel ID').setStyle(TextInputStyle.Short).setValue(config.bot.fallbackChannelId === '0' ? '' : config.bot.fallbackChannelId).setRequired(false);
    const autoCategoryInput = new TextInputBuilder().setCustomId('AUTO_CREATE_CATEGORY_ID').setLabel('Auto-Create Category ID').setStyle(TextInputStyle.Short).setValue(config.bot.autoCreateCategoryId === '0' ? '' : config.bot.autoCreateCategoryId).setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(coreServerInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(fallbackChannelInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(autoCategoryInput)
    );

    await interaction.showModal(modal);
  }

  async showLogicModal(interaction: StringSelectMenuInteraction): Promise<void> {
    const config = configManager.get();
    const modal = new ModalBuilder().setCustomId('setup_modal_logic').setTitle('Bot Logic Config');

    const sourceBotsInput = new TextInputBuilder().setCustomId('SOURCE_BOT_IDS').setLabel('Source Bot IDs (comma-separated)').setStyle(TextInputStyle.Paragraph).setValue(config.bot.sourceBotIds.join(',') || '').setRequired(false);
    const extraGuildsInput = new TextInputBuilder().setCustomId('EXTRA_GUILD_IDS').setLabel('Extra Guild IDs (comma-separated)').setStyle(TextInputStyle.Paragraph).setValue(config.discord.extraGuildIds.join(',') || '').setRequired(false);
    const manualModeInput = new TextInputBuilder().setCustomId('MANUAL_DOWNLOAD_MODE').setLabel('Manual Download Mode (true/false)').setStyle(TextInputStyle.Short).setValue(config.bot.manualDownloadMode.toString()).setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(sourceBotsInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(extraGuildsInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(manualModeInput)
    );

    await interaction.showModal(modal);
  }

  async showDownloaderModal(interaction: StringSelectMenuInteraction): Promise<void> {
    const config = configManager.get();
    const modal = new ModalBuilder().setCustomId('setup_modal_downloader').setTitle('Downloader Config');

    const engineInput = new TextInputBuilder().setCustomId('DOWNLOAD_ENGINE').setLabel('Download Engine').setStyle(TextInputStyle.Short).setValue(config.bot.downloadEngine || 'devest-alpha').setRequired(true);
    const autoDlInput = new TextInputBuilder().setCustomId('AUTO_DOWNLOAD').setLabel('Auto Download (true/false)').setStyle(TextInputStyle.Short).setValue(config.bot.autoDownload.toString()).setRequired(true);
    const cookieInput = new TextInputBuilder().setCustomId('COOKIE').setLabel('Cookie (Netscape/String)').setStyle(TextInputStyle.Paragraph).setValue(config.bot.cookie || '').setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(engineInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(autoDlInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(cookieInput)
    );

    await interaction.showModal(modal);
  }

  async showSystemModal(interaction: StringSelectMenuInteraction): Promise<void> {
    const config = configManager.get();
    const modal = new ModalBuilder().setCustomId('setup_modal_system').setTitle('System & Updates Config');

    const upstreamRepoInput = new TextInputBuilder().setCustomId('UPSTREAM_REPO').setLabel('Upstream Repo URL').setStyle(TextInputStyle.Short).setValue(config.update.upstreamRepo).setRequired(true);
    const upstreamBranchInput = new TextInputBuilder().setCustomId('UPSTREAM_BRANCH').setLabel('Upstream Branch').setStyle(TextInputStyle.Short).setValue(config.update.upstreamBranch).setRequired(true);
    const logLevelInput = new TextInputBuilder().setCustomId('LOG_LEVEL').setLabel('Log Level (info/debug/warn/error)').setStyle(TextInputStyle.Short).setValue(config.app.logLevel).setRequired(true);
    const jrmaInput = new TextInputBuilder().setCustomId('JRMA_RENEW_REMINDER').setLabel('JRMA Reminder (true/false)').setStyle(TextInputStyle.Short).setValue(config.bot.jrmaRenewReminder.toString()).setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(upstreamRepoInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(upstreamBranchInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(logLevelInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(jrmaInput)
    );

    await interaction.showModal(modal);
  }

  // --- Handlers ---

  async handleIdentitySubmit(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const coreId = interaction.fields.getTextInputValue('CORE_SERVER_ID');
    const fallbackId = interaction.fields.getTextInputValue('FALLBACK_CHANNEL_ID');
    const catId = interaction.fields.getTextInputValue('AUTO_CREATE_CATEGORY_ID');

    await this.systemConfigRepo.set('CORE_SERVER_ID', coreId);
    if (fallbackId) await this.systemConfigRepo.set('FALLBACK_CHANNEL_ID', fallbackId);
    if (catId) await this.systemConfigRepo.set('AUTO_CREATE_CATEGORY_ID', catId);

    await this.onConfigReload();
    await interaction.editReply('✅ **Identity Config Updated!**');
    await this.showConfigMenu(interaction);
  }

  async handleLogicSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const sourceBots = interaction.fields.getTextInputValue('SOURCE_BOT_IDS');
    const extraGuilds = interaction.fields.getTextInputValue('EXTRA_GUILD_IDS');
    const manualMode = interaction.fields.getTextInputValue('MANUAL_DOWNLOAD_MODE');

    // Basic cleaning of list inputs
    const cleanList = (val: string) => val.split(',').map(s => s.trim()).filter(s => s).join(',');

    await this.systemConfigRepo.set('SOURCE_BOT_IDS', cleanList(sourceBots));
    await this.systemConfigRepo.set('EXTRA_GUILD_IDS', cleanList(extraGuilds));
    await this.systemConfigRepo.set('MANUAL_DOWNLOAD_MODE', manualMode.toLowerCase() === 'true' ? 'true' : 'false');

    await this.onConfigReload();
    await interaction.editReply('✅ **Bot Logic Config Updated!**');
    await this.showConfigMenu(interaction);
  }

  async handleDownloaderSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const engine = interaction.fields.getTextInputValue('DOWNLOAD_ENGINE');
    const autoDl = interaction.fields.getTextInputValue('AUTO_DOWNLOAD');
    const cookie = interaction.fields.getTextInputValue('COOKIE');

    await this.systemConfigRepo.set('DOWNLOAD_ENGINE', engine);
    await this.systemConfigRepo.set('AUTO_DOWNLOAD', autoDl.toLowerCase() === 'true' ? 'true' : 'false');
    if (cookie) await this.systemConfigRepo.set('COOKIE', cookie);

    await this.onConfigReload();
    await interaction.editReply('✅ **Downloader Config Updated!**');
    await this.showConfigMenu(interaction);
  }

  async handleSystemSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const repo = interaction.fields.getTextInputValue('UPSTREAM_REPO');
    const branch = interaction.fields.getTextInputValue('UPSTREAM_BRANCH');
    const logLevel = interaction.fields.getTextInputValue('LOG_LEVEL');
    const jrma = interaction.fields.getTextInputValue('JRMA_RENEW_REMINDER');

    await this.systemConfigRepo.set('UPSTREAM_REPO', repo);
    await this.systemConfigRepo.set('UPSTREAM_BRANCH', branch);
    await this.systemConfigRepo.set('LOG_LEVEL', logLevel);
    await this.systemConfigRepo.set('JRMA_RENEW_REMINDER', jrma.toLowerCase() === 'true' ? 'true' : 'false');

    await this.onConfigReload();
    await interaction.editReply('✅ **System Config Updated!**');
    await this.showConfigMenu(interaction);
  }

  // --- Environment Page (Legacy) ---
  // Updated with STRICT Filtering for Engine Selection

  async showEnvironmentPage(interaction: ButtonInteraction | RepliableInteraction | StringSelectMenuInteraction): Promise<void> {
      const config = configManager.get();
      const primaryEngine = await this.systemConfigRepo.get('DOWNLOAD_ENGINE') || 'devest-alpha';
      const fallback1 = await this.systemConfigRepo.get('DOWNLOAD_ENGINE_FALLBACK_1') || 'none';
      const fallback2 = await this.systemConfigRepo.get('DOWNLOAD_ENGINE_FALLBACK_2') || 'none';
      const autoDl = (await this.systemConfigRepo.get('AUTO_DOWNLOAD')) !== 'false';

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Environment & Engine Configuration')
        .setColor(0x2b2d31)
        .setDescription('Manage your bot settings and download strategies below.')
        .addFields(
            { name: 'Source Bots', value: `\`${config.bot.sourceBotIds.join(', ')}\`` },
            { name: 'Core Server', value: `\`${config.discord.coreServerId}\``, inline: true },
            { name: 'Bot State', value: autoDl ? '🟢 Auto-Download ON' : '🔴 Auto-Download OFF', inline: true },
            { name: 'Download Strategy', value: `1. **${primaryEngine}**\n2. ${fallback1}\n3. ${fallback2}`, inline: false }
        );

      // STRICT FILTER: Only allow Devest Alpha, Devest Beta, YtDlp
      const allowedEngines = ['devest-alpha', 'devest-beta', 'ytdlp'];

      const buildOptionsRefined = (selectedValue: string, excludeValues: string[], includeNone: boolean) => {
          const options: StringSelectMenuOptionBuilder[] = [];
          if (includeNone) {
              options.push(new StringSelectMenuOptionBuilder().setLabel('None').setValue('none').setDescription('Disable this fallback slot').setDefault(selectedValue === 'none'));
          }
          allowedEngines.forEach(engine => {
              if (!excludeValues.includes(engine)) {
                  let label = engine;
                  let description = '';
                  if (engine === 'devest-alpha') { label = 'Devest Alpha (TikWM)'; description = 'Primary TikTok Engine'; }
                  if (engine === 'devest-beta') { label = 'Devest Beta (SSSTik)'; description = 'Secondary TikTok Engine'; }
                  if (engine === 'ytdlp') { label = 'Yt-Dlp (Universal)'; description = 'Universal Fallback'; }

                  const option = new StringSelectMenuOptionBuilder().setLabel(label).setValue(engine).setDefault(selectedValue === engine);
                  if (description.length > 0) option.setDescription(description);
                  options.push(option);
              }
          });
          return options;
      };

      const primarySelect = new StringSelectMenuBuilder().setCustomId('select_engine_primary').setPlaceholder('Select Primary Engine').addOptions(buildOptionsRefined(primaryEngine, [fallback1, fallback2].filter(v => v !== 'none'), false));
      const fallback1Select = new StringSelectMenuBuilder().setCustomId('select_engine_fallback_1').setPlaceholder('Select Fallback Engine 1').addOptions(buildOptionsRefined(fallback1, [primaryEngine, fallback2].filter(v => v !== 'none'), true));
      const fallback2Select = new StringSelectMenuBuilder().setCustomId('select_engine_fallback_2').setPlaceholder('Select Fallback Engine 2').addOptions(buildOptionsRefined(fallback2, [primaryEngine, fallback1].filter(v => v !== 'none'), true));

      const rowPrimary = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(primarySelect);
      const rowFallback1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fallback1Select);
      const rowFallback2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fallback2Select);
      const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_edit_env').setLabel('Edit Env').setStyle(ButtonStyle.Primary).setEmoji('📝'),
        new ButtonBuilder().setCustomId('btn_toggle_autodl').setLabel(autoDl ? 'Disable Auto DL' : 'Enable Auto DL').setStyle(autoDl ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_conf_smart').setLabel('Smart DL Config').setStyle(ButtonStyle.Secondary).setEmoji('🧠'),
        new ButtonBuilder().setCustomId('nav_back_main').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
      );

      const components = [rowPrimary, rowFallback1, rowFallback2, rowButtons];
      const payload = { embeds: [embed], components: components };

      if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
          if (!interaction.deferred && !interaction.replied) await (interaction as any).update(payload);
          else await interaction.editReply(payload);
      } else {
          await (interaction as RepliableInteraction).reply({ ...payload, ephemeral: true });
      }
  }

  async handleEngineSelect(interaction: StringSelectMenuInteraction): Promise<void> {
      const selectedValue = interaction.values[0];
      const customId = interaction.customId;
      if (customId === 'select_engine_primary') await this.systemConfigRepo.set('DOWNLOAD_ENGINE', selectedValue);
      else if (customId === 'select_engine_fallback_1') await this.systemConfigRepo.set('DOWNLOAD_ENGINE_FALLBACK_1', selectedValue);
      else if (customId === 'select_engine_fallback_2') await this.systemConfigRepo.set('DOWNLOAD_ENGINE_FALLBACK_2', selectedValue);
      await this.onConfigReload();
      await this.showEnvironmentPage(interaction);
  }

  async handleToggleAutoDl(interaction: ButtonInteraction): Promise<void> {
      const current = await this.systemConfigRepo.get('AUTO_DOWNLOAD');
      await this.systemConfigRepo.set('AUTO_DOWNLOAD', current === 'false' ? 'true' : 'false');
      await this.onConfigReload();
      await this.showEnvironmentPage(interaction);
  }

  async showEditModal(interaction: ButtonInteraction) {
      const config = configManager.get();
      const modal = new ModalBuilder().setCustomId('modal_env_edit').setTitle('Edit Configuration');
      const inputs = [
          new TextInputBuilder().setCustomId('env_source_bots').setLabel("SOURCE_BOT_IDS").setValue(config.bot.sourceBotIds.join(',')).setStyle(TextInputStyle.Paragraph),
          new TextInputBuilder().setCustomId('env_fallback_channel').setLabel("FALLBACK_CHANNEL_ID").setValue(config.bot.fallbackChannelId).setStyle(TextInputStyle.Short),
          new TextInputBuilder().setCustomId('env_auto_create_category').setLabel("AUTO_CREATE_CATEGORY_ID").setValue(config.bot.autoCreateCategoryId).setStyle(TextInputStyle.Short),
          new TextInputBuilder().setCustomId('env_core_server').setLabel("CORE_SERVER_ID").setValue(config.discord.coreServerId).setStyle(TextInputStyle.Short),
          new TextInputBuilder().setCustomId('env_db_max').setLabel("DB_MAX").setValue(config.database.maxConnections.toString()).setStyle(TextInputStyle.Short),
      ];
      // @ts-ignore
      modal.addComponents(inputs.map(i => new ActionRowBuilder().addComponents(i)));
      await interaction.showModal(modal);
  }

  async handleEditModal(interaction: ModalSubmitInteraction, showMainMenuCallback: (i: RepliableInteraction) => Promise<void>): Promise<void> {
      const sourceBots = interaction.fields.getTextInputValue('env_source_bots');
      const fallbackChannel = interaction.fields.getTextInputValue('env_fallback_channel');
      const autoCreateCategory = interaction.fields.getTextInputValue('env_auto_create_category');
      const coreServer = interaction.fields.getTextInputValue('env_core_server');
      const dbMax = interaction.fields.getTextInputValue('env_db_max');

      await this.systemConfigRepo.set('SOURCE_BOT_IDS', sourceBots);
      await this.systemConfigRepo.set('FALLBACK_CHANNEL_ID', fallbackChannel);
      await this.systemConfigRepo.set('AUTO_CREATE_CATEGORY_ID', autoCreateCategory);
      await this.systemConfigRepo.set('CORE_SERVER_ID', coreServer);
      await this.systemConfigRepo.set('DB_MAX_CONNECTIONS', dbMax);
      await this.onConfigReload();
      await showMainMenuCallback(interaction);
      await interaction.followUp({ content: '✅ Configuration saved!', ephemeral: true });
  }

  async showSmartDownloadPage(interaction: ButtonInteraction | RepliableInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction): Promise<void> {
      try {
          const manualMode = await this.systemConfigRepo.get('MANUAL_DOWNLOAD_MODE');
          const isManualMode = manualMode === 'true';
          const allowedChannelsStr = await this.systemConfigRepo.get('SMART_DOWNLOAD_CHANNELS');
          const allowedChannels = allowedChannelsStr ? allowedChannelsStr.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
          const channelMentions = allowedChannels.length > 0 ? allowedChannels.map(id => `<#${id}>`).join(', ') : 'None';

          const embed = new EmbedBuilder().setTitle('🧠 Smart Manual Download Configuration').setColor(0x3498db).setDescription('Configure which channels allow direct TikTok link downloads.').addFields({ name: 'Status', value: isManualMode ? '✅ **Active**' : '🔴 **Inactive**', inline: true }, { name: 'Allowed Channels', value: channelMentions, inline: false });
          const components: any[] = [];
          components.push(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_smart_add').setPlaceholder('➕ Add Channels to Whitelist').setChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(5)));
          if (allowedChannels.length > 0) {
              const removeSelect = new StringSelectMenuBuilder().setCustomId('select_smart_remove').setPlaceholder('➖ Remove Channels from Whitelist').setMinValues(1).setMaxValues(Math.max(1, Math.min(allowedChannels.length, 25)));
              removeSelect.addOptions(allowedChannels.slice(0, 25).map(id => { const channel = interaction.guild?.channels.cache.get(id); return new StringSelectMenuOptionBuilder().setLabel(channel ? `#${channel.name}` : `Channel ID: ${id}`).setValue(id); }));
              components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(removeSelect));
          }
          components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('btn_toggle_manual').setLabel(isManualMode ? 'Disable Smart Mode' : 'Enable Smart Mode').setStyle(isManualMode ? ButtonStyle.Danger : ButtonStyle.Success), new ButtonBuilder().setCustomId('nav_env').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')));

          const payload = { embeds: [embed], components: components };
          if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
              if (!interaction.deferred && !interaction.replied) await (interaction as any).update(payload);
              else await interaction.editReply(payload);
          } else {
              await (interaction as RepliableInteraction).reply({ ...payload, ephemeral: true });
          }
      } catch (error) { logger.error('Error showing smart download page', error); if (interaction.isRepliable() && !interaction.replied) await interaction.reply({ content: '❌ Error loading configuration page.', ephemeral: true }); }
  }

  async handleToggleManualMode(interaction: ButtonInteraction): Promise<void> {
      try {
          const current = await this.systemConfigRepo.get('MANUAL_DOWNLOAD_MODE');
          await this.systemConfigRepo.set('MANUAL_DOWNLOAD_MODE', current === 'true' ? 'false' : 'true');
          await this.onConfigReload();
          await this.showSmartDownloadPage(interaction);
      } catch (error) { logger.error('Error toggling manual mode', error); await interaction.followUp({ content: '❌ Failed to toggle mode.', ephemeral: true }); }
  }

  async handleAddSmartChannels(interaction: ChannelSelectMenuInteraction): Promise<void> {
      try {
          const selectedIds = interaction.values;
          const currentStr = await this.systemConfigRepo.get('SMART_DOWNLOAD_CHANNELS');
          const currentIds = currentStr ? currentStr.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
          const newIds = Array.from(new Set([...currentIds, ...selectedIds])).filter(Boolean);
          await this.systemConfigRepo.set('SMART_DOWNLOAD_CHANNELS', newIds.join(','));
          await this.showSmartDownloadPage(interaction);
      } catch (error) { logger.error('Error adding smart channels', error); await interaction.followUp({ content: '❌ Failed to add channels.', ephemeral: true }); }
  }

  async handleRemoveSmartChannels(interaction: StringSelectMenuInteraction): Promise<void> {
      try {
          const selectedIds = interaction.values;
          const currentStr = await this.systemConfigRepo.get('SMART_DOWNLOAD_CHANNELS');
          let currentIds = currentStr ? currentStr.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
          currentIds = currentIds.filter(id => !selectedIds.includes(id));
          await this.systemConfigRepo.set('SMART_DOWNLOAD_CHANNELS', currentIds.join(','));
          await this.showSmartDownloadPage(interaction);
      } catch (error) { logger.error('Error removing smart channels', error); await interaction.followUp({ content: '❌ Failed to remove channels.', ephemeral: true }); }
  }

}

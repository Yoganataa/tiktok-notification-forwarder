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
  ChannelSelectMenuInteraction
} from 'discord.js';
import { SystemConfigRepository } from '../../repositories/system-config.repository';
import { configManager } from '../../core/config/config';
import { container } from '@sapphire/framework';

export class ConfigController {
  constructor(
    private systemConfigRepo: SystemConfigRepository,
    private onConfigReload: () => Promise<void>
  ) {}

  async showEnvironmentPage(interaction: ButtonInteraction | RepliableInteraction | StringSelectMenuInteraction): Promise<void> {
    const config = configManager.get();
    const primaryEngine = await this.systemConfigRepo.get('DOWNLOAD_ENGINE') || 'vette';
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

    // Get all available engines dynamically
    const availableEngines = container.services.downloader.getRegisteredEngineNames();

    // REDEFINED buildOptions to handle custom labels properly
    const buildOptionsRefined = (selectedValue: string, excludeValues: string[], includeNone: boolean) => {
        const options: StringSelectMenuOptionBuilder[] = [];

        if (includeNone) {
            options.push(new StringSelectMenuOptionBuilder()
                .setLabel('None')
                .setValue('none')
                .setDescription('Disable this fallback slot')
                .setDefault(selectedValue === 'none'));
        }

        availableEngines.forEach(engine => {
            if (!excludeValues.includes(engine)) {
                let label = engine;
                let description = '';

                // Custom labels
                if (engine === 'devest') {
                    label = 'Devest (Auto-HD)';
                    description = 'Smart HD with fallback';
                } else if (engine === 'vette') {
                    label = 'Vette Downloader';
                    description = 'Recommended Default';
                }

                const option = new StringSelectMenuOptionBuilder()
                    .setLabel(label)
                    .setValue(engine)
                    .setDefault(selectedValue === engine);

                if (description.length > 0) {
                    option.setDescription(description);
                }

                options.push(option);
            }
        });

        // Add specific Hans subtypes if 'hans' is available
        if (availableEngines.includes('hans')) {
            const hansTypes = [
                { val: 'hans:native', label: 'Hans (Native)' },
                { val: 'hans:snaptik', label: 'Hans (Snaptik)' },
                { val: 'hans:tikmate', label: 'Hans (Tikmate)' },
                { val: 'hans:musicalydown', label: 'Hans (MusicalDown)' },
                { val: 'hans:ttdownloader', label: 'Hans (TTDownloader)' },
                { val: 'hans:fasttoksave', label: 'Hans (FastTok)' }
            ];

            hansTypes.forEach(t => {
                 if (!excludeValues.includes(t.val)) {
                    options.push(new StringSelectMenuOptionBuilder()
                        .setLabel(t.label)
                        .setValue(t.val)
                        .setDefault(selectedValue === t.val));
                 }
            });
        }

        return options;
    };

    // 1. Primary Engine Select (Excludes selections from Fallback 1 & 2 if not 'none')
    const primarySelect = new StringSelectMenuBuilder()
        .setCustomId('select_engine_primary')
        .setPlaceholder('Select Primary Engine')
        .addOptions(buildOptionsRefined(primaryEngine, [fallback1, fallback2].filter(v => v !== 'none'), false));

    // 2. Fallback 1 Select (Excludes Primary & Fallback 2)
    const fallback1Select = new StringSelectMenuBuilder()
        .setCustomId('select_engine_fallback_1')
        .setPlaceholder('Select Fallback Engine 1')
        .addOptions(buildOptionsRefined(fallback1, [primaryEngine, fallback2].filter(v => v !== 'none'), true));

    // 3. Fallback 2 Select (Excludes Primary & Fallback 1)
    const fallback2Select = new StringSelectMenuBuilder()
        .setCustomId('select_engine_fallback_2')
        .setPlaceholder('Select Fallback Engine 2')
        .addOptions(buildOptionsRefined(fallback2, [primaryEngine, fallback1].filter(v => v !== 'none'), true));


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

      if (customId === 'select_engine_primary') {
          await this.systemConfigRepo.set('DOWNLOAD_ENGINE', selectedValue);
      } else if (customId === 'select_engine_fallback_1') {
          await this.systemConfigRepo.set('DOWNLOAD_ENGINE_FALLBACK_1', selectedValue);
      } else if (customId === 'select_engine_fallback_2') {
          await this.systemConfigRepo.set('DOWNLOAD_ENGINE_FALLBACK_2', selectedValue);
      }

      await this.onConfigReload();
      await this.showEnvironmentPage(interaction);
  }

  async handleToggleAutoDl(interaction: ButtonInteraction): Promise<void> {
      const current = await this.systemConfigRepo.get('AUTO_DOWNLOAD');
      const newState = current === 'false' ? 'true' : 'false';
      await this.systemConfigRepo.set('AUTO_DOWNLOAD', newState);
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
      await interaction.followUp({ content: '✅ Configuration saved & **Hot Reloaded** successfully!', ephemeral: true });
  }

  // --- Smart Download Configuration ---

  async showSmartDownloadPage(interaction: ButtonInteraction | RepliableInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction): Promise<void> {
      const manualMode = await this.systemConfigRepo.get('MANUAL_DOWNLOAD_MODE');
      const isManualMode = manualMode === 'true';
      const allowedChannelsStr = await this.systemConfigRepo.get('SMART_DOWNLOAD_CHANNELS');
      const allowedChannels = allowedChannelsStr ? allowedChannelsStr.split(',') : [];

      const channelMentions = allowedChannels.length > 0
          ? allowedChannels.map(id => `<#${id}>`).join(', ')
          : 'None';

      const embed = new EmbedBuilder()
          .setTitle('🧠 Smart Manual Download Configuration')
          .setColor(0x3498db)
          .setDescription('Configure which channels allow direct TikTok link downloads.')
          .addFields(
              { name: 'Status', value: isManualMode ? '✅ **Active**' : '🔴 **Inactive**', inline: true },
              { name: 'Allowed Channels', value: channelMentions, inline: false }
          );

      // Row 1: Add Channels (Channel Select)
      const addSelect = new ChannelSelectMenuBuilder()
          .setCustomId('select_smart_add')
          .setPlaceholder('➕ Add Channels to Whitelist')
          .setChannelTypes(ChannelType.GuildText)
          .setMinValues(1)
          .setMaxValues(5); // Allow adding up to 5 at once

      // Row 2: Remove Channels (String Select)
      const removeSelect = new StringSelectMenuBuilder()
          .setCustomId('select_smart_remove')
          .setPlaceholder('➖ Remove Channels from Whitelist')
          .setMinValues(1)
          // Fix: Ensure maxValues is always at least 1, even if allowedChannels is empty
          .setMaxValues(Math.max(1, Math.min(allowedChannels.length, 25)));

      if (allowedChannels.length > 0) {
          // Limit to 25 options for Discord limits
          const options = allowedChannels.slice(0, 25).map(id => {
              // We can't easily get channel names here without fetching, so use ID as label or try to resolve
              // Ideally we use cache. For now using ID is safe.
              const channel = interaction.guild?.channels.cache.get(id);
              return new StringSelectMenuOptionBuilder()
                  .setLabel(channel ? `#${channel.name}` : `Channel ID: ${id}`)
                  .setValue(id);
          });
          removeSelect.addOptions(options);
      } else {
          removeSelect.addOptions(new StringSelectMenuOptionBuilder().setLabel('No channels to remove').setValue('none'));
          removeSelect.setDisabled(true);
      }

      // Row 3: Controls
      const rowControls = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
              .setCustomId('btn_toggle_manual')
              .setLabel(isManualMode ? 'Disable Smart Mode' : 'Enable Smart Mode')
              .setStyle(isManualMode ? ButtonStyle.Danger : ButtonStyle.Success),
          new ButtonBuilder()
              .setCustomId('nav_env') // Go back to main Env page
              .setLabel('Back')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('⬅️')
      );

      const components = [
          new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(addSelect),
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(removeSelect),
          rowControls
      ];

      const payload = { embeds: [embed], components: components };

      if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
          if (!interaction.deferred && !interaction.replied) await (interaction as any).update(payload);
          else await interaction.editReply(payload);
      } else {
          await (interaction as RepliableInteraction).reply({ ...payload, ephemeral: true });
      }
  }

  async handleToggleManualMode(interaction: ButtonInteraction): Promise<void> {
      const current = await this.systemConfigRepo.get('MANUAL_DOWNLOAD_MODE');
      const newState = current === 'true' ? 'false' : 'true';
      await this.systemConfigRepo.set('MANUAL_DOWNLOAD_MODE', newState);
      await this.onConfigReload();
      await this.showSmartDownloadPage(interaction);
  }

  async handleAddSmartChannels(interaction: ChannelSelectMenuInteraction): Promise<void> {
      const selectedIds = interaction.values; // Array of IDs
      const currentStr = await this.systemConfigRepo.get('SMART_DOWNLOAD_CHANNELS');
      const currentIds = currentStr ? currentStr.split(',') : [];

      // Merge and unique
      const newIds = Array.from(new Set([...currentIds, ...selectedIds])).filter(Boolean);

      await this.systemConfigRepo.set('SMART_DOWNLOAD_CHANNELS', newIds.join(','));
      await this.showSmartDownloadPage(interaction);
  }

  async handleRemoveSmartChannels(interaction: StringSelectMenuInteraction): Promise<void> {
      const selectedIds = interaction.values;
      const currentStr = await this.systemConfigRepo.get('SMART_DOWNLOAD_CHANNELS');
      let currentIds = currentStr ? currentStr.split(',') : [];

      // Filter out removed IDs
      currentIds = currentIds.filter(id => !selectedIds.includes(id));

      await this.systemConfigRepo.set('SMART_DOWNLOAD_CHANNELS', currentIds.join(','));
      await this.showSmartDownloadPage(interaction);
  }
}

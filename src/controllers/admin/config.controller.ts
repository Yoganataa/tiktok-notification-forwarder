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
  StringSelectMenuInteraction
} from 'discord.js';
import { SystemConfigRepository } from '../../repositories/system-config.repository';
import { configManager } from '../../core/config/config';

export class ConfigController {
  constructor(
    private systemConfigRepo: SystemConfigRepository,
    private onConfigReload: () => Promise<void>
  ) {}

  async showEnvironmentPage(interaction: ButtonInteraction | RepliableInteraction | StringSelectMenuInteraction): Promise<void> {
    const config = configManager.get();
    const engineConfig = await this.systemConfigRepo.get('DOWNLOAD_ENGINE') || 'vette';
    const autoDl = (await this.systemConfigRepo.get('AUTO_DOWNLOAD')) !== 'false';

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Environment Configuration')
      .setColor(0x2b2d31)
      .setDescription('Current system configuration values (Active).')
      .addFields(
        { name: 'Source Bots', value: `\`${config.bot.sourceBotIds.join(', ')}\`` },
        { name: 'Fallback Channel', value: `\`${config.bot.fallbackChannelId}\``, inline: true },
        { name: 'Auto-Create Category', value: `\`${config.bot.autoCreateCategoryId}\``, inline: true },
        { name: 'Core Server', value: `\`${config.discord.coreServerId}\``, inline: true },
        { name: 'DB Connections', value: `Min: ${config.database.minConnections} / Max: ${config.database.maxConnections}`, inline: true },
        { name: '📥 Download Engine', value: engineConfig, inline: true },
        { name: '🤖 Auto Download', value: autoDl ? 'Enabled' : 'Disabled', inline: true }
      );

    const engineSelect = new StringSelectMenuBuilder()
        .setCustomId('select_engine')
        .setPlaceholder('Select Download Engine')
        .addOptions([
            { label: 'Vette Downloader (Default)', value: 'vette', description: 'Recommended', default: engineConfig === 'vette' },
            { label: 'Btch Downloader', value: 'btch', description: 'Alternative', default: engineConfig === 'btch' },
            { label: 'YT-DLP', value: 'yt-dlp', description: 'Reliable binary', default: engineConfig === 'yt-dlp' },

            // Hans Sub-engines (Popular ones)
            { label: 'Hans (Native)', value: 'hans:native', description: 'Direct Scraping', default: engineConfig === 'hans:native' },
            { label: 'Hans (Snaptik)', value: 'hans:snaptik', description: 'Snaptik Provider', default: engineConfig === 'hans:snaptik' },
            { label: 'Hans (Tikmate)', value: 'hans:tikmate', description: 'Tikmate Provider', default: engineConfig === 'hans:tikmate' },
            { label: 'Hans (MusicalDown)', value: 'hans:musicalydown', description: 'MusicalyDown Provider', default: engineConfig === 'hans:musicalydown' },
            { label: 'Hans (TTDownloader)', value: 'hans:ttdownloader', description: 'TTDownloader Provider', default: engineConfig === 'hans:ttdownloader' },
            { label: 'Hans (FastTok)', value: 'hans:fasttoksave', description: 'FastTok Provider', default: engineConfig === 'hans:fasttoksave' },
        ]);

    const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(engineSelect);

    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('btn_edit_env').setLabel('Edit Env').setStyle(ButtonStyle.Primary).setEmoji('📝'),
      new ButtonBuilder().setCustomId('btn_toggle_autodl').setLabel(autoDl ? 'Disable Auto DL' : 'Enable Auto DL').setStyle(autoDl ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId('nav_back_main').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
    );

    const payload = { embeds: [embed], components: [rowSelect, rowButtons] };

    if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        if (!interaction.deferred && !interaction.replied) await (interaction as any).update(payload);
        else await interaction.editReply(payload);
    } else {
        await (interaction as RepliableInteraction).reply({ ...payload, ephemeral: true });
    }
  }

  async handleEngineSelect(interaction: StringSelectMenuInteraction): Promise<void> {
      await this.systemConfigRepo.set('DOWNLOAD_ENGINE', interaction.values[0]);
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
}

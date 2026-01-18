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
  RepliableInteraction
} from 'discord.js';
import { SystemConfigRepository } from '../../core/repositories/system-config.repository';
import { configManager } from '../../core/config/config';

export class ConfigController {
  constructor(
    private systemConfigRepo: SystemConfigRepository,
    private onConfigReload: () => Promise<void>
  ) {}

  async showEnvironmentPage(interaction: ButtonInteraction): Promise<void> {
    const config = configManager.get();
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Environment Configuration')
      .setColor(0x2b2d31)
      .setDescription('Current system configuration values (Active).')
      .addFields(
        { name: 'Source Bots', value: `\`${config.bot.sourceBotIds.join(', ')}\`` },
        { name: 'Fallback Channel', value: `\`${config.bot.fallbackChannelId}\``, inline: true },
        { name: 'Auto-Create Category', value: `\`${config.bot.autoCreateCategoryId}\``, inline: true },
        { name: 'Core Server', value: `\`${config.discord.coreServerId}\``, inline: true },
        { name: 'DB Connections', value: `Min: ${config.database.minConnections} / Max: ${config.database.maxConnections}`, inline: true }
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('btn_edit_env').setLabel('Edit Config').setStyle(ButtonStyle.Primary).setEmoji('📝'),
      new ButtonBuilder().setCustomId('nav_back_main').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
    );

    await interaction.update({ embeds: [embed], components: [row] });
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

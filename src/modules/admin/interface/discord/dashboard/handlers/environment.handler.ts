
import { 
  EmbedBuilder, 
  ButtonInteraction, 
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { ManageSystemConfigUseCase } from '../../../../application/usecases/manage-system-config.usecase';

export class EnvironmentHandler {
  constructor(private readonly configUseCase: ManageSystemConfigUseCase) {}

  async handle(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction, action: string = 'home', subject: string = 'none', _data: string = 'none'): Promise<void> {
    
    // 1. Handle Engine Switch
    if (interaction.isStringSelectMenu() && action === 'set' && subject === 'engine') {
        const selectedEngine = interaction.values[0];
        try {
            await this.configUseCase.setDownloadEngine(selectedEngine);
            // Fall through to update
        } catch (error) {
            await interaction.reply({ content: `❌ Failed to set engine: ${(error as Error).message}`, ephemeral: true });
            return;
        }
    }

    // 2. Handle Toggle
    if (interaction.isButton() && interaction.customId === 'toggle_autodl') {
        try {
            await this.configUseCase.toggleAutoDownload();
            // Fall through to update UI
        } catch (error) {
            const msg = { content: `❌ Failed to toggle Auto-DL: ${(error as Error).message}`, ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(msg);
            } else {
                await interaction.reply(msg);
            }
            return;
        }
    }

    // 3. Render Status
    const status = await this.configUseCase.getSystemStatus();
    const autoDlStatus = status.autoDownload ? '✅ ON' : '🔴 OFF';
    
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Environment Configuration')
      .addFields(
        { name: 'Auto Download', value: autoDlStatus, inline: true },
        { name: 'Active Engine', value: `\`${status.engine}\``, inline: true },
        { name: 'Database', value: `\`${status.dbDriver}\``, inline: true }
      )
      .setColor('#95a5a6') // Gray
      .setFooter({ text: 'Changes here are hot-reloaded.' });

    // Engine Selector
    const engineOptions = [
        { label: 'Liber (Recommended)', value: 'liber', description: 'Fast, reliable, no watermark.' },
        { label: 'TikWM', value: 'tikwm', description: 'Alternative reliable source.' },
        { label: 'Douyin / MusicalDown', value: 'musicaldown', description: 'Good for slides/images.' },
        { label: 'TikTok V2', value: 'tiktokv2', description: 'Legacy API scraper.' },
        { label: 'BTCH (Legacy)', value: 'btch', description: 'Previous default engine.' }
    ];

    const engineSelect = new StringSelectMenuBuilder()
        .setCustomId('set:env:engine:0') // ACTION:MODULE:SUBJECT:DATA -> Matches logic above
        .setPlaceholder(`Current Engine: ${status.engine}`)
        .addOptions(engineOptions.map(opt => 
            new StringSelectMenuOptionBuilder()
                .setLabel(opt.label)
                .setValue(opt.value)
                .setDescription(opt.description)
                .setDefault(opt.value === status.engine)
        ));

    const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(engineSelect);

    const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
             new ButtonBuilder()
                .setLabel(status.autoDownload ? 'DISABLE Auto-DL' : 'ENABLE Auto-DL')
                .setCustomId('toggle_autodl')
                .setStyle(status.autoDownload ? ButtonStyle.Danger : ButtonStyle.Success),
             new ButtonBuilder()
                .setLabel('Back to Menu')
                .setCustomId('nav:main:menu:0')
                .setStyle(ButtonStyle.Secondary)
        );

    const payload = { embeds: [embed], components: [row1, row2] };

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (interaction.deferred || interaction.replied) {
             await interaction.message.edit(payload);
        } else {
             await interaction.update(payload);
        }
    } else {
        await interaction.reply({ ...payload, ephemeral: true });
    }
  }
}

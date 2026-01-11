
import { 
  EmbedBuilder, 
  ButtonInteraction, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { UserMapping } from '../../../../../forwarder/domain/entities/user-mapping.entity';
import { ListMappingsUseCase } from '../../../../../forwarder/application/usecases/list-mappings.usecase';
import { AddMappingUseCase } from '../../../../../forwarder/application/usecases/add-mapping.usecase';
import { RemoveMappingUseCase } from '../../../../../forwarder/application/usecases/remove-mapping.usecase';

export class MappingHandler {
  constructor(
    private readonly addMapping: AddMappingUseCase,
    private readonly removeMapping: RemoveMappingUseCase,
    private readonly listMappings: ListMappingsUseCase
  ) {}

  async handle(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction, action: string = 'list', subject: string = 'mappings', data: string = '1'): Promise<void> {
    
    // Logic Fix: If action is 'nav', the real command is in 'subject' (e.g. nav:map:add -> subject=add)
    const command = action === 'nav' ? subject : action;

    switch(command) {
      case 'list':
        await this.showList(interaction, parseInt(data) || 1);
        break;
      case 'add':
        await this.showAddModal(interaction as ButtonInteraction);
        break;
      case 'submit':
        await this.handleAddSubmit(interaction as ModalSubmitInteraction);
        break;
      case 'delete':
        await this.showDeleteMenu(interaction as ButtonInteraction, parseInt(data) || 1);
        break;
      case 'remove':
        await this.handleRemove(interaction as StringSelectMenuInteraction, data);
        break;
      default:
        await this.showList(interaction, 1);
        break;
    }
  }

  private async showList(interaction: any, page: number): Promise<void> {
    const limit = 10;
    const result = await (this.listMappings as any).execute(page, limit) as { data: UserMapping[], total: number };
    const { data: mappings, total } = result;
    const totalPages = Math.ceil(total / limit) || 1;

    // Clamp page
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    const mappingList = mappings.length > 0
        ? mappings.map(m => `• **${m.username.value}** ➔ <#${m.channelId.value}>`).join('\n')
        : '*No mappings configured.*';

    const embed = new EmbedBuilder()
      .setTitle(`🗺️ Mappings (Page ${page}/${totalPages})`)
      .setDescription(mappingList)
      .setFooter({ text: `Total: ${total} mappings | Page ${page} of ${totalPages}` })
      .setColor('#2ecc71');

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`nav:map:list:${page - 1}`)
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 1),
            new ButtonBuilder()
                .setCustomId('nav:main:menu:0') // Home
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`nav:map:list:${page + 1}`)
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages),
             new ButtonBuilder()
                .setLabel('Add')
                .setEmoji('➕')
                .setCustomId('nav:map:add:0')
                .setStyle(ButtonStyle.Success),
             new ButtonBuilder()
                .setLabel('Delete')
                .setEmoji('🗑️')
                .setCustomId(`nav:map:delete:${page}`) // Pass current page to return/filter
                .setStyle(ButtonStyle.Danger)
                .setDisabled(mappings.length === 0)
        );

    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
       if (interaction.deferred || interaction.replied) {
          await interaction.message.edit({ embeds: [embed], components: [row] });
       } else {
          await interaction.update({ embeds: [embed], components: [row] });
       }
    } else {
       await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
  }

  private async showAddModal(interaction: ButtonInteraction): Promise<void> {
      const modal = new ModalBuilder()
        .setCustomId('nav:map:submit:0')
        .setTitle('Add TikTok Mapping');

      const usernameInput = new TextInputBuilder()
        .setCustomId('username')
        .setLabel("TikTok Username")
        .setPlaceholder("@username") // or plain username
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const channelInput = new TextInputBuilder()
        .setCustomId('channel_id')
        .setLabel("Discord Channel ID")
        .setPlaceholder("123456789012345678")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

        const roleInput = new TextInputBuilder()
        .setCustomId('role_id')
        .setLabel("Role ID to Tag (Optional)")
        .setPlaceholder("123456789012345678")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(usernameInput);
      const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput);
      const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput);

      modal.addComponents(row1, row2, row3);
      await interaction.showModal(modal);
  }

  private async handleAddSubmit(interaction: ModalSubmitInteraction): Promise<void> {
      const username = interaction.fields.getTextInputValue('username');
      const channelId = interaction.fields.getTextInputValue('channel_id');
      const roleId = interaction.fields.getTextInputValue('role_id');

      try {
          await this.addMapping.execute({ username, channelId, roleId });
          await interaction.reply({ content: `✅ Successfully added mapping for **${username}**!`, ephemeral: true });
          // Note: The modal submit replies, so the background menu might remain stale until refreshing.
          // We could send a follow-up or just let user refresh manually.
      } catch (error) {
          await interaction.reply({ content: `❌ Failed to add mapping: ${(error as Error).message}`, ephemeral: true });
      }
  }

  private async showDeleteMenu(interaction: ButtonInteraction, page: number): Promise<void> {
    const limit = 10; // Match list limit to show same items
    const result = await (this.listMappings as any).execute(page, limit) as { data: UserMapping[] };
    const { data: mappings } = result;

    if (mappings.length === 0) {
        await interaction.reply({ content: 'No mappings to delete on this page.', ephemeral: true });
        return;
    }

    const options = mappings.map(m => new StringSelectMenuOptionBuilder()
        .setLabel(`${m.username.value}`)
        .setDescription(`Channel: ${m.channelId.value}`)
        .setValue(`${m.username.value}:${m.channelId.value}`) // Combine keys for deletion
    );

    const select = new StringSelectMenuBuilder()
        .setCustomId(`nav:map:remove:${page}`)
        .setPlaceholder('Select a mapping to delete...')
        .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
         new ButtonBuilder()
            .setLabel('Cancel')
            .setCustomId(`nav:map:list:${page}`)
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ content: '🗑️ Select a mapping to delete:', embeds: [], components: [row, btnRow] });
  }

  private async handleRemove(interaction: StringSelectMenuInteraction, pageStr: string): Promise<void> {
      const selected = interaction.values[0];
      const [username, channelId] = selected.split(':');

      try {
          await this.removeMapping.execute({ username, channelId });
          await interaction.deferUpdate(); // Acknowledge
          // Go back to list
          await this.showList(interaction, parseInt(pageStr) || 1);
          // Send ephemeral confirmation?
          await interaction.followUp({ content: `✅ Deleted mapping for **${username}**.`, ephemeral: true });
      } catch (error) {
          await interaction.reply({ content: `❌ Failed to delete: ${(error as Error).message}`, ephemeral: true });
      }
  }
}

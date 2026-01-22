import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { UserMappingRepository } from '../../core/repositories/user-mapping.repository';

export class MappingController {
  constructor(private userMappingRepo: UserMappingRepository) {}

  async showManager(interaction: Interaction): Promise<void> {
    if (!interaction.isRepliable()) return;
    const mappings = await this.userMappingRepo.findAll();

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
    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
        if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
        else await (interaction as any).update(payload);
    } else {
        await (interaction as any).reply(payload);
    }
  }

  async handleButton(interaction: ButtonInteraction, action: string, username: string): Promise<void> {
    if (action === 'delete') {
      try {
        await this.userMappingRepo.delete(username);
        await this.showManager(interaction);
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

  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    if (interaction.customId === 'select_mapping_manage') {
      const username = interaction.values[0];
      const mapping = await this.userMappingRepo.findByUsername(username);

      if (!mapping) {
        if (interaction.deferred || interaction.replied) await interaction.editReply({ content: '❌ Mapping not found in DB.' });
        else await interaction.reply({ content: '❌ Mapping not found in DB.', ephemeral: true });
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

      const payload = { embeds: [embed], components: [row] };
      if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload);
      } else {
          await interaction.update(payload);
      }
    }
  }

  async showAddModal(interaction: ButtonInteraction) {
    const modal = new ModalBuilder().setCustomId('modal_add_mapping').setTitle('Add New Mapping');
    const userInput = new TextInputBuilder().setCustomId('map_user').setLabel("TikTok Username").setStyle(TextInputStyle.Short).setRequired(true);
    const channelInput = new TextInputBuilder().setCustomId('map_channel').setLabel("Channel ID").setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(userInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput)
    );
    await interaction.showModal(modal);
  }

  async handleAddModal(interaction: ModalSubmitInteraction): Promise<void> {
      const username = interaction.fields.getTextInputValue('map_user').trim();
      const channelId = interaction.fields.getTextInputValue('map_channel').trim();

      if (!/^\d{17,20}$/.test(channelId)) {
        await interaction.reply({ content: '❌ Invalid Channel ID.', ephemeral: true });
        return;
      }

      try {
        await this.userMappingRepo.upsert(username, channelId);
        await this.showManager(interaction);
        await interaction.followUp({ content: `✅ Mapping added: **${username}** -> <#${channelId}>`, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
      }
  }

  async handleEditModal(interaction: ModalSubmitInteraction, username: string): Promise<void> {
      const newChannelId = interaction.fields.getTextInputValue('map_channel_new').trim();

      if (!/^\d{17,20}$/.test(newChannelId)) {
        await interaction.reply({ content: '❌ Invalid Channel ID.', ephemeral: true });
        return;
      }

      try {
        await this.userMappingRepo.upsert(username, newChannelId);
        await this.showManager(interaction);
        await interaction.followUp({ content: `✅ Mapping updated: **${username}** -> <#${newChannelId}>`, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
      }
  }
}

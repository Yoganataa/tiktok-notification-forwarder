// src/controllers/admin/mapping.handler.ts
import { 
    ButtonInteraction, 
    ModalSubmitInteraction, 
    StringSelectMenuInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle
} from 'discord.js';
import { UserMappingRepository } from '../../repositories/user-mapping.repository';

export class MappingHandler {
    constructor(
        private userMappingRepo: UserMappingRepository
    ) {}

    async showPage(interaction: ButtonInteraction): Promise<void> {
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

        await interaction.update({ embeds: [embed], components: [rowSelect, rowButtons] });
    }

    async showAddModal(interaction: ButtonInteraction): Promise<void> {
        const modal = new ModalBuilder().setCustomId('modal_add_mapping').setTitle('Add New Mapping');
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('map_user').setLabel('TikTok Username').setStyle(TextInputStyle.Short).setRequired(true)));
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('map_channel').setLabel('Channel ID').setStyle(TextInputStyle.Short).setRequired(true)));
        await interaction.showModal(modal);
    }

    async handleAddSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        const username = interaction.fields.getTextInputValue('map_user').trim();
        const channelId = interaction.fields.getTextInputValue('map_channel').trim();

        if (!/^\d{17,20}$/.test(channelId)) {
            await interaction.reply({ content: '❌ Invalid Channel ID.', ephemeral: true });
            return;
        }

        try {
            await this.userMappingRepo.upsert(username, channelId);
            await interaction.reply({ content: `✅ Mapping added: **${username}** -> <#${channelId}>`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
        }
    }

    async handleSelection(interaction: StringSelectMenuInteraction): Promise<void> {
        const username = interaction.values[0];
        const mapping = await this.userMappingRepo.findByUsername(username);

        if (!mapping) {
            await interaction.reply({ content: '❌ Mapping not found.', ephemeral: true });
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

    async handleActions(interaction: ButtonInteraction): Promise<void> {
        const parts = interaction.customId.split('_');
        const action = parts[2];
        const username = parts[3];

        if (action === 'delete') {
            try {
                await this.userMappingRepo.delete(username);
                await this.showPage(interaction); // Go back to list
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

    async handleEditSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        const username = interaction.customId.replace('modal_edit_mapping_', '');
        const newChannelId = interaction.fields.getTextInputValue('map_channel_new').trim();

        try {
            await this.userMappingRepo.upsert(username, newChannelId);
            await interaction.reply({ content: `✅ Mapping updated: **${username}** -> <#${newChannelId}>`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
        }
    }
}
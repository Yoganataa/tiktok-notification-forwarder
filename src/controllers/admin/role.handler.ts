// src/controllers/admin/role.handler.ts
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
import { PermissionService } from '../../services/permission.service';
import { ROLES, UserRole } from '../../core/types/database.types';

export class RoleHandler {
    constructor(
        private permissionService: PermissionService
    ) {}

    async showPage(interaction: ButtonInteraction): Promise<void> {
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

        await interaction.update({ embeds: [embed], components: [rowSelect, rowButtons] });
    }

    async showAddModal(interaction: ButtonInteraction): Promise<void> {
        const modal = new ModalBuilder().setCustomId('modal_add_staff').setTitle('Add New Staff');
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('staff_id').setLabel('Discord User ID').setStyle(TextInputStyle.Short).setRequired(true)));
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('staff_role').setLabel('Role (ADMIN/SUDO)').setValue("SUDO").setStyle(TextInputStyle.Short).setRequired(true)));
        await interaction.showModal(modal);
    }

    async handleAddSubmit(interaction: ModalSubmitInteraction): Promise<void> {
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
            await interaction.reply({ content: `✅ Added <@${userId}> as **${role}**`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
        }
    }

    async handleSelection(interaction: StringSelectMenuInteraction): Promise<void> {
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

    async handleActions(interaction: ButtonInteraction): Promise<void> {
        const parts = interaction.customId.split('_');
        const action = parts[2];
        const targetId = parts[3];

        try {
            if (action === 'revoke') await this.permissionService.revokeAccess(targetId);
            else {
                const role = action === 'admin' ? ROLES.ADMIN : ROLES.SUDO;
                await this.permissionService.assignRole(targetId, role, interaction.user.id);
            }
            await this.showPage(interaction);
        } catch (error) {
            await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
        }
    }
}
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    PermissionFlagsBits 
} from 'discord.js';
import { AddMappingUseCase } from '../application/usecases/add-mapping.usecase';
import { logger } from '../../../infra/logger';

// Simplified command structure: No subcommands, direct options.
export const mappingCommand = new SlashCommandBuilder()
    .setName('mapping')
    .setDescription('Add a new TikTok forwarding mapping to this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt => 
        opt.setName('username')
           .setDescription('TikTok Username')
           .setRequired(true)
    )
    .addRoleOption(opt => 
        opt.setName('role')
           .setDescription('Role to ping (optional)')
    );

/**
 * Handles the simplified /mapping command (Add only).
 * Management (List/Remove) is delegated to the /menu dashboard.
 */
export async function handleForwarderAdapter(
    interaction: ChatInputCommandInteraction,
    addMapping: AddMappingUseCase
): Promise<void> {
    const channelId = interaction.channelId;

    if (!channelId) {
        await interaction.reply({ content: '❌ Invalid channel context.', ephemeral: true });
        return;
    }

    // Extract options directly (no subcommand check needed)
    const username = interaction.options.getString('username', true);
    const role = interaction.options.getRole('role');

    try {
        await addMapping.execute({
            username: username,
            channelId: channelId,
            roleId: role?.id
        });

        const pingText = role ? ` (Ping: ${role})` : '';
        await interaction.reply(`✅ Added mapping: **@${username}** -> <#${channelId}>${pingText}`);
        
    } catch (error) {
        logger.error('Forwarder adapter error', { error: (error as Error).message });
        
        // Handle specific duplication or validation errors gracefully if needed
        await interaction.reply({ 
            content: `❌ Failed to add mapping: ${(error as Error).message}`, 
            ephemeral: true 
        });
    }
}

import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { PermissionFlagsBits } from 'discord.js';
import { configManager } from '../../core/config/config';
import { container } from '@sapphire/framework';

@ApplyOptions<Command.Options>({
	description: 'Add a new user mapping',
	preconditions: ['CoreServerOnly', 'SudoOnly']
})
export class MappingCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
				.addStringOption((option) =>
					option.setName('username').setDescription('TikTok Username').setRequired(true)
				)
				.addChannelOption((option) =>
					option.setName('channel').setDescription('Discord Channel').setRequired(true)
				)
				.addRoleOption((option) =>
					option.setName('role').setDescription('Role to ping').setRequired(false)
				),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const username = interaction.options.getString('username', true);
		const channel = interaction.options.getChannel('channel', true);
		const role = interaction.options.getRole('role');

        if (!channel) return;

		await interaction.deferReply({ ephemeral: true });

		try {
			await container.repos.userMapping.upsert(
                username,
                channel.id,
                role ? role.id : null
            );
			await interaction.editReply(`✅ Mapping added: **${username}** -> <#${channel.id}> ${role ? `(<@&${role.id}>)` : ''}`);
		} catch (error) {
			await interaction.editReply(`❌ Error: ${(error as Error).message}`);
		}
	}
}

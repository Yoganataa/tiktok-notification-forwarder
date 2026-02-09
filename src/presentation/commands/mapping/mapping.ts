import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { EmbedBuilder } from 'discord.js';
import { container } from '@sapphire/framework';
import { configManager } from '../../../infrastructure/config/config';

@ApplyOptions<Subcommand.Options>({
	description: 'Manage user mappings',
	subcommands: [
		{ name: 'add', chatInputRun: 'addRun' },
		{ name: 'remove', chatInputRun: 'removeRun' },
		{ name: 'list', chatInputRun: 'listRun' }
	],
	preconditions: ['AdminOnly', 'CoreServerOnly']
})
export class MappingCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addSubcommand((command) =>
					command
						.setName('add')
						.setDescription('Add a new mapping')
						.addStringOption((option) =>
							option.setName('username').setDescription('TikTok Username').setRequired(true)
						)
						.addChannelOption((option) =>
							option.setName('channel').setDescription('Discord Channel').setRequired(true)
						)
						.addRoleOption((option) =>
							option.setName('role').setDescription('Role to ping').setRequired(false)
						)
				)
				.addSubcommand((command) =>
					command
						.setName('remove')
						.setDescription('Remove a mapping')
						.addStringOption((option) =>
							option.setName('username').setDescription('TikTok Username').setRequired(true)
						)
				)
				.addSubcommand((command) =>
					command
						.setName('list')
						.setDescription('List all mappings')
				),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public async addRun(interaction: Subcommand.ChatInputCommandInteraction) {
		const username = interaction.options.getString('username', true);
		const channel = interaction.options.getChannel('channel', true);
		const role = interaction.options.getRole('role');

		await interaction.deferReply({ ephemeral: true });

		try {
			const repo = container.repos.userMapping;
			await repo.upsert(username, channel.id, role?.id || null);
			await interaction.editReply(`Mapping added: ${username} -> <#${channel.id}> ${role ? `(@${role.name})` : ''}`);
		} catch (error) {
			await interaction.editReply(`Error adding mapping: ${(error as Error).message}`);
		}
	}

	public async removeRun(interaction: Subcommand.ChatInputCommandInteraction) {
		const username = interaction.options.getString('username', true);
		await interaction.deferReply({ ephemeral: true });

		try {
			const repo = container.repos.userMapping;
			const deleted = await repo.delete(username);
			if (deleted) {
				await interaction.editReply(`Mapping removed for ${username}`);
			} else {
				await interaction.editReply(`No mapping found for ${username}`);
			}
		} catch (error) {
			await interaction.editReply(`Error removing mapping: ${(error as Error).message}`);
		}
	}

	public async listRun(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });
		try {
			const repo = container.repos.userMapping;
			const mappings = await repo.findAll();

			if (mappings.length === 0) {
				return interaction.editReply('No mappings found.');
			}

			const embed = new EmbedBuilder()
				.setTitle('User Mappings')
				.setColor('#0099ff');

			// Chunking to avoid 4096 char limit
			const chunks: string[] = [];
			let currentChunk = '';

			for (const m of mappings) {
				const line = `• **${m.username}** ➔ <#${m.channel_id}> ${m.role_id ? `<@&${m.role_id}>` : ''}\n`;
				if (currentChunk.length + line.length > 1024) {
					chunks.push(currentChunk);
					currentChunk = line;
				} else {
					currentChunk += line;
				}
			}
			if (currentChunk) chunks.push(currentChunk);

			chunks.forEach((chunk, index) => {
				embed.addFields({ name: index === 0 ? 'Mappings' : 'Continued', value: chunk });
			});

			return interaction.editReply({ embeds: [embed] });
		} catch (error) {
			return interaction.editReply(`Error listing mappings: ${(error as Error).message}`);
		}
	}
}

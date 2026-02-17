import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { TextChannel, Message, EmbedBuilder } from 'discord.js';
import { container } from '@sapphire/framework';
import { configManager } from '../../../core/config/config';

@ApplyOptions<Command.Options>({
	description: 'Reprocess messages in bulk from channel history (admin only)',
	preconditions: ['AdminOnly']
})
export class ReforgotAllCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
        const config = configManager.get();
        // Register in both Core Server and Extra Guilds (Unique Set)
        const allowedGuilds = [...new Set([
            config.discord.coreServerId,
            ...config.discord.extraGuildIds
        ].filter(Boolean))];

		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
                .addIntegerOption((option) =>
                    option.setName('limit')
                        .setDescription('Maximum number of messages to scan (Default: 5000)')
                        .setMinValue(1)
                        .setMaxValue(100000)
                        .setRequired(false)
                ),
            { guildIds: allowedGuilds }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const limit = interaction.options.getInteger('limit') || 5000;
		await interaction.deferReply({ ephemeral: true });

		const channel = interaction.channel;
		if (!channel || !channel.isTextBased()) {
			return interaction.editReply('This command can only be used in text channels.');
		}

        let totalScanned = 0;
        let lastId: string | undefined;
        let running = true;

        await interaction.editReply(`🚀 Starting bulk scan... Limit: **${limit}** messages.`);

        try {
            while (running && totalScanned < limit) {
                const fetchLimit = Math.min(100, limit - totalScanned);
                const messages = await (channel as TextChannel).messages.fetch({ limit: fetchLimit, before: lastId });

                if (messages.size === 0) {
                    running = false;
                    break;
                }

                for (const [, message] of messages) {
                    // Process message
                    await container.services.forwarder.processMessage(message);
                    lastId = message.id;
                }

                totalScanned += messages.size;

                // Update status every 500 messages
                if (totalScanned % 500 === 0) {
                    await interaction.editReply(`🔄 Scanned **${totalScanned}** / ${limit} messages...`);
                }

                // Rate limit protection: 2 seconds delay
                if (running && totalScanned < limit) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Bulk Scan Complete')
                .setDescription(`Successfully scanned channel history.`)
                .addFields(
                    { name: 'Total Scanned', value: totalScanned.toString(), inline: true },
                    { name: 'Limit Reached', value: totalScanned >= limit ? 'Yes' : 'No', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ content: null, embeds: [embed] });

        } catch (error) {
            await interaction.editReply(`❌ Error during bulk scan: ${(error as Error).message}`);
        }
	}
}

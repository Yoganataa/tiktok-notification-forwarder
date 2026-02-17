import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { TextChannel, EmbedBuilder, Message, AttachmentBuilder } from 'discord.js';
import { configManager } from '../../../core/config/config';
import { logger } from '../../../core/utils/logger';

@ApplyOptions<Command.Options>({
	description: 'Move messages to another channel safely (Copy & Delete)',
	preconditions: ['CoreServerOnly', 'AdminOnly']
})
export class MoveCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addChannelOption((option) =>
					option.setName('destination').setDescription('Target Channel').setRequired(true)
				)
				.addIntegerOption((option) =>
					option.setName('amount')
						.setDescription('Number of messages to move (Default: Move All / Max 3000)')
						.setMinValue(1)
						.setMaxValue(3000)
						.setRequired(false)
				)
				.addStringOption((option) =>
					option.setName('type')
						.setDescription('Filter content type')
						.setRequired(false)
						.addChoices(
							{ name: 'All', value: 'all' },
							{ name: 'Media Only', value: 'media' },
							{ name: 'Text Only', value: 'text' }
						)
				),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const destination = interaction.options.getChannel('destination', true);
		const amount = interaction.options.getInteger('amount') || 3000; // Default to max 3000 ("All")
		const type = interaction.options.getString('type') || 'all';

		if (!interaction.channel || !interaction.channel.isTextBased()) {
			return interaction.reply({ content: '❌ This command can only be used in text channels.', ephemeral: true });
		}
		if (!('isTextBased' in destination) || !destination.isTextBased()) {
			return interaction.reply({ content: '❌ Destination must be a text channel.', ephemeral: true });
		}
		if (interaction.channel.id === destination.id) {
			return interaction.reply({ content: '❌ Source and Destination cannot be the same.', ephemeral: true });
		}

		await interaction.deferReply({ ephemeral: true });

		const sourceChannel = interaction.channel as TextChannel;
		const targetChannel = destination as TextChannel;

		try {
			// --- PHASE 1: FETCHING ---
			let collectedMessages: Message[] = [];
			let lastId: string | undefined;
			let fetching = true;

			await interaction.editReply(`🔍 Fetching messages... (Limit: ${amount})`);

			while (fetching && collectedMessages.length < amount) {
				const fetchSize = Math.min(100, amount - collectedMessages.length);
				const batch = await sourceChannel.messages.fetch({ limit: fetchSize, before: lastId });

				if (batch.size === 0) {
					fetching = false;
					break;
				}

				for (const [, msg] of batch) {
					// Basic filtering during fetch to save memory if obviously skippable
					if (!msg.system && !msg.pinned) {
						collectedMessages.push(msg);
					}
					lastId = msg.id;
				}

				// Check if we reached the limit
				if (collectedMessages.length >= amount) {
					fetching = false;
				}

				// Rate Limit: 2s delay between batches
				if (fetching) await new Promise(resolve => setTimeout(resolve, 2000));

				await interaction.editReply(`🔍 Fetched **${collectedMessages.length}** / ${amount} messages...`);
			}

			// --- PHASE 2: FILTERING & SORTING ---
			// Reverse to Chronological (Oldest -> Newest)
			collectedMessages.reverse();

			// Apply Type Filter
			const messagesToMove = collectedMessages.filter(msg => {
				const hasMedia = msg.attachments.size > 0 || msg.embeds.length > 0;
				if (type === 'media') return hasMedia;
				if (type === 'text') return !hasMedia && msg.content.length > 0;
				return true; // 'all'
			});

			if (messagesToMove.length === 0) {
				return interaction.editReply('❌ No messages found matching criteria.');
			}

			await interaction.editReply(`🚀 Ready to move **${messagesToMove.length}** messages (Type: ${type}). Starting...`);

			// --- PHASE 3: MOVING (SAFE LOOP) ---
			let movedCount = 0;
			let skippedCount = 0;
			let failedCount = 0;
			let consecutiveFailures = 0;

			for (const msg of messagesToMove) {
				// Circuit Breaker
				if (consecutiveFailures >= 5) {
					logger.error('Circuit Breaker tripped in /move command.');
					await interaction.followUp({ content: '⚠️ **ABORTED:** Too many consecutive errors. Stopping operation.', ephemeral: true });
					break;
				}

				try {
                    let finalEmbeds: EmbedBuilder[] = [];
                    let finalContent: string | undefined = undefined;

                    // Condition A: Message ALREADY has embeds (Bot, Link Preview, etc.)
                    if (msg.embeds.length > 0) {
                        // Clone the first embed and inject attribution
                        const firstEmbed = EmbedBuilder.from(msg.embeds[0]);
                        firstEmbed.setFooter({ text: `Moved from #${sourceChannel.name} • Author: ${msg.author.username}`, iconURL: msg.author.displayAvatarURL() });
                        firstEmbed.setTimestamp(msg.createdTimestamp);

                        // Keep subsequent embeds (limit total to 10)
                        const otherEmbeds = msg.embeds.slice(1).map(e => EmbedBuilder.from(e));

                        // Combine: [ModifiedFirst, ...Others] (sliced to max 9 others to fit 10 total)
                        finalEmbeds = [firstEmbed, ...otherEmbeds.slice(0, 9)];

                        // Pass text content if it exists
                        if (msg.content && msg.content.length > 0) {
                            finalContent = msg.content;
                        }

                    }
                    // Condition B: Text/Media only (No existing embeds)
                    else {
                        const mimicEmbed = new EmbedBuilder()
                            .setAuthor({ name: msg.author.username, iconURL: msg.author.displayAvatarURL() })
                            .setDescription(msg.content || '*[No Text Content]*')
                            .setTimestamp(msg.createdTimestamp)
                            .setFooter({ text: `Moved from #${sourceChannel.name}` });

                        finalEmbeds = [mimicEmbed];
                        // Content is inside the embed description, so payload content is undefined
                    }

					// Re-upload attachments
					const files = msg.attachments.map(att => new AttachmentBuilder(att.url, { name: att.name }));

					// 2. Send to Destination
					await targetChannel.send({
                        content: finalContent, // undefined or string
                        embeds: finalEmbeds,
                        files: files
                    });

					// 3. Delete Original (Only if send succeeded)
					await msg.delete();

					movedCount++;
					consecutiveFailures = 0; // Reset circuit breaker

					// 4. Rate Limit (1s delay)
					await new Promise(resolve => setTimeout(resolve, 1000));

				} catch (error) {
					logger.error(`Failed to move message ${msg.id}: ${(error as Error).message}`);
					failedCount++;
					consecutiveFailures++;
				}

				// Progress Update every 20 messages
				if ((movedCount + failedCount + skippedCount) % 20 === 0) {
					await interaction.editReply(
						`🔄 Moving... **${movedCount}** / ${messagesToMove.length} processed.\n` +
						`⚠️ Failed: ${failedCount} | Consecutive Errors: ${consecutiveFailures}`
					);
				}
			}

			// --- PHASE 4: COMPLETION ---
			const summary = new EmbedBuilder()
				.setColor(failedCount > 0 ? '#f1c40f' : '#2ecc71')
				.setTitle('✅ Move Operation Complete')
				.setDescription(`Moved messages from <#${sourceChannel.id}> to <#${targetChannel.id}>.`)
				.addFields(
					{ name: 'Moved', value: movedCount.toString(), inline: true },
					{ name: 'Failed', value: failedCount.toString(), inline: true },
					{ name: 'Skipped', value: (collectedMessages.length - messagesToMove.length).toString(), inline: true }
				)
				.setTimestamp();

			await interaction.editReply({ content: null, embeds: [summary] });

		} catch (error) {
			logger.error('Critical error in /move command', error);
			await interaction.editReply(`❌ Critical Error: ${(error as Error).message}`);
		}
	}
}

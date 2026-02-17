import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { container } from '@sapphire/framework';
import { configManager } from '../../../core/config/config';

@ApplyOptions<Command.Options>({
	description: 'Download a TikTok video',
	preconditions: ['CoreServerOnly']
})
export class DownloadCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('download')
				.setDescription(this.description)
				.addStringOption((option) =>
					option.setName('url').setDescription('TikTok URL').setRequired(true)
				),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        // Check Manual Download Mode
        // We check the DB directly to get the latest override, fallback to config default
        const manualMode = await container.repos.systemConfig.get('MANUAL_DOWNLOAD_MODE');
        const isManualMode = manualMode === 'true'; // string storage in DB

        if (isManualMode) {
            return interaction.reply({
                content: '🚫 **Manual Download Mode is Enabled.**\nPlease paste the TikTok link directly into an allowed channel to download it.',
                ephemeral: true
            });
        }

		const url = interaction.options.getString('url', true);
        await container.controllers.download.handleDownloadRequest(interaction, url);
	}
}

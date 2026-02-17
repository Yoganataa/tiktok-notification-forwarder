import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { configManager } from '../../../core/config/config';

@ApplyOptions<Command.Options>({
	description: 'Display the main menu',
	preconditions: ['CoreServerOnly']
})
export class MenuCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description),
			{ guildIds: [configManager.get().discord.coreServerId] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		return this.container.controllers.menu.showMainMenu(interaction);
	}
}

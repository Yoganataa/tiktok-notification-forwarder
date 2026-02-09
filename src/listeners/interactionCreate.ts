import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { Interaction } from 'discord.js';
import { container } from '@sapphire/framework';
import { logger } from '../shared/utils/logger';

@ApplyOptions<Listener.Options>({
	event: 'interactionCreate'
})
export class InteractionCreateListener extends Listener {
	public async run(interaction: Interaction) {
		try {
            // Commands are handled by Sapphire automatically.
            // We only need to handle components (Buttons, SelectMenus, Modals).

			if (interaction.isButton()) {
                await container.controllers.menu.handleButton(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await container.controllers.menu.handleSelectMenu(interaction);
            } else if (interaction.isModalSubmit()) {
                await container.controllers.menu.handleModal(interaction);
            }
		} catch (error) {
			logger.error('Error handling interaction', error);
            if (interaction.isRepliable() && !interaction.replied) {
                try {
                    if (interaction.deferred) {
                        await interaction.editReply({ content: '❌ An error occurred while processing your request.' });
                    } else {
                        await interaction.reply({ content: '❌ An error occurred while processing your request.', ephemeral: true });
                    }
                } catch (e) {
                    // Ignore if we can't reply
                }
            }
		}
	}
}

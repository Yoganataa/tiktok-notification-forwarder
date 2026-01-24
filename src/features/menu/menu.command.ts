import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BaseCommand } from '../../core/contracts/module.contract';
import { AppContext } from '../../index';

export default class MenuCommand extends BaseCommand {
    get definition() {
        return new SlashCommandBuilder()
            .setName('menu')
            .setDescription('Open the system control panel');
    }

    async execute(interaction: ChatInputCommandInteraction, context: AppContext): Promise<void> {
        const { menuController, permissionService } = context;
        if (!menuController || !permissionService) return;

        if (!(await permissionService.isAdminOrHigher(interaction.user.id))) {
            await interaction.reply({ content: '⛔ Access Denied.', ephemeral: true });
            return;
        }

        // Use the controller to render the initial menu state
        await menuController.showMainMenu(interaction);
    }
}

import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry } from '@sapphire/framework';
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } from 'discord.js';
import axios from 'axios';
import { configManager } from '../../../core/config/config';
import { logger } from '../../../core/utils/logger';

@ApplyOptions<Subcommand.Options>({
    name: 'setup',
    description: 'System Configuration & Setup (Owner Only)',
    subcommands: [
        { name: 'interactive', chatInputRun: 'interactive' },
        { name: 'import', chatInputRun: 'import' },
        { name: 'backup', chatInputRun: 'backup' },
        { name: 'test', chatInputRun: 'test' }
    ]
})
export class SetupCommand extends Subcommand {
    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
                .addSubcommand((sub) =>
                    sub
                        .setName('interactive')
                        .setDescription('Launch interactive setup wizard (Menu)')
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('import')
                        .setDescription('Import configuration from a raw text URL (Gist/Pastebin)')
                        .addStringOption((opt) =>
                            opt
                                .setName('url')
                                .setDescription('The raw URL containing KEY=VALUE config')
                                .setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('backup')
                        .setDescription('Export current configuration as a file')
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('test')
                        .setDescription('Verify current loaded configuration')
                )
        );
    }

    private async checkOwner(interaction: Subcommand.ChatInputCommandInteraction): Promise<boolean> {
        const ownerId = process.env.OWNER_ID;

        if (interaction.user.id !== ownerId) {
            await interaction.reply({
                content: '⛔ Security Alert: This command is restricted to the Bot Owner defined in environment variables.',
                ephemeral: true
            });
            return false;
        }
        return true;
    }

    public async interactive(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!await this.checkOwner(interaction)) return;

        // Use the new categorized menu
        try {
            await this.container.controllers.config.showConfigMenu(interaction);
        } catch (error) {
            logger.error('Interactive Setup Error', error);
            await interaction.reply({ content: '❌ Failed to launch interactive setup.', ephemeral: true });
        }
    }

    public async import(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!await this.checkOwner(interaction)) return;
        await interaction.deferReply({ ephemeral: true });

        const url = interaction.options.getString('url', true);

        try {
            const response = await axios.get(url, { responseType: 'text', timeout: 10000 });
            const content = response.data;
            const lines = content.split('\n');
            let count = 0;

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;

                const parts = trimmed.split('=');
                if (parts.length < 2) continue;

                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');

                await this.container.repos.systemConfig.set(key, value);
                count++;
            }

            await configManager.loadFromDatabase(this.container.repos.systemConfig);

            await interaction.editReply(`✅ Imported ${count} configuration keys from URL.`);

        } catch (error) {
            logger.error('Import Setup Error', error);
            await interaction.editReply(`❌ Failed to import: ${(error as Error).message}`);
        }
    }

    public async backup(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!await this.checkOwner(interaction)) return;
        await interaction.deferReply({ ephemeral: true });

        try {
            const configs = await this.container.repos.systemConfig.findAll();
            const content = configs.map(c => `${c.key}=${c.value}`).join('\n');

            const attachment = new AttachmentBuilder(Buffer.from(content, 'utf-8'), { name: 'backup.env' });

            await interaction.editReply({
                content: `📦 Configuration Backup (${configs.length} items)`,
                files: [attachment]
            });

        } catch (error) {
            logger.error('Backup Setup Error', error);
            await interaction.editReply('❌ Failed to create backup.');
        }
    }

    public async test(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!await this.checkOwner(interaction)) return;
        await interaction.deferReply({ ephemeral: true });

        const config = configManager.get();
        const output = [
            '**Current Configuration State:**',
            `Core Server ID: \`${config.discord.coreServerId || 'NOT SET'}\``,
            `Is Configured: \`${configManager.isConfigured ? 'YES' : 'NO'}\``,
            `Auto Download: \`${config.bot.autoDownload}\``,
            `Download Engine: \`${config.bot.downloadEngine}\``,
            `Upstream Repo: \`${config.update.upstreamRepo}\``
        ].join('\n');

        await interaction.editReply(output);
    }
}

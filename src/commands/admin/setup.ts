import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, ModalSubmitInteraction } from 'discord.js';
import axios from 'axios';
import { configManager } from '../../core/config/config';
import { logger } from '../../shared/utils/logger';

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
                        .setDescription('Launch interactive setup wizard (Modal)')
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
        // We must check config.ownerId manually because DB might be empty
        // and we want to rely on the ENV variable for initial setup access.
        const ownerId = process.env.OWNER_ID;
        // Note: configManager.get().discord.ownerId also comes from process.env.OWNER_ID

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

        // Do NOT deferReply() here, otherwise showModal will fail.

        const modal = new ModalBuilder()
            .setCustomId('setup_modal')
            .setTitle('Core Configuration Setup');

        const coreServerInput = new TextInputBuilder()
            .setCustomId('CORE_SERVER_ID')
            .setLabel('Core Server ID')
            .setPlaceholder('The main server ID for admin commands')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(configManager.get().discord.coreServerId || '');

        const fallbackChannelInput = new TextInputBuilder()
            .setCustomId('FALLBACK_CHANNEL_ID')
            .setLabel('Fallback Channel ID')
            .setPlaceholder('Channel ID for errors/logs')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(configManager.get().bot.fallbackChannelId === '0' ? '' : configManager.get().bot.fallbackChannelId);

        const autoCategoryInput = new TextInputBuilder()
            .setCustomId('AUTO_CREATE_CATEGORY_ID')
            .setLabel('Auto-Create Category ID')
            .setPlaceholder('Category ID for new ticket channels')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(configManager.get().bot.autoCreateCategoryId === '0' ? '' : configManager.get().bot.autoCreateCategoryId);

        const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(coreServerInput);
        const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(fallbackChannelInput);
        const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(autoCategoryInput);

        modal.addComponents(row1, row2, row3);

        await interaction.showModal(modal);

        // Handle the submission
        try {
            const submitted = await interaction.awaitModalSubmit({
                time: 60000,
                filter: (i) => i.customId === 'setup_modal' && i.user.id === interaction.user.id
            });

            await submitted.deferReply({ ephemeral: true });

            const coreId = submitted.fields.getTextInputValue('CORE_SERVER_ID');
            const fallbackId = submitted.fields.getTextInputValue('FALLBACK_CHANNEL_ID');
            const catId = submitted.fields.getTextInputValue('AUTO_CREATE_CATEGORY_ID');

            await this.container.repos.systemConfig.set('CORE_SERVER_ID', coreId);
            if (fallbackId) await this.container.repos.systemConfig.set('FALLBACK_CHANNEL_ID', fallbackId);
            if (catId) await this.container.repos.systemConfig.set('AUTO_CREATE_CATEGORY_ID', catId);

            // Reload config
            await configManager.loadFromDatabase(this.container.repos.systemConfig);

            await submitted.editReply(`✅ Configuration saved!\nCore Server: ${coreId}\nFallback: ${fallbackId || 'N/A'}\nCategory: ${catId || 'N/A'}`);

        } catch (error) {
            if (error instanceof Error && error.message.includes('time')) {
                // Modal timed out, do nothing or user cancelled
            } else {
                logger.error('Interactive Setup Error', error);
            }
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
                const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, ''); // Remove quotes

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
            `Fallback Channel: \`${config.bot.fallbackChannelId}\``,
            `Auto-Create Category: \`${config.bot.autoCreateCategoryId}\``,
            `Manual Download Mode: \`${config.bot.manualDownloadMode}\``,
            `Is Configured: \`${configManager.isConfigured ? 'YES' : 'NO'}\``
        ].join('\n');

        await interaction.editReply(output);
    }
}

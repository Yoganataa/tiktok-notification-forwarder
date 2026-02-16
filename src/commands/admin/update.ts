import { Command } from '@sapphire/framework';
import { execSync } from 'child_process';
import { EmbedBuilder } from 'discord.js';
import { configManager } from '../../core/config/config';
import { logger } from '../../shared/utils/logger';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

export class UpdateCommand extends Command {
    public constructor(context: Command.Context, options: Command.Options) {
        super(context, {
            ...options,
            name: 'update',
            description: 'Force update the bot from the upstream repository (Owner Only)',
            preconditions: ['CoreServerOnly'] // Assuming this precondition exists or similar restriction logic is applied
        });
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const config = configManager.get();

        // 1. Strict Owner Check
        if (interaction.user.id !== config.discord.ownerId) {
            return interaction.reply({
                content: '🚫 This command is restricted to the bot owner.',
                ephemeral: true
            });
        }

        // 2. Initial Feedback
        await interaction.reply({
            content: '🔄 **Force Update Initiated...**\nThis process involves resetting the git repository, pulling the latest code, and rebuilding. The bot will restart upon completion.',
            ephemeral: false
        });

        const repo = config.update.upstreamRepo;
        const branch = config.update.upstreamBranch;

        try {
            logger.info(`[UpdateCommand] Starting force update from ${repo} (branch: ${branch})`);

            // 3. Git Operations
            const gitPath = join(process.cwd(), '.git');

            if (existsSync(gitPath)) {
                logger.info('[UpdateCommand] Removing existing .git directory...');
                rmSync(gitPath, { recursive: true, force: true });
            }

            logger.info('[UpdateCommand] Initializing new git repository...');
            this.exec('git init -q');
            this.exec('git config user.email "bot@bot.com"');
            this.exec('git config user.name "Auto Update Bot"');

            logger.info('[UpdateCommand] Adding remote...');
            this.exec(`git remote add origin ${repo}`);

            logger.info('[UpdateCommand] Fetching upstream...');
            this.exec(`git fetch origin ${branch}`);

            logger.info('[UpdateCommand] Hard resetting...');
            this.exec(`git reset --hard origin/${branch}`);

            // 4. Build Process
            logger.info('[UpdateCommand] Installing dependencies...');
            this.exec('npm install');

            logger.info('[UpdateCommand] Building project...');
            this.exec('npm run build');

            // 5. Success & Restart
            const embed = new EmbedBuilder()
                .setTitle('✅ Update Successful')
                .setDescription('Codebase has been updated and rebuilt. Restarting process now...')
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Repository', value: repo },
                    { name: 'Branch', value: branch }
                )
                .setTimestamp();

            await interaction.followUp({ embeds: [embed] });

            logger.info('[UpdateCommand] Update complete. Exiting process for restart.');

            // Allow time for message to send
            setTimeout(() => {
                process.exit(0);
            }, 1000);

        } catch (error) {
            logger.error('[UpdateCommand] Update failed', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Update Failed')
                .setDescription(`An error occurred during the update process:\n\`\`\`${(error as Error).message}\`\`\``)
                .setColor(0xFF0000);

            await interaction.followUp({ embeds: [errorEmbed] });
        }
    }

    private exec(command: string) {
        try {
            // execSync returns Buffer, convert to string
            execSync(command, { stdio: 'inherit', cwd: process.cwd() });
        } catch (error) {
            // Throw error to be caught in main try-catch
            throw new Error(`Command failed: ${command}\n${(error as Error).message}`);
        }
    }
}

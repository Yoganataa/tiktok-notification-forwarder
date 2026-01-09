// src/controllers/admin/environment.handler.ts
import { 
    ButtonInteraction, 
    ModalSubmitInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    RepliableInteraction
} from 'discord.js';
import { SystemConfigRepository } from '../../repositories/system-config.repository';
import { configManager } from '../../core/config/config';

export class EnvironmentHandler {
    constructor(
        private systemConfigRepo: SystemConfigRepository,
        private onConfigReload: () => Promise<void>,
        private backCallback: (i: RepliableInteraction) => Promise<void>
    ) {}

    /**
     * Menampilkan Halaman Environment Configuration
     */
    async showPage(interaction: ButtonInteraction): Promise<void> {
        const config = configManager.get();
        
        // Status & Style Indicators
        const dlStatus = config.bot.enableDownloader ? '✅ ON' : '🔴 OFF';
        const dlStyle = config.bot.enableDownloader ? ButtonStyle.Success : ButtonStyle.Danger;
        
        // Indicator for current engine (BTCH vs TobyG74)
        const currentEngine = config.bot.downloaderEngine === 'btch' ? '🚀 BTCH' : '📦 TobyG74';
        const engineStyle = config.bot.downloaderEngine === 'btch' ? ButtonStyle.Primary : ButtonStyle.Secondary;

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Environment Configuration')
            .setColor(0x2b2d31)
            .setDescription('Manage Bot System Settings')
            .addFields(
                { name: 'Source Bots', value: `\`${config.bot.sourceBotIds.length} bots\``, inline: true },
                { name: 'DB Connections', value: `${config.database.minConnections}/${config.database.maxConnections}`, inline: true },
                { name: 'Auto Downloader', value: `**${dlStatus}**`, inline: true },
                { name: 'Active Engine', value: `**${currentEngine}**`, inline: true }
            );

        // Baris 1: Edit & Toggle Downloader
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('btn_edit_env').setLabel('Edit Config').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('btn_toggle_dl').setLabel(`Auto Download: ${config.bot.enableDownloader ? 'ON' : 'OFF'}`).setStyle(dlStyle).setEmoji('⬇️')
        );

        // Baris 2: Switch Engine & Back
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_switch_engine')
                .setLabel(`Engine: ${config.bot.downloaderEngine === 'btch' ? 'BTCH' : 'TobyG74'}`)
                .setStyle(engineStyle)
                .setEmoji('🔄'),
            new ButtonBuilder().setCustomId('nav_back_main').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
        );

        await interaction.update({ embeds: [embed], components: [row1, row2] });
    }

    /**
     * Menampilkan Modal Edit Config Manual
     */
    async showEditModal(interaction: ButtonInteraction): Promise<void> {
        const config = configManager.get();
        const modal = new ModalBuilder().setCustomId('modal_env_edit').setTitle('Edit Configuration');

        const inputs = [
            new TextInputBuilder().setCustomId('env_source_bots').setLabel("SOURCE_BOT_IDS").setValue(config.bot.sourceBotIds.join(',')).setStyle(TextInputStyle.Paragraph),
            new TextInputBuilder().setCustomId('env_fallback_channel').setLabel("FALLBACK_CHANNEL_ID").setValue(config.bot.fallbackChannelId).setStyle(TextInputStyle.Short),
            new TextInputBuilder().setCustomId('env_core_server').setLabel("CORE_SERVER_ID").setValue(config.discord.coreServerId).setStyle(TextInputStyle.Short),
            new TextInputBuilder().setCustomId('env_db_max').setLabel("DB_MAX").setValue(config.database.maxConnections.toString()).setStyle(TextInputStyle.Short),
            new TextInputBuilder().setCustomId('env_db_min').setLabel("DB_MIN").setValue(config.database.minConnections.toString()).setStyle(TextInputStyle.Short),
        ];

        // @ts-ignore - Ignore type mapping strictness for builder components array
        modal.addComponents(inputs.map(i => new ActionRowBuilder().addComponents(i)));
        await interaction.showModal(modal);
    }

    /**
     * Handle Submit Modal Config
     */
    async handleEditSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        const sourceBots = interaction.fields.getTextInputValue('env_source_bots');
        const fallbackChannel = interaction.fields.getTextInputValue('env_fallback_channel');
        const coreServer = interaction.fields.getTextInputValue('env_core_server');
        const dbMax = interaction.fields.getTextInputValue('env_db_max');
        const dbMin = interaction.fields.getTextInputValue('env_db_min');

        await this.systemConfigRepo.set('SOURCE_BOT_IDS', sourceBots);
        await this.systemConfigRepo.set('FALLBACK_CHANNEL_ID', fallbackChannel);
        await this.systemConfigRepo.set('CORE_SERVER_ID', coreServer);
        await this.systemConfigRepo.set('DB_MAX_CONNECTIONS', dbMax);
        await this.systemConfigRepo.set('DB_MIN_CONNECTIONS', dbMin);

        await this.onConfigReload();
        await this.backCallback(interaction); // Kembali ke menu utama setelah save
        await interaction.followUp({ content: '✅ Configuration saved & Hot Reloaded!', ephemeral: true });
    }

    /**
     * Toggle Auto Downloader ON/OFF
     */
    async toggleDownloader(interaction: ButtonInteraction): Promise<void> {
        const config = configManager.get();
        const newState = !config.bot.enableDownloader;
        
        await this.systemConfigRepo.set('TT_DL', newState ? 'true' : 'false');
        await this.onConfigReload(); // Hot reload config
        await this.showPage(interaction); // Refresh UI
    }

    /**
     * Switch Engine (BTCH <-> TobyG74)
     */
    async switchEngine(interaction: ButtonInteraction): Promise<void> {
        const config = configManager.get();
        const current = config.bot.downloaderEngine;
        // Logic toggle sederhana
        const newEngine = current === 'btch' ? 'tobyg74' : 'btch';

        // Simpan ke DB agar persist
        await this.systemConfigRepo.set('DOWNLOADER_ENGINE', newEngine);
        
        // Reload config di memory
        await this.onConfigReload();
        
        // Refresh tampilan tombol
        await this.showPage(interaction);
    }
}
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { AppConfig } from '../config/config';
import { logger } from '../logger';

export class CommandRegistrar {
  private rest: REST;

  constructor(private readonly config: AppConfig) {
    this.rest = new REST({ version: '10' }).setToken(config.discord.token);
  }

  /**
   * Register commands to Discord.
   * Uses PUT method to overwrite all old commands (Cleanup & Register).
   * @param commands List of SlashCommandBuilder to be registered
   */
  async register(commands: SlashCommandBuilder[] | any[]): Promise<void> {
    const commandsJson = commands.map((cmd) => cmd.toJSON());
    const clientId = this.config.discord.clientId;
    const guildId = this.config.discord.coreServerId; // Ini diambil dari CORE_SERVER_ID di .env

    try {
      logger.info(`🔒 Starting registration in Single Server Mode...`);

      if (!guildId) {
        throw new Error('CORE_SERVER_ID is missing in .env! Cannot register commands in Single Server Mode.');
      }

      // LANGKAH 1: Bersihkan Global Commands
      // Ini penting agar jika bot masuk ke server lain, tidak ada command yang muncul di sana.
      logger.info(`🧹 Clearing any existing Global Commands...`);
      await this.rest.put(
        Routes.applicationCommands(clientId),
        { body: [] } // Kirim array kosong untuk menghapus semua command global
      );

      // LANGKAH 2: Daftarkan ke Spesifik Server (Guild)
      // Update ini bersifat instan (tidak perlu menunggu 1 jam seperti Global).
      logger.info(`📝 Registering commands to Target Guild: ${guildId}`);
      await this.rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandsJson }
      );

      logger.info('✅ Commands successfully locked to the Core Server.');
      
    } catch (error) {
      logger.error('❌ Failed to register commands:', { error: (error as Error).message });
      throw error;
    }
  }
}

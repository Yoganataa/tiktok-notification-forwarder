import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export interface CommandContext {
    interaction: ChatInputCommandInteraction;
}

export abstract class BaseCommand {
    // Relaxed type definition to accept various Builder states
    abstract get definition(): SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
    abstract execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface DownloadResult {
  type: 'video' | 'image';
  buffer?: Buffer;
  buffers?: Buffer[];
  url?: string;
  urls: string[];
}

export abstract class BaseDownloadEngine {
  abstract get name(): string;
  abstract download(url: string): Promise<DownloadResult>;
}

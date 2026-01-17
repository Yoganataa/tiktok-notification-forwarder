
import {
    CacheType,
    ChatInputCommandInteraction,
    Interaction,
    ButtonInteraction,
    ModalSubmitInteraction,
    StringSelectMenuInteraction,
    RepliableInteraction
} from 'discord.js';
import { logger } from '../../infra/logger';
import { handleInteractionError } from '../../shared/utils/error-handler';

// Type definitions for handlers
type SlashCommandHandler = (interaction: ChatInputCommandInteraction<CacheType>) => Promise<void>;
type ComponentHandler = (interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction) => Promise<void>;

export class CommandDispatcher {
    private slashCommands: Map<string, SlashCommandHandler> = new Map();
    private componentHandlers: Map<string, ComponentHandler> = new Map();

    // Fallback/Wildcard handlers for components (legacy matching like startsWith)
    private wildcardComponentHandlers: Array<{
        prefix: string;
        handler: ComponentHandler;
    }> = [];

    /**
     * Registers a handler for a specific slash command name.
     */
    registerSlash(name: string, handler: SlashCommandHandler): void {
        this.slashCommands.set(name, handler);
        logger.debug(`Registered slash command handler: /${name}`);
    }

    /**
     * Registers a handler for exact component ID match.
     */
    registerComponent(customId: string, handler: ComponentHandler): void {
        this.componentHandlers.set(customId, handler);
    }

    /**
     * Registers a handler for components starting with a prefix.
     */
    registerComponentPrefix(prefix: string, handler: ComponentHandler): void {
        this.wildcardComponentHandlers.push({ prefix, handler });
        logger.debug(`Registered component prefix handler: ${prefix}*`);
    }

    /**
     * Main entry point for dispatching interactions.
     */
    async dispatch(interaction: Interaction): Promise<void> {
        try {
            if (interaction.isChatInputCommand()) {
                await this.handleSlash(interaction);
            } else if (
                interaction.isButton() ||
                interaction.isModalSubmit() ||
                interaction.isStringSelectMenu()
            ) {
                await this.handleComponent(interaction);
            }
        } catch (error) {
            // Last resort error handler if the specific handler didn't catch it
            logger.error('Dispatcher caught unhandled error', { error: (error as Error).message });
            if (interaction.isRepliable()) {
                 await handleInteractionError(interaction as RepliableInteraction, error as Error);
            }
        }
    }

    private async handleSlash(interaction: ChatInputCommandInteraction): Promise<void> {
        const handler = this.slashCommands.get(interaction.commandName);
        if (handler) {
            await handler(interaction);
        } else {
            logger.warn(`Unknown slash command received: ${interaction.commandName}`);
        }
    }

    private async handleComponent(
        interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction
    ): Promise<void> {
        const { customId } = interaction;

        // 1. Exact Match
        if (this.componentHandlers.has(customId)) {
            await this.componentHandlers.get(customId)!(interaction);
            return;
        }

        // 2. Prefix Match (Legacy support for "nav:...", "admin_...")
        for (const { prefix, handler } of this.wildcardComponentHandlers) {
            if (customId.startsWith(prefix)) {
                await handler(interaction);
                return;
            }
        }

        logger.debug(`Unhandled component interaction: ${customId}`);
    }
}

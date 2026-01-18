import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { EMBED_COLORS } from '../../constants';

export function createSuccessEmbed(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.SUCCESS as ColorResolvable)
        .setTitle(title);
    if (description) embed.setDescription(description);
    return embed;
}

export function createErrorEmbed(error: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(EMBED_COLORS.ERROR as ColorResolvable)
        .setTitle('❌ Error')
        .setDescription(error);
}

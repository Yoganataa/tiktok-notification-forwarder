import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Interaction, MessageComponentInteraction, RepliableInteraction } from 'discord.js';

export interface PaginatorOptions<T> {
    items: T[];
    itemsPerPage: number;
    renderPage: (items: T[], pageIndex: number, totalPages: number) => EmbedBuilder;
    filter?: (i: Interaction) => boolean;
    timeout?: number;
}

export class Paginator<T> {
    constructor(private options: PaginatorOptions<T>) {}

    async send(interaction: RepliableInteraction) {
        const { items, itemsPerPage, renderPage, filter, timeout } = this.options;
        const totalPages = Math.ceil(items.length / itemsPerPage);
        let currentPage = 0;

        const getPage = (page: number) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            return renderPage(items.slice(start, end), page + 1, totalPages);
        };

        const getButtons = (page: number) => {
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages - 1)
                );
            return [row];
        };

        const message = await interaction.editReply({
            embeds: [getPage(currentPage)],
            components: getButtons(currentPage)
        });

        const collector = message.createMessageComponentCollector({
            filter: filter || ((i) => i.user.id === interaction.user.id),
            time: timeout || 60000
        });

        collector.on('collect', async (i: MessageComponentInteraction) => {
            if (i.customId === 'prev') currentPage = Math.max(0, currentPage - 1);
            if (i.customId === 'next') currentPage = Math.min(totalPages - 1, currentPage + 1);

            await i.update({
                embeds: [getPage(currentPage)],
                components: getButtons(currentPage)
            });
        });

        collector.on('end', async () => {
            const disabledButtons = getButtons(currentPage)[0].components.map(b => ButtonBuilder.from(b).setDisabled(true));
            await message.edit({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButtons)] });
        });
    }
}

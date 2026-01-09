// src/commands/tiktok.command.ts
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder,
    AttachmentBuilder
} from 'discord.js';
import { TiktokDownloadService } from '../services/tiktok-download.service';
import { EMBED_COLORS } from '../constants';
import { logger } from '../utils/logger';
import { configManager } from '../core/config/config'; // Import configManager

const tiktokService = new TiktokDownloadService();

/**
 * Membuat Slash Command Builder secara dinamis berdasarkan ketersediaan Cookie.
 */
export function getTiktokCommand() {
    const config = configManager.get();
    const hasCookie = !!config.bot.tiktokCookie && config.bot.tiktokCookie.length > 0;

    const cmd = new SlashCommandBuilder()
        .setName('tiktok')
        .setDescription('TikTok Utility Tools')
        
        // 1. Download (Selalu ada, karena bisa pakai Engine yang tidak butuh cookie)
        .addSubcommand(sub =>
            sub.setName('dl')
               .setDescription('Download video/slide/music from URL')
               .addStringOption(opt => opt.setName('url').setDescription('TikTok URL').setRequired(true))
        );

    // Fitur Advanced (Hanya muncul jika Cookie ada)
    if (hasCookie) {
        cmd
        // 2. Stalk
        .addSubcommand(sub => 
            sub.setName('stalk')
               .setDescription('Stalk User Profile')
               .addStringOption(opt => opt.setName('username').setDescription('Username (no @)').setRequired(true))
        )
        // 3. Search
        .addSubcommand(sub => 
            sub.setName('search')
               .setDescription('Search TikTok')
               .addStringOption(opt => opt.setName('query').setDescription('Keyword').setRequired(true))
               .addStringOption(opt => 
                   opt.setName('type').setDescription('Type').setRequired(true)
                      .addChoices({ name: 'User', value: 'user' }, { name: 'Video', value: 'video' }, { name: 'Live', value: 'live' })
               )
        )
        // 4. Comments
        .addSubcommand(sub =>
            sub.setName('comments')
               .setDescription('Get Video Comments')
               .addStringOption(opt => opt.setName('url').setDescription('Video URL').setRequired(true))
        )
        // 5. User Feed (Posts/Reposts/Liked)
        .addSubcommand(sub =>
            sub.setName('feed')
               .setDescription('Get User Posts/Reposts/Liked')
               .addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true))
               .addStringOption(opt => 
                    opt.setName('type').setDescription('Type').setRequired(true)
                       .addChoices({ name: 'Posts', value: 'posts' }, { name: 'Reposts', value: 'reposts' }, { name: 'Liked', value: 'liked' })
               )
        )
        // 6. Collection/Playlist
        .addSubcommand(sub =>
            sub.setName('list')
               .setDescription('Get Collection or Playlist')
               .addStringOption(opt => opt.setName('url').setDescription('Collection/Playlist URL or ID').setRequired(true))
               .addStringOption(opt => 
                    opt.setName('type').setDescription('Type').setRequired(true)
                       .addChoices({ name: 'Collection', value: 'collection' }, { name: 'Playlist', value: 'playlist' })
               )
        )
        // 7. Trending
        .addSubcommand(sub =>
            sub.setName('trending')
               .setDescription('Get Trending Content/Creators')
               .addStringOption(opt => 
                    opt.setName('type').setDescription('Type').setRequired(true)
                       .addChoices({ name: 'Content', value: 'content' }, { name: 'Creators', value: 'creators' })
               )
        )
        // 8. Music
        .addSubcommand(sub =>
            sub.setName('music')
               .setDescription('Music Tools')
               .addStringOption(opt => opt.setName('url').setDescription('Music ID or URL').setRequired(true))
               .addStringOption(opt => 
                    opt.setName('action').setDescription('Action').setRequired(true)
                       .addChoices({ name: 'Detail', value: 'detail' }, { name: 'Get Videos', value: 'videos' })
               )
        );
    }

    return cmd;
}

export async function handleTiktokCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    
    // Safety Check: Jika user entah bagaimana mengakses command advanced tanpa cookie
    const config = configManager.get();
    const hasCookie = !!config.bot.tiktokCookie;
    
    if (subcommand !== 'dl' && !hasCookie) {
        await interaction.reply({ content: '❌ This command requires **TIKTOK_COOKIE** to be configured in settings.', ephemeral: true });
        return;
    }

    await interaction.deferReply();

    try {
        switch (subcommand) {
            case 'dl': await handleDownload(interaction); break;
            case 'stalk': await handleStalk(interaction); break;
            case 'search': await handleSearch(interaction); break;
            case 'comments': await handleComments(interaction); break;
            case 'feed': await handleFeed(interaction); break;
            case 'list': await handleList(interaction); break;
            case 'trending': await handleTrending(interaction); break;
            case 'music': await handleMusic(interaction); break;
        }
    } catch (error) {
        logger.error(`TikTok cmd error [${subcommand}]`, { error: (error as Error).message });
        await interaction.editReply({ content: `❌ Error: ${(error as Error).message}` });
    }
}

// --- Handlers ---

async function handleDownload(interaction: ChatInputCommandInteraction): Promise<void> {
    const url = interaction.options.getString('url', true);
    const media = await tiktokService.download(url);

    if (!media) {
        await interaction.editReply('❌ Failed to download content.');
        return;
    }

    const files = media.type === 'video' 
        ? [new AttachmentBuilder(media.urls[0], { name: 'video.mp4' })] 
        : media.urls.slice(0, 10).map((u, i) => new AttachmentBuilder(u, { name: `img_${i}.jpg` }));

    const embed = new EmbedBuilder().setColor(EMBED_COLORS.TIKTOK)
        .setTitle('📥 Download Success').setDescription(media.description || 'No Desc')
        .setAuthor({ name: media.author || 'Unknown' }).setFooter({ text: interaction.user.tag });

    try {
        await interaction.editReply({ content: `✅ Source: <${url}>`, embeds: [embed], files });
    } catch (e) {
        await interaction.editReply({ content: `⚠️ File too large.\nLink: ${media.urls[0]}`, embeds: [embed] });
    }
}

async function handleStalk(interaction: ChatInputCommandInteraction): Promise<void> {
    const username = interaction.options.getString('username', true);
    const data = await tiktokService.stalkUser(username);
    if (!data) {
        await interaction.editReply('❌ User not found.');
        return;
    }

    const embed = new EmbedBuilder().setColor(EMBED_COLORS.TIKTOK)
        .setTitle(`👤 @${data.username} (${data.nickname})`)
        .setThumbnail(data.avatar).setDescription(data.signature || 'No Bio')
        .addFields(
            { name: 'Followers', value: String(data.followers), inline: true },
            { name: 'Likes', value: String(data.likes), inline: true },
            { name: 'Videos', value: String(data.videoCount), inline: true }
        );
    await interaction.editReply({ embeds: [embed] });
}

async function handleSearch(interaction: ChatInputCommandInteraction): Promise<void> {
    const query = interaction.options.getString('query', true);
    const type = interaction.options.getString('type', true) as any;
    const results = await tiktokService.search(query, type);

    if (!results.length) {
        await interaction.editReply('❌ No results.');
        return;
    }

    const embed = new EmbedBuilder().setColor(EMBED_COLORS.TIKTOK)
        .setTitle(`🔍 Search: ${query} (${type})`);

    results.slice(0, 5).forEach((item: any, i) => {
        if (type === 'user') {
            embed.addFields({ name: `${i+1}. ${item.nickname}`, value: `@${item.username} | ${item.followerCount} Fans` });
        } else if (type === 'video') {
            embed.addFields({ name: `${i+1}. Video`, value: `By: ${item.author?.nickname}\nDesc: ${item.desc?.substring(0,50)}` });
        } else {
            embed.addFields({ name: `${i+1}. Live`, value: `Host: ${item.owner?.nickname}\nTitle: ${item.title}` });
        }
    });
    await interaction.editReply({ embeds: [embed] });
}

async function handleComments(interaction: ChatInputCommandInteraction): Promise<void> {
    const url = interaction.options.getString('url', true);
    const comments = await tiktokService.getVideoComments(url);
    if (!comments.length) {
        await interaction.editReply('❌ No comments found.');
        return;
    }

    const embed = new EmbedBuilder().setColor(EMBED_COLORS.INFO).setTitle('💬 Comments');
    comments.slice(0, 10).forEach((c: any) => {
        embed.addFields({ name: c.user?.nickname || 'Anon', value: c.text?.substring(0, 100) || '-' });
    });
    await interaction.editReply({ embeds: [embed] });
}

async function handleFeed(interaction: ChatInputCommandInteraction): Promise<void> {
    const username = interaction.options.getString('username', true);
    const type = interaction.options.getString('type', true);
    let data: any[] = [];

    if (type === 'posts') data = await tiktokService.getUserPosts(username);
    else if (type === 'reposts') data = await tiktokService.getUserReposts(username);
    else data = await tiktokService.getUserLiked(username);

    if (!data.length) {
        await interaction.editReply(`❌ No ${type} found (Private/Empty).`);
        return;
    }

    const embed = new EmbedBuilder().setColor(EMBED_COLORS.TIKTOK).setTitle(`📱 User ${type}: ${username}`);
    data.slice(0, 5).forEach((item: any, i) => {
        embed.addFields({ name: `${i+1}. ${item.desc?.substring(0,50) || 'No Desc'}`, value: `👁️ ${item.stats?.playCount || 0} | ❤️ ${item.stats?.likeCount || 0}` });
    });
    await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
    const url = interaction.options.getString('url', true);
    const type = interaction.options.getString('type', true);
    const data = type === 'collection' ? await tiktokService.getCollection(url) : await tiktokService.getPlaylist(url);

    if (!data.length) {
        await interaction.editReply('❌ Not found or empty.');
        return;
    }

    const embed = new EmbedBuilder().setColor(EMBED_COLORS.INFO).setTitle(`📂 ${type.toUpperCase()}`);
    data.slice(0, 5).forEach((item: any, i) => {
        embed.addFields({ name: `${i+1}. ${item.desc?.substring(0,50)}`, value: `ID: ${item.id}` });
    });
    await interaction.editReply({ embeds: [embed] });
}

async function handleTrending(interaction: ChatInputCommandInteraction): Promise<void> {
    const type = interaction.options.getString('type', true) as 'content' | 'creators';
    const data = await tiktokService.getTrending(type);

    if (!data.length) {
        await interaction.editReply('❌ Failed to fetch trending.');
        return;
    }

    const embed = new EmbedBuilder().setColor(EMBED_COLORS.TIKTOK).setTitle(`🔥 Trending ${type}`);
    data.slice(0, 5).forEach((item: any, i) => {
        if (type === 'content') {
            const card = item.cardItem;
            embed.addFields({ name: `${i+1}. ${card.title || 'Video'}`, value: `By: ${card.extraInfo?.userId}` });
        } else {
            embed.addFields({ name: `${i+1}. ${item.nickname}`, value: `@${item.username} | ${item.followerCount} Fans` });
        }
    });
    await interaction.editReply({ embeds: [embed] });
}

async function handleMusic(interaction: ChatInputCommandInteraction): Promise<void> {
    const url = interaction.options.getString('url', true);
    const action = interaction.options.getString('action', true);

    if (action === 'detail') {
        const data = await tiktokService.getMusicDetail(url);
        if (!data) {
            await interaction.editReply('❌ Music details not found.');
            return;
        }
        
        const info = data.musicInfo;
        const embed = new EmbedBuilder().setColor(EMBED_COLORS.SUCCESS)
            .setTitle(`🎵 ${info.music?.title}`)
            .setThumbnail(info.music?.coverMedium)
            .addFields(
                { name: 'Author', value: info.music?.authorName || '-', inline: true },
                { name: 'Duration', value: String(info.music?.duration), inline: true },
                { name: 'Used By', value: `${info.stats?.videoCount} videos`, inline: true }
            );
        await interaction.editReply({ embeds: [embed] });
    } else {
        const data = await tiktokService.getMusicVideos(url);
        if (!data || !data.videos) {
            await interaction.editReply('❌ No videos found for this music.');
            return;
        }

        const embed = new EmbedBuilder().setColor(EMBED_COLORS.SUCCESS).setTitle('🎵 Videos using this Sound');
        data.videos.slice(0, 5).forEach((v: any, i: number) => {
            embed.addFields({ name: `${i+1}. ${v.author?.nickname}`, value: v.desc?.substring(0,50) || 'Video' });
        });
        await interaction.editReply({ embeds: [embed] });
    }
}
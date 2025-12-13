// src/commands/menu.ts
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Guild,
  ButtonInteraction,
  UserSelectMenuInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction
} from 'discord.js';
import { prisma } from '../lib/prisma';
import { permission } from '../services/permission';
import { config, updateRuntimeConfig } from '../config';
import { ROLES, UserRole } from '../types';

export const menuCommand = new SlashCommandBuilder()
  .setName('menu')
  .setDescription('Open Admin Control Panel (Owner/Admin Only)');

// Alias for various interaction types
type MenuInteraction = 
  | ChatInputCommandInteraction 
  | ButtonInteraction 
  | AnySelectMenuInteraction 
  | ModalSubmitInteraction;

// Handler for the /menu command
export async function handleMenuCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!await permission.isAdminOrHigher(interaction.user.id)) {
    await interaction.reply({ 
      content: '⛔ Access Denied. This panel is restricted to Administrators.', 
      ephemeral: true 
    });
    return;
  }

  const response = await interaction.deferReply({ ephemeral: true });

  await showMainMenu(interaction);

  const collector = response.createMessageComponentCollector({ 
    time: 300000 // 5 menit timeout
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ content: '⛔ This is not your session.', ephemeral: true });
      return;
    }

    try {
      // Handle navigation and actions
      switch (i.customId) {
        case 'nav_home':
          await showMainMenu(i as any);
          break;
        case 'nav_env':
          await showEnvInfo(i as any);
          break;
        case 'nav_roles':
          await showRoleManager(i as any);
          break;
        case 'nav_servers':
          await showServerList(i as any);
          break;
        
        case 'act_edit_env':
          await showEnvModal(i as any); 
          break;

        case 'act_add_admin':
        case 'act_add_sudo':
        case 'act_remove_staff':
          await handleRoleUpdate(i as any); 
          break;
      }
    } catch (error) {
      console.error(error);
      if (!i.replied && !i.deferred) {
        await i.reply({ content: '❌ An error occurred.', ephemeral: true });
      }
    }
  });
}

// Main Menu View

async function showMainMenu(target: MenuInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🎛️ System Control Panel')
    .setColor(0x2B2D31)
    .setDescription(`Select a module to manage:`)
    .addFields(
      { name: '⚙️ Environment', value: 'Edit config values', inline: true },
      { name: '👥 Roles', value: 'Add/Remove Staff', inline: true },
      { name: '🖥️ Servers', value: 'View Guilds', inline: true }
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('nav_env').setLabel('Environment').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
    new ButtonBuilder().setCustomId('nav_roles').setLabel('Role Manager').setStyle(ButtonStyle.Primary).setEmoji('👥'),
    new ButtonBuilder().setCustomId('nav_servers').setLabel('Servers').setStyle(ButtonStyle.Success).setEmoji('🖥️')
  );

  if ((target as any).update) {
    await (target as any).update({ embeds: [embed], components: [row] });
  } else {
    await (target as ChatInputCommandInteraction).editReply({ embeds: [embed], components: [row] });
  }
}

// Environment Info View

async function showEnvInfo(i: any) {
  const sourceIdsString = config.sourceBotIds.length > 0 
    ? config.sourceBotIds.join(', ') 
    : '_None configured_';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ Environment Configuration')
    .setColor(0x5865F2)
    .setDescription('Current Runtime Configuration:')
    .addFields(
      { name: 'Log Level', value: `\`${config.logLevel}\``, inline: true },
      { name: 'Fallback Channel', value: `<#${config.fallbackChannelId}>`, inline: true },
      { name: 'Node Env', value: `\`${config.nodeEnv}\``, inline: true },
      { name: 'Source Bot IDs', value: `\`${sourceIdsString}\``, inline: false },
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('nav_home').setLabel('Back').setStyle(ButtonStyle.Danger).setEmoji('⬅️'),
    new ButtonBuilder().setCustomId('act_edit_env').setLabel('Edit Values').setStyle(ButtonStyle.Primary).setEmoji('📝')
  );

  if (i.update) {
    await i.update({ embeds: [embed], components: [row] });
  } else {
    await i.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
}

// Handle Environment Edit Modal
async function showEnvModal(i: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_env_edit')
    .setTitle('Edit Configuration');

  const inputLogLevel = new TextInputBuilder()
    .setCustomId('input_loglevel')
    .setLabel('Log Level (info/debug/warn/error)')
    .setStyle(TextInputStyle.Short)
    .setValue(config.logLevel)
    .setRequired(true);

  const inputChannel = new TextInputBuilder()
    .setCustomId('input_fallback')
    .setLabel('Fallback Channel ID')
    .setStyle(TextInputStyle.Short)
    .setValue(config.fallbackChannelId)
    .setRequired(true);

  // TextInput for Array of Source Bot IDs
  const inputSourceIds = new TextInputBuilder()
    .setCustomId('input_source_ids')
    .setLabel('Source Bot IDs (Split with comma)')
    .setPlaceholder('12345678, 87654321')
    .setStyle(TextInputStyle.Paragraph) 
    .setValue(config.sourceBotIds.join(', '))
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(inputLogLevel),
    new ActionRowBuilder<TextInputBuilder>().addComponents(inputChannel),
    new ActionRowBuilder<TextInputBuilder>().addComponents(inputSourceIds)
  );

  await i.showModal(modal);

  const filter = (submission: ModalSubmitInteraction) => submission.customId === 'modal_env_edit' && submission.user.id === i.user.id;
  
  try {
    const submission = await i.awaitModalSubmit({ filter, time: 60000 });
    
    const newLogLevel = submission.fields.getTextInputValue('input_loglevel');
    const newChannelId = submission.fields.getTextInputValue('input_fallback');
    const rawSourceIds = submission.fields.getTextInputValue('input_source_ids');

    // String to Array parsing
    const newSourceIds = rawSourceIds
      .split(',')
      .map(id => id.trim())
      .filter(id => /^\d+$/.test(id)); 

    updateRuntimeConfig('logLevel', newLogLevel);
    updateRuntimeConfig('fallbackChannelId', newChannelId);
    updateRuntimeConfig('sourceBotIds', newSourceIds); 

    await showEnvInfo(submission);

  } catch (err) {
    // Timeout
  }
}

async function showRoleManager(i: MenuInteraction) {
  const staff = await prisma.accessControl.findMany({ orderBy: { role: 'asc' }});
  
  const desc = staff.length > 0 
    ? staff.map(s => `• <@${s.userId}> : **${s.role}**`).join('\n')
    : '_No staff configured yet._';

  const embed = new EmbedBuilder()
    .setTitle('👥 Role Management')
    .setColor(0xFEE75C)
    .setDescription(desc)
    .addFields({ name: 'Instructions', value: 'Use the dropdowns below to manage staff.' });

  const selectAddAdmin = new UserSelectMenuBuilder()
    .setCustomId('act_add_admin')
    .setPlaceholder('➕ Select User to make ADMIN')
    .setMaxValues(1);

  const selectAddSudo = new UserSelectMenuBuilder()
    .setCustomId('act_add_sudo')
    .setPlaceholder('➕ Select User to make SUDO')
    .setMaxValues(1);

  const removeOptions = staff.map(s => ({
    label: `Remove ${s.role}: ${s.userId}`, 
    value: s.userId,
    description: `Remove access from this user`
  }));

  const rows: any[] = [];

  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('nav_home').setLabel('Back').setStyle(ButtonStyle.Danger).setEmoji('⬅️')
  ));

  rows.push(new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectAddAdmin));
  rows.push(new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectAddSudo));

  if (removeOptions.length > 0) {
    const slicedOptions = removeOptions.slice(0, 25); 
    const selectRemove = new StringSelectMenuBuilder()
      .setCustomId('act_remove_staff')
      .setPlaceholder('🗑️ Select User to REMOVE')
      .addOptions(slicedOptions);
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectRemove));
  }

  if ((i as any).update) {
    await (i as any).update({ embeds: [embed], components: rows });
  }
}

async function handleRoleUpdate(i: UserSelectMenuInteraction | StringSelectMenuInteraction) {
  const action = i.customId;
  let targetUserId = '';
  let roleToSet: UserRole | null = null;
  let message = '';

  if (action === 'act_add_admin' || action === 'act_add_sudo') {
    // @ts-ignore
    targetUserId = i.values[0];
    roleToSet = action === 'act_add_admin' ? ROLES.ADMIN : ROLES.SUDO;
    
    await prisma.accessControl.upsert({
      where: { userId: targetUserId },
      update: { role: roleToSet },
      create: { userId: targetUserId, role: roleToSet, addedBy: i.user.id }
    });
    message = `✅ Updated <@${targetUserId}> to **${roleToSet}**`;

  } else if (action === 'act_remove_staff') {
    // @ts-ignore
    targetUserId = i.values[0];
    
    await prisma.accessControl.delete({ where: { userId: targetUserId } }).catch(() => null);
    message = `🗑️ Removed access for <@${targetUserId}>`;
  }

  await i.followUp({ content: message, ephemeral: true });

  if (i.message) {
      const fakeInteraction = {
          update: async (payload: any) => await (i.message as any).edit(payload),
          user: i.user,
          client: i.client
      };
      await showRoleManager(fakeInteraction as any);
  }
}

// Server List View

async function showServerList(i: MenuInteraction) {
  const client = i.client;
  const guilds = client.guilds.cache.map((g: Guild) => `• **${g.name}** \`${g.id}\` (${g.memberCount} members)`).join('\n');
  
  const embed = new EmbedBuilder()
    .setTitle('🖥️ Active Servers')
    .setColor(0x57F287)
    .setDescription(guilds || 'No servers found.')
    .setFooter({ text: `Total: ${client.guilds.cache.size} Servers` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('nav_home').setLabel('Back').setStyle(ButtonStyle.Danger).setEmoji('⬅️')
  );

  if ((i as any).update) {
    await (i as any).update({ embeds: [embed], components: [row] });
  }
}
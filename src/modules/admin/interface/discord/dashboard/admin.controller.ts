
import { 
  ChatInputCommandInteraction, 
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { PermissionService } from '../../../application/admin.service';
import { ManageSystemConfigUseCase } from '../../../application/usecases/manage-system-config.usecase';
import { MappingHandler } from './handlers/mapping.handler';
import { EnvironmentHandler } from './handlers/environment.handler';
import { RoleHandler } from './handlers/role.handler';
import { ServerHandler } from './handlers/server.handler';

// Adapters dependencies for handlers
import { AddMappingUseCase } from '../../../../forwarder/application/usecases/add-mapping.usecase';
import { RemoveMappingUseCase } from '../../../../forwarder/application/usecases/remove-mapping.usecase';
import { ListMappingsUseCase } from '../../../../forwarder/application/usecases/list-mappings.usecase';
import { DiscordClientWrapper } from '../../../../../interfaces/discord/client';

export class AdminController {
  private mappingHandler: MappingHandler;
  private envHandler: EnvironmentHandler;
  private roleHandler: RoleHandler;
  private serverHandler: ServerHandler;

  constructor(
    private readonly permissionService: PermissionService,
    configUseCase: ManageSystemConfigUseCase,
    // Mapping Use Cases
    addMapping: AddMappingUseCase,
    removeMapping: RemoveMappingUseCase,
    listMappings: ListMappingsUseCase,
    // Other Deps
    clientWrapper: DiscordClientWrapper
  ) {
    this.mappingHandler = new MappingHandler(addMapping, removeMapping, listMappings);
    this.envHandler = new EnvironmentHandler(configUseCase);
    this.roleHandler = new RoleHandler(permissionService);
    this.serverHandler = new ServerHandler(clientWrapper);
  }

  async handle(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
    // 1. Security Guard
    const userId = interaction.user.id;
    if (!(await this.permissionService.isAdminOrHigher(userId))) {
      const reply = { content: '⛔ **Access Denied**\nThis panel is restricted to Administrators.', ephemeral: true };
      if (interaction.isButton()) {
          // If a non-admin somehow clicked a button (unlikely due to ephemeral, but good practice)
          await interaction.reply(reply);
      } else {
          await interaction.reply(reply);
      }
      return;
    }

    // 2. Routing
    // 2. Routing
    // Format: ACTION:MODULE:SUBJECT:DATA
    // Defaults: nav:main:menu:0
    const customId = (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu())
        ? interaction.customId 
        : 'nav:main:menu:0';

    const parts = customId.split(':');
    // Handle legacy or simple IDs by mapping them if necessary, or just rely on new format.
    // Map legacy 'nav_mappings' -> 'nav:map:list:0'
    let [action, module, subject, data] = parts;

    // Backward compatibility / Command defaults
    if (customId === 'nav_mappings') { [action, module, subject, data] = ['nav', 'map', 'list', '0']; }
    if (customId === 'nav_env')      { [action, module, subject, data] = ['nav', 'env', 'home', '0']; }
    if (customId === 'nav_roles')    { [action, module, subject, data] = ['nav', 'role', 'list', '0']; }
    if (customId === 'nav_servers')  { [action, module, subject, data] = ['nav', 'server', 'list', '0']; }
    if (customId === 'nav_main')     { [action, module, subject, data] = ['nav', 'main', 'menu', '0']; }
    if (customId === 'toggle_autodl'){ [action, module, subject, data] = ['btn', 'env', 'toggle', 'autodl']; }

    switch (module) {
        case 'map':
            await this.mappingHandler.handle(interaction, action, subject, data);
            break;
        case 'env':
            await this.envHandler.handle(interaction, action, subject, data);
            break;
        case 'role':
            await this.roleHandler.handle(interaction, action, subject, data);
            break;
        case 'server':
            await this.serverHandler.handle(interaction, action, subject, data);
            break;
        case 'main':
        default:
            await this.showMainMenu(interaction);
            break;
    }
  }

  private async showMainMenu(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎛️ System Control Panel')
      .setDescription('Select a module to manage.')
      .setColor('#2c3e50') // Dark Blue
      .addFields(
        { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Session', value: 'Active', inline: true }
      );

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Mappings')
          .setEmoji('🗺️')
          .setCustomId('nav:map:list:0')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setLabel('Environment')
          .setEmoji('⚙️')
          .setCustomId('nav:env:home:0')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setLabel('Roles')
          .setEmoji('👥')
          .setCustomId('nav:role:list:0')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setLabel('Servers')
          .setEmoji('🖥️')
          .setCustomId('nav:server:list:0')
          .setStyle(ButtonStyle.Secondary)
      );

    if (interaction.isButton()) {
        await interaction.update({ embeds: [embed], components: [row] });
    } else {
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
  }
}

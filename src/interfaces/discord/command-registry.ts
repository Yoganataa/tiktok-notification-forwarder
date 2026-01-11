import { adminCommand } from '../../modules/admin/interface/admin.discord.adapter';
import { getTiktokCommand } from '../../modules/tiktok/interface/tiktok.discord.adapter';
import { mappingCommand } from '../../modules/forwarder/interface/forwarder.discord.adapter';
import { menuCommand } from '../../modules/admin/interface/discord/commands/menu.command';

export function getCommandList() {
    return [
        mappingCommand, 
        adminCommand,
        menuCommand,
        getTiktokCommand() 
    ];
}
import { container } from '@sapphire/framework';

export class TelegramClientWrapper {
    async login() {
       // Ideally we should wait for services to be initialized in container first
       if (container.services?.telegram) {
           await container.services.telegram.init();
       } else {
           console.error('Telegram Service not found in container');
       }
    }
}

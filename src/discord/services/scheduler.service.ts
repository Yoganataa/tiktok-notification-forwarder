import { Client, TextChannel } from 'discord.js';
import { logger } from '../../core/utils/logger';
import { configManager } from '../../core/config/config';

export class SchedulerService {
    private client: Client | null = null;
    private hasWarned60 = false;
    private hasWarned70 = false;

    init(client: Client) {
        this.client = client;
        this.startLifecycleMonitor();
        logger.info('SchedulerService initialized.');
    }

    private startLifecycleMonitor() {
        // Run every 1 hour (3600000 ms)
        setInterval(() => this.checkLifecycle(), 3600000);
        // Initial check
        this.checkLifecycle();
    }

    private async checkLifecycle() {
        const config = configManager.get();
        if (!config.bot.jrmaRenewReminder || !this.client) return;

        const uptimeSeconds = process.uptime();
        const uptimeHours = uptimeSeconds / 3600;

        // 70 Hours (2 hours left for 72h limit)
        if (uptimeHours > 70 && !this.hasWarned70) {
            await this.sendOwnerAlert(
                `🚨 **Red Alert: JRMA Container Lifecycle Critical**\n` +
                `Uptime: ${uptimeHours.toFixed(1)} hours.\n` +
                `The container will sleep/kill in < 2 hours. Please renew immediately!`
            );
            this.hasWarned70 = true;
        }
        // 60 Hours (12 hours left)
        else if (uptimeHours > 60 && !this.hasWarned60) {
            await this.sendOwnerAlert(
                `⚠️ **Warning: JRMA Container Lifecycle**\n` +
                `Uptime: ${uptimeHours.toFixed(1)} hours.\n` +
                `The container will sleep in ~12 hours. Consider renewing soon.`
            );
            this.hasWarned60 = true;
        }
    }

    private async sendOwnerAlert(message: string) {
        try {
            const config = configManager.get();
            const ownerId = config.discord.ownerId;
            const owner = await this.client!.users.fetch(ownerId);

            if (owner) {
                await owner.send(message);
                logger.info(`Scheduler: Sent lifecycle alert to owner (${ownerId}).`);
            } else {
                logger.warn(`Scheduler: Could not fetch owner (${ownerId}) to send alert.`);
            }
        } catch (error) {
            logger.error('Scheduler: Failed to send lifecycle alert', error);
        }
    }
}

import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalSubmitInteraction,
    ButtonInteraction,
    ChatInputCommandInteraction,
    MessageFlags
} from 'discord.js';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { computeCheck } from 'telegram/Password';
import { saveTelegramSession } from '../../../core/utils/telegram-session.store';
import { SystemConfigRepository } from '../../../core/repositories/system-config.repository';
import { logger } from '../../../core/utils/logger';

interface LoginContext {
    client: TelegramClient;
    apiId: number;
    apiHash: string;
    phone: string;
    phoneCodeHash?: string;
    timeout: NodeJS.Timeout;
}

export class TelegramLoginController {
    private loginSessions: Map<string, LoginContext> = new Map();

    constructor(private systemConfigRepo: SystemConfigRepository) {}

    async startLogin(interaction: ChatInputCommandInteraction): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId('tg_login_step1')
            .setTitle('Telegram Login (Step 1/3)');

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('api_id')
                    .setLabel('Telegram API ID')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('api_hash')
                    .setLabel('Telegram API Hash')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('phone_number')
                    .setLabel('Phone Number (+123456789)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );

        await interaction.showModal(modal);
    }

    async handlePhoneSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const userId = interaction.user.id;
        const apiId = parseInt(interaction.fields.getTextInputValue('api_id'));
        const apiHash = interaction.fields.getTextInputValue('api_hash');
        const phone = interaction.fields.getTextInputValue('phone_number');

        if (isNaN(apiId)) {
            await interaction.editReply('❌ Invalid API ID.');
            return;
        }

        try {
            const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
                connectionRetries: 5
            });

            await client.connect();

            const result = await client.invoke(
                new Api.auth.SendCode({
                    phoneNumber: phone,
                    apiId,
                    apiHash,
                    settings: new Api.CodeSettings({})
                })
            );

            const phoneCodeHash = (result as any).phoneCodeHash;

            if (!phoneCodeHash) {
                throw new Error('Telegram did not return phoneCodeHash.');
            }

            const timeout = setTimeout(() => {
                void this.cleanupSession(userId);
            }, 120_000);

            this.loginSessions.set(userId, {
                client,
                apiId,
                apiHash,
                phone,
                phoneCodeHash,
                timeout
            });

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('tg_btn_enter_otp')
                    .setLabel('Enter OTP')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.editReply({
                content: `✅ Code sent to ${phone}`,
                components: [row]
            });

        } catch (error) {
            logger.error('Send code failed', error);
            await interaction.editReply(`❌ ${(error as Error).message}`);
        }
    }

    async showOtpModal(interaction: ButtonInteraction): Promise<void> {
        if (!this.loginSessions.has(interaction.user.id)) {
            await interaction.reply({
                content: '❌ Session expired.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId('tg_login_step2')
            .setTitle('Enter OTP');

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('otp_code')
                    .setLabel('OTP Code')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('2fa_password')
                    .setLabel('2FA Password (optional)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            )
        );

        await interaction.showModal(modal);
    }

    async handleOtpSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const session = this.loginSessions.get(interaction.user.id);
        if (!session) {
            await interaction.editReply('❌ Session expired.');
            return;
        }

        const otp = interaction.fields.getTextInputValue('otp_code');
        const password = interaction.fields.getTextInputValue('2fa_password');

        try {
            await session.client.invoke(
                new Api.auth.SignIn({
                    phoneNumber: session.phone,
                    phoneCodeHash: session.phoneCodeHash!,
                    phoneCode: otp
                })
            );

        } catch (err) {
            const msg = (err as Error).message;

            if (msg.includes('SESSION_PASSWORD_NEEDED')) {
                if (!password) {
                    await interaction.editReply('❌ 2FA password required.');
                    return;
                }

                const pw = await session.client.invoke(new Api.account.GetPassword());
                const check = await computeCheck(pw, password);

                await session.client.invoke(
                    new Api.auth.CheckPassword({ password: check })
                );
            } else {
                throw err;
            }
        }

        await this.finalizeLogin(interaction, session);
    }

    private async finalizeLogin(
        interaction: ModalSubmitInteraction,
        session: LoginContext
    ): Promise<void> {
        const sessionString = session.client.session.save() as unknown as string;

        await saveTelegramSession(sessionString);

        await this.systemConfigRepo.set('TELEGRAM_API_ID', session.apiId.toString());
        await this.systemConfigRepo.set('TELEGRAM_API_HASH', session.apiHash);

        logger.info(`Telegram login success for ${interaction.user.id}`);

        await interaction.editReply('🎉 Login successful. Session saved to server file.');

        void this.cleanupSession(interaction.user.id);
    }

    private async cleanupSession(userId: string): Promise<void> {
        const session = this.loginSessions.get(userId);
        if (!session) return;

        clearTimeout(session.timeout);
        await session.client.disconnect();
        this.loginSessions.delete(userId);
    }
}

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
    RepliableInteraction
} from 'discord.js';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { SystemConfigRepository } from '../../../core/repositories/system-config.repository';
import { logger } from '../../../core/utils/logger';
import { RPCError } from 'telegram/errors';

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

    // Step 1: Start Login
    async startLogin(interaction: ChatInputCommandInteraction): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId('tg_login_step1')
            .setTitle('Telegram Login (Step 1/3)');

        const apiIdInput = new TextInputBuilder()
            .setCustomId('api_id')
            .setLabel('Telegram API ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const apiHashInput = new TextInputBuilder()
            .setCustomId('api_hash')
            .setLabel('Telegram API Hash')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const phoneInput = new TextInputBuilder()
            .setCustomId('phone_number')
            .setLabel('Phone Number (e.g. +1234567890)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(apiIdInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(apiHashInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(phoneInput)
        );

        await interaction.showModal(modal);
    }

    // Step 2: Handle Phone -> Send Code
    async handlePhoneSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const apiIdStr = interaction.fields.getTextInputValue('api_id');
        const apiHash = interaction.fields.getTextInputValue('api_hash');
        const phone = interaction.fields.getTextInputValue('phone_number');

        const apiId = parseInt(apiIdStr);
        if (isNaN(apiId)) {
            await interaction.editReply('❌ Invalid API ID. It must be a number.');
            return;
        }

        try {
            const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
                connectionRetries: 5
            });

            await client.connect();

            // Use invoke directly for robustness
            const result = await client.invoke(
                new Api.auth.SendCode({
                    phoneNumber: phone,
                    apiId: apiId,
                    apiHash: apiHash,
                    settings: new Api.CodeSettings({
                        allowFlashcall: false,
                        currentNumber: true,
                        allowAppHash: false
                    })
                })
            );

            // Access phoneCodeHash safely
            const phoneCodeHash = (result as any).phoneCodeHash;

            if (!phoneCodeHash) {
                throw new Error('Failed to retrieve phoneCodeHash from Telegram.');
            }

            const timeout = setTimeout(() => {
                this.cleanupSession(userId);
            }, 120 * 1000);

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
                    .setLabel('Enter OTP Code')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔑')
            );

            await interaction.editReply({
                content: `✅ Code sent to ${phone}!\nPlease check your Telegram app and click below to enter the code.`,
                components: [row]
            });

        } catch (error) {
            logger.error('Telegram Login Error (Send Code)', error);
            await interaction.editReply(`❌ Failed to send code: ${(error as Error).message}`);
        }
    }

    // Step 3: Show OTP Modal
    async showOtpModal(interaction: ButtonInteraction): Promise<void> {
        const userId = interaction.user.id;
        if (!this.loginSessions.has(userId)) {
            await interaction.reply({ content: '❌ Session expired. Please start over.', ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId('tg_login_step2')
            .setTitle('Enter OTP Code');

        const otpInput = new TextInputBuilder()
            .setCustomId('otp_code')
            .setLabel('OTP Code')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('12345')
            .setRequired(true);

        const passwordInput = new TextInputBuilder()
            .setCustomId('2fa_password')
            .setLabel('2FA Password (If enabled)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(otpInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(passwordInput)
        );

        await interaction.showModal(modal);
    }

    // Step 4: Handle OTP/Password -> Login
    async handleOtpSubmit(interaction: ModalSubmitInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const session = this.loginSessions.get(userId);

        if (!session || !session.phoneCodeHash) {
            await interaction.editReply('❌ Session expired or invalid. Please start over.');
            return;
        }

        const phoneCode = interaction.fields.getTextInputValue('otp_code');
        const password = interaction.fields.getTextInputValue('2fa_password');

        try {
            // Attempt Sign In
            await session.client.invoke(
                new Api.auth.SignIn({
                    phoneNumber: session.phone,
                    phoneCodeHash: session.phoneCodeHash,
                    phoneCode: phoneCode
                })
            );

            await this.finalizeLogin(interaction, session);

        } catch (error) {
            // Check for 2FA error string if class is missing
            const errorMessage = (error as Error).message || '';
            const is2FA = errorMessage.includes('SESSION_PASSWORD_NEEDED'); // Standard error code check

            if (is2FA) {
                if (password) {
                    try {
                        // FIX: Use checkPassword instead of signIn for SRP handling
                        // Cast to any to bypass type issues with the installed version
                        await (session.client as any).checkPassword(password);
                        await this.finalizeLogin(interaction, session);
                    } catch (pwError) {
                        logger.error('Telegram Login Error (2FA)', pwError);
                        await interaction.editReply(`❌ Login failed (Invalid Password?): ${(pwError as Error).message}`);
                    }
                } else {
                    await interaction.editReply('⚠️ 2FA Password is required (SESSION_PASSWORD_NEEDED) but was not provided. Please try again.');
                }
            } else {
                logger.error('Telegram Login Error (Sign In)', error);
                await interaction.editReply(`❌ Login failed: ${(error as Error).message}`);
            }
        }
    }

    private async finalizeLogin(interaction: ModalSubmitInteraction, session: LoginContext): Promise<void> {
        try {
            // Save Session
            const sessionString = session.client.session.save() as unknown as string;

            await this.systemConfigRepo.set('TELEGRAM_API_ID', session.apiId.toString());
            await this.systemConfigRepo.set('TELEGRAM_API_HASH', session.apiHash);
            await this.systemConfigRepo.set('TELEGRAM_SESSION', sessionString);

            logger.info(`Telegram login successful for user ${interaction.user.id}`);

            await interaction.editReply('🎉 **Login Successful!**\nConfiguration has been saved to the database.\n\n⚠️ **IMPORTANT:** Please restart the bot to apply changes.');

            this.cleanupSession(interaction.user.id);

        } catch (error) {
            logger.error('Telegram Login Error (Finalize)', error);
            await interaction.editReply('❌ Login succeeded but failed to save configuration.');
        }
    }

    private async cleanupSession(userId: string) {
        const session = this.loginSessions.get(userId);
        if (session) {
            clearTimeout(session.timeout);
            try {
                await session.client.disconnect();
            } catch (e) { /* ignore */ }
            this.loginSessions.delete(userId);
        }
    }
}

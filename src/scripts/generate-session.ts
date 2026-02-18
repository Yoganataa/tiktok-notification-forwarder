import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import input from 'input'; // Package to handle user input

(async () => {
    console.log('🔵 Telegram String Session Generator');
    console.log('------------------------------------');

    const apiId = await input.text('Enter your API ID: ');
    const apiHash = await input.text('Enter your API Hash: ');
    const phoneNumber = await input.text('Enter your Phone Number (e.g., +1234567890): ');

    const client = new TelegramClient(
        new StringSession(""),
        parseInt(apiId),
        apiHash,
        { connectionRetries: 5 }
    );

    await client.start({
        phoneNumber: async () => phoneNumber,
        password: async () => await input.text('Enter your Password (2FA) if enabled (leave empty if not): '),
        phoneCode: async () => await input.text('Enter the Code you received: '),
        onError: (err) => console.log(err),
    });

    console.log('\n✅ Session Generated Successfully!');
    console.log('------------------------------------');
    console.log('Copy the string below into your .env file as TELEGRAM_SESSION:');
    console.log('------------------------------------');
    console.log(client.session.save());
    console.log('------------------------------------');
    console.log('⚠️  Keep this session string SAFE. It grants full access to your account.');

    process.exit(0);
})();

// src/index.ts
import { 
  Client, 
  GatewayIntentBits, 
  Events,
  REST,
  Routes,
  ActivityType
} from 'discord.js';
import { prisma } from './lib/prisma';
import { config} from './config';
import { logger } from './utils/logger';
import { forwarder } from './services/forwarder';
import { commandList } from './commands';
import {handleMappingCommand } from './commands/mapping';
import { handleMenuCommand } from './commands/menu';
import { handleAdminCommand } from './commands/admin';

/**
 * Discord client with required intents
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  presence: {
    activities: [{
      name: 'TikTok notifications',
      type: ActivityType.Watching
    }],
    status: 'online'
  }
});

/**
  * Registers slash commands with Discord API
  * Handles both global and guild-specific commands
  * Global commands are registered for all servers
  * Guild commands are cleared from the core server to avoid conflicts
  * Logs success and error information
  * @return Promise that resolves when registration is complete
 */

async function registerCommands(): Promise<void> {
  try {
    const rest = new REST({ version: '10' }).setToken(config.discordToken);
    
    const commandsBody = commandList.map(cmd => cmd.toJSON());

    logger.info('🔄 Memulai sinkronisasi command...');

    await rest.put(
      Routes.applicationCommands(config.clientId), 
      { body: commandsBody }
    );
    logger.info(`✅ Global commands (${commandsBody.length}) berhasil didaftarkan.`);

    if (config.coreServerId) {
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.coreServerId),
        { body: [] } 
      );
      logger.info('🧹 Guild commands (sisa lama) berhasil dibersihkan dari Core Server.');
    }

  } catch (error) {
    logger.error('Gagal meregistrasi command', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Logs information about all servers the bot is in
 */
async function logServerInfo(): Promise<void> {
  try {
    const coreServer = await client.guilds.fetch(config.coreServerId).catch(() => null);
    
    if (coreServer) {
      logger.info('Core server found', {
        id: coreServer.id,
        name: coreServer.name,
        memberCount: coreServer.memberCount
      });
    } else {
      logger.warn('Core server not found', {
        coreServerId: config.coreServerId,
        message: 'Bot may not be in the core server yet'
      });
    }

    const guilds = await client.guilds.fetch();
    logger.info('Active servers', {
      totalServers: guilds.size
    });

    for (const [id, guild] of guilds) {
      const fullGuild = await guild.fetch();
      const isCoreServer = id === config.coreServerId;
      
      logger.info('Server details', {
        id: fullGuild.id,
        name: fullGuild.name,
        memberCount: fullGuild.memberCount,
        isCoreServer
      });
    }
  } catch (error) {
    logger.error('Failed to fetch server information', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Initializes database connection
 */
async function initializeDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    
    // Test connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      databaseUrl: config.databaseUrl
    });
    throw error;
  }
}

/**
 * Client ready event - triggers once when bot is authenticated
 */
client.once(Events.ClientReady, async (readyClient) => {
  logger.info('Bot authenticated', {
    username: readyClient.user.tag,
    id: readyClient.user.id,
    environment: config.nodeEnv
  });

  logger.info('Configuration loaded', {
    sourceBotId: config.sourceBotIds.join(', '),
    coreServerId: config.coreServerId,
    fallbackChannelId: config.fallbackChannelId,
    logLevel: config.logLevel
  });

  try {
    await initializeDatabase();
    await registerCommands();
    await logServerInfo();
    
    logger.info('Bot initialization complete');
  } catch (error) {
    logger.error('Initialization failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
});

/**
 * Message creation event - processes all new messages
 */
client.on(Events.MessageCreate, async (message) => {
  // Ignore messages from self
  if (message.author.id === client.user?.id) {
    return;
  }

  try {
    await forwarder.processMessage(message);
  } catch (error) {
    logger.error('Error processing message', {
      messageId: message.id,
      channelId: message.channel.id,
      guildId: message.guildId,
      authorId: message.author.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

/**
 * Interaction creation event - handles slash commands
 */
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'mapping') {
      await handleMappingCommand(interaction);
    }
    else if (interaction.commandName === 'menu') {
      await handleMenuCommand(interaction);
    }
    else if (interaction.commandName === 'admin') {
      await handleAdminCommand(interaction);
    }
  } catch (error) {
    logger.error('Error handling interaction', {
      commandName: interaction.commandName,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

/**
 * Discord client error event
 */
client.on(Events.Error, (error) => {
  logger.error('Discord client error', {
    error: error.message,
    stack: error.stack,
    name: error.name
  });
});

/**
 * Discord client warning event
 */
client.on(Events.Warn, (warning) => {
  logger.warn('Discord client warning', {
    warning
  });
});

/**
 * Handles unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: String(promise)
  });
});

/**
 * Handles uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
    name: error.name
  });
  
  // Exit process on uncaught exception
  shutdown(1);
});

/**
 * Gracefully shuts down the application
 * 
 * @param exitCode - Exit code (0 for success, 1 for error)
 */
async function shutdown(exitCode = 0): Promise<void> {
  logger.info('Initiating graceful shutdown', {
    exitCode,
    reason: exitCode === 0 ? 'Normal termination' : 'Error termination'
  });
  
  try {
    // Disconnect from database
    await prisma.$disconnect();
    logger.info('Database disconnected');

    // Destroy Discord client
    client.destroy();
    logger.info('Discord client destroyed');

    logger.info('Shutdown complete');
    process.exit(exitCode);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
}

/**
 * Handle graceful shutdown signals
 */
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal');
  shutdown(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal');
  shutdown(0);
});

/**
 * Start the bot
 */
(async () => {
  try {
    logger.info('Starting TikTok Notification Forwarder Bot');
    await client.login(config.discordToken);
  } catch (error) {
    logger.error('Failed to login', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
})();
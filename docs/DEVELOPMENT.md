# Developer Guide

## Architecture

This project uses the **Sapphire Framework** for Discord bot functionality, integrated with a custom feature-based architecture.

### Key Components

1.  **Commands**: Located in `src/commands/`. All commands must extend Sapphire's `Command` or `Subcommand` class.
    *   **Registration**: Commands are registered to the `CORE_SERVER_ID` by default using `{ guildIds: [...] }` in `registerApplicationCommands`.
    *   **Preconditions**: Use decorators like `@ApplyOptions` with `preconditions: ['AdminOnly']` to enforce permissions.

2.  **Services**: Located in `src/features/`. These contain the business logic.
    *   `DownloaderService`: Handles media downloading using various engines (Vette, Hans, YtDlp).
    *   `ForwarderService`: Analyzes messages and forwards content.
    *   `QueueService`: Manages reliable delivery via database queue.

3.  **Repositories**: Located in `src/core/repositories/`. Handle all database interactions (PostgreSQL/SQLite).

4.  **Dependency Injection**: Managed via Sapphire's `container`.
    *   Access services via `container.services.serviceName`.
    *   Access repositories via `container.repos.repoName`.

### Adding a New Command

1.  Create a file in `src/commands/<category>/<command>.ts`.
2.  Extend `Command` or `Subcommand`.
3.  Implement `registerApplicationCommands` and `chatInputRun`.
4.  Ensure `guildIds` is set if it's a core-only command.

```typescript
import { Command } from '@sapphire/framework';

export class MyCommand extends Command {
    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder.setName('mycommand').setDescription('My awesome command')
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        return interaction.reply('Hello!');
    }
}
```

### Adding a New Download Engine

1.  Create the engine in `src/features/downloader/engines/`.
2.  Implement the `DownloadEngine` interface.
3.  Register it in `DownloaderService.init()` using `this.registerEngine()`.

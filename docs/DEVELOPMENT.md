# Developer Guide

This project utilizes a **Dynamic Module Loader** architecture to ensure scalability and ease of extension. Commands and Download Engines are automatically discovered and registered at runtime, eliminating the need for manual registry updates.

## 🏗 Architecture Overview

*   **Module Loader**: A core service (`src/core/services/module-loader.service.ts`) scans the filesystem for files matching specific patterns (`*.command.ts`, `*.engine.ts`).
*   **Contracts**: Base classes (`BaseCommand`, `BaseDownloadEngine`) defined in `src/core/contracts/module.contract.ts` ensure type safety and consistent behavior.
*   **Auto-Discovery**:
    *   Commands are scanned from `src/features/**/*.command.ts`.
    *   Engines are scanned from `src/features/downloader/engines/**/*.engine.ts`.

---

## ➕ Adding a New Command

To add a new Slash Command, you simply need to create a new file. No other file modifications are required.

### Steps

1.  Create a new file in `src/features/<feature-name>/<command-name>.command.ts`.
2.  Extend the `BaseCommand` abstract class.
3.  Implement the required methods (`definition`, `execute`).
4.  **Export the class as default**.

### Template

```typescript
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { BaseCommand } from '../../core/contracts/module.contract';

export default class PingCommand extends BaseCommand {
    // 1. Define the Slash Command structure
    get definition() {
        return new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Replies with Pong!');
    }

    // 2. Implement the execution logic
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.reply({ content: 'Pong! 🏓', ephemeral: true });
    }
}
```

Once saved (and built), the bot will automatically register `/ping` on the next restart.

---

## ⬇️ Adding a New Download Engine

To add support for a new downloader (or a different strategy), create a new engine module.

### Steps

1.  Create a new file in `src/features/downloader/engines/<engine-name>.engine.ts`.
2.  Extend the `BaseDownloadEngine` abstract class.
3.  Implement the `name` property and `download` method.
4.  **Export the class as default**.

### Template

```typescript
import { BaseDownloadEngine, DownloadResult } from '../../../core/contracts/module.contract';
import { fetchBuffer } from '../../../shared/utils/network';

export default class MyNewEngine extends BaseDownloadEngine {
    // Unique name to reference in .env (DOWNLOAD_ENGINE=mynewengine)
    name = 'mynewengine';

    async download(url: string): Promise<DownloadResult> {
        // Implement your logic here (e.g., call an API, scrape a page)
        const videoUrl = await someExternalApi(url);
        const buffer = await fetchBuffer(videoUrl);

        return {
            type: 'video',
            buffer: buffer,
            urls: [videoUrl]
        };
    }
}
```

### Activation

To use your new engine, update your `.env` file:

```env
DOWNLOAD_ENGINE=mynewengine
```

---

## ⚠️ Important Notes

1.  **Default Export**: The loader specifically looks for a `default` export that is a class. Named exports will be ignored.
2.  **Inheritance**: Your class **must** extend `BaseCommand` or `BaseDownloadEngine`. The loader performs an `instanceof` check to validate the module.
3.  **File Naming**:
    *   Commands must end in `.command.ts`.
    *   Engines must end in `.engine.ts`.

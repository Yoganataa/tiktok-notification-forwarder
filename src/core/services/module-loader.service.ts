import { glob } from 'glob';
import path from 'path';
import { logger } from '../../shared/utils/logger';

export class ModuleLoader {
    /**
     * Scans for modules, validates them, and returns instances.
     * @param pattern Glob pattern relative to src (or dist in prod)
     * @param baseClass The abstract base class to check against (instanceof)
     */
    static async loadModules<T>(pattern: string, baseClass: any): Promise<T[]> {
        const isProduction = path.extname(__filename) === '.js';
        const rootDir = isProduction ? path.resolve(__dirname, '../../') : path.resolve(__dirname, '../../');

        // Adjust pattern for extension
        const finalPattern = isProduction ? pattern.replace('.ts', '.js') : pattern;
        const searchPath = path.join(rootDir, finalPattern).replace(/\\/g, '/'); // normalize for glob

        logger.info(`[ModuleLoader] Scanning: ${searchPath}`);

        const files = await glob(searchPath);
        const modules: T[] = [];

        for (const file of files) {
            try {
                // Dynamic import
                const modulePath = path.resolve(file);
                const imported = await import(modulePath);

                // We expect a default export that is a Class
                const ModuleClass = imported.default;

                if (!ModuleClass) {
                    logger.warn(`[ModuleLoader] Skipping ${file}: No default export found.`);
                    continue;
                }

                // Check if it's a class we can instantiate
                if (typeof ModuleClass !== 'function') {
                    logger.warn(`[ModuleLoader] Skipping ${file}: Default export is not a class.`);
                    continue;
                }

                const instance = new ModuleClass();

                // Validate against contract
                if (instance instanceof baseClass) {
                    modules.push(instance);
                    logger.info(`[ModuleLoader] Loaded module from: ${path.basename(file)}`);
                } else {
                    logger.warn(`[ModuleLoader] Skipping ${file}: Instance does not extend ${baseClass.name}.`);
                }

            } catch (error) {
                logger.error(`[ModuleLoader] Failed to load ${file}`, { error: (error as Error).message });
            }
        }

        return modules;
    }
}

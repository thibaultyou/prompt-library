import * as os from 'os';
import * as path from 'path';

import * as fs from 'fs-extra';

/**
 * Determines if the application is running in "package mode" (installed globally or locally
 * via npm/yarn) versus "development mode" (running directly from the source code, e.g., using `ts-node` or `npm run dev`).
 *
 * This distinction is crucial for determining the correct base directory for user data,
 * configuration, and potentially assets.
 *
 * @returns {boolean} `true` if running in package mode, `false` if running in development mode.
 */
export function isPackageMode(): boolean {
    // Heuristic 1: Check if the entry script path includes 'node_modules'.
    // This is a strong indicator of running as an installed dependency.
    const entryScriptPath = process.argv[1] || ''; // Path of the executed script
    const isRunningFromNodeModules = entryScriptPath.includes('node_modules');
    // Heuristic 2: Check if the current working directory contains typical project root files.
    // If we're *not* in the project root, it's likely package mode (e.g., user ran global command from elsewhere).
    // Check for package.json OR tsconfig.json as indicators of the project root.
    const isInProjectRoot =
        fs.existsSync(path.join(process.cwd(), 'package.json')) ||
        fs.existsSync(path.join(process.cwd(), 'tsconfig.json'));
    // Determine package mode:
    // - If running from node_modules, it's definitely package mode.
    // - If *not* running from node_modules AND *not* in the project root, it's likely package mode
    //   (e.g., globally installed command run from a random directory).
    // - Otherwise (not in node_modules but *in* project root), it's development mode.
    const packageMode = isRunningFromNodeModules || !isInProjectRoot;
    // console.log(`[DEBUG] isPackageMode Check:
    //   Entry Script: ${entryScriptPath}
    //   In node_modules: ${isRunningFromNodeModules}
    //   In Project Root: ${isInProjectRoot}
    //   Result (Package Mode): ${packageMode}`);
    return packageMode;
}

/**
 * Determines the appropriate base directory for the application's user-specific data
 * (like the repository clone, config files, database).
 *
 * - In **Package Mode** (installed tool), it uses a hidden directory in the user's home folder
 *   (e.g., `~/.prompt-library`) to avoid cluttering the installation location and ensure
 *   data persistence across updates.
 * - In **Development Mode** (running from source), it uses the current working directory
 *   (assumed to be the project root) for easier development and testing.
 *
 * @returns {string} The absolute path to the application's base directory.
 */
export function getBaseDir(): string {
    if (isPackageMode()) {
        // Use ~/.prompt-library for user-specific data when installed
        return path.join(os.homedir(), '.prompt-library');
    } else {
        // Use the current working directory during development
        return process.cwd();
    }
}

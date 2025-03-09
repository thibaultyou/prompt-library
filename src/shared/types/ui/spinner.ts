// src/shared/types/ui/spinner.ts
import { Ora } from 'ora'; // Import the Ora type from ora library

/**
 * Extends the base `ora` Spinner interface to add standardized
 * methods for indicating success or failure states, ensuring consistent
 * feedback to the user after an operation completes.
 */
export interface SpinnerWithStatus extends Ora {
    // Extend Ora type
    /**
     * Stops the spinner and displays a success message.
     * @param {string} [text] - Optional text to display alongside the success indicator.
     */
    succeed: (text?: string) => Ora; // ora's succeed returns Ora

    /**
     * Stops the spinner and displays a failure message.
     * @param {string} [text] - Optional text to display alongside the failure indicator.
     */
    fail: (text?: string) => Ora; // ora's fail returns Ora
}

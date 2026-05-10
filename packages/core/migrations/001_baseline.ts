/**
 * 001_baseline — no-op baseline migration.
 *
 * The migration runner exists from v0.1 even though there is nothing to
 * migrate. v0.3 will need this scaffold; building it later costs more than
 * shipping a stub now.
 */
export const id = "001_baseline";
export const description = "No-op baseline migration.";
export async function up(): Promise<void> { /* noop */ }
export async function down(): Promise<void> { /* noop */ }

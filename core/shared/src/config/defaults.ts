import { configSchema, type OrbisConfig } from './schema.js';

/**
 * Generate default configuration using the schema.
 * Passing an empty object {} to parse() will use all default values.
 */
export const defaultConfig: OrbisConfig = configSchema.parse({});

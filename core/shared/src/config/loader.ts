import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { configSchema, type OrbisConfig } from './schema.js';
import { ConfigError } from '../errors/config.js';
import { createLogger } from '../logger/logger.js';
import { findProjectRoot } from '../utils/root.js';

let cachedConfig: OrbisConfig | null = null;
let currentConfigPath: string | null = null;
let isConfigLoading = false;

/**
 * Manually sets the cached configuration (useful for tests).
 */
export function setConfig(config: OrbisConfig | null): void {
  cachedConfig = config;
}

/**
 * Returns the loaded config as a singleton.
 * If config is not loaded, it will load it using the default strategy.
 */
export function getConfig(): OrbisConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

/**
 * Loads the configuration file following this strategy:
 * 1. ORBIS_CONFIG_PATH environment variable
 * 2. Project root directory (orbis.config.json)
 * 3. Default values (creates the file if missing in root)
 */
export function loadConfig(customPath?: string, forceReload: boolean = false): OrbisConfig {
  const envPath = process.env.ORBIS_CONFIG_PATH;
  const rawPath = customPath || envPath || 'orbis.config.json';
  const projectRoot = findProjectRoot();
  
  // Resolve path: if relative, make it relative to project root
  const configPath = isAbsolute(rawPath) ? rawPath : resolve(projectRoot, rawPath);

  if (forceReload || configPath !== currentConfigPath) {
    cachedConfig = null;
    currentConfigPath = configPath;
  }

  // Only return cache if NO custom path is provided AND NOT forcing reload
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  if (isConfigLoading && !cachedConfig) {
    return configSchema.parse({});
  }

  isConfigLoading = true;

  try {
    const defaults = configSchema.parse({});

    if (!existsSync(configPath)) {
      const configWithSchema = {
        $schema: './orbis.config.schema.json',
        ...defaults
      };
      cachedConfig = defaults;
      const logger = createLogger('shared');
      logger.warn(`Config file not found at ${configPath}. Using defaults and creating base config.`);
      try {
        writeFileSync(configPath, JSON.stringify(configWithSchema, null, 2), 'utf8');
      } catch (error: any) {
        logger.error(`Could not create default config file: ${error.message}`);
      }
      return cachedConfig;
    }

    const fileContent = readFileSync(configPath, 'utf8');
    let rawConfig: any;
    try {
      rawConfig = JSON.parse(fileContent);
    } catch (e: any) {
      throw new ConfigError(`JSON syntax error in ${configPath}: ${e.message}`);
    }
    
    const merge = (target: any, source: any) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    };

    const merged = merge(JSON.parse(JSON.stringify(defaults)), rawConfig);
    const result = configSchema.safeParse(merged);
    
    if (!result.success) {
      const issues = result.error.issues
        .map(i => `[${i.path.join('.')}] ${i.message}`)
        .join(', ');
      throw new ConfigError(`Config validation failed: ${issues}`);
    }

    cachedConfig = result.data;
    return cachedConfig;
  } catch (error: any) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(`Error loading config from ${configPath}: ${error.message}`);
  } finally {
    isConfigLoading = false;
  }
}

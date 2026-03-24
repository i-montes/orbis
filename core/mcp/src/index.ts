import { OrbisMCPServer } from './server.js';
import { createLogger } from '@orbis/shared';

const logger = createLogger('mcp:main');

async function main() {
  try {
    const server = new OrbisMCPServer();
    await server.run();
  } catch (error: any) {
    logger.error('Failed to start Orbis MCP server:', error.message);
    process.exit(1);
  }
}

main();

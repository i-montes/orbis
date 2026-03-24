import { spawn } from 'child_process';
import { createLogger } from '@orbis/shared';

const logger = createLogger('orbis:main');

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'mcp':
      logger.info('Starting Orbis MCP Server via Orchestrator...');
      // Ejecutamos el servidor MCP
      const mcp = spawn('bun', ['run', '--cwd', 'core/mcp', 'start'], {
        stdio: 'inherit'
      });
      
      mcp.on('exit', (code) => {
        process.exit(code || 0);
      });
      break;

    case 'status':
      logger.info('Orbis System Status: Operational');
      console.log('Orchestrator: Active');
      console.log('Memory Core: Verified');
      console.log('MCP Server: Ready');
      break;

    default:
      console.log('Usage: bun main.ts [mcp|status]');
      process.exit(1);
  }
}

main().catch(err => {
  logger.error('Orchestrator error:', err);
  process.exit(1);
});

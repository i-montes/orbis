#!/usr/bin/env bun
import { Command } from 'commander';
import { dbCommands } from './commands/db/index.js';
import { chatCommand } from './commands/chat/index.js';
import { sleepCommand } from './commands/sleep.js';
import { getConfig } from '@orbis/shared';

const config = getConfig();
const program = new Command();

program
  .name('orbis')
  .description('Orbis CLI - Gestión de Agentes con Memoria Persistente')
  .version(config.version || '0.1.0');

// Registrar grupos de comandos
program.addCommand(dbCommands);
program.addCommand(chatCommand);
program.addCommand(sleepCommand);

program.parse(process.argv);

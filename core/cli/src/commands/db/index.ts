import { Command } from 'commander';
import { migrateCommand } from './migrate.js';
import { resetCommand } from './reset.js';
import { statsCommand } from './stats.js';

export const dbCommands = new Command('db')
  .description('Gestión de la base de datos de memoria');

dbCommands.addCommand(migrateCommand);
dbCommands.addCommand(resetCommand);
dbCommands.addCommand(statsCommand);

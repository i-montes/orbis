import { Command } from 'commander';
import chalk from 'chalk';
import { Memor } from '@orbis/memor';

export const migrateCommand = new Command('migrate')
  .description('Ejecuta migraciones pendientes en la base de datos')
  .action(async () => {
    try {
      console.log(chalk.blue('Verificando migraciones...'));
      // Al instanciar Memor, el constructor de MemorStore ejecuta las migraciones
      const memor = new Memor();
      console.log(chalk.green.bold('✓ Base de datos actualizada y lista.'));
      memor.close();
    } catch (error: any) {
      console.error(chalk.red(`Error durante la migración: ${error.message}`));
    }
  });

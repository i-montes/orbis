import { Command } from 'commander';
import chalk from 'chalk';
import { Memor } from '@orbis/memor';

export const resetCommand = new Command('reset')
  .description('Elimina todos los datos de la base de datos (FLUSH)')
  .action(async () => {
    const memor = new Memor();
    try {
      console.log(chalk.yellow('Reseteando base de datos...'));
      memor.reset();
      console.log(chalk.green.bold('✓ Base de datos limpiada correctamente.'));
    } catch (error: any) {
      console.error(chalk.red(`Error al resetear la base de datos: ${error.message}`));
    } finally {
      memor.close();
    }
  });

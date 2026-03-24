import { Command } from 'commander';
import chalk from 'chalk';
import { Memor } from '@orbis/memor';
import { formatBytes } from '@orbis/shared';

export const statsCommand = new Command('stats')
  .description('Muestra estadísticas de la base de datos')
  .action(async () => {
    const memor = new Memor();
    try {
      const stats = memor.getStats();
      
      console.log(chalk.bold('\n📊 Estadísticas de Orbis Memory:'));
      console.log(chalk.blue('---------------------------------'));
      console.log(`${chalk.cyan('Recuerdos:')}  ${stats.memories}`);
      console.log(`${chalk.cyan('Relaciones:')} ${stats.edges}`);
      console.log(`${chalk.cyan('Tamaño:')}     ${formatBytes(stats.sizeBytes)}`);
      console.log(chalk.blue('---------------------------------\n'));
    } catch (error: any) {
      console.error(chalk.red(`Error al obtener estadísticas: ${error.message}`));
    } finally {
      memor.close();
    }
  });

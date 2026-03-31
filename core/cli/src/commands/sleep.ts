import { Command } from 'commander';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { SleepAgent } from '@orbis/orbis';

export const sleepCommand = new Command('sleep')
  .description('Ejecuta el hilo de sueño para consolidar memorias en bruto (EXPERIENCE) en conceptos estructurados')
  .option('-l, --limit <number>', 'Límite de memorias a procesar', '20')
  .action(async (options) => {
    p.intro(chalk.magenta('Orbis Sleep Thread'));

    const limit = parseInt(options.limit, 10);

    const spinner = p.spinner();
    spinner.start(`Iniciando hilo de sueño... Consolidando hasta ${limit} recuerdos...`);

    try {
      const agent = new SleepAgent();
      const result = await agent.consolidate(limit);

      spinner.stop('Hilo de sueño finalizado.');

      if (result.processed === 0) {
        p.log.info('No había recuerdos pendientes de consolidar.');
      } else {
        p.log.success(
          `Consolidación exitosa:\n` +
          `- Memorias procesadas: ${result.processed}\n` +
          `- Nuevos conceptos/hechos generados: ${result.generated}`
        );
      }

      p.outro('¡Proceso completado!');
    } catch (error: any) {
      spinner.stop('Error en el hilo de sueño.');
      p.log.error(error.message);
      process.exit(1);
    }
  });

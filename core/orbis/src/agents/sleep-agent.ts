import { Memor } from '@orbis/memor';
import { getConfig, createLogger } from '@orbis/shared';

const logger = createLogger('orbis:sleep-agent');

export class SleepAgent {
  private memor: Memor;

  constructor(memor?: Memor) {
    this.memor = memor || new Memor();
  }

  /**
   * Processes unconsolidated EXPERIENCE memories, uses LLM to summarize them into
   * facts/concepts, stores them, and marks the originals as consolidated.
   */
  async consolidate(limit: number = 20): Promise<{ processed: number; generated: number }> {
    logger.info(`Iniciando consolidación de recuerdos (límite: ${limit})...`);
    const unconsolidated = this.memor.getUnconsolidatedMemories(limit);

    if (unconsolidated.length === 0) {
      logger.info('No hay recuerdos pendientes de consolidar.');
      return { processed: 0, generated: 0 };
    }

    const config = getConfig();
    const model = config.chat?.model;
    
    if (!model) {
      logger.warn('No hay modelo configurado. Ejecuta el chat primero o configura orbis.config.json.');
      return { processed: 0, generated: 0 };
    }

    let generatedCount = 0;

    for (const memory of unconsolidated) {
      try {
        const prompt = `Analiza la siguiente interacción (Usuario y Asistente).
Extrae los hechos más importantes, conceptos clave o decisiones tomadas.
Resume la interacción en 1 a 3 frases claras que representen un conocimiento valioso a largo plazo.
Devuelve ÚNICAMENTE un JSON con el siguiente formato, sin markdown ni explicaciones adicionales:
{
  "summary": "el resumen condensado",
  "type": "FACT" o "CONCEPT" o "DECISION",
  "entities": ["entidad1", "entidad2"]
}

INTERACCIÓN:
${memory.content}
`;

        const response = await fetch('http://127.0.0.1:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false,
            format: 'json'
          })
        });

        if (!response.ok) {
          throw new Error(`Ollama error: ${response.statusText}`);
        }

        const data = await response.json() as any;
        let parsed;
        try {
          parsed = JSON.parse(data.response);
        } catch (e) {
          logger.warn(`No se pudo parsear el JSON generado para la memoria ${memory.id}`);
          continue;
        }

        if (parsed.summary) {
          // 1. Guardar el nuevo recuerdo consolidado
          await this.memor.addMemory({
            content: parsed.summary,
            source: 'SYSTEM',
            memoryType: parsed.type === 'FACT' || parsed.type === 'CONCEPT' || parsed.type === 'DECISION' ? parsed.type : 'FACT',
            metadata: {
              entities: parsed.entities || [],
              derivedFrom: memory.id
            }
          });
          generatedCount++;

          // 2. Marcar la memoria original como consolidada
          const updatedMetadata = { ...(memory.metadata || {}), consolidated: true };
          await this.memor.updateMemory(memory.id, { metadata: updatedMetadata });
        }
      } catch (err: any) {
        logger.error(`Error consolidando memoria ${memory.id}: ${err.message}`);
      }
    }

    logger.info(`Consolidación terminada. Procesadas: ${unconsolidated.length}, Generadas: ${generatedCount}`);
    return { processed: unconsolidated.length, generated: generatedCount };
  }
}

import { Command } from 'commander';
import { getConfig, findProjectRoot } from '@orbis/shared';
import { Memor } from '@orbis/memor';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Command 'orbis chat'
 * Performs a pre-flight check for the chat model.
 * If no model is defined in the config, it asks the user to pick one from Ollama.
 * Then, it enters an interactive chat loop with memory.
 */
export const chatCommand = new Command('chat')
  .description('Iniciar sesión de chat interactiva con memoria persistente')
  .action(async () => {
    let config = getConfig();

    // 1. Pre-flight Check: already has a model?
    if (!config.chat?.model) {
      p.intro('Configuración de Chat (Pre-vuelo)');

      try {
        const spinner = p.spinner();
        spinner.start('Consultando modelos disponibles en Ollama...');
        
        const response = await fetch('http://127.0.0.1:11434/api/tags');
        
        if (!response.ok) {
          spinner.stop('Error al conectar con Ollama');
          throw new Error('Ollama no respondió correctamente');
        }
        
        const data = (await response.json()) as { models: Array<{ name: string }> };
        const modelNames = data.models.map((m) => m.name);
        
        spinner.stop('Modelos de Ollama listados.');

        if (modelNames.length === 0) {
          p.log.error('No se encontraron modelos en tu instancia de Ollama.');
          p.log.message('Usa "ollama pull <modelo>" para descargar uno (ej. llama3).');
          return;
        }

        const selectedModel = await p.select({
          message: '¿Qué modelo de Ollama deseas usar para esta sesión?',
          options: modelNames.map((name) => ({ value: name, label: name })),
        });

        if (p.isCancel(selectedModel)) {
          p.cancel('Operación cancelada.');
          return;
        }

        const shouldSave = await p.confirm({
          message: '¿Deseas guardar este modelo como predeterminado en tu orbis.config.json?',
          initialValue: true,
        });

        if (p.isCancel(shouldSave)) {
          p.cancel('Operación cancelada.');
          return;
        }

        if (shouldSave) {
          const projectRoot = findProjectRoot();
          const configPath = resolve(projectRoot, 'orbis.config.json');
          
          let rawConfig: any = {};
          if (existsSync(configPath)) {
            try {
              rawConfig = JSON.parse(readFileSync(configPath, 'utf8'));
            } catch (e) {
              p.log.warn('No se pudo leer el archivo de configuración existente, creando uno nuevo.');
            }
          }

          const updatedConfig = {
            ...rawConfig,
            chat: {
              ...(rawConfig.chat || {}),
              model: selectedModel
            }
          };

          writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf8');
          p.log.success(`Configuración actualizada: ${selectedModel} es ahora tu modelo predeterminado.`);
        }

        // Update local config for current session
        config = { ...config, chat: { ...config.chat, model: selectedModel as string } };
        
      } catch (error: any) {
        p.log.error('No se pudo conectar con Ollama.');
        p.log.message('Asegúrate de que Ollama esté corriendo en http://127.0.0.1:11434');
        p.log.message('Error: ' + error.message);
        return;
      }
    }

    const chatModel = config.chat!.model!;
    p.intro(`${chalk.cyan('Orbis Chat')} - Modelo: ${chalk.green(chatModel)}`);
    p.log.message('Escribe "exit" o presiona Ctrl+C para salir. Los mensajes se guardan en memoria.');

    const memor = new Memor();

    while (true) {
      const userInput = await p.text({
        message: chalk.blue('Tú:'),
        placeholder: 'Escribe algo para recordar...',
        validate: (value) => {
          if (!value || value.trim().length === 0) return 'El mensaje no puede estar vacío';
        },
      });

      if (p.isCancel(userInput) || userInput.toLowerCase() === 'exit') {
        p.outro('Sesión de chat finalizada. ¡Hasta pronto!');
        break;
      }

      // 2. Memory Retrieval (RAG)
      const spinner = p.spinner();
      spinner.start('Consultando memoria...');
      const contextResults = await memor.search(userInput, { topK: 3 });
      spinner.stop('Memoria consultada.');

      const contextString = contextResults.length > 0 
        ? contextResults.map(m => `- ${m.memory.content}`).join('\n')
        : 'No hay recuerdos relevantes encontrados.';

      // 3. Prompt Construction
      const systemPrompt = `Eres Orbis, un asistente con memoria persistente. 
Utiliza el siguiente contexto recuperado de tu memoria para responder a la pregunta del usuario.
Si el contexto no es relevante, responde de forma natural.

CONTEXTO RECUPERADO:
${contextString}
`;

      // 4. Ollama Generation (Streaming)
      process.stdout.write(`\n${chalk.magenta('Orbis:')} `);
      
      try {
        const response = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            model: chatModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userInput }
            ],
            stream: true,
            options: {
              num_ctx: 2048 // Limitamos el contexto para ahorrar memoria
            }
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ollama Error (${response.status}): ${errorText}`);
        }

        if (!response.body) {
          throw new Error('No se recibió cuerpo de respuesta de Ollama');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value || new Uint8Array(), { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.message && json.message.content) {
                process.stdout.write(json.message.content);
                fullResponse += json.message.content;
              }
            } catch (e) {
              // Ignore partial JSON chunks
            }
          }
        }
        process.stdout.write('\n\n');

        // 5. Store Interaction in Memory
        // We save both the user input and assistant response as a single interaction context
        await memor.addMemory({
          content: `Usuario: ${userInput}\nOrbis: ${fullResponse}`,
          source: 'USER',
          memoryType: 'EXPERIENCE',
          metadata: {
            model: chatModel,
            timestamp: new Date().toISOString(),
            consolidated: false
          }
        });

      } catch (error: any) {
        p.log.error('Error durante la generación: ' + error.message);
      }
    }
  });

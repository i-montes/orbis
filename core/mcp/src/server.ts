import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Memor } from '@orbis/memor';
import { createLogger, getConfig } from '@orbis/shared';
import { z } from 'zod';

const logger = createLogger('mcp:server');

export class OrbisMCPServer {
  private server: Server;
  private memor: Memor;

  constructor() {
    const config = getConfig();
    
    this.server = new Server(
      {
        name: 'orbis-mcp',
        version: config.version || '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Instanciamos la fachada de memoria
    this.memor = new Memor();

    this.setupToolHandlers();
    
    this.server.onerror = (error) => logger.error('[MCP Error]', error);
    
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'orbis_remember',
          description: 'Guarda un nuevo recuerdo, hecho o concepto en la memoria a largo plazo del usuario.',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'El contenido del recuerdo a almacenar.',
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'orbis_recall',
          description: 'Busca en la memoria a largo plazo información relevante basada en una consulta semántica.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Consulta semántica o pregunta para buscar en la memoria.',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'orbis_relate',
          description: 'Crea una relación explícita entre dos recuerdos existentes.',
          inputSchema: {
            type: 'object',
            properties: {
              sourceId: {
                type: 'string',
                description: 'ID del recuerdo de origen.',
              },
              targetId: {
                type: 'string',
                description: 'ID del recuerdo de destino.',
              },
              relationType: {
                type: 'string',
                enum: ['related_to', 'contradicts', 'elaborates', 'causes', 'precedes'],
                description: 'El tipo de relación semántica.',
              },
            },
            required: ['sourceId', 'targetId', 'relationType'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'orbis_remember') {
        const schema = z.object({ content: z.string() });
        const parsed = schema.safeParse(request.params.arguments);
        
        if (!parsed.success) {
          throw new McpError(ErrorCode.InvalidParams, 'Argumentos inválidos para orbis_remember');
        }

        try {
          const memory = await this.memor.addMemory({
            content: parsed.data.content,
            source: 'AGENT',
            memoryType: 'FACT'
          });
          
          return {
            content: [
              {
                type: 'text',
                text: `Recuerdo guardado exitosamente con ID: ${memory.id}`,
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(ErrorCode.InternalError, `Error al guardar recuerdo: ${error.message}`);
        }
      }

      if (request.params.name === 'orbis_recall') {
        const schema = z.object({ query: z.string() });
        const parsed = schema.safeParse(request.params.arguments);
        
        if (!parsed.success) {
          throw new McpError(ErrorCode.InvalidParams, 'Argumentos inválidos para orbis_recall');
        }

        try {
          // Búsqueda expandida por grafo, top 5 resultados por defecto
          const results = await this.memor.search(parsed.data.query, { expandGraph: true, topK: 5 });
          
          if (results.length === 0) {
            return {
              content: [{ type: 'text', text: 'No se encontraron recuerdos relevantes en la base de datos.' }]
            };
          }

          const formatted = results.map(r => `[ID: ${r.memory.id}] (Score: ${(r.score * 100).toFixed(1)}%)\n${r.memory.content}`).join('\n\n---\n\n');
          return {
            content: [{ type: 'text', text: formatted }]
          };
        } catch (error: any) {
          throw new McpError(ErrorCode.InternalError, `Error durante la recuperación de recuerdos: ${error.message}`);
        }
      }

      if (request.params.name === 'orbis_relate') {
        const schema = z.object({
          sourceId: z.string(),
          targetId: z.string(),
          relationType: z.enum(['related_to', 'contradicts', 'elaborates', 'causes', 'precedes'])
        });
        
        const parsed = schema.safeParse(request.params.arguments);
        
        if (!parsed.success) {
          throw new McpError(ErrorCode.InvalidParams, 'Argumentos inválidos para orbis_relate');
        }

        try {
          this.memor.addEdge(parsed.data.sourceId, parsed.data.targetId, parsed.data.relationType, 1.0);
          return {
            content: [
              {
                type: 'text',
                text: `Relación '${parsed.data.relationType}' creada exitosamente entre el nodo ${parsed.data.sourceId} y ${parsed.data.targetId}`,
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(ErrorCode.InternalError, `Error al crear relación: ${error.message}`);
        }
      }

      throw new McpError(ErrorCode.MethodNotFound, `Herramienta desconocida: ${request.params.name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Orbis MCP server running on stdio');
  }

  private async cleanup() {
    try {
      this.memor.close();
      await this.server.close();
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

orbis/
│
├── orbis.config.json # Fuente única de verdad de configuración
├── orbis.config.schema.json # JSON Schema para validar el config
├── package.json # Workspace root (Bun workspaces)
├── bunfig.toml # Configuración de Bun (paths, registros)
├── tsconfig.base.json # TypeScript base heredado por todos
├── .env.example # Variables de entorno documentadas
├── .gitignore
│
├── core/
│ │
│ ├── shared/ # @orbis/core ── Fundación compartida
│ │ ├── src/
│ │ │ ├── config/ # Carga, parsea y valida orbis.config.json
│ │ │ ├── types/ # Interfaces y tipos TypeScript globales
│ │ │ ├── logger/ # Logger estructurado (niveles, formato)
│ │ │ ├── events/ # Bus de eventos inter-módulo
│ │ │ ├── utils/ # Helpers compartidos (fechas, hashes, ids)
│ │ │ └── errors/ # Clases de error personalizadas
│ │ ├── package.json # name: "@orbis/core"
│ │ └── tsconfig.json
│ │
│ ├── memor/ # @orbis/memor ── Sistema de memoria
│ │ ├── src/
│ │ │ ├── store/ # Capa de acceso a SQLite (queries, migraciones)
│ │ │ ├── vectors/ # sqlite-vec + índice HNSW
│ │ │ ├── graph/ # Relaciones en grafo entre recuerdos
│ │ │ ├── retrieval/ # Búsqueda semántica + factor recency_lambda
│ │ │ ├── embeddings/ # Generación de embeddings (local o remoto)
│ │ │ └── index.ts # API pública del módulo
│ │ ├── package.json # name: "@orbis/memor"
│ │ └── tsconfig.json
│ │
│ ├── socket/ # @orbis/socket ── Servidor WebSocket
│ │ ├── src/
│ │ │ ├── server/ # Setup del servidor (Bun.serve + WS)
│ │ │ ├── handlers/ # Manejadores por tipo de evento
│ │ │ ├── rooms/ # Canales/salas (dashboard, agentes, logs)
│ │ │ └── index.ts
│ │ ├── package.json # name: "@orbis/socket"
│ │ └── tsconfig.json
│ │
│ ├── mcp/ # @orbis/mcp ── Model Context Protocol
│ │ ├── src/
│ │ │ ├── tools/ # memory_search, memory_store, memory_forget
│ │ │ ├── resources/ # Recursos expuestos al modelo
│ │ │ └── index.ts
│ │ ├── package.json # name: "@orbis/mcp"
│ │ └── tsconfig.json
│ │
│ ├── cli/ # @orbis/cli ── Interfaz de línea de comandos
│ │ ├── src/
│ │ │ ├── commands/
│ │ │ │ ├── start.ts # orbis start [módulo]
│ │ │ │ ├── stop.ts # orbis stop [módulo]
│ │ │ │ ├── restart.ts # orbis restart [módulo]
│ │ │ │ ├── status.ts # orbis status
│ │ │ │ ├── logs.ts # orbis logs [--module] [--tail]
│ │ │ │ ├── doctor.ts # orbis doctor
│ │ │ │ ├── version.ts # orbis version
│ │ │ │ ├── memor/
│ │ │ │ │ ├── index.ts # orbis memor
│ │ │ │ │ ├── start.ts # orbis memor start
│ │ │ │ │ ├── stop.ts
│ │ │ │ │ ├── restart.ts # orbis memor restart
│ │ │ │ │ ├── status.ts # orbis memor status
│ │ │ │ │ ├── flush.ts # orbis memor flush
│ │ │ │ │ └── search.ts # orbis memor search <query>
│ │ │ │ ├── socket/
│ │ │ │ │ ├── index.ts
│ │ │ │ │ ├── start.ts | stop.ts | restart.ts | status.ts
│ │ │ │ │ └── clients.ts # orbis socket clients
│ │ │ │ ├── mcp/
│ │ │ │ │ └── start.ts | stop.ts | restart.ts | status.ts
│ │ │ │ ├── config/
│ │ │ │ │ ├── show.ts # orbis config show
│ │ │ │ │ ├── edit.ts # orbis config edit
│ │ │ │ │ └── validate.ts
│ │ │ │ └── db/
│ │ │ │ ├── migrate.ts # orbis db migrate
│ │ │ │ ├── backup.ts # orbis db backup [--path]
│ │ │ │ └── restore.ts # orbis db restore <archivo>
│ │ │ ├── ui/ # Helpers de terminal: tablas, spinners, prompts
│ │ │ └── index.ts # Entry point del CLI
│ │ ├── package.json # name: "@orbis/cli", bin: { "orbis": "./src/index.ts" }
│ │ └── tsconfig.json
│ │
│ └── orbis/ # @orbis/orbis ── Orquestador (se construye encima)
│ ├── src/
│ │ ├── agents/ # Definición de agentes especializados
│ │ ├── orchestrator/ # Lógica de orquestación y enrutamiento
│ │ └── index.ts
│ ├── package.json # name: "@orbis/orbis"
│ └── tsconfig.json
│
├── data/ # Bases de datos (en .gitignore)
│ ├── memor.db # Base de datos principal de memor
│ ├── sessions.db # Sesiones y contextos activos
│ └── .gitkeep
│
├── apps/ # Aplicaciones consumidoras (futuro)
│ └── dashboard/ # Dashboard web (conecta por socket)
│ ├── src/
│ └── package.json
│
└── scripts/ # Automatización y mantenimiento
├── setup.ts # Instalación inicial (zero-config bootstrap)
├── migrate.ts # Corre todas las migraciones de DB
└── health-check.ts # Verifica que todo esté en orden

# AGENTS.md — Orbis

Todo lo que un agente necesita saber para trabajar en este proyecto.
Lee este archivo completo antes de escribir cualquier línea de código.

---

## Qué es Orbis

Orbis es un sistema de agentes de IA con memoria persistente. Su objetivo es permitir que los agentes operen de forma continua, económica y sin configuración manual, recordando información a largo plazo en lugar de depender del historial de conversación completo.

El proyecto se construye en fases incrementales. Cada fase entrega un sistema funcional antes de avanzar a la siguiente. Al momento de este documento, estamos en la **Fase 1: Memor**.

---

## Stack tecnológico

- **Runtime**: Bun (no Node.js, no npm, no npx — siempre `bun`)
- **Lenguaje**: TypeScript estricto en todo el proyecto
- **Base de datos**: SQLite vía `better-sqlite3`
- **Vectores**: `sqlite-vec` con índice HNSW
- **Comandos CLI**: `citty`
- **Configuración**: `orbis.config.json` en la raíz del proyecto

No uses `node`, `npm`, `npx` ni `yarn` en ningún comando. Todo pasa por `bun`.

---

## Estructura del proyecto

```
orbis/
├── orbis.config.json              # Fuente única de verdad de configuración
├── orbis.config.schema.json       # JSON Schema que valida el config
├── package.json                   # Workspace root con Bun workspaces
├── bunfig.toml                    # Configuración de Bun
├── tsconfig.base.json             # TypeScript base heredado por todos los paquetes
├── .env.example                   # Variables de entorno documentadas
│
├── core/                          # Todos los paquetes del sistema
│   ├── shared/                    # @orbis/shared — Fundación compartida
│   ├── memor/                     # @orbis/memor — Sistema de memoria
│   ├── socket/                    # @orbis/socket — Servidor WebSocket
│   ├── mcp/                       # @orbis/mcp — Model Context Protocol
│   ├── cli/                       # @orbis/cli — Interfaz de línea de comandos
│   └── orbis/                     # @orbis/orbis — Orquestador principal
│
├── data/                          # Bases de datos en runtime (en .gitignore)
│   ├── memor.db
│   └── backups/
│
├── apps/                          # Aplicaciones consumidoras (futuro)
│   └── dashboard/
│
└── scripts/                       # Automatización
    ├── setup.ts
    ├── migrate.ts
    ├── seed-memor.ts
    └── health-check.ts
```

### Estructura interna de cada paquete

```
core/<paquete>/
├── src/
│   ├── <subsistema>/
│   │   ├── index.ts               # API pública del subsistema
│   │   └── *.ts                   # Implementación interna
│   └── index.ts                   # API pública del paquete completo
├── package.json                   # name: "@orbis/<paquete>"
└── tsconfig.json                  # Hereda de tsconfig.base.json
```

---

## Paquetes y sus responsabilidades

### `@orbis/shared`
La base de todo. No importa nada de los otros paquetes del proyecto.

Exporta:
- `loadConfig()` — lee y valida `orbis.config.json`, retorna defaults si no existe
- `createLogger(module)` — logger estructurado con prefijo por módulo
- Tipos globales: `Memory`, `MemoryNode`, `MemoryEdge`, `SearchResult`, `EmbeddingVector`
- Tipos de configuración que espejan el schema JSON
- `EventBus` — EventEmitter tipado para comunicación entre módulos
- Eventos: `memory:stored`, `memory:retrieved`, `memory:forgotten`, `system:ready`, `system:error`
- Utilidades: `generateId()`, `hashContent()`, `normalizeText()`, `sleep()`, `formatBytes()`
- Errores: `OrbisError`, `ConfigError`, `MemorError`, `EmbeddingError`

### `@orbis/memor`
El sistema de memoria. Depende solo de `@orbis/shared`.

Exporta la clase `Memor` con:
- `store(content, options?)` — guarda, vectoriza, crea aristas automáticas
- `search(query, options?)` — búsqueda semántica con recency_lambda y expansión por grafo
- `forget(memoryId)` — elimina recuerdo y sus aristas
- `relate(sourceId, targetId, type)` — relación manual entre recuerdos
- `stats()` — conteos, tamaño de DB, distribución temporal
- `getGraph(memoryId, depth?)` — subgrafo de un recuerdo

Internamente organizado en subsistemas:
- `store/` — queries SQLite y migraciones
- `vectors/` — sqlite-vec e índice HNSW
- `graph/` — relaciones entre recuerdos
- `retrieval/` — búsqueda semántica + recency_lambda
- `embeddings/` — proveedores de embeddings

### `@orbis/socket`
Servidor WebSocket. Depende de `@orbis/shared`.
Comunica eventos del sistema a clientes externos (dashboard, herramientas).

### `@orbis/mcp`
Servidor Model Context Protocol. Depende de `@orbis/shared` y `@orbis/memor`.
Expone herramientas de memoria al modelo: `memory_store`, `memory_search`, `memory_forget`, `memory_relate`.

### `@orbis/cli`
Interfaz de línea de comandos. Depende de todos los paquetes anteriores.
Es el único punto de control total del sistema.

### `@orbis/orbis`
El orquestador. Depende de todos. Se construye en la Fase 5.

---

## Reglas de dependencia entre paquetes

El grafo de dependencias es estrictamente unidireccional. Nunca hay dependencias circulares.

```
@orbis/orbis
    ↓
@orbis/cli
    ↓
@orbis/mcp  ←→  @orbis/socket
    ↓               ↓
@orbis/memor ───────┘
    ↓
@orbis/shared
```

**Regla absoluta**: un paquete solo puede importar de paquetes que estén por debajo suyo en este grafo. `@orbis/shared` no importa nada del proyecto. `@orbis/memor` solo importa de `@orbis/shared`. Nunca al revés.

---

## Configuración central

El archivo `orbis.config.json` en la raíz es la **única fuente de verdad**. Ningún paquete tiene valores hardcodeados: todos consultan el config a través de `loadConfig()` de `@orbis/shared`.

```json
{
  "$schema": "./orbis.config.schema.json",
  "version": "1.0.0",
  "name": "orbis",
  "data": {
    "path": "./data"
  },
  "memor": {
    "enabled": true,
    "database": "memor.db",
    "recency_lambda": 0.1,
    "embedding": {
      "provider": "local",
      "model": "nomic-embed-text",
      "dimensions": 768
    },
    "hnsw": {
      "m": 16,
      "ef_construction": 200
    }
  },
  "socket": {
    "enabled": true,
    "port": 3001,
    "host": "localhost"
  },
  "mcp": {
    "enabled": true,
    "transport": "stdio"
  },
  "logger": {
    "level": "info",
    "format": "pretty"
  }
}
```

Si necesitas agregar una nueva opción de configuración:
1. Agrégala al schema en `orbis.config.schema.json`
2. Agrégala al tipo correspondiente en `@orbis/shared/src/types/`
3. Agrégala al `orbis.config.json` con su valor por defecto
4. Nunca hardcodees el valor en el código

---

## Base de datos

### Ubicación
Todas las bases de datos viven en la carpeta `data/` que está en `.gitignore`. Son datos de runtime, no de versionado. La ruta se construye como `config.data.path + "/" + config.memor.database`.

### Schema de `memor.db`

```sql
-- Recuerdos principales
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  summary TEXT,
  created_at INTEGER NOT NULL,       -- Unix timestamp
  last_accessed_at INTEGER,
  access_count INTEGER DEFAULT 0,
  source TEXT,                       -- origen del recuerdo (agente, sesión, etc.)
  metadata TEXT                      -- JSON libre
);

-- Vectores de embedding
CREATE TABLE embeddings (
  memory_id TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
  vector BLOB NOT NULL,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Grafo de relaciones
CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES memories(id) ON DELETE CASCADE,
  target_id TEXT REFERENCES memories(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,       -- related_to | contradicts | elaborates | causes | precedes
  weight REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL
);

-- Sesiones
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER,
  metadata TEXT
);

-- Recuerdos por sesión
CREATE TABLE session_memories (
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  memory_id TEXT REFERENCES memories(id) ON DELETE CASCADE,
  relevance_score REAL,
  PRIMARY KEY (session_id, memory_id)
);

-- Registro de migraciones
CREATE TABLE _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL
);
```

### Migraciones
Las migraciones son archivos `.sql` numerados en `core/memor/src/store/migrations/`. Al inicializar, se corren automáticamente las pendientes. Nunca modifiques una migración ya aplicada: crea una nueva.

---

## Sistema de memoria — conceptos clave

### recency_lambda
Factor de decaimiento temporal. Fórmula de scoring:

```
score_final = score_semantico × e^(−recency_lambda × dias_desde_creacion)
```

- `recency_lambda = 0.0` → la antigüedad no afecta, solo relevancia semántica
- `recency_lambda = 0.1` → valor por defecto, decay suave
- `recency_lambda = 1.0` → recuerdos de más de 7 días caen notoriamente

Implementación: recuperar `topK × 2` candidatos por vector, re-ordenar con la fórmula, devolver los mejores `topK`.

### Aristas automáticas
Al guardar un recuerdo nuevo, se buscan los N más similares. Si la similitud supera el umbral configurado, se crea una arista automáticamente con peso proporcional al score. Esto construye el grafo sin intervención manual.

### Búsqueda expandida
`search()` primero busca por similitud vectorial, luego expande a los vecinos del grafo. Permite recuperar recuerdos relacionados aunque no sean semánticamente similares a la query exacta.

---

## Convenciones de código

### TypeScript
- Strict mode activado en todos los paquetes. Sin `any` implícito.
- Tipos explícitos en todas las funciones públicas (parámetros y retorno).
- Interfaces para contratos públicos, types para uniones y aliases.
- Nunca uses `!` (non-null assertion) sin un comentario que justifique por qué es seguro.

### Exports
- Cada paquete tiene un único `src/index.ts` que define su API pública.
- Los demás módulos del proyecto importan solo desde ese `index.ts`, nunca desde rutas internas.
- Correcto: `import { Memor } from "@orbis/memor"`
- Incorrecto: `import { MemorStore } from "@orbis/memor/src/store/store"`

### Errores
- Siempre usa las clases de error de `@orbis/shared`. Nunca `throw new Error("...")` genérico.
- Los errores deben tener mensajes accionables: qué falló y qué hacer para resolverlo.
- Ejemplo: `throw new EmbeddingError("Ollama no está corriendo. Ejecuta: ollama serve")`

### Logging
- Usa siempre el logger de `@orbis/shared`, nunca `console.log` en código de producción.
- `console.log` solo está permitido en scripts de desarrollo y tests.
- El logger recibe el nombre del módulo al crearse: `createLogger("memor")`.

### Async
- Prefiere `async/await` sobre `.then().catch()`.
- Todas las operaciones de I/O (DB, red, filesystem) son async.
- Las operaciones SQLite síncronas de `better-sqlite3` son aceptables dentro del store, ya que SQLite en modo WAL es seguro para uso local.

### Nombrado
- `camelCase` para variables y funciones
- `PascalCase` para clases e interfaces
- `UPPER_SNAKE_CASE` para constantes
- Archivos en `kebab-case`
- Carpetas en `kebab-case`

---

## Comandos disponibles

### CLI (una vez ejecutado `bun link` en `core/cli`)

```bash
# Memoria
orbis memor status           # estado del módulo
orbis memor stats            # estadísticas detalladas
orbis memor search <query>   # búsqueda semántica
orbis memor flush            # borrar todos los recuerdos (pide confirmación)

# Base de datos
orbis db migrate             # correr migraciones pendientes
orbis db backup              # crear backup con timestamp
orbis db restore <archivo>   # restaurar desde backup (pide confirmación)
orbis db list                # listar DBs con tamaño y fecha
```

### Desarrollo

```bash
# Instalar dependencias (desde la raíz)
bun install

# Build de un paquete
bun run build --cwd core/shared
bun run build --cwd core/memor

# Tests de un paquete
bun test --cwd core/shared
bun test --cwd core/memor

# Tests de un subsistema específico
bun test --cwd core/memor src/store
bun test --cwd core/memor src/vectors

# Ejecutar un script
bun run scripts/seed-memor.ts
bun run scripts/migrate.ts
```

---

## Estado actual del proyecto

**Fase actual**: Fase 1 — Memor

**Lo que ya existe** (estructura creada, sin contenido):
- Monorepo con Bun workspaces configurado
- Carpetas y `package.json` de todos los paquetes
- `tsconfig.json` en cada paquete heredando de `tsconfig.base.json`
- `orbis.config.json` con valores base
- `orbis.config.schema.json` con el schema de validación completo
- Estructura de carpetas `data/`, `apps/`, `scripts/`

**Lo que se está construyendo ahora** (Fase 1, en orden):
1. Contenido de `@orbis/shared` — config loader, logger, tipos, bus de eventos, utilidades, errores
2. `@orbis/memor` store — SQLite, migraciones, schema de DB
3. `@orbis/memor` embeddings — Ollama y OpenAI
4. `@orbis/memor` vectores — sqlite-vec, HNSW
5. `@orbis/memor` recency — factor de decaimiento temporal
6. `@orbis/memor` grafo — relaciones entre recuerdos
7. `@orbis/memor` API pública — clase `Memor` completa
8. `@orbis/cli` parcial — comandos `orbis memor *` y `orbis db *`
9. Prueba end-to-end con `scripts/seed-memor.ts`

**Lo que viene después** (no tocar todavía):
- Fase 2: `@orbis/socket`
- Fase 3: `@orbis/mcp`
- Fase 4: CLI completo + `orbis doctor`
- Fase 5: `@orbis/orbis` (orquestador)
- Fase 6: `apps/dashboard`

---

## Principios que guían cada decisión

**Zero-config**: si algo falta (la DB no existe, una dependencia no está instalada, el config no existe), el sistema se encarga o da instrucciones claras. Nunca crashea silenciosamente.

**Low-cost**: el objetivo es reducir tokens enviados al modelo. En lugar de historial completo, los agentes recuperan solo los recuerdos relevantes. Cada decisión de diseño debe tener en cuenta este principio.

**Local-first**: el sistema funciona completamente offline con Ollama. Los proveedores externos (OpenAI) son opcionales.

**Sin redundancia**: si una función ya existe en `@orbis/shared`, no se reimplementa en otro paquete. Se importa.

**Módulos aislados**: cada paquete puede reiniciarse, borrarse o reemplazarse sin afectar al resto. Si se borra `data/memor.db`, el sistema la recrea con `orbis db migrate`. Los demás módulos no se caen.

**Una sola fuente de verdad**: toda la configuración viene de `orbis.config.json`. Toda la lógica compartida viene de `@orbis/shared`. No hay duplicación.

---

## Lo que nunca debes hacer

- No uses `console.log` en código de producción. Usa el logger.
- No hardcodees rutas, puertos, nombres de modelos ni cualquier valor que pueda cambiar. Todo va al config.
- No importes desde rutas internas de otros paquetes. Solo desde su `index.ts`.
- No crees dependencias circulares entre paquetes.
- No modifiques migraciones ya aplicadas. Crea una nueva migración.
- No uses `any` sin justificación explícita en un comentario.
- No instales dependencias con `npm` o `yarn`. Solo `bun add`.
- No escribas lógica de negocio en el CLI. El CLI llama a la API pública de los paquetes, no reimplementa nada.
- No adelantes trabajo de fases futuras. Si no está en la fase actual, no se toca.
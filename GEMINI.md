Todo lo que un agente necesita saber para trabajar en este proyecto.
Lee este archivo completo antes de escribir cualquier línea de código.

## Qué es Orbis

Orbis es un sistema de agentes de IA con memoria persistente. Su objetivo es permitir que los agentes operen de forma continua, económica y sin configuración manual, recordando información a largo plazo en lugar de depender del historial de conversación completo.

## Stack tecnológico
- **Configuración**: `orbis.config.json` en la raíz del proyecto

No uses `node`, `npm`, `npx` ni `yarn` en ningún comando. Todo pasa por `bun`.

## Paquetes y sus responsabilidades

### `@orbis/shared`
La base de todo. No importa nada de los otros paquetes del proyecto.

### `@orbis/memor`
El sistema de memoria. Depende solo de `@orbis/shared`.
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
El orquestador. Depende de todos.

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

El archivo `orbis.config.json` en la raíz es la **única fuente de verdad**. Ningún paquete tiene valores hardcodeados: todos consultan el config a través de `@orbis/shared`.

Si necesitas agregar una nueva opción de configuración:
1. Agrégala al schema en `orbis.config.schema.json`
2. Agrégala al tipo correspondiente en `@orbis/shared/src/types/`
3. Agrégala al `orbis.config.json` con su valor por defecto
4. Nunca hardcodees el valor en el código

## Base de datos

### Ubicación
Todas las bases de datos viven en la carpeta `data/` que está en `.gitignore`. Son datos de runtime, no de versionado. La ruta se construye como `config.data.path + "/" + config.memor.database`.

### Migraciones
Las migraciones son archivos `.sql` numerados en `core/memor/src/store/migrations/`. Al inicializar, se corren automáticamente las pendientes. Nunca modifiques una migración ya aplicada: crea una nueva.

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
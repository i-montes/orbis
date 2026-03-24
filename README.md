# 🌐 Orbis

Orbis es un sistema de memoria semántica persistente para agentes de IA. A diferencia de las bases de datos vectoriales tradicionales, Orbis utiliza un **grafo de conocimiento dinámico** y **decaimiento temporal** para imitar cómo los humanos recuerdan y olvidan información.

## 🚀 Inicio Rápido

Para inicializar el proyecto por primera vez (instalar dependencias, configurar entorno, compilar y ejecutar pruebas), simplemente ejecuta:

```bash
bun run setup
```

## 🏗️ Arquitectura del Proyecto

Orbis está construido como un monorepo gestionado por **Bun**, con una jerarquía de dependencias estrictamente unidireccional:

-   `@orbis/shared`: Utilidades, tipos globales y el sistema de configuración centralizado.
-   `@orbis/memor`: El núcleo del motor de memoria. Gestiona la base de datos SQLite, los embeddings multilingües (`bge-m3`), el índice vectorial y la lógica del grafo.
-   `@orbis/socket`: Servidor WebSocket para comunicación en tiempo real.
-   `@orbis/mcp`: Servidor Model Context Protocol para exponer herramientas de memoria a LLMs (Claude, Agentes personalizados).
-   `@orbis/cli`: Interfaz de línea de comandos para la gestión total del sistema.
-   `@orbis/orbis`: El orquestador principal que une todas las piezas.

## 🛠️ Herramientas de Desarrollo

### 1. Gestión de la Base de Datos (CLI)
Orbis incluye un CLI potente accesible mediante el alias `orbis`:

```bash
bun run orbis db stats    # Ver estadísticas de la memoria (recuerdos y aristas)
bun run orbis db reset    # Limpiar toda la memoria (Flush total)
bun run orbis db migrate  # Ejecutar migraciones pendientes
```

### 2. Siembra de Datos (Seeding)
Para realizar pruebas con un dataset real de 100 recuerdos interconectados en 10 categorías (IA, Espacio, Café, Salud, etc.):

```bash
bun run scripts/seed-orbis.ts
```

### 3. Inspector MCP
Para probar cómo un LLM ve y utiliza las herramientas de Orbis (`orbis_remember`, `orbis_recall`, `orbis_relate`):

```bash
bun run mcp-inspector
```

### 4. Pruebas Automatizadas
Ejecuta la suite completa de 42 tests de integración y unidad:

```bash
bun run test
```

## 🧠 Conceptos Clave de la Memoria

### Graph Boosting (Refuerzo por Grafo)
Orbis no solo busca por similitud de palabras. Si un recuerdo es muy relevante, "activa" a sus vecinos en el grafo de conocimiento, elevando recuerdos relacionados aunque no compartan términos exactos con la búsqueda.

### Recency Decay (`recency_lambda`)
La importancia de un recuerdo disminuye con el tiempo según la fórmula $e^{-\lambda \cdot t}$. Esto asegura que el agente priorice información reciente sin olvidar hechos fundamentales del pasado.

### Local-First & Privacy
Por defecto, Orbis utiliza el modelo `Xenova/bge-m3` que se ejecuta localmente en tu CPU usando Transformers.js, garantizando que tu memoria nunca salga de tu máquina.

---
Creado con ❤️ para el ecosistema de agentes de IA.

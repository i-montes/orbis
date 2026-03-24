/**
 * Orbis Master Test Runner
 * Executes all project tests in a specific order.
 */

// Phase 1: Shared Core (Base infrastructure)
import "./core/shared/tests/shared.test.ts";

// Phase 2: Memor Store & Migrations (Persistence layer)
import "./core/memor/tests/store.test.ts";

// Phase 3: Embeddings & Vector Management (Intelligence layer)
import "./core/memor/tests/embeddings.test.ts";

// Phase 4: Retrieval & Ranking (Search layer)
import "./core/memor/tests/retrieval.test.ts";

// Phase 5: Auto-Linking (Graph layer)
import "./core/memor/tests/graph.test.ts";

// Phase 6: Graph-Augmented Retrieval
import "./core/memor/tests/graph-retrieval.test.ts";

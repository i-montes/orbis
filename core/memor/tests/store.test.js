"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var store_js_1 = require("../src/store/store.js");
var path_1 = require("path");
var fs_1 = require("fs");
var bun_sqlite_1 = require("bun:sqlite");
(0, bun_test_1.describe)('MemorStore', function () {
    var store;
    var currentDbPath;
    (0, bun_test_1.beforeEach)(function () {
        // Generate a unique path for each test to avoid file locking issues on Windows
        currentDbPath = (0, path_1.join)(import.meta.dir, "../../../../data/test-".concat(Date.now(), "-").concat(Math.floor(Math.random() * 10000), ".db"));
        store = new store_js_1.MemorStore(currentDbPath);
    });
    (0, bun_test_1.afterEach)(function () {
        store.close();
        // Try to clean up the db file and its WAL/SHM files
        try {
            if ((0, fs_1.existsSync)(currentDbPath))
                (0, fs_1.unlinkSync)(currentDbPath);
            if ((0, fs_1.existsSync)(currentDbPath + '-wal'))
                (0, fs_1.unlinkSync)(currentDbPath + '-wal');
            if ((0, fs_1.existsSync)(currentDbPath + '-shm'))
                (0, fs_1.unlinkSync)(currentDbPath + '-shm');
        }
        catch (e) {
            // Ignore cleanup errors on Windows due to delayed lock release
        }
    });
    (0, bun_test_1.test)('Inicialización: debe crear la base de datos y las tablas', function () {
        (0, bun_test_1.expect)((0, fs_1.existsSync)(currentDbPath)).toBe(true);
        var db = new bun_sqlite_1.Database(currentDbPath);
        var row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memories'").get();
        (0, bun_test_1.expect)(row).not.toBeNull();
        db.close();
    });
    (0, bun_test_1.test)('insertMemory: inserta un recuerdo y retorna objeto con id y accessCount 0', function () {
        var memory = store.insertMemory({
            content: 'test content',
            createdAt: Date.now(),
            memoryType: 'FACT',
            metadata: { foo: 'bar' }
        });
        (0, bun_test_1.expect)(memory.id).toBeDefined();
        (0, bun_test_1.expect)(typeof memory.id).toBe('string');
        (0, bun_test_1.expect)(memory.accessCount).toBe(0);
        (0, bun_test_1.expect)(memory.content).toBe('test content');
        (0, bun_test_1.expect)(memory.memoryType).toBe('FACT');
        (0, bun_test_1.expect)(memory.metadata).toEqual({ foo: 'bar' });
    });
    (0, bun_test_1.test)('insertMemory: arroja error por constraint de id duplicado', function () {
        var memoryInput = {
            id: 'custom-id-1',
            content: 'test content',
            createdAt: Date.now(),
            memoryType: 'FACT'
        };
        store.insertMemory(memoryInput);
        (0, bun_test_1.expect)(function () {
            store.insertMemory(memoryInput);
        }).toThrow();
    });
    (0, bun_test_1.test)('getMemoryById: retorna memoria existente y deserializa metadata', function () {
        var inserted = store.insertMemory({
            content: 'test fetch',
            createdAt: Date.now(),
            memoryType: 'DECISION',
            metadata: { deep: { nested: true } }
        });
        var fetched = store.getMemoryById(inserted.id);
        (0, bun_test_1.expect)(fetched).not.toBeNull();
        (0, bun_test_1.expect)(fetched === null || fetched === void 0 ? void 0 : fetched.content).toBe('test fetch');
        (0, bun_test_1.expect)(fetched === null || fetched === void 0 ? void 0 : fetched.metadata).toEqual({ deep: { nested: true } });
    });
    (0, bun_test_1.test)('getMemoryById: retorna null si no existe', function () {
        var fetched = store.getMemoryById('non-existent-id');
        (0, bun_test_1.expect)(fetched).toBeNull();
    });
    (0, bun_test_1.test)('updateAccessStats: incrementa accessCount y actualiza lastAccessedAt', function () {
        var memory = store.insertMemory({
            content: 'stats test',
            createdAt: Date.now() - 10000, // 10s en el pasado
            memoryType: 'EXPERIENCE'
        });
        (0, bun_test_1.expect)(memory.accessCount).toBe(0);
        (0, bun_test_1.expect)(memory.lastAccessedAt).toBeUndefined();
        store.updateAccessStats(memory.id);
        var fetched = store.getMemoryById(memory.id);
        (0, bun_test_1.expect)(fetched === null || fetched === void 0 ? void 0 : fetched.accessCount).toBe(1);
        (0, bun_test_1.expect)(fetched === null || fetched === void 0 ? void 0 : fetched.lastAccessedAt).toBeGreaterThan(memory.createdAt);
    });
    (0, bun_test_1.test)('deleteMemory: borra correctamente y retorna booleano', function () {
        var memory = store.insertMemory({
            content: 'delete test',
            createdAt: Date.now(),
            memoryType: 'TASK'
        });
        (0, bun_test_1.expect)(store.getMemoryById(memory.id)).not.toBeNull();
        var deleted = store.deleteMemory(memory.id);
        (0, bun_test_1.expect)(deleted).toBe(true);
        (0, bun_test_1.expect)(store.getMemoryById(memory.id)).toBeNull();
        var deletedAgain = store.deleteMemory(memory.id);
        (0, bun_test_1.expect)(deletedAgain).toBe(false);
    });
    (0, bun_test_1.test)('getAllMemories: retorna todos ordenados por fecha', function () {
        store.insertMemory({ id: 'm1', content: 'older', createdAt: 100, memoryType: 'FACT' });
        store.insertMemory({ id: 'm2', content: 'newer', createdAt: 200, memoryType: 'FACT' });
        var all = store.getAllMemories();
        (0, bun_test_1.expect)(all.length).toBe(2);
        (0, bun_test_1.expect)(all[0].id).toBe('m2'); // newer first
        (0, bun_test_1.expect)(all[1].id).toBe('m1');
    });
    (0, bun_test_1.test)('getMemoriesBySession: retorna memorias de la sesion correctamente', function () {
        var m1 = store.insertMemory({ content: 'c1', createdAt: 1, memoryType: 'FACT' });
        var m2 = store.insertMemory({ content: 'c2', createdAt: 2, memoryType: 'FACT' });
        // Insert dummy session and session_memories using direct DB access for testing
        var db = new bun_sqlite_1.Database(currentDbPath);
        db.exec("INSERT INTO sessions (id, created_at) VALUES ('s1', 1)");
        db.exec("INSERT INTO session_memories (session_id, memory_id, relevance_score) VALUES ('s1', '".concat(m1.id, "', 0.8)"));
        db.exec("INSERT INTO session_memories (session_id, memory_id, relevance_score) VALUES ('s1', '".concat(m2.id, "', 0.9)"));
        db.close();
        var sessionMemories = store.getMemoriesBySession('s1');
        (0, bun_test_1.expect)(sessionMemories.length).toBe(2);
        // Highest relevance score first
        (0, bun_test_1.expect)(sessionMemories[0].id).toBe(m2.id);
        (0, bun_test_1.expect)(sessionMemories[1].id).toBe(m1.id);
    });
    (0, bun_test_1.test)('countMemories: retorna el conteo correcto', function () {
        (0, bun_test_1.expect)(store.countMemories()).toBe(0);
        store.insertMemory({ content: '1', createdAt: 1, memoryType: 'FACT' });
        store.insertMemory({ content: '2', createdAt: 2, memoryType: 'FACT' });
        (0, bun_test_1.expect)(store.countMemories()).toBe(2);
    });
    (0, bun_test_1.test)('getDatabaseSize: retorna tamanio de archivo > 0', function () {
        store.insertMemory({ content: 'fill', createdAt: 1, memoryType: 'FACT' });
        (0, bun_test_1.expect)(store.getDatabaseSize()).toBeGreaterThan(0);
    });
});

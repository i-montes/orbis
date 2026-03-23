"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorStore = void 0;
var bun_sqlite_1 = require("bun:sqlite");
var index_js_1 = require("./migrations/index.js");
var shared_1 = require("@orbis/shared");
var fs_1 = require("fs");
var path_1 = require("path");
var logger = (0, shared_1.createLogger)('memor:store');
var MemorStore = /** @class */ (function () {
    function MemorStore(customPath) {
        try {
            if (customPath) {
                this.dbPath = customPath;
            }
            else {
                var config = (0, shared_1.getConfig)();
                this.dbPath = (0, path_1.join)(config.data.path, config.memor.database);
            }
            (0, fs_1.mkdirSync)((0, path_1.dirname)(this.dbPath), { recursive: true });
            this.db = new bun_sqlite_1.Database(this.dbPath);
            this.db.exec('PRAGMA journal_mode = WAL;');
            this.db.exec('PRAGMA foreign_keys = ON;');
            this.db.exec('PRAGMA synchronous = NORMAL;');
            logger.info("Opened database at ".concat(this.dbPath));
            (0, index_js_1.runMigrations)(this.db);
        }
        catch (error) {
            if (error instanceof shared_1.DatabaseError) {
                throw error;
            }
            throw new shared_1.DatabaseError("Failed to initialize database at ".concat(this.dbPath), 'INIT_FAILED', error);
        }
    }
    MemorStore.prototype.close = function () {
        if (this.db) {
            this.db.close();
            logger.info('Database connection closed');
        }
    };
    MemorStore.prototype.insertMemory = function (memoryInput) {
        var memory = __assign(__assign({}, memoryInput), { id: memoryInput.id || (0, shared_1.generateId)(), accessCount: 0 });
        var stmt = this.db.prepare("\n      INSERT INTO memories (\n        id, content, summary, source, memory_type, metadata, \n        access_count, last_accessed_at, created_at, updated_at\n      )\n      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n    ");
        try {
            stmt.run(memory.id, memory.content, memory.summary || null, memory.source || 'SYSTEM', memory.memoryType, memory.metadata ? JSON.stringify(memory.metadata) : null, memory.accessCount, memory.lastAccessedAt || null, memory.createdAt, Date.now());
            return memory;
        }
        catch (error) {
            throw new shared_1.DatabaseError("Failed to insert memory ".concat(memory.id), 'INSERT_MEMORY_FAILED', error);
        }
    };
    MemorStore.prototype.getMemoryById = function (id) {
        var stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
        try {
            var row = stmt.get(id);
            if (!row)
                return null;
            return this.mapRowToMemory(row);
        }
        catch (error) {
            throw new shared_1.DatabaseError("Failed to get memory ".concat(id), 'GET_MEMORY_FAILED', error);
        }
    };
    MemorStore.prototype.updateAccessStats = function (id) {
        var stmt = this.db.prepare("\n      UPDATE memories\n      SET access_count = access_count + 1,\n          last_accessed_at = ?\n      WHERE id = ?\n    ");
        try {
            stmt.run(Date.now(), id);
        }
        catch (error) {
            throw new shared_1.DatabaseError("Failed to update access stats for memory ".concat(id), 'UPDATE_STATS_FAILED', error);
        }
    };
    MemorStore.prototype.deleteMemory = function (id) {
        var stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
        try {
            var result = stmt.run(id);
            return result.changes > 0;
        }
        catch (error) {
            throw new shared_1.DatabaseError("Failed to delete memory ".concat(id), 'DELETE_MEMORY_FAILED', error);
        }
    };
    MemorStore.prototype.getAllMemories = function () {
        var _this = this;
        var stmt = this.db.prepare('SELECT * FROM memories ORDER BY created_at DESC');
        try {
            var rows = stmt.all();
            return rows.map(function (row) { return _this.mapRowToMemory(row); });
        }
        catch (error) {
            throw new shared_1.DatabaseError('Failed to get all memories', 'GET_ALL_MEMORIES_FAILED', error);
        }
    };
    MemorStore.prototype.getMemoriesBySession = function (sessionId) {
        var _this = this;
        var stmt = this.db.prepare("\n      SELECT m.* \n      FROM memories m\n      JOIN session_memories sm ON m.id = sm.memory_id\n      WHERE sm.session_id = ?\n      ORDER BY sm.relevance_score DESC\n    ");
        try {
            var rows = stmt.all(sessionId);
            return rows.map(function (row) { return _this.mapRowToMemory(row); });
        }
        catch (error) {
            throw new shared_1.DatabaseError("Failed to get memories for session ".concat(sessionId), 'GET_SESSION_MEMORIES_FAILED', error);
        }
    };
    MemorStore.prototype.countMemories = function () {
        var stmt = this.db.prepare('SELECT COUNT(*) as count FROM memories');
        try {
            var result = stmt.get();
            return result.count;
        }
        catch (error) {
            throw new shared_1.DatabaseError('Failed to count memories', 'COUNT_MEMORIES_FAILED', error);
        }
    };
    MemorStore.prototype.getDatabaseSize = function () {
        try {
            var stats = (0, fs_1.statSync)(this.dbPath);
            return stats.size;
        }
        catch (error) {
            throw new shared_1.DatabaseError("Failed to get database size for ".concat(this.dbPath), 'GET_DB_SIZE_FAILED', error);
        }
    };
    MemorStore.prototype.mapRowToMemory = function (row) {
        return {
            id: row.id,
            content: row.content,
            summary: row.summary,
            source: row.source,
            memoryType: row.memory_type,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            accessCount: row.access_count,
            lastAccessedAt: row.last_accessed_at,
            createdAt: row.created_at
        };
    };
    return MemorStore;
}());
exports.MemorStore = MemorStore;

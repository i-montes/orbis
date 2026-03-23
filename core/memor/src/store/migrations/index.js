"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
var fs_1 = require("fs");
var path_1 = require("path");
var shared_1 = require("@orbis/shared");
var logger = (0, shared_1.createLogger)('memor');
function runMigrations(db) {
    // 1. Verifica si la tabla _migrations existe. Si no existe, la crea primero.
    var checkTable = db.prepare("\n    SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations';\n  ").get();
    if (!checkTable) {
        db.exec("\n      CREATE TABLE _migrations (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        name TEXT NOT NULL UNIQUE,\n        applied_at INTEGER NOT NULL\n      );\n    ");
    }
    // 2. Lee todos los archivos .sql de la carpeta migrations/ ordenados por nombre
    // Usamos import.meta.dir (Bun) para obtener el directorio actual
    var migrationsDir = import.meta.dir;
    var files = (0, fs_1.readdirSync)(migrationsDir)
        .filter(function (file) { return file.endsWith('.sql'); })
        .sort();
    var appliedCount = 0;
    var checkMigration = db.prepare('SELECT id FROM _migrations WHERE name = ?');
    var insertMigration = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');
    var _loop_1 = function (file) {
        var isApplied = checkMigration.get(file);
        if (!isApplied) {
            var filePath = (0, path_1.join)(migrationsDir, file);
            var sql_1 = (0, fs_1.readFileSync)(filePath, 'utf-8');
            var applyMigration = db.transaction(function () {
                db.exec(sql_1);
                insertMigration.run(file, Date.now());
            });
            try {
                applyMigration();
                appliedCount++;
                logger.info("Migration applied: ".concat(file));
            }
            catch (error) {
                throw new shared_1.DatabaseError("Migration failed: ".concat(file), 'MIGRATION_FAILED', error);
            }
        }
    };
    // 3 & 4 & 5. Para cada archivo, verifica si está registrado, si no ejecuta
    for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
        var file = files_1[_i];
        _loop_1(file);
    }
    // 6. Log final
    if (appliedCount > 0) {
        logger.info("Applied ".concat(appliedCount, " migrations successfully."));
    }
    else {
        logger.info('Database schema is up to date. No pending migrations.');
    }
}

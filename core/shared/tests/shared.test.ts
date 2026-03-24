import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, getConfig } from "../src/config/loader.js";
import { createLogger } from "../src/logger/logger.js";
import { getEventBus } from "../src/events/bus.js";
import { generateId, hashContent, normalizeText, formatBytes, daysSince, now, findProjectRoot } from "../src/utils/index.js";
import { ConfigError } from "../src/errors/config.js";

const root = findProjectRoot();
const TEST_CONFIG = "orbis.test.json";
const testPath = resolve(root, TEST_CONFIG);

describe("Config Loader", () => {
  afterEach(() => {
    if (existsSync(testPath)) unlinkSync(testPath);
  });

  it("loads correctly a valid config", () => {
    writeFileSync(testPath, JSON.stringify({ name: "test-orbis" }), "utf8");
    const config = loadConfig(TEST_CONFIG, true);
    expect(config.name).toBe("test-orbis");
    expect(config.socket.port).toBe(3001); // default preserved
  });

  it("returns defaults when file does not exist", () => {
    if (existsSync(testPath)) unlinkSync(testPath);
    const config = loadConfig(TEST_CONFIG, true);
    expect(config.name).toBe("orbis");
    expect(existsSync(testPath)).toBe(true);

    // Verify embedding defaults
    expect(config.memor.embedding.default).toBe("ollama-qwen");
    expect(config.memor.embedding.providers["ollama-qwen"]).toBeDefined();
    expect(config.memor.embedding.providers["ollama-qwen"]?.model).toBe("qwen3-embedding:0.6b");
    expect(config.memor.embedding.providers["ollama-qwen"]?.dimensions).toBe(1024);
  });

  it("throws ConfigError with correct field when invalid value", () => {
    writeFileSync(testPath, JSON.stringify({ memor: { recency_lambda: 1.5 } }), "utf8");
    expect(() => loadConfig(TEST_CONFIG, true)).toThrow(/recency_lambda/);
  });

  it("getConfig() returns the same instance", () => {
    const c1 = getConfig();
    const c2 = getConfig();
    expect(c1).toBe(c2);
  });
});

describe("Logger", () => {
  afterEach(() => {
    if (existsSync(testPath)) unlinkSync(testPath);
  });

  it("format pretty includes timestamp and module", () => {
    if (existsSync(testPath)) unlinkSync(testPath);
    loadConfig(TEST_CONFIG, true); // ensure defaults in a safe test path
    const spy = spyOn(process.stdout, "write");
    const logger = createLogger("test-logger");
    logger.info("Hello");
    // Get last call to avoid interference
    const output = spy.mock.calls[spy.mock.calls.length - 1]![0] as string;
    expect(output).toContain("[test-logger]");
    expect(output).toContain("INFO");
    spy.mockRestore();
  });

  it("format json is valid JSON", () => {
    const jsonPath = resolve(root, "orbis.json.test");
    writeFileSync(jsonPath, JSON.stringify({ logger: { format: "json" } }), "utf8");
    loadConfig("orbis.json.test", true);
    
    const spy = spyOn(process.stdout, "write");
    const logger = createLogger("test-json");
    logger.info("Hello JSON");
    const output = spy.mock.calls[spy.mock.calls.length - 1]![0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.message).toBe("Hello JSON");
    expect(parsed.module).toBe("test-json");
    spy.mockRestore();
    
    if (existsSync(jsonPath)) unlinkSync(jsonPath);
  });

  it("lower levels are not printed", () => {
    const levelPath = resolve(root, "orbis.level.test");
    writeFileSync(levelPath, JSON.stringify({ logger: { level: "warn" } }), "utf8");
    loadConfig("orbis.level.test", true);

    const spy = spyOn(process.stdout, "write");
    const logger = createLogger("test-level");
    const callsBefore = spy.mock.calls.length;
    logger.info("Should not see this");
    expect(spy.mock.calls.length).toBe(callsBefore);
    logger.warn("Should see this");
    expect(spy.mock.calls.length).toBe(callsBefore + 1);
    spy.mockRestore();

    if (existsSync(levelPath)) unlinkSync(levelPath);
  });
});

describe("Utils", () => {
  it("generateId() returns unique strings", () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(1000);
  });

  it("hashContent() is consistent", async () => {
    const h1 = await hashContent("test");
    const h2 = await hashContent("test");
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64);
  });

  it("normalizeText() works correctly", () => {
    expect(normalizeText("  A   B  \n C ")).toBe("a b c");
  });

  it("formatBytes() works correctly", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
  });

  it("daysSince() returns 0 for recent timestamp", () => {
    expect(daysSince(now() - 1000)).toBeLessThan(0.01);
  });
});

describe("Event Bus", () => {
  it("listener receives payload", () => {
    const bus = getEventBus();
    let received: any = null;
    const listener = (p: any) => { received = p; };
    bus.on("memory:stored", listener);
    bus.emit("memory:stored", { 
      id: '1', 
      content: 'test', 
      createdAt: Date.now(), 
      accessCount: 0 
    });
    expect(received.content).toBe("test");
    bus.off("memory:stored", listener);
  });

  it("off() removes listener", () => {
    const bus = getEventBus();
    let count = 0;
    const listener = () => { count++; };
    bus.on("system:ready", listener);
    bus.emit("system:ready", { module: "1" });
    bus.off("system:ready", listener);
    bus.emit("system:ready", { module: "2" });
    expect(count).toBe(1);
  });

  it("exceptions in listener do not crash", () => {
    const bus = getEventBus();
    bus.on("system:ready", () => { throw new Error("Boom"); });
    expect(() => bus.emit("system:ready", { module: "crash" })).not.toThrow();
  });
});

import { spawnSync } from "bun";
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

// Colores ANSI manuales para evitar depender de 'chalk' antes de bun install
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

async function runCommand(command: string, args: string[], description: string) {
  console.log(`${colors.blue}\n[Setup] ${description}...${colors.reset}`);
  
  // En Bun.spawnSync, stdio debe ser un array de 3 elementos [stdin, stdout, stderr]
  const result = spawnSync([command, ...args], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
    cwd: root,
  });

  if (result.exitCode !== 0) {
    console.error(`${colors.red}❌ Error en: ${description}${colors.reset}`);
    process.exit(1);
  }
  console.log(`${colors.green}✅ Completado: ${description}${colors.reset}`);
}

async function setup() {
  console.log(`${colors.bold}${colors.magenta}\n🌐 Bienvenid@ a Orbis - Inicialización del Proyecto\n${colors.reset}`);

  // 1. Verificar directorios esenciales
  if (!existsSync(join(root, "data"))) {
    console.log(`${colors.yellow}Creando directorio data/...${colors.reset}`);
    mkdirSync(join(root, "data"), { recursive: true });
  }

  // 2. Configuración de archivos de entorno
  if (!existsSync(join(root, ".env")) && existsSync(join(root, ".env.example"))) {
    console.log(`${colors.yellow}Creando .env a partir de .env.example...${colors.reset}`);
    copyFileSync(join(root, ".env.example"), join(root, ".env"));
  }

  // 3. Instalación de dependencias
  await runCommand("bun", ["install"], "Instalando dependencias");

  // 4. Compilación del proyecto
  await runCommand("bun", ["run", "build"], "Compilando todo el workspace");

  // 5. Preparación de la base de datos
  await runCommand("bun", ["run", "orbis", "db", "migrate"], "Ejecutando migraciones de base de datos");

  // 6. Ejecución de pruebas de integridad
  await runCommand("bun", ["run", "test"], "Verificando estabilidad del sistema (Tests)");

  console.log(`${colors.bold}${colors.green}\n✨ ¡Orbis está listo para la acción! ✨${colors.reset}`);
  console.log(`${colors.cyan}\nComandos rápidos:${colors.reset}`);
  console.log(`- ${colors.yellow}bun run orbis db stats${colors.reset}      : Ver estado de la memoria`);
  console.log(`- ${colors.yellow}bun run mcp-inspector${colors.reset}      : Probar herramientas con el LLM`);
  console.log(`- ${colors.yellow}bun main.ts status${colors.reset}         : Ver estado del orquestador\n`);
}

setup().catch((err) => {
  console.error(`${colors.red}\n💥 Error fatal durante el setup:${colors.reset}`, err);
  process.exit(1);
});

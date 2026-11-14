import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { registerHooks } from "node:module";

// Export only curated facts, never the illustrative readings or surface fixtures.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL?.endsWith(".ts") &&
      specifier.startsWith(".") &&
      !specifier.endsWith(".ts")
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const { regions } = await import("../src/data/demo.ts");
const { stories } = await import("../src/data/stories.ts");
const destination = resolve(root, "backend/data/earth_context.json");
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(
  destination,
  JSON.stringify({ regions, stories }, null, 2) + "\n",
);
console.log(
  `Exported ${regions.length} regions and ${stories.length} stories.`,
);

/**
 * Build-time OpenAPI spec generator.
 *
 * Runs after tsup, from the repository root, where the annotated `.ts` sources
 * still exist. It writes `dist/swagger.json` so the runtime never has to scan
 * sources that the production image does not ship.
 *
 * Wired into `npm run build`; see the note at the top of src/config/swagger.ts
 * for why runtime scanning cannot work in the container.
 */
import fs from "fs";
import path from "path";
import { buildSwaggerSpec } from "../config/swagger";

const OUT_DIR = path.resolve(process.cwd(), "dist");
const OUT_FILE = path.join(OUT_DIR, "swagger.json");

function main() {
  const spec = buildSwaggerSpec() as { paths?: Record<string, unknown> };
  const pathCount = Object.keys(spec.paths ?? {}).length;

  if (pathCount === 0) {
    // A spec with no endpoints means the annotations were not found. Failing
    // the build is better than shipping an image whose /api-docs is silently
    // empty, which is the bug this generator exists to prevent.
    console.error(
      "❌ Swagger generation produced 0 paths. Expected annotated route files " +
        `under ${path.resolve(process.cwd(), "src/app")}. Run this from the ` +
        "server package root."
    );
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(spec, null, 2), "utf8");

  console.log(`📘 Swagger spec written to ${OUT_FILE} (${pathCount} paths).`);
}

main();

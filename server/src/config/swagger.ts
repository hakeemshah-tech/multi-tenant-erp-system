// src/config/swagger.ts
import fs from "fs";
import path from "path";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";
import { swaggerSchemas } from "./swagger.schemas";

/**
 * Where the OpenAPI spec comes from, and why it is not scanned at runtime.
 *
 * swagger-jsdoc works by reading `@swagger` JSDoc blocks out of source files.
 * That is fine in development, where the `.ts` sources are on disk, but it
 * cannot work inside the production image:
 *
 *   - tsup bundles the whole app into `dist/index.js`, so there is no
 *     `dist/app/**\/*.js` tree to point the scanner at, and
 *   - esbuild strips comments, so the 28 annotated route files contribute zero
 *     `@swagger` blocks to the bundle.
 *
 * Pointing `apis` at `dist` therefore yields an empty spec, which is exactly
 * what `/api-docs` used to render in the container. The spec is instead
 * generated from the sources at build time (see `src/tools/generateSwagger.ts`)
 * and written to `dist/swagger.json`, which the runtime loads directly.
 */
export const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "HR Platform API",
      version: "1.0.0",
    },
    servers: [
      {
        url: "/api", // ✅ tells Swagger that all endpoints are prefixed with /api
        description: "Base API path",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: swaggerSchemas,
    },
  },
  // Resolved against the process working directory, which is the repository
  // root in development and the build stage.
  apis: ["src/app/**/*.ts"],
};

/** Scan the TypeScript sources. Only possible where `src/` exists. */
export const buildSwaggerSpec = () => swaggerJsdoc(swaggerOptions);

/** Path of the spec emitted at build time, alongside the bundle. */
export const PREBUILT_SPEC_PATH = path.join(__dirname, "swagger.json");

const countPaths = (spec: unknown) =>
  Object.keys((spec as { paths?: Record<string, unknown> })?.paths ?? {})
    .length;

/**
 * Prefers the build-time spec and falls back to scanning sources, so the same
 * code serves populated docs in the container and picks up live edits in dev.
 */
const resolveSpec = () => {
  try {
    if (fs.existsSync(PREBUILT_SPEC_PATH)) {
      const spec = JSON.parse(fs.readFileSync(PREBUILT_SPEC_PATH, "utf8"));
      console.log(
        `📘 Swagger: loaded prebuilt spec (${countPaths(spec)} paths).`
      );
      return spec;
    }
  } catch (error) {
    console.warn(
      "⚠️ Swagger: prebuilt spec unreadable, falling back to source scan:",
      error
    );
  }

  const spec = buildSwaggerSpec();
  const paths = countPaths(spec);

  if (paths === 0) {
    console.warn(
      "⚠️ Swagger: 0 paths found. No prebuilt dist/swagger.json and no readable " +
        "src/app/**/*.ts from this working directory; /api-docs will be empty."
    );
  } else {
    console.log(`📘 Swagger: scanned sources (${paths} paths).`);
  }

  return spec;
};

export const setupSwagger = (app: Express) => {
  const swaggerSpec = resolveSpec();

  // Exposed so tooling can fetch the contract without scraping the UI.
  app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

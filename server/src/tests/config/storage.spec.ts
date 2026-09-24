import fs from "fs";
import path from "path";

/**
 * Regression cover for the boot crash:
 *
 *   Error: EACCES: permission denied, mkdir '/uploads/temp'
 *
 * The upload directory used to be `path.join(__dirname, "../../../uploads/temp")`.
 * That is correct under ts-node, where `__dirname` is `src/app/bulkImport`, but
 * tsup bundles the app into `dist/index.js`, so at runtime `__dirname` is
 * `/app/dist` and the three-level hop escaped to `/uploads` at the filesystem
 * root. The non-root container user cannot create that, so the process died
 * before binding and compose reported `container erp-server is unhealthy`.
 *
 * The contract pinned here: the upload root is always inside the working
 * directory (or an explicit UPLOAD_DIR), never at the filesystem root.
 */
describe("upload directory resolution", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  const loadModule = () =>
    require("@/config/storage") as typeof import("@/config/storage");

  it("defaults to a directory under the working directory", () => {
    delete process.env.UPLOAD_DIR;

    const { UPLOAD_ROOT } = loadModule();

    expect(UPLOAD_ROOT).toBe(path.resolve(process.cwd(), "uploads"));
  });

  it("never resolves to the filesystem root", () => {
    delete process.env.UPLOAD_DIR;

    const { TEMP_UPLOAD_DIR } = loadModule();

    // The exact shape of the original bug.
    expect(TEMP_UPLOAD_DIR).not.toBe(path.resolve("/uploads/temp"));
    expect(path.resolve(TEMP_UPLOAD_DIR).startsWith(process.cwd())).toBe(true);
  });

  it("honours an explicit UPLOAD_DIR, as the image sets", () => {
    process.env.UPLOAD_DIR = path.join(path.sep, "app", "uploads");

    const { UPLOAD_ROOT, TEMP_UPLOAD_DIR } = loadModule();

    expect(UPLOAD_ROOT).toBe(path.join(path.sep, "app", "uploads"));
    expect(TEMP_UPLOAD_DIR).toBe(path.join(path.sep, "app", "uploads", "temp"));
  });

  it("places temp inside the upload root", () => {
    delete process.env.UPLOAD_DIR;

    const { UPLOAD_ROOT, TEMP_UPLOAD_DIR } = loadModule();

    expect(TEMP_UPLOAD_DIR).toBe(path.join(UPLOAD_ROOT, "temp"));
  });

  it("reports failure instead of throwing when the directory cannot be made", () => {
    // The failure is injected rather than provoked with a real unwritable path.
    //
    // This previously pointed UPLOAD_DIR at /proc/definitely-not-writable and
    // relied on the filesystem refusing it, which is platform-specific: on
    // Windows that path is creatable, on Linux it depends on procfs and on
    // whether the process is root. Mocking mkdirSync tests the behaviour that
    // actually matters -- that `ensureUploadDir` catches and reports instead of
    // throwing at import time -- and does so identically everywhere, with no
    // filesystem access at all.
    process.env.UPLOAD_DIR = path.join(path.sep, "app", "uploads");

    const { ensureUploadDir, TEMP_UPLOAD_DIR } = loadModule();

    const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => {
      const error = new Error(
        "EACCES: permission denied, mkdir"
      ) as NodeJS.ErrnoException;
      error.code = "EACCES";
      throw error;
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(() => ensureUploadDir(TEMP_UPLOAD_DIR)).not.toThrow();
      expect(ensureUploadDir(TEMP_UPLOAD_DIR)).toBe(false);
      expect(mkdirSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      mkdirSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("returns true when the directory is created", () => {
    process.env.UPLOAD_DIR = path.join(path.sep, "app", "uploads");

    const { ensureUploadDir, TEMP_UPLOAD_DIR } = loadModule();

    const mkdirSpy = jest
      .spyOn(fs, "mkdirSync")
      .mockImplementation(() => undefined);

    try {
      expect(ensureUploadDir(TEMP_UPLOAD_DIR)).toBe(true);
      expect(mkdirSpy).toHaveBeenCalledWith(TEMP_UPLOAD_DIR, {
        recursive: true,
      });
    } finally {
      mkdirSpy.mockRestore();
    }
  });
});

jest.mock("../../../src/backend/utility/eci-utility", () => ({
  getRootECI: jest.fn(),
  getECIByTag: jest.fn(),
  traverseHierarchy: jest.fn(),
  getPicoIDByName: jest.fn(),
}));

jest.mock("../../../src/backend/utility/http-utility", () => ({
  getFetchRequest: jest.fn(),
  postFetchRequest: jest.fn(),
}));

const apiUtility = require("../../../src/backend/utility/api-utility");
const eciUtility = require("../../../src/backend/utility/eci-utility");
const httpUtility = require("../../../src/backend/utility/http-utility");
const path = require("path");

global.fetch = jest.fn();

describe("Unit Tests: api-utility.js", () => {
  // Store the original setTimeout to bypass the 30-second delay in setupRegistry
  const originalSetTimeout = global.setTimeout;

  beforeAll(() => {
    // Override setTimeout to instantly execute its callback
    global.setTimeout = jest.fn((cb) => cb());
  });

  afterAll(() => {
    global.setTimeout = originalSetTimeout;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("picoHasRuleset", () => {
    test("returns true if the ruleset is found", async () => {
      httpUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          rulesets: [{ rid: "other.ruleset" }, { rid: "target.ruleset" }],
        }),
      });

      const result = await apiUtility.picoHasRuleset(
        "eci-123",
        "target.ruleset",
      );
      expect(result).toBe(true);
    });

    test("returns false if the ruleset is not found", async () => {
      httpUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          rulesets: [{ rid: "other.ruleset" }],
        }),
      });

      const result = await apiUtility.picoHasRuleset(
        "eci-123",
        "target.ruleset",
      );
      expect(result).toBe(false);
    });

    test("returns false and logs error on HTTP failure", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      httpUtility.getFetchRequest.mockRejectedValueOnce(
        new Error("Network Error"),
      );

      const result = await apiUtility.picoHasRuleset(
        "eci-123",
        "target.ruleset",
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "picoHasRuleset error:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("installRuleset", () => {
    test("skips installation if ruleset is already installed", async () => {
      httpUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          rulesets: [{ rid: "my-ruleset" }],
        }),
      });

      await apiUtility.installRuleset(
        "eci-123",
        "file:///path/to/my-ruleset.krl",
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("installs ruleset if it is not currently installed", async () => {
      httpUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({ rulesets: [] }),
      });

      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ success: true }),
      });

      const filePath = "file:///path/to/my-ruleset.krl";

      await apiUtility.installRuleset("eci-123", filePath);

      expect(httpUtility.postFetchRequest).toHaveBeenCalledWith(
        "/c/eci-123/event/engine_ui/install/query/io.picolabs.pico-engine-ui/pico",
        expect.objectContaining({
          url: filePath,
          config: {},
        }),
      );
    });
  });

  describe("installOwner", () => {
    test("resolves correct path and calls install process", async () => {
      const cwdSpy = jest
        .spyOn(process, "cwd")
        .mockReturnValue("/mock/folder/MCPforEXP/backend");

      httpUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({ rulesets: [] }),
      });

      // Mock postFetchRequest to simulate successful installation
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ success: true }),
      });

      await apiUtility.installOwner("eci-123");

      const expectedPathFragment = path
        .join("Manifold-api", "io.picolabs.manifold_owner.krl")
        .split(path.sep)
        .join("/");

      expect(httpUtility.postFetchRequest).toHaveBeenCalledWith(
        expect.stringContaining(
          "/c/eci-123/event/engine_ui/install/query/io.picolabs.pico-engine-ui/pico",
        ),
        expect.objectContaining({
          url: expect.stringContaining(expectedPathFragment),
          config: {},
        }),
      );

      cwdSpy.mockRestore();
    });
  });

  describe("manifold_isAChild", () => {
    test("successfully verifies if a thing is a child", async () => {
      eciUtility.getPicoIDByName.mockResolvedValueOnce("pico-id-456");
      eciUtility.traverseHierarchy.mockResolvedValueOnce("manifold-eci-789");

      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(true),
      });

      const result = await apiUtility.manifold_isAChild("MyThing");

      expect(httpUtility.postFetchRequest).toHaveBeenCalledWith(
        "/c/manifold-eci-789/query/io.picolabs.manifold_pico/isAChild",
        { picoID: "pico-id-456" },
      );
      expect(result).toBe(true);
    });
  });

  describe("setupRegistry", () => {
    test("successfully completes bootstrap process on the first try", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      // Mock root ECI
      eciUtility.getRootECI.mockResolvedValueOnce("root-eci");

      // Mock picoHasRuleset inside installRuleset (returns empty rulesets => install)
      httpUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({ rulesets: [] }),
      });

      // Mock installRuleset POST request
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ success: true }),
      });

      // Mock getECIByTag to return bootstrap ECI
      eciUtility.getECIByTag.mockResolvedValueOnce("bootstrap-eci");

      // Mock getFetchRequest for bootstrap status
      httpUtility.getFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          owner_eci: "owner-123",
          tag_registry_eci: "tag-123",
        }),
      });

      const result = await apiUtility.setupRegistry(
        "/mock/path/to/bootstrap.krl",
      );

      expect(result).toEqual({
        owner_eci: "owner-123",
        tag_registry_eci: "tag-123",
      });

      consoleSpy.mockRestore();
    });

    test("throws an error if bootstrap times out after max attempts", async () => {
      const stdoutSpy = jest
        .spyOn(process.stdout, "write")
        .mockImplementation();

      // Mock root ECI
      eciUtility.getRootECI.mockResolvedValueOnce("root-eci");

      // Mock picoHasRuleset inside installRuleset (returns empty rulesets => install)
      httpUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({ rulesets: [] }),
      });

      // Mock installRuleset POST request
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ success: true }),
      });

      // Mock getECIByTag to always return null to simulate timeout
      eciUtility.getECIByTag.mockResolvedValue(null);

      // Pass a dummy file path to avoid TypeError
      const dummyFilePath = "/mock/path/to/bootstrap.krl";

      await expect(apiUtility.setupRegistry(dummyFilePath)).rejects.toThrow(
        "Bootstrap timed out before reaching the 'Owner' completion step.",
      );

      // Since you override setTimeout to run instantly in beforeAll, it should be called 30 times
      expect(global.setTimeout).toHaveBeenCalledTimes(30);

      stdoutSpy.mockRestore();
    });
  });
});

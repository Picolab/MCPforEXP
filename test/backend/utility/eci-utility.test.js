const {
getRootECI,
getInitializationECI,
getManifoldECI,
getECIByTag,
getChildEciByName,
getThingManifoldChannel,
traverseHierarchy,
} = require("../../../src/backend/utility/eci-utility");

const eciUtility = require("../../../src/backend/utility/eci-utility");
const apiUtility = require("../../../src/backend/utility/api-utility");

// Mock the external dependencies
jest.mock("../../src/backend/utility/api-utility", () => ({
  getFetchRequest: jest.fn(),
}));

// Mock the global fetch API
global.fetch = jest.fn();

describe("Unit Tests: eci-utility.js", () => {
  // Clear mocks after each test to ensure a clean slate
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getRootECI", () => {
    test("successfully fetches and returns the root ECI", async () => {
      // Setup the mock response
      apiUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({ eci: "root-123" }),
      });

      const result = await eciUtility.getRootECI();
      
      expect(apiUtility.getFetchRequest).toHaveBeenCalledWith("/api/ui-context");
      expect(result).toBe("root-123");
    });

    test("handles fetch errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      apiUtility.getFetchRequest.mockRejectedValueOnce(new Error("Network Error"));

      const result = await eciUtility.getRootECI();

      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith("Fetch error:", expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe("getECIByTag", () => {
    test("returns channel id when the tag matches", async () => {
      apiUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          channels: [
            { id: "chan-1", tags: ["random"] },
            { id: "chan-2", tags: ["manifold", "initialization"] },
          ],
        }),
      });

      const result = await eciUtility.getECIByTag("owner-123", "initialization");
      expect(result).toBe("chan-2");
    });

    test("throws an error if the tag is not found", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      apiUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          channels: [{ id: "chan-1", tags: ["random"] }],
        }),
      });

      const result = await eciUtility.getECIByTag("owner-123", "missing-tag");
      
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith("Fetch error:", expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe("getInitializationECI", () => {
    test("successfully retrieves the initialization ECI", async () => {
      // Because getInitializationECI calls getECIByTag internally, we mock the network call it relies on
      apiUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          channels: [{ id: "init-chan-123", tags: ["initialization"] }],
        }),
      });

      const result = await eciUtility.getInitializationECI("owner-123");
      expect(result).toBe("init-chan-123");
    });
  });

  describe("getChildEciByName", () => {
    test("returns matching child ECI when name matches", async () => {
      // 1st fetch: get children
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ children: ["child-A", "child-B"] }),
      });

      // 2nd fetch: name query for child-A (no match)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("Wrong Name"),
      });

      // 3rd fetch: name query for child-B (match!)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("Target Name"),
      });

      const result = await eciUtility.getChildEciByName("parent-123", "Target Name");
      expect(result).toBe("child-B");
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    test("returns null if no children match the name", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ children: ["child-A"] }),
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("Wrong Name"),
      });

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const result = await eciUtility.getChildEciByName("parent-123", "Target Name");
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith("Returning null from getChildEciByName");
      consoleSpy.mockRestore();
    });

    test("skips unreachable children and continues searching", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ children: ["child-broken", "child-working"] }),
      });

      // child-broken throws a network error
      global.fetch.mockRejectedValueOnce(new Error("Network timeout"));

      // child-working succeeds and matches
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("Target Name"),
      });

      const result = await eciUtility.getChildEciByName("parent-123", "Target Name");
      expect(result).toBe("child-working");
    });
  });

  describe("getManifoldECI", () => {
    test("successfully fetches manifold ECI via POST", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("manifold-child-123"),
      });

      const result = await eciUtility.getManifoldECI("owner-123");
      
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/c/owner-123/query/io.picolabs.manifold_owner/getManifoldPicoEci",
        expect.objectContaining({ method: "POST" })
      );
      expect(result).toBe("manifold-child-123");
    });
  });

  describe("traverseHierarchy", () => {
    test("successfully traverses the hierarchy to find manifold channel", async () => {
      // Mock getRootECI -> returns root data
      apiUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({ eci: "root-eci" }),
      });

      // Mock getChildEciByName ("Owner") -> returns Owner data
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ children: ["owner-pico-eci"] }),
      });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("Owner"),
      });

      // Mock getInitializationECI -> returns init channel
      apiUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          channels: [{ id: "owner-init-chan", tags: ["initialization"] }],
        }),
      });

      // Mock getManifoldECI -> returns manifold pico ECI
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("manifold-pico-eci"),
      });

      // Mock getECIByTag ("manifold") -> returns final channel
      apiUtility.getFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          channels: [{ id: "final-manifold-channel", tags: ["manifold"] }],
        }),
      });

      const result = await eciUtility.traverseHierarchy();
      expect(result).toBe("final-manifold-channel");
    });
  });
});
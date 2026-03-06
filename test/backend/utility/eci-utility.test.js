// Mock the external dependencies
jest.mock("../../../src/backend/utility/http-utility", () => ({
  getFetchRequest: jest.fn(),
  postFetchRequest: jest.fn(),
}));

const eciUtility = require("../../../src/backend/utility/eci-utility");
const httpUtility = require("../../../src/backend/utility/http-utility");

describe("Unit Tests: eci-utility.js", () => {
  // Clear mocks after each test to ensure a clean slate
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getRootECI", () => {
    test("successfully fetches and returns the root ECI", async () => {
      // Setup the mock response - ADDED: ok: true and status: 200
      httpUtility.getFetchRequest.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ eci: "root-123" }),
      });

      const result = await eciUtility.getRootECI();

      expect(httpUtility.getFetchRequest).toHaveBeenCalledWith(
        "/api/ui-context",
      );
      expect(result).toBe("root-123");
    });

    test("handles fetch errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      httpUtility.getFetchRequest.mockRejectedValueOnce(
        new Error("Network Error"),
      );

      await expect(eciUtility.getRootECI()).rejects.toThrow("Network Error");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Fetch error:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("getECIByTag", () => {
    test("returns channel id when the tag matches", async () => {
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          channels: [
            { id: "chan-1", tags: ["random"] },
            { id: "chan-2", tags: ["manifold", "initialization"] },
          ],
        }),
      });

      const result = await eciUtility.getECIByTag(
        "owner-123",
        "initialization",
      );
      expect(result).toBe("chan-2");
    });

    test("throws an error if the tag is not found", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          channels: [{ id: "chan-1", tags: ["random"] }],
        }),
      });

      await expect(
        eciUtility.getECIByTag("owner-123", "missing-tag"),
      ).rejects.toThrow('Child ECI with tag "missing-tag" not found!');
      expect(consoleSpy).toHaveBeenCalledWith(
        "Fetch error:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("getInitializationECI", () => {
    test("successfully retrieves the initialization ECI", async () => {
      // Because getInitializationECI calls getECIByTag internally, we mock the network call it relies on
      httpUtility.postFetchRequest.mockResolvedValueOnce({
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
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest
          .fn()
          .mockResolvedValueOnce({ children: ["child-A", "child-B"] }),
      });

      // 2nd fetch: name query for child-A (no match)
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("Wrong Name"),
      });

      // 3rd fetch: name query for child-B (match!)
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("Target Name"),
      });

      const result = await eciUtility.getChildEciByName(
        "parent-123",
        "Target Name",
      );
      expect(result).toBe("child-B");
      expect(httpUtility.postFetchRequest).toHaveBeenCalledTimes(3);
    });

    test("returns null if no children match the name", async () => {
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ children: ["child-A"] }),
      });

      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("Wrong Name"),
      });

      const result = await eciUtility.getChildEciByName(
        "parent-123",
        "Target Name",
      );

      expect(result).toBeNull();
    });

    test("skips unreachable children and continues searching", async () => {
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          children: ["child-broken", "child-working"],
        }),
      });

      // child-broken throws a network error
      httpUtility.postFetchRequest.mockRejectedValueOnce(
        new Error("Network timeout"),
      );

      // child-working succeeds and matches
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("Target Name"),
      });

      const result = await eciUtility.getChildEciByName(
        "parent-123",
        "Target Name",
      );
      expect(result).toBe("child-working");
    });
  });

  describe("getManifoldECI", () => {
    test("successfully fetches manifold ECI via POST", async () => {
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("manifold-child-123"),
      });

      const result = await eciUtility.getManifoldECI("owner-123");

      expect(httpUtility.postFetchRequest).toHaveBeenCalledWith(
        "/c/owner-123/query/io.picolabs.manifold_owner/getManifoldPicoEci",
        {},
      );
      expect(result).toBe("manifold-child-123");
    });
  });

  describe("traverseHierarchy", () => {
    test("successfully traverses the hierarchy to find manifold channel", async () => {
      // Mock getRootECI -> returns root data
      httpUtility.getFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ eci: "root-eci" }),
      });

      // Mock getChildEciByName ("Owner") -> returns Owner data
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ children: ["owner-pico-eci"] }),
      });
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("Owner"),
      });

      // Mock getInitializationECI -> returns init channel
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          channels: [{ id: "owner-init-chan", tags: ["initialization"] }],
        }),
      });

      // Mock getManifoldECI -> returns manifold pico ECI
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce("manifold-pico-eci"),
      });

      // Mock getECIByTag ("manifold") -> returns final channel
      httpUtility.postFetchRequest.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          channels: [{ id: "final-manifold-channel", tags: ["manifold"] }],
        }),
      });

      const result = await eciUtility.traverseHierarchy();
      expect(result).toBe("final-manifold-channel");
    });
  });
});

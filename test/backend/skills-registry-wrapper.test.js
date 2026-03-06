const {
  getSkills,
  addSkill,
  removeSkill,
  addToolToSkill,
  removeToolFromSkill,
} = require("../../src/backend/skills-registry-wrapper.js");

const eciUtility = require("../../src/backend/utility/eci-utility.js");
const httpUtility = require("../../src/backend/utility/http-utility.js");

jest.mock("../../src/backend/utility/eci-utility.js");
jest.mock("../../src/backend/utility/http-utility.js");

describe("Skills Registry Wrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    eciUtility.getSkillsRegistryECI.mockResolvedValue("test-eci");
  });

  test("getSkills returns skills list", async () => {
    const mockData = [{ name: "coding" }];

    httpUtility.postFetchRequest.mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockData),
    });

    const result = await getSkills();

    expect(eciUtility.getSkillsRegistryECI).toHaveBeenCalled();

    expect(httpUtility.postFetchRequest).toHaveBeenCalledWith(
      "/c/test-eci/query/io.picolabs.manifold.skills_registry/getSkills",
      { name: "" },
    );

    expect(result).toEqual(mockData);
  });

  test("addSkill sends correct request", async () => {
    const mockResponse = { success: true };

    httpUtility.postFetchRequest.mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await addSkill("coding", "rid.example", "{}", "url");

    expect(httpUtility.postFetchRequest).toHaveBeenCalledWith(
      "/c/test-eci/event-wait/manifold/new_skill_available",
      {
        name: "coding",
        rid: "rid.example",
        tools: "{}",
        url: "url",
      },
    );

    expect(result).toEqual(mockResponse);
  });

  test("removeSkill sends correct request", async () => {
    const mockResponse = { removed: true };

    httpUtility.postFetchRequest.mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await removeSkill("coding");

    expect(httpUtility.postFetchRequest).toHaveBeenCalledWith(
      "/c/test-eci/event-wait/manifold/remove_skill",
      { name: "coding" },
    );

    expect(result).toEqual(mockResponse);
  });

  test("addToolToSkill sends correct request", async () => {
    const mockResponse = { added: true };

    httpUtility.postFetchRequest.mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await addToolToSkill("coding", "editor", "toolCode");

    expect(httpUtility.postFetchRequest).toHaveBeenCalledWith(
      "/c/test-eci/event-wait/manifold/new_tool_available",
      {
        name: "coding",
        tool_name: "editor",
        tool: "toolCode",
      },
    );

    expect(result).toEqual(mockResponse);
  });

  test("removeToolFromSkill sends correct request", async () => {
    const mockResponse = { removed: true };

    httpUtility.postFetchRequest.mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await removeToolFromSkill("coding", "editor");

    expect(httpUtility.postFetchRequest).toHaveBeenCalledWith(
      "/c/test-eci/event-wait/manifold/remove_tool",
      {
        name: "coding",
        tool_name: "editor",
      },
    );

    expect(result).toEqual(mockResponse);
  });
});

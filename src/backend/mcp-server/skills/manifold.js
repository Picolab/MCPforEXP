const { z } = require("zod");
const ops = require("../../krl-operation.js");

module.exports = [
  {
    name: "manifold_getThings",
    description: "List all digital things managed by Manifold.",
    schema: { id: z.string().optional() },
    handler: (args) => ops.manifold_getThings(args.id),
  },
  {
    name: "manifold_create_thing",
    description: "Create a new digital thing Pico.",
    schema: {
      name: z.string().describe("Descriptive name (e.g. 'Backpack')"),
      id: z.string().optional(),
    },
    handler: (args) => ops.manifold_create_thing(args.name, args.id),
  },
];

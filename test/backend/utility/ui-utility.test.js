const uiUtility = require("../../../src/backend/utility/ui-utility");

test("get test", async () => {
  const result = await uiUtility.get_box_info("Pico");
  console.log(result);
});

test("update test", async () => {
  const result = await uiUtility.update_box_info(
    "Pico",
    100,
    100,
    100,
    100,
    "#00ff00",
  );
  console.log(result);
});

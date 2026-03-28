const { createThing } = require("../src/backend/api-wrapper");
const { update_box_info } = require("../src/backend/utility/ui-utility");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
  console.log("Making showcase setup.");
  await update_box_info("Pico", "500", "100", "", "", "#000000");
  await update_box_info("Skills Registry", "350", "250", "", "", "#000000");
  await update_box_info("Owner", "500", "250", "", "", "#AA1111");
  await update_box_info("Tag Registry", "650", "250", "", "", "#000000");
  await update_box_info("Manifold", "500", "400", "110", "", "#1111CC");
  try {
    await createThing("Backpack");
  } catch {}
  try {
    await createThing("Car");
  } catch {}
  await update_box_info("Backpack", "405", "600", "110", "");
  await update_box_info("Car", "595", "600", "110", "");
  console.log("Finished!");
}

main();

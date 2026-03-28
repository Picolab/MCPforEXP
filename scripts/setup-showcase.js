const {
  createThing,
  addNote,
  installSkillForThing,
  setSquareTag,
  updateOwnerInfo,
} = require("../src/backend/api-wrapper");
const { update_box_info } = require("../src/backend/utility/ui-utility");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

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
  await installSkillForThing("Backpack", "safeandmine");
  await installSkillForThing("Car", "journal");
  await addNote("Car", "Oil change 9/15/2025", "Price: $63. Mileage: 103451");
  await addNote("Car", "Emissions 1/20/2026", "Price: $25. Mileage: 106203");
  await setSquareTag("Backpack", "AAABBB", "sqtg");
  await updateOwnerInfo("Backpack", {
    name: "Charles Butler",
    email: "c@picolabs.org",
    phone: "888-888-8888",
    message: "You found my backpack! Please text me.",
    shareName: true,
    sharePhone: true,
    shareEmail: false,
  });
  console.log("Finished!");
}

main();

const express = require("express");
const cors = require("cors");

const { equipmentItems, inventoryStats, sampleUser } = require("./data/mockData");

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  }),
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "equipment-backend" });
});

app.get("/api/user", (_req, res) => {
  res.json(sampleUser);
});

app.get("/api/stats", (_req, res) => {
  res.json(inventoryStats);
});

app.get("/api/equipment", (_req, res) => {
  res.json(equipmentItems);
});

app.get("/api/equipment/:id", (req, res) => {
  const item = equipmentItems.find((entry) => entry.id === req.params.id);

  if (!item) {
    return res.status(404).json({ message: "equipment not found" });
  }

  return res.json(item);
});

app.get("/api/active-loans", (_req, res) => {
  const activeLoans = equipmentItems.filter((item) => item.status !== "available");
  res.json(activeLoans);
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`backend running on http://localhost:${port}`);
  });
}

module.exports = app;

const request = require("supertest");

const app = require("../src/server");
const { equipmentItems, sampleUser, inventoryStats } = require("../src/data/mockData");

describe("backend API", () => {
  test("GET /api/health returns service status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: "equipment-backend" });
  });

  test("GET /api/user returns sample user", async () => {
    const response = await request(app).get("/api/user");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(sampleUser);
  });

  test("GET /api/stats returns inventory stats", async () => {
    const response = await request(app).get("/api/stats");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(inventoryStats);
  });

  test("GET /api/equipment returns all equipment items", async () => {
    const response = await request(app).get("/api/equipment");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(equipmentItems.length);
    expect(response.body).toEqual(equipmentItems);
  });

  test("GET /api/equipment/:id returns matching equipment", async () => {
    const target = equipmentItems[0];
    const response = await request(app).get(`/api/equipment/${target.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(target);
  });

  test("GET /api/equipment/:id returns 404 for unknown id", async () => {
    const response = await request(app).get("/api/equipment/not-found-id");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "equipment not found" });
  });

  test("GET /api/active-loans excludes available items", async () => {
    const response = await request(app).get("/api/active-loans");

    expect(response.status).toBe(200);
    expect(response.body.every((item) => item.status !== "available")).toBe(true);
    expect(response.body).toHaveLength(
      equipmentItems.filter((item) => item.status !== "available").length,
    );
  });
});

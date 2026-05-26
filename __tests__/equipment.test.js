const { app, request, loginAs } = require("../test-helpers/authHelper");
const { equipmentItems } = require("../src/data/mockData");

describe("equipment API", () => {
  test("GET /api/equipment returns 403 without member role", async () => {
    const response = await request(app).get("/api/equipment");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "forbidden" });
  });

  test("GET /api/equipment returns all equipment items with bearer token", async () => {
    const loginResponse = await loginAs("ai.yamamoto@example.com", "Passw0rd!");
    const response = await request(app)
      .get("/api/equipment")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(equipmentItems.length);
    expect(response.body).toEqual(equipmentItems);
  });

  test("GET /api/equipment/:id returns 403 without member role", async () => {
    const target = equipmentItems[0];
    const response = await request(app).get(`/api/equipment/${target.id}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "forbidden" });
  });

  test("GET /api/equipment/:id returns matching equipment with bearer token", async () => {
    const loginResponse = await loginAs("ai.yamamoto@example.com", "Passw0rd!");
    const target = equipmentItems[0];
    const response = await request(app)
      .get(`/api/equipment/${target.id}`)
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(target);
  });

  test("GET /api/equipment/:id returns 403 for unknown id without member role", async () => {
    const response = await request(app).get("/api/equipment/not-found-id");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "forbidden" });
  });

  test("GET /api/equipment/:id returns 404 for unknown id with bearer token", async () => {
    const loginResponse = await loginAs("ai.yamamoto@example.com", "Passw0rd!");
    const response = await request(app)
      .get("/api/equipment/not-found-id")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "equipment not found" });
  });

  test("GET /api/active-loans returns 403 without member role", async () => {
    const response = await request(app).get("/api/active-loans");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "forbidden" });
  });

  test("GET /api/active-loans excludes available items with bearer token", async () => {
    const loginResponse = await loginAs("ai.yamamoto@example.com", "Passw0rd!");
    const response = await request(app)
      .get("/api/active-loans")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.every((item) => item.status !== "available")).toBe(true);
    expect(response.body).toHaveLength(
      equipmentItems.filter((item) => item.status !== "available").length,
    );
  });
});

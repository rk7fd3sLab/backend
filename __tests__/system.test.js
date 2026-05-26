const { app, request } = require("../test-helpers/authHelper");

describe("system API", () => {
  test("GET /api/health returns service status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: "equipment-backend" });
  });
});

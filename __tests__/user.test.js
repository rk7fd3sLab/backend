const { app, request, loginAs } = require("../test-helpers/authHelper");

describe("user API", () => {
  test("GET /api/user returns 401 without bearer token", async () => {
    const response = await request(app).get("/api/user");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "missing or invalid authorization header" });
  });

  test("GET /api/user returns logged-in user by bearer token", async () => {
    const loginResponse = await loginAs("misaki.tanaka@example.com", "Passw0rd!");
    const response = await request(app)
      .get("/api/user")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      employeeId: "EMP-0142",
      email: "misaki.tanaka@example.com",
      name: "田中 美咲",
      department: "プロダクト開発部",
      role: "member",
    });
  });
});

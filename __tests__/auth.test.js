const { app, request, loginAs } = require("../test-helpers/authHelper");

describe("auth API", () => {
  test("POST /api/auth/login returns access token", async () => {
    const response = await loginAs("guest.user@example.com", "Passw0rd!");

    expect(response.status).toBe(200);
    expect(response.body.tokenType).toBe("Bearer");
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.user).toMatchObject({
      employeeId: "EMP-0300",
      email: "guest.user@example.com",
      name: "ゲスト ユーザー",
      department: "研修アカウント",
      role: "guest",
    });
  });

  test("POST /api/auth/login returns 401 with wrong password", async () => {
    const response = await loginAs("guest.user@example.com", "wrong-password");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "invalid credentials" });
  });

  test("POST /api/auth/logout returns 401 without bearer token", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "missing or invalid authorization header" });
  });

  test("POST /api/auth/logout returns success with bearer token", async () => {
    const loginResponse = await loginAs("guest.user@example.com", "Passw0rd!");
    const accessToken = loginResponse.body.accessToken;
    const response = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, message: "logged out" });

    const afterLogout = await request(app)
      .get("/api/user")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body).toEqual({ message: "token expired by newer login or logout" });
  });

  test("latest login token only is valid", async () => {
    const firstLogin = await loginAs("guest.user@example.com", "Passw0rd!");
    const secondLogin = await loginAs("guest.user@example.com", "Passw0rd!");

    const withOldToken = await request(app)
      .get("/api/user")
      .set("Authorization", `Bearer ${firstLogin.body.accessToken}`);

    const withLatestToken = await request(app)
      .get("/api/user")
      .set("Authorization", `Bearer ${secondLogin.body.accessToken}`);

    expect(withOldToken.status).toBe(401);
    expect(withOldToken.body).toEqual({ message: "token expired by newer login or logout" });
    expect(withLatestToken.status).toBe(200);
    expect(withLatestToken.body.email).toBe("guest.user@example.com");
  });
});

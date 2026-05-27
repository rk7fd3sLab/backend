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

  test("GET /api/equipment supports status filter", async () => {
    const loginResponse = await loginAs("ai.yamamoto@example.com", "Passw0rd!");
    const response = await request(app)
      .get("/api/equipment?status=available")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.every((item) => item.status === "available")).toBe(true);
    expect(response.body).toHaveLength(
      equipmentItems.filter((item) => item.status === "available").length,
    );
  });

  test("GET /api/equipment supports pagination", async () => {
    const loginResponse = await loginAs("ai.yamamoto@example.com", "Passw0rd!");
    const expectedSecond = [...equipmentItems].sort((a, b) => a.id.localeCompare(b.id))[1];
    const response = await request(app)
      .get("/api/equipment?page=2&limit=1")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(expectedSecond.id);
    expect(response.headers["x-total-count"]).toBe(String(equipmentItems.length));
    expect(response.headers["x-page"]).toBe("2");
    expect(response.headers["x-limit"]).toBe("1");
  });

  test("GET /api/equipment returns 400 for invalid status filter", async () => {
    const loginResponse = await loginAs("ai.yamamoto@example.com", "Passw0rd!");
    const response = await request(app)
      .get("/api/equipment?status=broken")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "status must be one of available, in_use, reserved" });
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

  test("POST /api/equipment returns 403 for member role", async () => {
    const loginResponse = await loginAs("ai.yamamoto@example.com", "Passw0rd!");
    const response = await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`)
      .send({
        id: "eq-new-member-denied",
        name: "Denied Laptop",
        category: "ノートPC",
        location: "東京オフィス 1F",
        reservationPeriod: "即日 - 2026/12/31",
        specs: ["16GB RAM"],
        note: "member role should be denied",
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "forbidden" });
  });

  test("POST /api/equipment returns 400 for invalid category", async () => {
    const adminLogin = await loginAs("ryo.sato@example.com", "Passw0rd!");
    const adminToken = adminLogin.body.accessToken;
    const response = await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        id: `eq-invalid-${Date.now()}`,
        name: "Invalid Category Device",
        category: "その他",
        location: "東京オフィス 1F",
        reservationPeriod: "2026/06/01 - 2026/06/10",
        specs: ["USB-C"],
        note: "validation test",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "category must be one of ノートPC, モニタ, 周辺機器" });
  });

  test("POST/PATCH/DELETE /api/equipment works for admin role", async () => {
    const adminLogin = await loginAs("ryo.sato@example.com", "Passw0rd!");
    const adminToken = adminLogin.body.accessToken;
    const targetId = `eq-test-${Date.now()}`;

    const createResponse = await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        id: targetId,
        name: "Test Device",
        category: "周辺機器",
        location: "東京オフィス 5F",
        reservationPeriod: "2026/06/01 - 2026/06/10",
        specs: ["USB-C", "Bluetooth"],
        note: "integration test item",
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      id: targetId,
      name: "Test Device",
      status: "available",
    });

    const patchResponse = await request(app)
      .patch(`/api/equipment/${targetId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        location: "大阪オフィス 3F",
        status: "reserved",
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body).toMatchObject({
      id: targetId,
      location: "大阪オフィス 3F",
      status: "reserved",
    });

    const deleteResponse = await request(app)
      .delete(`/api/equipment/${targetId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteResponse.status).toBe(204);

    const afterDelete = await request(app)
      .get(`/api/equipment/${targetId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(afterDelete.status).toBe(404);
  });

  test("checkout and return endpoints update status transitions", async () => {
    const adminLogin = await loginAs("ryo.sato@example.com", "Passw0rd!");
    const adminToken = adminLogin.body.accessToken;
    const targetId = `eq-flow-${Date.now()}`;

    await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        id: targetId,
        name: "Flow Test Device",
        category: "ノートPC",
        location: "福岡オフィス 1F",
        reservationPeriod: "即日 - 2026/06/30",
        specs: ["32GB RAM"],
        note: "checkout return flow test",
      });

    const checkoutResponse = await request(app)
      .post(`/api/equipment/${targetId}/checkout`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        assignee: "山本 愛",
        requestedBy: "山本 愛",
        reservationPeriod: "2026/06/01 - 2026/06/15",
      });

    expect(checkoutResponse.status).toBe(200);
    expect(checkoutResponse.body).toMatchObject({
      id: targetId,
      status: "in_use",
      assignee: "山本 愛",
      requestedBy: "山本 愛",
    });

    const conflictCheckout = await request(app)
      .post(`/api/equipment/${targetId}/checkout`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        assignee: "田中 美咲",
        requestedBy: "田中 美咲",
        reservationPeriod: "2026/06/16 - 2026/06/20",
      });

    expect(conflictCheckout.status).toBe(409);
    expect(conflictCheckout.body).toEqual({ message: "equipment is not available" });

    const returnResponse = await request(app)
      .post(`/api/equipment/${targetId}/return`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(returnResponse.status).toBe(200);
    expect(returnResponse.body).toMatchObject({
      id: targetId,
      status: "available",
      assignee: null,
      requestedBy: null,
      reservationPeriod: "返却済み",
    });

    await request(app)
      .delete(`/api/equipment/${targetId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  });
});

const { app, request, loginAs } = require("../test-helpers/authHelper");

describe("request API", () => {
  async function createTempEquipment(adminToken) {
    const targetId = `eq-request-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createResponse = await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        id: targetId,
        name: "Request Test Device",
        category: "ノートPC",
        location: "東京オフィス 6F",
        reservationPeriod: "即日 - 2026/12/31",
        specs: ["16GB RAM", "512GB SSD"],
        note: "request test item",
      });

    expect(createResponse.status).toBe(201);

    return targetId;
  }

  test("POST /api/equipment/:id/requests creates request for member", async () => {
    const adminLogin = await loginAs("naoki.admin@example.com", "Passw0rd!");
    const adminToken = adminLogin.body.accessToken;
    const memberLogin = await loginAs("haruka.member@example.com", "Passw0rd!");
    const memberToken = memberLogin.body.accessToken;
    const equipmentId = await createTempEquipment(adminToken);

    const createRequest = await request(app)
      .post(`/api/equipment/${equipmentId}/requests`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        reservationPeriod: "2026/07/01 - 2026/07/10",
        purpose: "展示会利用",
      });

    expect(createRequest.status).toBe(201);
    expect(createRequest.body).toMatchObject({
      equipmentId,
      requesterEmail: "haruka.member@example.com",
      status: "pending",
    });

    const myRequests = await request(app)
      .get("/api/requests/me")
      .set("Authorization", `Bearer ${memberToken}`);

    expect(myRequests.status).toBe(200);
    expect(myRequests.body.some((item) => item.id === createRequest.body.id)).toBe(true);

    await request(app)
      .delete(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  });

  test("POST /api/equipment/:id/requests returns 403 for guest", async () => {
    const adminLogin = await loginAs("naoki.admin@example.com", "Passw0rd!");
    const adminToken = adminLogin.body.accessToken;
    const guestLogin = await loginAs("guest.viewer@example.com", "Passw0rd!");
    const guestToken = guestLogin.body.accessToken;
    const equipmentId = await createTempEquipment(adminToken);

    const createRequest = await request(app)
      .post(`/api/equipment/${equipmentId}/requests`)
      .set("Authorization", `Bearer ${guestToken}`)
      .send({
        reservationPeriod: "2026/07/01 - 2026/07/10",
        purpose: "ゲスト申請",
      });

    expect(createRequest.status).toBe(403);
    expect(createRequest.body).toEqual({ message: "forbidden" });

    await request(app)
      .delete(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  });

  test("admin can approve pending request", async () => {
    const adminLogin = await loginAs("naoki.admin@example.com", "Passw0rd!");
    const adminToken = adminLogin.body.accessToken;
    const memberLogin = await loginAs("haruka.member@example.com", "Passw0rd!");
    const memberToken = memberLogin.body.accessToken;
    const equipmentId = await createTempEquipment(adminToken);

    const createRequest = await request(app)
      .post(`/api/equipment/${equipmentId}/requests`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        reservationPeriod: "2026/08/01 - 2026/08/05",
        purpose: "顧客デモ",
      });

    const approveResponse = await request(app)
      .post(`/api/requests/${createRequest.body.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body).toMatchObject({
      id: createRequest.body.id,
      status: "approved",
      decidedByName: "中村 直樹",
    });

    const equipmentResponse = await request(app)
      .get(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(equipmentResponse.status).toBe(200);
    expect(equipmentResponse.body).toMatchObject({
      id: equipmentId,
      status: "reserved",
      requestedBy: "吉田 はるか",
    });

    await request(app)
      .post(`/api/equipment/${equipmentId}/return`)
      .set("Authorization", `Bearer ${adminToken}`);

    await request(app)
      .delete(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  });

  test("admin can reject pending request with reason", async () => {
    const adminLogin = await loginAs("naoki.admin@example.com", "Passw0rd!");
    const adminToken = adminLogin.body.accessToken;
    const memberLogin = await loginAs("haruka.member@example.com", "Passw0rd!");
    const memberToken = memberLogin.body.accessToken;
    const equipmentId = await createTempEquipment(adminToken);

    const createRequest = await request(app)
      .post(`/api/equipment/${equipmentId}/requests`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        reservationPeriod: "2026/08/11 - 2026/08/20",
        purpose: "社内研修",
      });

    const rejectResponse = await request(app)
      .post(`/api/requests/${createRequest.body.id}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reason: "日程が重複",
      });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body).toMatchObject({
      id: createRequest.body.id,
      status: "rejected",
      decisionReason: "日程が重複",
    });

    await request(app)
      .delete(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  });

  test("requester can cancel own pending request", async () => {
    const adminLogin = await loginAs("naoki.admin@example.com", "Passw0rd!");
    const adminToken = adminLogin.body.accessToken;
    const memberLogin = await loginAs("haruka.member@example.com", "Passw0rd!");
    const memberToken = memberLogin.body.accessToken;
    const equipmentId = await createTempEquipment(adminToken);

    const createRequest = await request(app)
      .post(`/api/equipment/${equipmentId}/requests`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        reservationPeriod: "2026/09/01 - 2026/09/10",
        purpose: "検証利用",
      });

    const cancelResponse = await request(app)
      .post(`/api/requests/${createRequest.body.id}/cancel`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body).toMatchObject({
      id: createRequest.body.id,
      status: "cancelled",
    });

    await request(app)
      .delete(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  });

  test("GET /api/requests/:requestId returns detail for requester", async () => {
    const adminLogin = await loginAs("naoki.admin@example.com", "Passw0rd!");
    const adminToken = adminLogin.body.accessToken;
    const memberLogin = await loginAs("haruka.member@example.com", "Passw0rd!");
    const memberToken = memberLogin.body.accessToken;
    const equipmentId = await createTempEquipment(adminToken);

    const createRequest = await request(app)
      .post(`/api/equipment/${equipmentId}/requests`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        reservationPeriod: "2026/10/01 - 2026/10/03",
        purpose: "資料作成",
      });

    const detailResponse = await request(app)
      .get(`/api/requests/${createRequest.body.id}`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body).toMatchObject({
      id: createRequest.body.id,
      equipmentId,
      requesterEmail: "haruka.member@example.com",
    });

    await request(app)
      .post(`/api/requests/${createRequest.body.id}/cancel`)
      .set("Authorization", `Bearer ${memberToken}`);

    await request(app)
      .delete(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  });

  test("admin can filter requests and get pending count", async () => {
    const adminLogin = await loginAs("naoki.admin@example.com", "Passw0rd!");
    const adminToken = adminLogin.body.accessToken;
    const memberLogin = await loginAs("haruka.member@example.com", "Passw0rd!");
    const memberToken = memberLogin.body.accessToken;
    const equipmentId = await createTempEquipment(adminToken);

    const createRequest = await request(app)
      .post(`/api/equipment/${equipmentId}/requests`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        reservationPeriod: "2026/10/11 - 2026/10/20",
        purpose: "外部説明会",
      });

    const filtered = await request(app)
      .get(`/api/requests?status=pending&equipmentId=${equipmentId}&requesterEmail=haruka.member@example.com`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(filtered.status).toBe(200);
    expect(filtered.body.some((item) => item.id === createRequest.body.id)).toBe(true);

    const countResponse = await request(app)
      .get("/api/requests/pending-count")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(countResponse.status).toBe(200);
    expect(typeof countResponse.body.pendingCount).toBe("number");
    expect(countResponse.body.pendingCount).toBeGreaterThanOrEqual(1);

    await request(app)
      .post(`/api/requests/${createRequest.body.id}/cancel`)
      .set("Authorization", `Bearer ${memberToken}`);

    await request(app)
      .delete(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  });

  test("admin can get request history by equipment id", async () => {
    const adminLogin = await loginAs("naoki.admin@example.com", "Passw0rd!");
    const adminToken = adminLogin.body.accessToken;
    const memberLogin = await loginAs("haruka.member@example.com", "Passw0rd!");
    const memberToken = memberLogin.body.accessToken;
    const equipmentId = await createTempEquipment(adminToken);

    const createRequest = await request(app)
      .post(`/api/equipment/${equipmentId}/requests`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        reservationPeriod: "2026/11/01 - 2026/11/10",
        purpose: "検証",
      });

    const historyResponse = await request(app)
      .get(`/api/equipment/${equipmentId}/requests`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.some((item) => item.id === createRequest.body.id)).toBe(true);

    await request(app)
      .post(`/api/requests/${createRequest.body.id}/cancel`)
      .set("Authorization", `Bearer ${memberToken}`);

    await request(app)
      .delete(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  });
});

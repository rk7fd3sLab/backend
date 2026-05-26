const { app, request, loginAs } = require("../test-helpers/authHelper");
const { equipmentItems } = require("../src/data/mockData");

function extractReservationEndDate(reservationPeriod) {
  const match = reservationPeriod.match(/(\d{4})\/(\d{2})\/(\d{2})$/);

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function getTodayLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("inventory API", () => {
  test("GET /api/stats returns 403 without member role", async () => {
    const response = await request(app).get("/api/stats");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "forbidden" });
  });

  test("GET /api/stats returns 403 for guest role", async () => {
    const loginResponse = await loginAs("guest.viewer@example.com", "Passw0rd!");
    const response = await request(app)
      .get("/api/stats")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "forbidden" });
  });

  test("GET /api/stats returns inventory stats with bearer token", async () => {
    const loginResponse = await loginAs("misaki.tanaka@example.com", "Passw0rd!");
    const response = await request(app)
      .get("/api/stats")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    const expectedDueToday = equipmentItems.filter(
      (item) => extractReservationEndDate(item.reservationPeriod) === getTodayLocalDateString(),
    ).length;

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        label: "登録備品",
        value: "5",
        caption: "ノートPC 2 / モニタ 2 / 周辺機器 1",
      },
      {
        label: "使用中",
        value: "2",
        caption: "外出・在宅勤務向けに貸出中",
      },
      {
        label: "本日の返却予定",
        value: String(expectedDueToday),
        caption: "管理画面から返却処理可能",
      },
    ]);
  });
});

function registerInventoryRoutes(
  app,
  { prisma, requireMemberForInventoryAndEquipment, getTodayLocalDateString, buildCategoryCaption },
) {
  // ダッシュボード向けに在庫統計を動的集計して返す。
  app.get("/api/stats", requireMemberForInventoryAndEquipment, async (_req, res) => {
    const equipment = await prisma.equipment.findMany();
    const today = getTodayLocalDateString();

    // DBの生データから画面表示用の3指標を算出する。
    const registeredCount = equipment.length;
    const inUseCount = equipment.filter((item) => item.status === "in_use").length;
    const dueTodayCount = equipment.filter((item) => item.reservationEndDate === today).length;

    res.json([
      {
        label: "登録備品",
        value: String(registeredCount),
        caption: buildCategoryCaption(equipment),
      },
      {
        label: "使用中",
        value: String(inUseCount),
        caption: "外出・在宅勤務向けに貸出中",
      },
      {
        label: "本日の返却予定",
        value: String(dueTodayCount),
        caption: "管理画面から返却処理可能",
      },
    ]);
  });
}

module.exports = {
  registerInventoryRoutes,
};

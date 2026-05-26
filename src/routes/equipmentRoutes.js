function registerEquipmentRoutes(
  app,
  { prisma, requireMemberForInventoryAndEquipment, toEquipmentResponse },
) {
  // 一覧は表示順を安定させるためID昇順で返す。
  app.get("/api/equipment", requireMemberForInventoryAndEquipment, async (_req, res) => {
    const equipment = await prisma.equipment.findMany({
      orderBy: { id: "asc" },
    });

    res.json(equipment.map(toEquipmentResponse));
  });

  app.get("/api/equipment/:id", requireMemberForInventoryAndEquipment, async (req, res) => {
    const item = await prisma.equipment.findUnique({
      where: { id: req.params.id },
    });

    if (!item) {
      // 未存在IDは明示的に404を返す。
      return res.status(404).json({ message: "equipment not found" });
    }

    return res.json(toEquipmentResponse(item));
  });

  // 貸出中・予約中のみを抽出して返す。
  app.get("/api/active-loans", requireMemberForInventoryAndEquipment, async (_req, res) => {
    const activeLoans = await prisma.equipment.findMany({
      where: {
        status: {
          not: "available",
        },
      },
      orderBy: { id: "asc" },
    });

    res.json(activeLoans.map(toEquipmentResponse));
  });
}

module.exports = {
  registerEquipmentRoutes,
};

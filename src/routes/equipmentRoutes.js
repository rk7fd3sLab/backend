function registerEquipmentRoutes(
  app,
  {
    prisma,
    requireMemberForInventoryAndEquipment,
    requireAdminForEquipmentWrite,
    toEquipmentResponse,
  },
) {
  const allowedStatuses = new Set(["available", "in_use", "reserved"]);

  function extractReservationEndDate(reservationPeriod) {
    const match = String(reservationPeriod || "").match(/(\d{4})\/(\d{2})\/(\d{2})$/);

    if (!match) {
      return null;
    }

    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  function normalizeEquipmentPayload(payload, { allowPartial }) {
    const source = payload || {};
    const normalized = {};

    const requiredFields = ["id", "name", "category", "location", "reservationPeriod", "specs", "note"];
    if (!allowPartial) {
      for (const field of requiredFields) {
        if (source[field] === undefined || source[field] === null || source[field] === "") {
          return { error: `${field} is required` };
        }
      }
    }

    if (source.id !== undefined) {
      if (typeof source.id !== "string" || !source.id.trim()) {
        return { error: "id must be a non-empty string" };
      }
      normalized.id = source.id.trim();
    }

    const stringFields = ["name", "category", "location", "reservationPeriod", "note", "assignee", "requestedBy"];
    for (const field of stringFields) {
      if (source[field] === undefined) {
        continue;
      }

      if (source[field] === null) {
        if (field === "assignee" || field === "requestedBy") {
          normalized[field] = null;
          continue;
        }

        return { error: `${field} must be a string` };
      }

      if (typeof source[field] !== "string") {
        return { error: `${field} must be a string` };
      }

      const trimmed = source[field].trim();

      if (!trimmed && field !== "assignee" && field !== "requestedBy") {
        return { error: `${field} must be a non-empty string` };
      }

      normalized[field] = trimmed || null;
    }

    if (source.status !== undefined) {
      if (typeof source.status !== "string" || !allowedStatuses.has(source.status)) {
        return { error: "status must be one of available, in_use, reserved" };
      }

      normalized.status = source.status;
    }

    if (source.specs !== undefined) {
      if (!Array.isArray(source.specs) || source.specs.some((item) => typeof item !== "string" || !item.trim())) {
        return { error: "specs must be a non-empty string array" };
      }

      normalized.specsJson = JSON.stringify(source.specs.map((item) => item.trim()));
    }

    if (normalized.reservationPeriod !== undefined) {
      normalized.reservationEndDate = extractReservationEndDate(normalized.reservationPeriod);
    }

    return { value: normalized };
  }

  // 一覧は条件絞り込みとページングを受け付けつつ、表示順はID昇順で安定化する。
  app.get("/api/equipment", requireMemberForInventoryAndEquipment, async (req, res) => {
    const where = {};
    const { status, category, location, keyword, page, limit } = req.query || {};

    if (status !== undefined) {
      if (typeof status !== "string" || !allowedStatuses.has(status)) {
        return res.status(400).json({ message: "status must be one of available, in_use, reserved" });
      }

      where.status = status;
    }

    if (category !== undefined) {
      if (typeof category !== "string" || !category.trim()) {
        return res.status(400).json({ message: "category must be a non-empty string" });
      }

      where.category = category.trim();
    }

    if (location !== undefined) {
      if (typeof location !== "string" || !location.trim()) {
        return res.status(400).json({ message: "location must be a non-empty string" });
      }

      where.location = {
        contains: location.trim(),
      };
    }

    if (keyword !== undefined) {
      if (typeof keyword !== "string" || !keyword.trim()) {
        return res.status(400).json({ message: "keyword must be a non-empty string" });
      }

      const trimmedKeyword = keyword.trim();
      where.OR = [
        { id: { contains: trimmedKeyword } },
        { name: { contains: trimmedKeyword } },
        { note: { contains: trimmedKeyword } },
      ];
    }

    let pageNumber;
    let limitNumber;

    if (page !== undefined || limit !== undefined) {
      if (typeof page !== "string" || typeof limit !== "string") {
        return res.status(400).json({ message: "page and limit must be positive integers" });
      }

      pageNumber = Number(page);
      limitNumber = Number(limit);

      if (!Number.isInteger(pageNumber) || !Number.isInteger(limitNumber) || pageNumber <= 0 || limitNumber <= 0) {
        return res.status(400).json({ message: "page and limit must be positive integers" });
      }

      if (limitNumber > 100) {
        return res.status(400).json({ message: "limit must be less than or equal to 100" });
      }
    }

    const query = {
      where,
      orderBy: { id: "asc" },
    };

    if (pageNumber && limitNumber) {
      query.skip = (pageNumber - 1) * limitNumber;
      query.take = limitNumber;
    }

    const equipment = await prisma.equipment.findMany(query);

    if (pageNumber && limitNumber) {
      const totalCount = await prisma.equipment.count({ where });
      res.set("X-Total-Count", String(totalCount));
      res.set("X-Page", String(pageNumber));
      res.set("X-Limit", String(limitNumber));
    }

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

  // 登録時は管理者のみ許可し、DB保存に必要な必須項目を検証する。
  app.post("/api/equipment", requireAdminForEquipmentWrite, async (req, res) => {
    const parsed = normalizeEquipmentPayload(req.body, { allowPartial: false });

    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const payload = parsed.value;

    const existing = await prisma.equipment.findUnique({
      where: { id: payload.id },
    });

    if (existing) {
      return res.status(409).json({ message: "equipment already exists" });
    }

    const created = await prisma.equipment.create({
      data: {
        id: payload.id,
        name: payload.name,
        category: payload.category,
        location: payload.location,
        status: payload.status || "available",
        assignee: payload.assignee ?? null,
        requestedBy: payload.requestedBy ?? null,
        reservationPeriod: payload.reservationPeriod,
        reservationEndDate: payload.reservationEndDate,
        specsJson: payload.specsJson,
        note: payload.note,
      },
    });

    return res.status(201).json(toEquipmentResponse(created));
  });

  app.patch("/api/equipment/:id", requireAdminForEquipmentWrite, async (req, res) => {
    const parsed = normalizeEquipmentPayload(req.body, { allowPartial: true });

    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const payload = parsed.value;

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: "at least one field is required" });
    }

    delete payload.id;

    const existing = await prisma.equipment.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ message: "equipment not found" });
    }

    const updated = await prisma.equipment.update({
      where: { id: req.params.id },
      data: payload,
    });

    return res.json(toEquipmentResponse(updated));
  });

  app.delete("/api/equipment/:id", requireAdminForEquipmentWrite, async (req, res) => {
    const existing = await prisma.equipment.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ message: "equipment not found" });
    }

    await prisma.equipment.delete({
      where: { id: req.params.id },
    });

    return res.status(204).send();
  });

  app.post("/api/equipment/:id/checkout", requireAdminForEquipmentWrite, async (req, res) => {
    const { assignee, requestedBy, reservationPeriod } = req.body || {};

    if (!assignee || !requestedBy || !reservationPeriod) {
      return res.status(400).json({ message: "assignee, requestedBy and reservationPeriod are required" });
    }

    const equipment = await prisma.equipment.findUnique({
      where: { id: req.params.id },
    });

    if (!equipment) {
      return res.status(404).json({ message: "equipment not found" });
    }

    if (equipment.status !== "available") {
      return res.status(409).json({ message: "equipment is not available" });
    }

    const updated = await prisma.equipment.update({
      where: { id: req.params.id },
      data: {
        status: "in_use",
        assignee: String(assignee).trim(),
        requestedBy: String(requestedBy).trim(),
        reservationPeriod: String(reservationPeriod).trim(),
        reservationEndDate: extractReservationEndDate(String(reservationPeriod).trim()),
      },
    });

    return res.json(toEquipmentResponse(updated));
  });

  app.post("/api/equipment/:id/return", requireAdminForEquipmentWrite, async (req, res) => {
    const equipment = await prisma.equipment.findUnique({
      where: { id: req.params.id },
    });

    if (!equipment) {
      return res.status(404).json({ message: "equipment not found" });
    }

    if (equipment.status === "available") {
      return res.status(409).json({ message: "equipment is already available" });
    }

    const updated = await prisma.equipment.update({
      where: { id: req.params.id },
      data: {
        status: "available",
        assignee: null,
        requestedBy: null,
        reservationPeriod: "返却済み",
        reservationEndDate: null,
      },
    });

    return res.json(toEquipmentResponse(updated));
  });
}

module.exports = {
  registerEquipmentRoutes,
};

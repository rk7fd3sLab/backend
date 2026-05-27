function registerRequestRoutes(
  app,
  { prisma, requireMemberForRequest, requireAdminForRequestApproval },
) {
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidReservationPeriod(reservationPeriod) {
    return /\d{4}\/\d{2}\/\d{2}$/.test(String(reservationPeriod || ""));
  }

  function isAdmin(user) {
    return user && user.role === "admin";
  }

  function parseRequestId(rawRequestId) {
    const requestId = Number(rawRequestId);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return null;
    }

    return requestId;
  }

  function extractReservationEndDate(reservationPeriod) {
    const match = String(reservationPeriod || "").match(/(\d{4})\/(\d{2})\/(\d{2})$/);

    if (!match) {
      return null;
    }

    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  function toRequestResponse(item) {
    return {
      id: item.id,
      equipmentId: item.equipmentId,
      requesterUserId: item.requesterUserId,
      requesterName: item.requesterName,
      requesterEmail: item.requesterEmail,
      reservationPeriod: item.reservationPeriod,
      purpose: item.purpose,
      status: item.status,
      decisionReason: item.decisionReason,
      decidedByUserId: item.decidedByUserId,
      decidedByName: item.decidedByName,
      decidedAt: item.decidedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  // member 以上が備品貸出申請を作成する。
  app.post("/api/equipment/:id/requests", requireMemberForRequest, async (req, res) => {
    const { reservationPeriod, purpose } = req.body || {};

    if (!reservationPeriod || !purpose) {
      return res.status(400).json({ message: "reservationPeriod and purpose are required" });
    }

    if (
      typeof reservationPeriod !== "string"
      || typeof purpose !== "string"
      || !reservationPeriod.trim()
      || !purpose.trim()
    ) {
      return res.status(400).json({ message: "reservationPeriod and purpose must be non-empty strings" });
    }

    if (!isValidReservationPeriod(reservationPeriod)) {
      return res.status(400).json({ message: "reservationPeriod must end with YYYY/MM/DD" });
    }

    const normalizedPurpose = purpose.trim();
    if (normalizedPurpose.length < 2 || normalizedPurpose.length > 200) {
      return res.status(400).json({ message: "purpose must be between 2 and 200 characters" });
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

    const pendingSameRequest = await prisma.equipmentRequest.findFirst({
      where: {
        equipmentId: req.params.id,
        requesterUserId: req.user.id,
        status: "pending",
      },
    });

    if (pendingSameRequest) {
      return res.status(409).json({ message: "pending request already exists" });
    }

    const created = await prisma.equipmentRequest.create({
      data: {
        equipmentId: req.params.id,
        requesterUserId: req.user.id,
        requesterName: req.user.name,
        requesterEmail: req.user.email,
        reservationPeriod: String(reservationPeriod).trim(),
        purpose: normalizedPurpose,
      },
    });

    return res.status(201).json(toRequestResponse(created));
  });

  // 申請者本人が自分の申請一覧を確認できる。
  app.get("/api/requests/me", requireMemberForRequest, async (req, res) => {
    const requests = await prisma.equipmentRequest.findMany({
      where: {
        requesterUserId: req.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(requests.map(toRequestResponse));
  });

  app.get("/api/equipment/:id/requests", requireAdminForRequestApproval, async (req, res) => {
    const requests = await prisma.equipmentRequest.findMany({
      where: {
        equipmentId: req.params.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json(requests.map(toRequestResponse));
  });

  app.get("/api/requests/pending-count", requireAdminForRequestApproval, async (_req, res) => {
    const pendingCount = await prisma.equipmentRequest.count({
      where: {
        status: "pending",
      },
    });

    return res.json({ pendingCount });
  });

  app.get("/api/requests/:requestId", requireMemberForRequest, async (req, res) => {
    const requestId = parseRequestId(req.params.requestId);

    if (!requestId) {
      return res.status(400).json({ message: "requestId must be a positive integer" });
    }

    const targetRequest = await prisma.equipmentRequest.findUnique({
      where: { id: requestId },
    });

    if (!targetRequest) {
      return res.status(404).json({ message: "request not found" });
    }

    if (!isAdmin(req.user) && targetRequest.requesterUserId !== req.user.id) {
      return res.status(403).json({ message: "forbidden" });
    }

    return res.json(toRequestResponse(targetRequest));
  });

  app.get("/api/requests", requireAdminForRequestApproval, async (req, res) => {
    const allowedStatuses = new Set(["pending", "approved", "rejected", "cancelled"]);
    const where = {};
    const { status, equipmentId, requesterEmail } = req.query || {};

    if (status !== undefined) {
      if (typeof status !== "string" || !allowedStatuses.has(status)) {
        return res.status(400).json({ message: "status must be one of pending, approved, rejected, cancelled" });
      }

      where.status = status;
    }

    if (equipmentId !== undefined) {
      if (typeof equipmentId !== "string" || !equipmentId.trim()) {
        return res.status(400).json({ message: "equipmentId must be a non-empty string" });
      }

      where.equipmentId = equipmentId.trim();
    }

    if (requesterEmail !== undefined) {
      if (typeof requesterEmail !== "string" || !requesterEmail.trim()) {
        return res.status(400).json({ message: "requesterEmail must be a non-empty string" });
      }

      if (!isValidEmail(requesterEmail.trim())) {
        return res.status(400).json({ message: "requesterEmail must be a valid address" });
      }

      where.requesterEmail = requesterEmail.trim();
    }

    const requests = await prisma.equipmentRequest.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(requests.map(toRequestResponse));
  });

  app.post("/api/requests/:requestId/cancel", requireMemberForRequest, async (req, res) => {
    const requestId = parseRequestId(req.params.requestId);

    if (!requestId) {
      return res.status(400).json({ message: "requestId must be a positive integer" });
    }

    const targetRequest = await prisma.equipmentRequest.findUnique({
      where: { id: requestId },
    });

    if (!targetRequest) {
      return res.status(404).json({ message: "request not found" });
    }

    if (!isAdmin(req.user) && targetRequest.requesterUserId !== req.user.id) {
      return res.status(403).json({ message: "forbidden" });
    }

    if (targetRequest.status !== "pending") {
      return res.status(409).json({ message: "request is not pending" });
    }

    const updatedRequest = await prisma.equipmentRequest.update({
      where: { id: requestId },
      data: {
        status: "cancelled",
        decidedByUserId: req.user.id,
        decidedByName: req.user.name,
        decidedAt: new Date(),
        decisionReason: "cancelled by requester",
      },
    });

    return res.json(toRequestResponse(updatedRequest));
  });

  app.post("/api/requests/:requestId/approve", requireAdminForRequestApproval, async (req, res) => {
    const requestId = parseRequestId(req.params.requestId);

    if (!requestId) {
      return res.status(400).json({ message: "requestId must be a positive integer" });
    }

    const targetRequest = await prisma.equipmentRequest.findUnique({
      where: { id: requestId },
    });

    if (!targetRequest) {
      return res.status(404).json({ message: "request not found" });
    }

    if (targetRequest.status !== "pending") {
      return res.status(409).json({ message: "request is not pending" });
    }

    const equipment = await prisma.equipment.findUnique({
      where: { id: targetRequest.equipmentId },
    });

    if (!equipment) {
      return res.status(404).json({ message: "equipment not found" });
    }

    if (equipment.status !== "available") {
      return res.status(409).json({ message: "equipment is not available" });
    }

    const [, updatedRequest] = await prisma.$transaction([
      prisma.equipment.update({
        where: { id: targetRequest.equipmentId },
        data: {
          status: "reserved",
          assignee: null,
          requestedBy: targetRequest.requesterName,
          reservationPeriod: targetRequest.reservationPeriod,
          reservationEndDate: extractReservationEndDate(targetRequest.reservationPeriod),
        },
      }),
      prisma.equipmentRequest.update({
        where: { id: requestId },
        data: {
          status: "approved",
          decidedByUserId: req.user.id,
          decidedByName: req.user.name,
          decidedAt: new Date(),
          decisionReason: null,
        },
      }),
    ]);

    return res.json(toRequestResponse(updatedRequest));
  });

  app.post("/api/requests/:requestId/reject", requireAdminForRequestApproval, async (req, res) => {
    const requestId = parseRequestId(req.params.requestId);
    const { reason } = req.body || {};

    if (!requestId) {
      return res.status(400).json({ message: "requestId must be a positive integer" });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: "reason is required" });
    }

    const normalizedReason = String(reason).trim();
    if (normalizedReason.length < 2 || normalizedReason.length > 200) {
      return res.status(400).json({ message: "reason must be between 2 and 200 characters" });
    }

    const targetRequest = await prisma.equipmentRequest.findUnique({
      where: { id: requestId },
    });

    if (!targetRequest) {
      return res.status(404).json({ message: "request not found" });
    }

    if (targetRequest.status !== "pending") {
      return res.status(409).json({ message: "request is not pending" });
    }

    const updatedRequest = await prisma.equipmentRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        decidedByUserId: req.user.id,
        decidedByName: req.user.name,
        decidedAt: new Date(),
        decisionReason: normalizedReason,
      },
    });

    return res.json(toRequestResponse(updatedRequest));
  });
}

module.exports = {
  registerRequestRoutes,
};

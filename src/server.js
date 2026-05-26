const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("./lib/prisma");
const { registerAuthRoutes } = require("./routes/authRoutes");
const { registerUserRoutes } = require("./routes/userRoutes");
const { registerInventoryRoutes } = require("./routes/inventoryRoutes");
const { registerEquipmentRoutes } = require("./routes/equipmentRoutes");

const app = express();
const port = Number(process.env.PORT) || 4000;
const jwtSecret = process.env.JWT_SECRET || "dev-only-secret";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1h";

// APIはフロントからのアクセスを前提にし、CORSとJSONボディを有効化する。
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  }),
);
app.use(express.json());

// 認証情報や内部項目(passwordHash等)を返さないよう公開用レスポンスに整形する。
function toPublicUser(user) {
  return {
    employeeId: user.employeeId,
    email: user.email,
    name: user.name,
    department: user.department,
    role: user.role,
  };
}

// DBでは配列をJSON文字列で保持しているため、API返却時に配列へ戻す。
function toEquipmentResponse(item) {
  let specs = [];

  try {
    specs = JSON.parse(item.specsJson || "[]");
  } catch {
    specs = [];
  }

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    location: item.location,
    status: item.status,
    assignee: item.assignee,
    requestedBy: item.requestedBy,
    reservationPeriod: item.reservationPeriod,
    specs,
    note: item.note,
  };
}

// 在庫統計の「本日返却予定」判定に使うローカル日付文字列(YYYY-MM-DD)を作る。
function getTodayLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// カテゴリ別件数を表示順(ノートPC/モニタ/周辺機器)でキャプション化する。
function buildCategoryCaption(items) {
  const counts = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  const preferredOrder = ["ノートPC", "モニタ", "周辺機器"];
  const remaining = Object.keys(counts)
    .filter((category) => !preferredOrder.includes(category))
    .sort((a, b) => a.localeCompare(b, "ja"));
  const orderedCategories = [
    ...preferredOrder.filter((category) => counts[category]),
    ...remaining,
  ];

  return orderedCategories.map((category) => `${category} ${counts[category]}`).join(" / ");
}

// ロールを数値化して、最低権限チェックを単純比較で実装する。
function getRoleRank(role) {
  const roleRanks = {
    guest: 0,
    member: 1,
    admin: 2,
  };

  return roleRanks[role] ?? -1;
}

// Bearer認証の共通ミドルウェア。
// deniedStatusCodeやminimumRoleを切り替えて、401系と403系の両方を同一実装で扱う。
function createBearerAuthMiddleware(deniedStatusCode = 401, minimumRole = null) {
  return async function bearerAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res
        .status(deniedStatusCode)
        .json({ message: deniedStatusCode === 401 ? "missing or invalid authorization header" : "forbidden" });
    }

    try {
      // JWT署名と有効期限を検証する。
      const payload = jwt.verify(token, jwtSecret);

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        return res
          .status(deniedStatusCode)
          .json({ message: deniedStatusCode === 401 ? "invalid token" : "forbidden" });
      }

      // login/logout時にtokenVersionを更新することで、古いトークンを失効させる。
      if (payload.tokenVersion !== user.tokenVersion) {
        return res
          .status(deniedStatusCode)
          .json({ message: deniedStatusCode === 401 ? "token expired by newer login or logout" : "forbidden" });
      }

      if (minimumRole && getRoleRank(user.role) < getRoleRank(minimumRole)) {
        return res.status(deniedStatusCode).json({ message: "forbidden" });
      }

      req.user = user;
      return next();
    } catch {
      return res
        .status(deniedStatusCode)
        .json({ message: deniedStatusCode === 401 ? "invalid token" : "forbidden" });
    }
  };
}

const authenticateBearer = createBearerAuthMiddleware(401);
const requireMemberForInventoryAndEquipment = createBearerAuthMiddleware(403, "member");

// 疎通確認用。認証不要で常に応答できる最小エンドポイント。
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "equipment-backend" });
});

// 機能ごとのルート登録。server.jsは依存解決と配線に集中させる。
registerAuthRoutes(app, {
  prisma,
  bcrypt,
  jwt,
  jwtSecret,
  jwtExpiresIn,
  authenticateBearer,
  toPublicUser,
});

registerUserRoutes(app, {
  authenticateBearer,
  toPublicUser,
});

registerInventoryRoutes(app, {
  prisma,
  requireMemberForInventoryAndEquipment,
  getTodayLocalDateString,
  buildCategoryCaption,
});

registerEquipmentRoutes(app, {
  prisma,
  requireMemberForInventoryAndEquipment,
  toEquipmentResponse,
});

if (require.main === module) {
  // テストからrequireされた場合はlistenしない。
  app.listen(port, () => {
    console.log(`backend running on http://localhost:${port}`);
  });
}

module.exports = app;

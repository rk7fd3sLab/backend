const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { equipmentItems } = require("../src/data/mockData");

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./prisma/dev.db";
}

const prisma = new PrismaClient();

const seedUsers = [
  {
    employeeId: "EMP-0300",
    email: "guest.user@example.com",
    password: "Passw0rd!",
    name: "ゲスト ユーザー",
    department: "研修アカウント",
    role: "guest",
  },
  {
    employeeId: "EMP-0301",
    email: "guest.viewer@example.com",
    password: "Passw0rd!",
    name: "閲覧 ゲスト",
    department: "研修アカウント",
    role: "guest",
  },
  {
    employeeId: "EMP-0142",
    email: "misaki.tanaka@example.com",
    password: "Passw0rd!",
    name: "田中 美咲",
    department: "プロダクト開発部",
    role: "member",
  },
  {
    employeeId: "EMP-0098",
    email: "ryo.sato@example.com",
    password: "Passw0rd!",
    name: "佐藤 亮",
    department: "情報システム部",
    role: "admin",
  },
  {
    employeeId: "EMP-0410",
    email: "naoki.admin@example.com",
    password: "Passw0rd!",
    name: "中村 直樹",
    department: "情報システム部",
    role: "admin",
  },
  {
    employeeId: "EMP-0211",
    email: "ai.yamamoto@example.com",
    password: "Passw0rd!",
    name: "山本 愛",
    department: "営業企画部",
    role: "member",
  },
  {
    employeeId: "EMP-0320",
    email: "haruka.member@example.com",
    password: "Passw0rd!",
    name: "吉田 はるか",
    department: "営業企画部",
    role: "member",
  },
];

function extractReservationEndDate(reservationPeriod) {
  const match = reservationPeriod.match(/(\d{4})\/(\d{2})\/(\d{2})$/);

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

async function main() {
  for (const user of seedUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        employeeId: user.employeeId,
        passwordHash,
        name: user.name,
        department: user.department,
        role: user.role,
      },
      create: {
        employeeId: user.employeeId,
        email: user.email,
        passwordHash,
        name: user.name,
        department: user.department,
        role: user.role,
      },
    });
  }

  await prisma.equipmentRequest.deleteMany();

  await prisma.equipment.deleteMany();

  await prisma.equipment.createMany({
    data: equipmentItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      location: item.location,
      status: item.status,
      assignee: item.assignee,
      requestedBy: item.requestedBy,
      reservationPeriod: item.reservationPeriod,
      reservationEndDate: extractReservationEndDate(item.reservationPeriod),
      specsJson: JSON.stringify(item.specs),
      note: item.note,
    })),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

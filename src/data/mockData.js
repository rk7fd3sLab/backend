const sampleUser = {
  employeeId: "EMP-0142",
  name: "田中 美咲",
  department: "プロダクト開発部",
};

const equipmentItems = [
  {
    id: "eq-001",
    name: "ThinkPad X1 Carbon Gen 12",
    category: "ノートPC",
    location: "東京オフィス 4F",
    status: "available",
    assignee: null,
    requestedBy: null,
    reservationPeriod: "即日 - 2026/05/12",
    specs: ["Core Ultra 7", "32GB RAM", "14 inch"],
    note: "営業同行用に軽量モデル。USB-C 充電器を付属。",
  },
  {
    id: "eq-002",
    name: "Dell 27 4K USB-C Monitor",
    category: "モニタ",
    location: "大阪オフィス 2F",
    status: "in_use",
    assignee: "佐藤 亮",
    requestedBy: "佐藤 亮",
    reservationPeriod: "2026/05/01 - 2026/05/15",
    specs: ["27 inch", "4K", "USB-C 90W"],
    note: "デザインレビュー室で利用中。返却時は高さ調整台も回収。",
  },
  {
    id: "eq-003",
    name: "MacBook Pro 14 M4",
    category: "ノートPC",
    location: "福岡オフィス 3F",
    status: "reserved",
    assignee: null,
    requestedBy: "山本 愛",
    reservationPeriod: "2026/05/10 - 2026/05/20",
    specs: ["M4 Pro", "24GB RAM", "1TB SSD"],
    note: "展示会向けの動画編集用。貸出開始前にFinal Cutの起動確認が必要。",
  },
  {
    id: "eq-004",
    name: "LG DualUp Monitor",
    category: "モニタ",
    location: "名古屋オフィス 1F",
    status: "available",
    assignee: null,
    requestedBy: null,
    reservationPeriod: "即日 - 2026/05/16",
    specs: ["28 inch", "16:18", "Ergo Stand"],
    note: "開発検証用。縦長画面のため梱包材の再利用を推奨。",
  },
  {
    id: "eq-005",
    name: "Anker 737 Power Bank",
    category: "周辺機器",
    location: "東京オフィス 4F",
    status: "in_use",
    assignee: "鈴木 悠",
    requestedBy: "鈴木 悠",
    reservationPeriod: "2026/05/07 - 2026/05/09",
    specs: ["140W", "24,000mAh", "USB-C x2"],
    note: "出張者向け貸出。返却時は残量 30% 以上で保管。",
  },
];

const inventoryStats = [
  { label: "登録備品", value: "28", caption: "ノートPC 12 / モニタ 10 / 周辺機器 6" },
  { label: "使用中", value: "11", caption: "外出・在宅勤務向けに貸出中" },
  { label: "本日の返却予定", value: "3", caption: "管理画面から返却処理可能" },
];

module.exports = {
  equipmentItems,
  inventoryStats,
  sampleUser,
};

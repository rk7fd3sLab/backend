function registerUserRoutes(app, { authenticateBearer, toPublicUser }) {
  // 認証済みユーザー自身の公開情報を返す。
  app.get("/api/user", authenticateBearer, (req, res) => {
    res.json(toPublicUser(req.user));
  });
}

module.exports = {
  registerUserRoutes,
};

function registerAuthRoutes(
  app,
  { prisma, bcrypt, jwt, jwtSecret, jwtExpiresIn, authenticateBearer, toPublicUser },
) {
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ログイン時にtokenVersionを更新し、同一ユーザーの旧トークンを失効させる。
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body || {};

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password.trim()) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "email must be a valid address" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "password must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({ message: "invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ message: "invalid credentials" });
    }

    // 最新トークンのみ有効にするため、ログインのたびにバージョンを進める。
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });

    // JWTにtokenVersionを埋め込み、認証ミドルウェアでDB値と照合する。
    const accessToken = jwt.sign(
      { sub: user.id, tokenVersion: updatedUser.tokenVersion },
      jwtSecret,
      {
        expiresIn: jwtExpiresIn,
      },
    );

    return res.json({
      accessToken,
      tokenType: "Bearer",
      expiresIn: jwtExpiresIn,
      user: toPublicUser(updatedUser),
    });
  });

  app.post("/api/auth/logout", authenticateBearer, async (req, res) => {
    // logout時もtokenVersionを進め、現在のトークンを再利用不可にする。
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });

    res.json({ ok: true, message: "logged out" });
  });
}

module.exports = {
  registerAuthRoutes,
};

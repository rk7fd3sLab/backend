const request = require("supertest");
const app = require("../src/server");

async function loginAs(email, password) {
  return request(app).post("/api/auth/login").send({ email, password });
}

module.exports = {
  app,
  request,
  loginAs,
};

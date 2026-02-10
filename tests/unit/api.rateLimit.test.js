const request = require('supertest');
const { RestAPIServer } = require('../../src/api/RestAPIServer');

describe('RestAPIServer rate limiting', () => {
  test('returns 429 after configured threshold', async () => {
    const server = new RestAPIServer({
      cors: false,
      rateLimit: { windowMs: 60000, max: 1 }
    });

    const app = server.app;

    const first = await request(app).get('/health');
    expect(first.status).toBe(200);

    const second = await request(app).get('/health');
    expect(second.status).toBe(429);
    expect(second.body.error).toMatch(/Too many requests/i);
  });
});

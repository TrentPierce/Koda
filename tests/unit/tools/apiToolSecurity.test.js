const { APITool } = require('../../../src/tools/APITool');

describe('APITool security controls', () => {
  test('blocks localhost by default', async () => {
    const tool = new APITool();

    await expect(tool.call('http://localhost:3000')).rejects.toThrow('blocked');
  });

  test('allows configured host allowlist', async () => {
    const tool = new APITool({ allowedHosts: ['example.com'] });

    tool.callWithRetry = jest.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { ok: true }
    });

    const result = await tool.call('https://example.com/path');
    expect(result.status).toBe(200);
  });
});

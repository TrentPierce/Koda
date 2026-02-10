const path = require('path');
const fs = require('fs').promises;
const { FileTool } = require('../../../src/tools/FileTool');

describe('FileTool path security', () => {
  const sandbox = path.join(__dirname, '..', '..', 'tmp-filetool');

  beforeEach(async () => {
    await fs.mkdir(sandbox, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(sandbox, { recursive: true, force: true });
  });

  test('blocks path traversal outside baseDir', async () => {
    const tool = new FileTool({ baseDir: sandbox });

    await expect(tool.read('../package.json')).rejects.toThrow('outside allowed');
  });

  test('rejects symlink path', async () => {
    if (process.platform === 'win32') {
      return;
    }
    const tool = new FileTool({ baseDir: sandbox });
    const target = path.join(sandbox, 'real.txt');
    const link = path.join(sandbox, 'link.txt');

    await fs.writeFile(target, 'ok', 'utf8');
    await fs.symlink(target, link);

    await expect(tool.read('link.txt')).rejects.toThrow('Symlink');
  });
});

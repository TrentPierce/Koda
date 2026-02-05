/**
 * Mock implementation of sharp for testing
 */

class SharpMock {
  constructor() {
    this.options = {};
  }

  resize(width, height) {
    this.options.resize = { width, height };
    return this;
  }

  toFormat(format) {
    this.options.format = format;
    return this;
  }

  toBuffer() {
    return Promise.resolve(Buffer.from('mock-image-data'));
  }

  toFile(path) {
    return Promise.resolve({
      format: this.options.format || 'png',
      width: this.options.resize?.width || 100,
      height: this.options.resize?.height || 100,
      size: 1024
    });
  }

  png() {
    this.options.format = 'png';
    return this;
  }

  jpeg() {
    this.options.format = 'jpeg';
    return this;
  }

  webp() {
    this.options.format = 'webp';
    return this;
  }

  grayscale() {
    this.options.grayscale = true;
    return this;
  }

  blur(sigma) {
    this.options.blur = sigma;
    return this;
  }

  rotate(angle) {
    this.options.rotate = angle;
    return this;
  }

  extract(region) {
    this.options.extract = region;
    return this;
  }

  metadata() {
    return Promise.resolve({
      format: 'png',
      width: 1920,
      height: 1080,
      space: 'srgb',
      channels: 4,
      depth: 'uchar'
    });
  }
}

module.exports = function sharp(input) {
  return new SharpMock(input);
};

module.exports.SharpMock = SharpMock;

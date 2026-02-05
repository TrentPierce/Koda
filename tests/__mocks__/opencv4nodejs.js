/**
 * Mock implementation of opencv4nodejs for testing
 */

class MatMock {
  constructor(rows, cols, type) {
    this.rows = rows;
    this.cols = cols;
    this.type = type;
    this.data = Buffer.alloc(rows * cols * 4);
  }

  get(row, col) {
    return [0, 0, 0, 255];
  }

  set(row, col, value) {
    return this;
  }

  resize(width, height) {
    return new MatMock(height, width, this.type);
  }

  release() {
    // Mock release
  }
}

const cv = {
  // Constants
  CV_8UC1: 0,
  CV_8UC3: 16,
  CV_8UC4: 24,
  CV_32F: 5,
  CV_64F: 6,
  COLOR_BGR2GRAY: 6,
  COLOR_BGR2RGB: 4,
  COLOR_RGBA2BGR: 2,
  THRESH_BINARY: 0,
  THRESH_BINARY_INV: 1,
  RETR_EXTERNAL: 0,
  RETR_TREE: 3,
  CHAIN_APPROX_SIMPLE: 2,
  CHAIN_APPROX_NONE: 1,

  // Mat operations
  Mat: MatMock,

  imread(path) {
    return new MatMock(1080, 1920, cv.CV_8UC3);
  },

  imwrite(path, mat) {
    return true;
  },

  imdecode(buffer, flags) {
    return new MatMock(1080, 1920, cv.CV_8UC3);
  },

  imencode(ext, mat, params) {
    return Buffer.from('mock-encoded-image');
  },

  resize(src, dsize, fx, fy, interpolation) {
    return new MatMock(dsize.height, dsize.width, src.type);
  },

  cvtColor(src, code, dstCn) {
    return new MatMock(src.rows, src.cols, cv.CV_8UC3);
  },

  threshold(src, thresh, maxval, type) {
    return {
      dst: new MatMock(src.rows, src.cols, src.type),
      val: thresh
    };
  },

  findContours(image, mode, method) {
    return {
      contours: [],
      hierarchy: new MatMock(1, 1, cv.CV_32S)
    };
  },

  contourArea(contour, oriented) {
    return 0;
  },

  boundingRect(contour) {
    return { x: 0, y: 0, width: 100, height: 100 };
  },

  rectangle(mat, pt1, pt2, color, thickness) {
    return mat;
  },

  circle(mat, center, radius, color, thickness) {
    return mat;
  },

  line(mat, pt1, pt2, color, thickness) {
    return mat;
  },

  putText(mat, text, org, fontFace, fontScale, color, thickness) {
    return mat;
  },

  matchTemplate(image, templ, method) {
    return new MatMock(image.rows - templ.rows + 1, image.cols - templ.cols + 1, cv.CV_32F);
  },

  minMaxLoc(mat) {
    return {
      minVal: 0,
      maxVal: 1,
      minLoc: { x: 0, y: 0 },
      maxLoc: { x: 0, y: 0 }
    };
  },

  blur(src, ksize) {
    return new MatMock(src.rows, src.cols, src.type);
  },

  GaussianBlur(src, ksize, sigmaX) {
    return new MatMock(src.rows, src.cols, src.type);
  },

  medianBlur(src, ksize) {
    return new MatMock(src.rows, src.cols, src.type);
  },

  Canny(image, threshold1, threshold2) {
    return new MatMock(image.rows, image.cols, cv.CV_8UC1);
  },

  dilate(src, kernel, iterations) {
    return new MatMock(src.rows, src.cols, src.type);
  },

  erode(src, kernel, iterations) {
    return new MatMock(src.rows, src.cols, src.type);
  },

  getStructuringElement(shape, ksize) {
    return new MatMock(ksize.height, ksize.width, cv.CV_8UC1);
  },

  // Cascade classifiers
  CascadeClassifier: class CascadeClassifier {
    constructor(path) {
      this.path = path;
    }

    load(path) {
      return true;
    }

    detectMultiScale(image, scaleFactor, minNeighbors, flags, minSize, maxSize) {
      return {
        objects: [],
        numDetections: 0
      };
    }
  },

  // Video capture
  VideoCapture: class VideoCapture {
    constructor(source) {
      this.source = source;
      this.isOpened = true;
    }

    read() {
      return {
        mat: new MatMock(480, 640, cv.CV_8UC3),
        returnValue: true
      };
    }

    release() {
      this.isOpened = false;
    }
  }
};

module.exports = cv;

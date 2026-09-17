import "fake-indexeddb/auto";

// jsdom has no OffscreenCanvas. The editor core only uses it as a raster cache, which no
// unit test asserts on, so a constructor-level stub is enough to keep modules importable.
if (!("OffscreenCanvas" in globalThis)) {
  class OffscreenCanvasStub {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }

    getContext() {
      return {
        putImageData() {},
        drawImage() {},
        clearRect() {},
        fillRect() {},
        getImageData: () => null,
        globalAlpha: 1,
        globalCompositeOperation: "source-over",
        imageSmoothingEnabled: false,
      };
    }
  }

  Object.assign(globalThis, { OffscreenCanvas: OffscreenCanvasStub });
}

// jsdom implements ImageData only behind canvas; the core relies on it sharing the buffer.
if (!("ImageData" in globalThis)) {
  class ImageDataStub {
    data: Uint8ClampedArray;
    width: number;
    height: number;

    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  }

  Object.assign(globalThis, { ImageData: ImageDataStub });
}

/**
 * Straight (non-premultiplied) RGBA pixels, 4 bytes per pixel.
 *
 * Pinned to `ArrayBuffer` rather than the default `ArrayBufferLike`, because `ImageData`
 * refuses a possibly-shared buffer and the cel raster depends on wrapping this array directly.
 */
export type PixelBuffer = Uint8ClampedArray<ArrayBuffer>;

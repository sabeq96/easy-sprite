import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { flushCels } from "@/db/repositories/cels";
import { createSprite, loadSnapshot } from "@/db/repositories/sprites";
import { setPixel } from "@/editor/buffer";
import { openDocument, saveDocumentStructure } from "@/services/documentService";
import { RED } from "@/test/factories";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("documentService", () => {
  it("opens a stored sprite into a live document", async () => {
    const sprite = await createSprite({ name: "Hero", width: 4, height: 4 });
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    setPixel(pixels, 2, 2, 4, RED);
    await flushCels([
      {
        spriteId: sprite.id,
        layerId: sprite.layerIds[0],
        frameId: sprite.frames[0].id,
        pixels,
      },
    ]);

    const doc = await openDocument(sprite.id);

    expect(doc.name).toBe("Hero");
    expect(doc.layers).toHaveLength(1);
    expect(doc.frames).toHaveLength(1);
    expect(doc.getCel(sprite.layerIds[0], sprite.frames[0].id)?.pixels[(2 * 4 + 2) * 4]).toBe(255);
  });

  it("round-trips structural edits through the database", async () => {
    const sprite = await createSprite({ width: 4, height: 4 });
    const doc = await openDocument(sprite.id);

    const added = doc.addLayer("Outline");
    doc.addFrame();
    doc.setMeta({ name: "Renamed", fps: 24 });
    await saveDocumentStructure(doc);

    const reopened = await openDocument(sprite.id);
    expect(reopened.name).toBe("Renamed");
    expect(reopened.fps).toBe(24);
    expect(reopened.frames).toHaveLength(2);
    expect(reopened.layers.map((layer) => layer.id)).toEqual([sprite.layerIds[0], added.id]);
  });

  it("prunes layers deleted on the document", async () => {
    const sprite = await createSprite({ width: 2, height: 2 });
    const doc = await openDocument(sprite.id);
    const extra = doc.addLayer("Temp");
    await saveDocumentStructure(doc);
    expect(await db.layers.count()).toBe(2);

    doc.removeLayer(extra.id);
    await saveDocumentStructure(doc);

    expect(await db.layers.count()).toBe(1);
    const snapshot = await loadSnapshot(sprite.id);
    expect(snapshot.layers.map((layer) => layer.id)).toEqual([sprite.layerIds[0]]);
  });
});

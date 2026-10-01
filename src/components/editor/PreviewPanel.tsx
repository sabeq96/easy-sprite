import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { Panel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_FPS, MAX_FPS, MIN_FPS } from "@/constants/animation";
import { compositeFrame } from "@/core/composite";
import { useAnimationPlayer } from "@/hooks/useAnimationPlayer";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { useEditorStore } from "@/stores/useEditorStore";

export function PreviewPanel() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Preview-only: not saved with the sprite, so every open starts at the default.
  const [fps, setFps] = useState(DEFAULT_FPS);
  const activeFrameId = useEditorStore((state) => state.activeFrameId);
  const setPlaying = useEditorStore((state) => state.setPlaying);

  const player = useAnimationPlayer({ doc, fps });

  // Mirror playback into the store so the renderer can suppress onion skin while playing.
  useEffect(() => {
    setPlaying(player.isPlaying);
  }, [player.isPlaying, setPlaying]);

  // Repaint on frame change and on any pixel change, so the preview is live while drawing.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let queued = false;

    const paint = () => {
      queued = false;
      const frame = player.isPlaying
        ? snapshot.frames[player.frameIndex % snapshot.frames.length]
        : (snapshot.frames.find((candidate) => candidate.id === activeFrameId) ??
          snapshot.frames[0]);
      if (!frame) return;

      const source = compositeFrame(doc, frame.id);
      const scale = Math.max(
        1,
        Math.floor(Math.min(canvas.width / doc.width, canvas.height / doc.height)),
      );
      const width = doc.width * scale;
      const height = doc.height * scale;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        source,
        Math.round((canvas.width - width) / 2),
        Math.round((canvas.height - height) / 2),
        width,
        height,
      );
    };

    paint();
    return doc.events.on("pixels", () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    });
  }, [doc, snapshot, player.isPlaying, player.frameIndex, activeFrameId]);

  return (
    <Panel
      render={<section aria-label="Preview" />}
      className="flex shrink-0 flex-col gap-2 p-2"
    >
      <canvas
        ref={canvasRef}
        width={480}
        height={300}
        className="w-full rounded-lg bg-checker-a ring-1 ring-foreground/10"
      />

      <div className="flex items-center gap-2">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={player.isPlaying ? "Pause animation" : "Play animation"}
          disabled={snapshot.frames.length < 2}
          onClick={player.toggle}
        >
          {player.isPlaying ? <Pause /> : <Play />}
        </Button>

        <Slider
          className="flex-1"
          min={MIN_FPS}
          max={MAX_FPS}
          value={[fps]}
          aria-label="Frames per second"
          onValueChange={(value) => setFps(Array.isArray(value) ? value[0] : value)}
        />

        <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
          {fps} fps
        </span>
      </div>
    </Panel>
  );
}

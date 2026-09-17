import { expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { render } from "@test/render";
import { makeDocument } from "@test/factories";

test("Export PNG produces a PNG blob sized to the spritesheet layout", async () => {
  const doc = makeDocument({ width: 8, height: 8 });
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");

  const screen = render(<ExportDialog doc={doc} open onOpenChange={() => {}} />);

  await userEvent.click(screen.getByRole("button", { name: "Export PNG" }));

  await expect.poll(() => createObjectURL.mock.calls.length).toBe(1);
  const [blob] = createObjectURL.mock.calls[0] as [Blob];
  expect(blob.type).toBe("image/png");
  expect(blob.size).toBeGreaterThan(0);

  createObjectURL.mockRestore();
});

test("cancel closes the dialog without exporting anything", async () => {
  const doc = makeDocument({ width: 8, height: 8 });
  const createObjectURL = vi.spyOn(URL, "createObjectURL");
  const onOpenChange = vi.fn();

  const screen = render(<ExportDialog doc={doc} open onOpenChange={onOpenChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  expect(createObjectURL).not.toHaveBeenCalled();

  createObjectURL.mockRestore();
});

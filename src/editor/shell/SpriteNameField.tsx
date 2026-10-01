import { useDocumentSession } from "@/app/DocumentProvider";
import { InlineNameField } from "@/components/common/InlineNameField";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";

export function SpriteNameField() {
  const { doc } = useDocumentSession();
  const snapshot = useDocumentSnapshot(doc);

  return (
    <InlineNameField
      label="Sprite name"
      name={snapshot.name}
      onCommit={(name) => doc.setMeta({ name })}
    />
  );
}

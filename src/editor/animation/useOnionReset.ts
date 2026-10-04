import { useEffect } from "react";
import { useDocumentSession } from "@/app/DocumentProvider";
import { useDefaultsStore } from "@/stores/useDefaultsStore";
import { useAnimationStore } from "./store";

/** Onion skin to the user's defaults whenever a sprite opens. */
export function useOnionReset(): void {
  const { doc } = useDocumentSession();
  const setOnion = useAnimationStore((state) => state.setOnion);

  useEffect(() => {
    const { onionEnabled, onionDirection, onionOpacity } = useDefaultsStore.getState().defaults;
    setOnion({ enabled: onionEnabled, direction: onionDirection, opacity: onionOpacity });
  }, [doc, setOnion]);
}

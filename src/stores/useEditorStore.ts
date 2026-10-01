import { create } from "zustand";

/** Empty: every field moved into an editor module's store. Deleted with the canvas module (stage 5, task 8). */
export const useEditorStore = create<Record<string, never>>()(() => ({}));

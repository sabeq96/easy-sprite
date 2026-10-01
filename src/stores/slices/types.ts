import type { StateCreator } from "zustand";
import type { SettingsSlice } from "@/stores/slices/settingsSlice";
import type { ToolSlice } from "@/stores/slices/toolSlice";

export type EditorStore = ToolSlice & SettingsSlice;

export type SliceCreator<T> = StateCreator<EditorStore, [], [], T>;

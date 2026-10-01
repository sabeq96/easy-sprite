import type { StateCreator } from "zustand";
import type { SettingsSlice } from "@/stores/slices/settingsSlice";
import type { ToolSlice } from "@/stores/slices/toolSlice";
import type { ViewSlice } from "@/stores/slices/viewSlice";

export type EditorStore = ViewSlice & ToolSlice & SettingsSlice;

export type SliceCreator<T> = StateCreator<EditorStore, [], [], T>;

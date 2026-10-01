import type { StateCreator } from "zustand";
import type { ColorSlice } from "@/stores/slices/colorSlice";
import type { SettingsSlice } from "@/stores/slices/settingsSlice";
import type { ToolSlice } from "@/stores/slices/toolSlice";
import type { ViewSlice } from "@/stores/slices/viewSlice";

export type EditorStore = ViewSlice & ToolSlice & ColorSlice & SettingsSlice;

export type SliceCreator<T> = StateCreator<EditorStore, [], [], T>;

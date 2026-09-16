import type { StateCreator } from "zustand";
import type { ColorSlice } from "@/stores/slices/colorSlice";
import type { SelectionSlice } from "@/stores/slices/selectionSlice";
import type { ToolSlice } from "@/stores/slices/toolSlice";
import type { ViewSlice } from "@/stores/slices/viewSlice";

export type EditorStore = ViewSlice & ToolSlice & ColorSlice & SelectionSlice;

export type SliceCreator<T> = StateCreator<EditorStore, [], [], T>;

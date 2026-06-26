import { create } from "zustand";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmText?: string;
  onConfirm: () => void;
};

type ConfirmState = {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: (() => void) | null;
  confirm: (options: ConfirmOptions) => void;
  close: () => void;
};

/**
 * Tiny global store backing a single app-wide confirmation dialog.
 * Any component can trigger it via `useConfirmStore().confirm({...})`.
 */
export const useConfirmStore = create<ConfirmState>((set) => ({
  open: false,
  title: "",
  description: "",
  confirmText: "Confirm",
  onConfirm: null,
  confirm: ({ title, description, confirmText = "Confirm", onConfirm }) =>
    set({ open: true, title, description, confirmText, onConfirm }),
  close: () => set({ open: false, onConfirm: null }),
}));

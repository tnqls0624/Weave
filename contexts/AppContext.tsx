import React, { ReactNode } from "react";
import { useAppStore } from "../stores";

export function AppProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useApp() {
  return useAppStore();
}

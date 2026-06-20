"use client";

import { createContext, useContext } from "react";

interface AppContextValue {
  isAdmin: boolean;
  role: string;
}

const AppContext = createContext<AppContextValue>({ isAdmin: false, role: "staff" });

export function AppContextProvider({
  children,
  isAdmin,
  role,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  role: string;
}) {
  return (
    <AppContext.Provider value={{ isAdmin, role }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}

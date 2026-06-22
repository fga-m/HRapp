"use client";

import { createContext, useContext } from "react";

interface AppContextValue {
  isAdmin: boolean;
  /** Primary role (backward compatible). */
  role: string;
  /** All roles held by the user. */
  roles: string[];
  /** Effective permissions (union across roles; empty array for admins who get all). */
  permissions: string[];
  /** True if the user has a feature (admins always do). */
  can: (feature: string) => boolean;
}

const AppContext = createContext<AppContextValue>({
  isAdmin: false,
  role: "staff",
  roles: ["staff"],
  permissions: [],
  can: () => false,
});

export function AppContextProvider({
  children,
  isAdmin,
  role,
  roles,
  permissions,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  role: string;
  roles?: string[];
  permissions?: string[];
}) {
  const resolvedRoles = roles && roles.length > 0 ? roles : [role];
  const resolvedPerms = permissions ?? [];
  const can = (feature: string) => isAdmin || resolvedPerms.includes(feature);
  return (
    <AppContext.Provider
      value={{ isAdmin, role, roles: resolvedRoles, permissions: resolvedPerms, can }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}

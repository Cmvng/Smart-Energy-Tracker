import { createContext, useContext, useState, ReactNode } from "react";

interface AddSheetContextType {
  showAddSheet: boolean;
  openAddSheet: () => void;
  closeAddSheet: () => void;
}

const AddSheetContext = createContext<AddSheetContextType>({
  showAddSheet: false,
  openAddSheet: () => {},
  closeAddSheet: () => {},
});

export function AddSheetProvider({ children }: { children: ReactNode }) {
  const [showAddSheet, setShowAddSheet] = useState(false);
  return (
    <AddSheetContext.Provider
      value={{
        showAddSheet,
        openAddSheet: () => setShowAddSheet(true),
        closeAddSheet: () => setShowAddSheet(false),
      }}
    >
      {children}
    </AddSheetContext.Provider>
  );
}

export function useAddSheet() {
  return useContext(AddSheetContext);
}

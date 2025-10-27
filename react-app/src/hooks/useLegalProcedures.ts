// useLegalProcedures Hook
// ========================
// Hook לגישה ל-Legal Procedures Context

import { useContext } from 'react';
import { LegalProceduresContext } from '@context/LegalProceduresContext';

export const useLegalProcedures = () => {
  const context = useContext(LegalProceduresContext);

  if (!context) {
    throw new Error('useLegalProcedures must be used within a LegalProceduresProvider');
  }

  return context;
};

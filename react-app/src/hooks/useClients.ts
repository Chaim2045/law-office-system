// useClients Hook
// ================
// Hook לגישה ל-Clients Context

import { useContext } from 'react';
import { ClientsContext } from '@context/ClientsContext';

export const useClients = () => {
  const context = useContext(ClientsContext);

  if (!context) {
    throw new Error('useClients must be used within a ClientsProvider');
  }

  return context;
};

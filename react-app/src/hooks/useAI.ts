// useAI Hook
// ===========
// Custom hook for accessing AI Context

import { useContext } from 'react';
import { AIContext } from '@context/AIContext';

export const useAI = () => {
  const context = useContext(AIContext);

  if (!context) {
    throw new Error('useAI must be used within AIProvider');
  }

  return context;
};

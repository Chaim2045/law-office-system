// Clients Service
// ================
// שירות לניהול לקוחות דרך Firebase Functions

import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Client, ClientFormData, FirebaseFunctionResponse } from '../../types';

const functions = getFunctions();

/**
 * יצירת לקוח חדש (Client = Case)
 */
export const createClient = async (clientData: ClientFormData): Promise<Client> => {
  try {
    const createClientFn = httpsCallable<ClientFormData, FirebaseFunctionResponse<Client>>(
      functions,
      'createClient'
    );

    const result = await createClientFn(clientData);

    if (!result.data.success) {
      throw new Error(result.data.message || 'שגיאה ביצירת לקוח');
    }

    if (!result.data.data) {
      throw new Error('לא התקבל מידע על הלקוח שנוצר');
    }

    return result.data.data;
  } catch (error: unknown) {
    console.error('Error creating client:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה ביצירת לקוח');
  }
};

/**
 * קבלת כל הלקוחות
 * @param includeInternal - האם לכלול תיקים פנימיים (ברירת מחדל: false)
 */
export const getClients = async (includeInternal = false): Promise<Client[]> => {
  try {
    const getClientsFn = httpsCallable<{ includeInternal?: boolean }, FirebaseFunctionResponse<{ clients: Client[] }>>(
      functions,
      'getClients'
    );

    const result = await getClientsFn({ includeInternal });

    if (!result.data.success) {
      throw new Error(result.data.message || 'שגיאה בטעינת לקוחות');
    }

    if (!result.data.data?.clients) {
      throw new Error('לא התקבל מידע על לקוחות');
    }

    return result.data.data.clients;
  } catch (error: unknown) {
    console.error('Error fetching clients:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה בטעינת לקוחות');
  }
};

/**
 * קבלת לקוח בודד לפי ID
 */
export const getClient = async (clientId: string): Promise<Client> => {
  try {
    const getClientFn = httpsCallable<{ clientId: string }, FirebaseFunctionResponse<Client>>(
      functions,
      'getClient'
    );

    const result = await getClientFn({ clientId });

    if (!result.data.success) {
      throw new Error(result.data.message || 'שגיאה בטעינת לקוח');
    }

    if (!result.data.data) {
      throw new Error('לקוח לא נמצא');
    }

    return result.data.data;
  } catch (error: unknown) {
    console.error('Error fetching client:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה בטעינת לקוח');
  }
};

/**
 * עדכון לקוח קיים
 */
export const updateClient = async (
  clientId: string,
  updates: Partial<Client>
): Promise<Client> => {
  try {
    const updateClientFn = httpsCallable<
      { clientId: string } & Partial<Client>,
      FirebaseFunctionResponse<Client>
    >(functions, 'updateClient');

    const result = await updateClientFn({ clientId, ...updates });

    if (!result.data.success) {
      throw new Error(result.data.message || 'שגיאה בעדכון לקוח');
    }

    if (!result.data.data) {
      throw new Error('לא התקבל מידע על הלקוח המעודכן');
    }

    return result.data.data;
  } catch (error: unknown) {
    console.error('Error updating client:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה בעדכון לקוח');
  }
};

/**
 * מחיקת לקוח
 */
export const deleteClient = async (clientId: string): Promise<void> => {
  try {
    const deleteClientFn = httpsCallable<
      { clientId: string },
      FirebaseFunctionResponse<void>
    >(functions, 'deleteClient');

    const result = await deleteClientFn({ clientId });

    if (!result.data.success) {
      throw new Error(result.data.message || 'שגיאה במחיקת לקוח');
    }
  } catch (error: unknown) {
    console.error('Error deleting client:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה במחיקת לקוח');
  }
};

/**
 * חיפוש לקוחות
 * @param searchTerm - מילת חיפוש
 * @param includeInternal - האם לכלול תיקים פנימיים (ברירת מחדל: false)
 */
export const searchClients = async (searchTerm: string, includeInternal = false): Promise<Client[]> => {
  try {
    const allClients = await getClients(includeInternal);

    if (!searchTerm.trim()) {
      return allClients;
    }

    const term = searchTerm.toLowerCase().trim();

    return allClients.filter(client =>
      client.clientName.toLowerCase().includes(term) ||
      client.caseNumber.toLowerCase().includes(term) ||
      client.phone.includes(term) ||
      client.email.toLowerCase().includes(term)
    );
  } catch (error: unknown) {
    console.error('Error searching clients:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה בחיפוש לקוחות');
  }
};

// Legal Procedures Service
// =========================
// שירות לניהול הליכים משפטיים (מבוסס על Clients עם procedureType: 'legal_procedure')

import * as clientsService from './clientsService';
import type { Client, LegalProcedure, Stage } from '../../types';

/**
 * המרת Client להליך משפטי (LegalProcedure)
 * הליכים משפטיים הם Clients עם procedureType: 'legal_procedure'
 */
const clientToLegalProcedure = (client: Client): LegalProcedure => {
  return {
    id: client.id,
    clientId: client.id,
    clientName: client.clientName,
    caseNumber: client.caseNumber,
    title: client.description || `הליך משפטי - ${client.clientName}`,
    description: client.description,
    status: client.status === 'active' ? 'active' :
            client.status === 'completed' ? 'completed' :
            client.status === 'on_hold' ? 'on_hold' : 'cancelled',
    currentStage: client.currentStage || '',
    stages: client.stages || [],
    totalStages: client.stages?.length || 0,
    completedStages: client.stages?.filter(s => s.status === 'completed').length || 0,
    createdBy: client.createdBy,
    createdAt: client.createdAt,
    lastModifiedBy: client.lastModifiedBy,
    lastModifiedAt: client.lastModifiedAt,
    priority: client.priority,
    assignedTo: client.assignedTo,
  };
};

/**
 * קבלת כל ההליכים המשפטיים
 */
export const getLegalProcedures = async (): Promise<LegalProcedure[]> => {
  try {
    const clients = await clientsService.getClients();

    // סינון רק Clients עם procedureType: 'legal_procedure'
    const legalProcedureClients = clients.filter(
      client => client.procedureType === 'legal_procedure'
    );

    return legalProcedureClients.map(clientToLegalProcedure);
  } catch (error: unknown) {
    console.error('Error fetching legal procedures:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה בטעינת הליכים משפטיים');
  }
};

/**
 * קבלת הליך משפטי בודד
 */
export const getLegalProcedure = async (procedureId: string): Promise<LegalProcedure> => {
  try {
    const client = await clientsService.getClient(procedureId);

    if (client.procedureType !== 'legal_procedure') {
      throw new Error('התיק הזה אינו הליך משפטי');
    }

    return clientToLegalProcedure(client);
  } catch (error: unknown) {
    console.error('Error fetching legal procedure:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה בטעינת הליך משפטי');
  }
};

/**
 * עדכון הליך משפטי
 */
export const updateLegalProcedure = async (
  procedureId: string,
  updates: Partial<LegalProcedure>
): Promise<LegalProcedure> => {
  try {
    // המרה מ-LegalProcedure ל-Client updates
    const clientUpdates: Partial<Client> = {
      description: updates.description,
      status: updates.status === 'on_hold' ? 'on_hold' :
              updates.status === 'completed' ? 'completed' :
              updates.status === 'cancelled' ? 'inactive' : 'active',
      priority: updates.priority,
      currentStage: updates.currentStage,
      stages: updates.stages,
    };

    const updatedClient = await clientsService.updateClient(procedureId, clientUpdates);

    return clientToLegalProcedure(updatedClient);
  } catch (error: unknown) {
    console.error('Error updating legal procedure:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה בעדכון הליך משפטי');
  }
};

/**
 * עדכון שלב בהליך משפטי
 */
export const updateStage = async (
  procedureId: string,
  stageId: string,
  updates: Partial<Stage>
): Promise<LegalProcedure> => {
  try {
    const procedure = await getLegalProcedure(procedureId);

    if (!procedure.stages) {
      throw new Error('אין שלבים בהליך זה');
    }

    const updatedStages = procedure.stages.map(stage =>
      stage.id === stageId ? { ...stage, ...updates } : stage
    );

    return await updateLegalProcedure(procedureId, { stages: updatedStages });
  } catch (error: unknown) {
    console.error('Error updating stage:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה בעדכון שלב');
  }
};

/**
 * סימון שלב כהושלם
 */
export const completeStage = async (
  procedureId: string,
  stageId: string
): Promise<LegalProcedure> => {
  try {
    const procedure = await getLegalProcedure(procedureId);

    if (!procedure.stages) {
      throw new Error('אין שלבים בהליך זה');
    }

    const stageIndex = procedure.stages.findIndex(s => s.id === stageId);
    if (stageIndex === -1) {
      throw new Error('שלב לא נמצא');
    }

    const updatedStages = procedure.stages.map((stage, index) => {
      if (stage.id === stageId) {
        return {
          ...stage,
          status: 'completed' as const,
          completionDate: new Date().toISOString(),
        };
      }
      // הפעל את השלב הבא אם קיים
      if (index === stageIndex + 1 && stage.status === 'pending') {
        return {
          ...stage,
          status: 'active' as const,
          startDate: new Date().toISOString(),
        };
      }
      return stage;
    });

    // עדכן שלב נוכחי
    const nextActiveStage = updatedStages.find(s => s.status === 'active');
    const currentStage = nextActiveStage ? nextActiveStage.name : 'הושלם';

    // בדוק אם כל השלבים הושלמו
    const allCompleted = updatedStages.every(s => s.status === 'completed');
    const status = allCompleted ? 'completed' : procedure.status;

    return await updateLegalProcedure(procedureId, {
      stages: updatedStages,
      currentStage,
      status,
    });
  } catch (error: unknown) {
    console.error('Error completing stage:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה בהשלמת שלב');
  }
};

/**
 * ביטול שלב
 */
export const cancelStage = async (
  procedureId: string,
  stageId: string,
  _reason?: string
): Promise<LegalProcedure> => {
  try {
    return await updateStage(procedureId, stageId, {
      status: 'cancelled',
      // אפשר להוסיף שדה 'cancellationReason' ל-Stage interface אם צריך
    });
  } catch (error: unknown) {
    console.error('Error cancelling stage:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה בביטול שלב');
  }
};

/**
 * חיפוש הליכים משפטיים
 */
export const searchLegalProcedures = async (searchTerm: string): Promise<LegalProcedure[]> => {
  try {
    const procedures = await getLegalProcedures();

    if (!searchTerm.trim()) {
      return procedures;
    }

    const term = searchTerm.toLowerCase().trim();

    return procedures.filter(
      procedure =>
        procedure.clientName.toLowerCase().includes(term) ||
        procedure.caseNumber.toLowerCase().includes(term) ||
        procedure.title.toLowerCase().includes(term) ||
        procedure.description.toLowerCase().includes(term)
    );
  } catch (error: unknown) {
    console.error('Error searching legal procedures:', error);

    if (error && typeof error === 'object' && 'message' in error) {
      throw new Error((error as { message: string }).message);
    }

    throw new Error('שגיאה בחיפוש הליכים משפטיים');
  }
};

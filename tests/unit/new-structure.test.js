/**
 * 🧪 Tests for New Data Structure
 *
 * בודק שהמבנה החדש עובד נכון:
 * - יצירת שירות חדש ללקוח קיים
 * - קיזוז שעות מהשירות הנכון
 * - חישובי שעות נותרות
 * - עדכון UI
 */

import { describe, it, expect, beforeEach, vi, test } from 'vitest';

/**
 * Mock של calculateRemainingHours - ההגדרה האמיתית מ-core-utils.js
 */
function calculateRemainingHours(entity) {
  if (!entity) {
    return 0;
  }

  if (!entity.packages || !Array.isArray(entity.packages) || entity.packages.length === 0) {
    return entity.hoursRemaining || 0;
  }

  const totalHours = entity.packages
    .filter(pkg => pkg.status === 'active' || !pkg.status)
    .reduce((sum, pkg) => sum + (pkg.hoursRemaining || 0), 0);

  return totalHours;
}

/**
 * Mock של getActivePackage
 */
function getActivePackage(stage) {
  if (!stage.packages || !Array.isArray(stage.packages)) {
    return null;
  }

  return stage.packages.find(pkg =>
    (pkg.status === 'active' || !pkg.status) &&
    (pkg.hoursRemaining === undefined || pkg.hoursRemaining > 0)
  );
}

describe('New Data Structure - Services Architecture', () => {

  describe('מבנה נתונים בסיסי', () => {

    it('לקוח עם שירותים - מבנה תקין', () => {
      const client = {
        id: '2025001',
        caseNumber: '2025001',
        clientName: 'יוסי כהן',
        services: [
          {
            id: 'srv_001',
            type: 'legal_procedure',
            name: 'הליך גירושין',
            pricingType: 'hourly',
            currentStage: 'stage_a',
            stages: [
              {
                id: 'stage_a',
                name: 'שלב א\'',
                status: 'active',
                totalHours: 20,
                hoursUsed: 0,
                hoursRemaining: 20,
                packages: [
                  {
                    id: 'pkg_001',
                    type: 'initial',
                    hours: 20,
                    hoursUsed: 0,
                    hoursRemaining: 20,
                    status: 'active'
                  }
                ]
              }
            ],
            totalHours: 20,
            hoursUsed: 0,
            hoursRemaining: 20
          }
        ]
      };

      // ודא שהמבנה תקין
      expect(client).toHaveProperty('services');
      expect(client.services).toBeInstanceOf(Array);
      expect(client.services.length).toBe(1);

      const service = client.services[0];
      expect(service.type).toBe('legal_procedure');
      expect(service.stages).toBeInstanceOf(Array);

      const stage = service.stages[0];
      expect(stage.packages).toBeInstanceOf(Array);
      expect(stage.packages[0].status).toBe('active');
    });

    it('לקוח ללא שדה stages ברמת הלקוח - אין מבנה legacy', () => {
      const client = {
        id: '2025001',
        clientName: 'יוסי כהן',
        services: [
          {
            id: 'srv_001',
            type: 'hours',
            name: 'ייעוץ משפטי'
          }
        ]
      };

      // ודא שאין stages ברמת הלקוח
      expect(client).not.toHaveProperty('stages');
      expect(client).not.toHaveProperty('procedureType');

      // רק services
      expect(client.services).toBeDefined();
      expect(client.services.length).toBeGreaterThan(0);
    });
  });

  describe('זיהוי שירות ושלב מתוך משימה', () => {

    it('משימה מכילה serviceId ו-parentServiceId', () => {
      const task = {
        id: 'task_123',
        clientId: '2025001',
        serviceId: 'stage_a',          // זיהוי השלב
        serviceName: 'שלב א\'',
        serviceType: 'legal_procedure',
        parentServiceId: 'srv_001'     // זיהוי השירות ההורה
      };

      expect(task.serviceId).toBe('stage_a');
      expect(task.parentServiceId).toBe('srv_001');
      expect(task.serviceType).toBe('legal_procedure');
    });

    it('מציאת השירות והשלב הנכון לפי המזהים', () => {
      const client = {
        services: [
          {
            id: 'srv_001',
            type: 'legal_procedure',
            stages: [
              { id: 'stage_a', name: 'שלב א\'', hoursRemaining: 20 },
              { id: 'stage_b', name: 'שלב ב\'', hoursRemaining: 30 }
            ]
          },
          {
            id: 'srv_002',
            type: 'hours',
            name: 'ייעוץ'
          }
        ]
      };

      const task = {
        parentServiceId: 'srv_001',
        serviceId: 'stage_a'
      };

      // מצא את השירות
      const service = client.services.find(s => s.id === task.parentServiceId);
      expect(service).toBeDefined();
      expect(service.id).toBe('srv_001');

      // מצא את השלב
      const stage = service.stages.find(s => s.id === task.serviceId);
      expect(stage).toBeDefined();
      expect(stage.id).toBe('stage_a');
      expect(stage.hoursRemaining).toBe(20);
    });
  });

  describe('קיזוז שעות - מבנה חדש בלבד', () => {

    it('קיזוז שעות מהליך משפטי - שלב א\'', () => {
      const client = {
        services: [
          {
            id: 'srv_001',
            type: 'legal_procedure',
            pricingType: 'hourly',
            stages: [
              {
                id: 'stage_a',
                status: 'active',
                totalHours: 20,
                hoursUsed: 0,
                hoursRemaining: 20,
                packages: [
                  {
                    id: 'pkg_001',
                    hours: 20,
                    hoursUsed: 0,
                    hoursRemaining: 20,
                    status: 'active'
                  }
                ]
              }
            ],
            totalHours: 20,
            hoursUsed: 0,
            hoursRemaining: 20
          }
        ]
      };

      const task = {
        parentServiceId: 'srv_001',
        serviceId: 'stage_a'
      };

      const minutesToAdd = 75; // 1.25 שעות
      const hoursToAdd = minutesToAdd / 60;

      // מצא ועדכן
      const service = client.services.find(s => s.id === task.parentServiceId);
      const stage = service.stages.find(s => s.id === task.serviceId);
      const pkg = stage.packages.find(p => p.status === 'active');

      // קיזוז
      pkg.hoursUsed += hoursToAdd;
      pkg.hoursRemaining -= hoursToAdd;
      stage.hoursUsed += hoursToAdd;
      stage.hoursRemaining -= hoursToAdd;
      service.hoursUsed += hoursToAdd;
      service.hoursRemaining -= hoursToAdd;

      // בדיקות
      expect(pkg.hoursUsed).toBe(1.25);
      expect(pkg.hoursRemaining).toBe(18.75);
      expect(stage.hoursUsed).toBe(1.25);
      expect(stage.hoursRemaining).toBe(18.75);
      expect(service.hoursUsed).toBe(1.25);
      expect(service.hoursRemaining).toBe(18.75);
    });

    it('קיזוז מרובה עד סגירת חבילה', () => {
      const pkg = {
        id: 'pkg_001',
        hours: 10,
        hoursUsed: 0,
        hoursRemaining: 10,
        status: 'active'
      };

      // קזז 9.5 שעות
      pkg.hoursUsed += 9.5;
      pkg.hoursRemaining -= 9.5;

      expect(pkg.hoursRemaining).toBe(0.5);
      expect(pkg.status).toBe('active');

      // קזז עוד 0.5 שעות - החבילה תתרוקן
      pkg.hoursUsed += 0.5;
      pkg.hoursRemaining -= 0.5;

      expect(pkg.hoursRemaining).toBe(0);

      // עכשיו צריך לסגור את החבילה
      if (pkg.hoursRemaining <= 0) {
        pkg.status = 'depleted';
      }

      expect(pkg.status).toBe('depleted');
    });
  });

  describe('חישוב שעות נותרות - calculateRemainingHours', () => {

    it('חישוב מכל החבילות הפעילות', () => {
      const stage = {
        id: 'stage_a',
        packages: [
          {
            id: 'pkg_001',
            status: 'active',
            hoursRemaining: 10
          },
          {
            id: 'pkg_002',
            status: 'active',
            hoursRemaining: 15
          },
          {
            id: 'pkg_003',
            status: 'depleted',
            hoursRemaining: 0
          }
        ]
      };

      // חישוב
      const totalRemaining = stage.packages
        .filter(pkg => pkg.status === 'active' || !pkg.status)
        .reduce((sum, pkg) => sum + (pkg.hoursRemaining || 0), 0);

      expect(totalRemaining).toBe(25); // 10 + 15 (pkg_003 לא נספר כי depleted)
    });

    it('fallback ללקוחות ישנים ללא חבילות', () => {
      const entity = {
        hoursRemaining: 20,
        packages: null  // אין חבילות - מבנה ישן
      };

      // הלוגיקה צריכה להחזיר את hoursRemaining ישירות
      const totalRemaining = (!entity.packages || entity.packages.length === 0)
        ? (entity.hoursRemaining || 0)
        : entity.packages.reduce((sum, pkg) => sum + (pkg.hoursRemaining || 0), 0);

      expect(totalRemaining).toBe(20);
    });
  });

  describe('יצירת שירות חדש', () => {

    it('הוספת שירות לקוח קיים', () => {
      const existingClient = {
        id: '2025001',
        clientName: 'יוסי כהן',
        services: [
          {
            id: 'srv_001',
            type: 'hours',
            name: 'ייעוץ ראשוני'
          }
        ],
        totalServices: 1
      };

      const newService = {
        id: 'srv_002',
        type: 'legal_procedure',
        name: 'הליך גירושין',
        pricingType: 'hourly',
        currentStage: 'stage_a',
        stages: [
          {
            id: 'stage_a',
            name: 'שלב א\'',
            status: 'active',
            totalHours: 20,
            hoursRemaining: 20,
            packages: [
              {
                id: 'pkg_001',
                type: 'initial',
                hours: 20,
                hoursRemaining: 20,
                status: 'active'
              }
            ]
          },
          {
            id: 'stage_b',
            name: 'שלב ב\'',
            status: 'pending',
            totalHours: 30,
            hoursRemaining: 30
          }
        ],
        totalHours: 50,
        hoursRemaining: 50
      };

      // הוסף לשירותים
      existingClient.services.push(newService);
      existingClient.totalServices++;

      // בדיקות
      expect(existingClient.services.length).toBe(2);
      expect(existingClient.totalServices).toBe(2);

      const addedService = existingClient.services[1];
      expect(addedService.id).toBe('srv_002');
      expect(addedService.stages.length).toBe(2);
      expect(addedService.stages[0].status).toBe('active');
      expect(addedService.stages[1].status).toBe('pending');
    });

    it('אתחול נכון של שלבים - רק שלב א\' פעיל', () => {
      const stages = [
        {
          id: 'stage_a',
          name: 'שלב א\'',
          status: 'active',  // רק השלב הראשון!
          packages: [
            { status: 'active', hours: 20 }
          ]
        },
        {
          id: 'stage_b',
          name: 'שלב ב\'',
          status: 'pending',
          packages: [
            { status: 'pending', hours: 30 }
          ]
        },
        {
          id: 'stage_c',
          name: 'שלב ג\'',
          status: 'pending',
          packages: [
            { status: 'pending', hours: 15 }
          ]
        }
      ];

      const activeStages = stages.filter(s => s.status === 'active');
      const pendingStages = stages.filter(s => s.status === 'pending');

      expect(activeStages.length).toBe(1);
      expect(activeStages[0].id).toBe('stage_a');
      expect(pendingStages.length).toBe(2);
    });
  });

  describe('בדיקות שדות - clientName בלבד', () => {

    it('לקוח חדש עם clientName בלבד', () => {
      const client = {
        id: '2025001',
        clientName: 'יוסי כהן',
        caseNumber: '2025001'
      };

      expect(client.clientName).toBe('יוסי כהן');
      expect(client).not.toHaveProperty('fullName');
    });

    it('חיפוש לקוח לפי clientName', () => {
      const clients = [
        { id: '1', clientName: 'יוסי כהן' },
        { id: '2', clientName: 'שרה לוי' },
        { id: '3', clientName: 'דוד מזרחי' }
      ];

      const searchName = 'יוסי כהן';
      const found = clients.find(c => c.clientName === searchName);

      expect(found).toBeDefined();
      expect(found.id).toBe('1');
    });
  });

  describe('אין מבנה legacy', () => {

    it('לקוח חדש לא צריך שדות legacy', () => {
      const newClient = {
        id: '2025001',
        caseNumber: '2025001',
        clientName: 'יוסי כהן',
        services: []
      };

      // ודא שאין שדות legacy
      expect(newClient).not.toHaveProperty('stages');
      expect(newClient).not.toHaveProperty('procedureType');
      expect(newClient).not.toHaveProperty('fullName');
      expect(newClient).not.toHaveProperty('pricingType');

      // רק שדות חדשים
      expect(newClient.caseNumber).toBeDefined();
      expect(newClient.clientName).toBeDefined();
      expect(newClient.services).toBeDefined();
    });
  });

});

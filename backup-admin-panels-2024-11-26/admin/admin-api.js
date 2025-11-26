/**
 * Admin API - חיבור פשוט לשרת Firebase Functions
 * מותאם לדשבורד admin.html
 */

class AdminAPI {
  constructor() {
    this.baseURL =
      "https://us-central1-law-office-system-e4801.cloudfunctions.net/legacyRouter";
    this.timeout = 30000;
  }

  /**
   * קריאה בסיסית לשרת - ללא dependencies חיצוניות
   */
  async callFunction(action, data = null) {
    try {
      console.log(`🚀 Admin API Call: ${action}`);

      const response = await fetch(this.baseURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: action,
          ...data,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Admin API Success: ${action}`, result);
      return result;
    } catch (error) {
      console.error(`❌ Admin API Error: ${action}`, error);
      throw error;
    }
  }

  // פונקציות ספציפיות לדשבורד
  async testConnection() {
    return await this.callFunction("testConnection");
  }

  async createTask(taskData) {
    return await this.callFunction("createAdminTask", taskData);
  }

  async getUserTasks(employeeName) {
    return await this.callFunction("getUserAdminTasks", { employeeName });
  }

  async updateTaskStatus(taskId, status) {
    return await this.callFunction("updateAdminTaskStatus", { taskId, status });
  }

  async getAllTasks() {
    return await this.callFunction("getAllAdminTasks");
  }
}

// יצירת instance גלובלי
window.adminAPI = new AdminAPI();

console.log("📦 Admin API loaded successfully!");

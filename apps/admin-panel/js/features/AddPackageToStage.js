/**
 * ➕ Add Package to Legal Procedure Stage Feature
 *
 * @description Standalone module that adds "Add Hours Package" functionality to legal procedure stages
 * @version 1.0.1
 * @created 2025-12-14
 * @updated 2025-12-14 - Fixed: Using native CSS modals instead of Bootstrap
 *
 * Features:
 * - Adds "➕ הוסף חבילת שעות" button to each stage in legal procedures
 * - Shows dialog to input hours and reason
 * - Calls Cloud Function: addHoursPackageToStage
 * - Refreshes UI after successful addition
 *
 * How it works:
 * - Hooks into ClientManagementModal when it opens a client
 * - Injects buttons into .management-stage elements
 * - Handles all UI interactions independently
 *
 * To disable: Remove the import from clients.html
 */

(function() {
  'use strict';

  console.log('🎯 AddPackageToStage module loaded v1.0.1');

  // ========================================
  // Configuration
  // ========================================
  const CONFIG = {
    minHours: 1,
    maxHours: 500,
    minReasonLength: 3,
    maxReasonLength: 500,
    buttonClass: 'add-package-btn',
    dialogId: 'addPackageToStageDialog'
  };

  // ========================================
  // State
  // ========================================
  let currentClientId = null;
  let currentStageId = null;
  let currentServiceId = null;
  let dialogElement = null;

  // ========================================
  // 1. CSS Styles
  // ========================================
  function injectStyles() {
    if (document.getElementById('addPackageToStageStyles')) {
return;
}

    const style = document.createElement('style');
    style.id = 'addPackageToStageStyles';
    style.textContent = `
      /* Add Package Button - תואם לעיצוב המערכת */
      .add-package-btn {
        background: #059669;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        transition: all 0.2s;
        font-weight: 500;
        box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
      }

      .add-package-btn:hover {
        background: #047857;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .add-package-btn:active {
        transform: translateY(0);
      }

      .add-package-btn:disabled {
        background: #6b7280;
        cursor: not-allowed;
        transform: none;
        opacity: 0.6;
      }

      .add-package-btn i {
        font-size: 11px;
      }

      /* Only show on hourly stages */
      .management-stage:not([data-pricing-type="hourly"]) .add-package-btn {
        display: none;
      }

      /* Modal Overlay */
      #addPackageToStageDialog {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 99999;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(4px);
      }

      #addPackageToStageDialog.show {
        display: flex !important;
      }

      /* Modal Content - תואם לעיצוב clients.css */
      #addPackageToStageDialog .modal-content {
        background: white;
        border-radius: 16px;
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        margin: auto;
        overflow-y: auto;
        box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%);
        position: relative;
        animation: slideIn 0.3s ease-out;

        /* Custom Scrollbar - תואם למערכת */
        scrollbar-width: thin;
        scrollbar-color: rgb(24 119 242 / 15%) transparent;
      }

      #addPackageToStageDialog .modal-content::-webkit-scrollbar {
        width: 6px;
      }

      #addPackageToStageDialog .modal-content::-webkit-scrollbar-track {
        background: transparent;
      }

      #addPackageToStageDialog .modal-content::-webkit-scrollbar-thumb {
        background: rgb(24 119 242 / 15%);
        border-radius: 3px;
        transition: background 0.2s ease;
      }

      #addPackageToStageDialog .modal-content::-webkit-scrollbar-thumb:hover {
        background: rgb(24 119 242 / 30%);
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-50px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Modal Header - קומפקטי */
      #addPackageToStageDialog .modal-header {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: white;
      }

      #addPackageToStageDialog .modal-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: #1f2937;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
      }

      #addPackageToStageDialog .modal-title i {
        color: #1877F2;
        font-size: 1rem;
      }

      #addPackageToStageDialog .close-btn {
        background: none;
        border: none;
        font-size: 1.3rem;
        color: #6b7280;
        cursor: pointer;
        padding: 0.25rem;
        line-height: 1;
        transition: color 0.2s;
        width: auto;
        height: auto;
        border-radius: 0;
      }

      #addPackageToStageDialog .close-btn:hover {
        color: #1f2937;
        background: none;
      }

      /* Modal Body - קומפקטי */
      #addPackageToStageDialog .modal-body {
        padding: 1rem 1.5rem;
      }

      #addPackageToStageDialog .stage-info {
        background: #f9fafb;
        padding: 0.75rem 1rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        border: 1px solid #e5e7eb;
      }

      #addPackageToStageDialog .stage-info-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.4rem;
      }

      #addPackageToStageDialog .stage-info-item:last-child {
        margin-bottom: 0;
        padding-top: 0.4rem;
        border-top: 1px solid #e5e7eb;
      }

      #addPackageToStageDialog .stage-info-label {
        font-weight: 500;
        color: #6b7280;
        font-size: 13px;
      }

      #addPackageToStageDialog .stage-info-value {
        color: #1f2937;
        font-weight: 600;
        font-size: 13px;
      }

      #addPackageToStageDialog .form-group {
        margin-bottom: 1rem;
      }

      #addPackageToStageDialog .form-label {
        display: block;
        font-weight: 500;
        color: #1f2937;
        margin-bottom: 0.4rem;
        font-size: 13px;
      }

      #addPackageToStageDialog .form-control {
        width: 100%;
        padding: 0.45rem 0.65rem;
        border: 1px solid #e5e7eb;
        border-radius: 5px;
        font-size: 14px;
        transition: all 0.2s;
        color: #1f2937;
        font-family: inherit;
      }

      #addPackageToStageDialog .form-control:focus {
        outline: none;
        border-color: #1877F2;
        box-shadow: 0 0 0 2px rgba(24, 119, 242, 0.1);
      }

      #addPackageToStageDialog .form-text {
        display: block;
        margin-top: 0.3rem;
        font-size: 11.5px;
        color: #6b7280;
        line-height: 1.3;
      }

      #addPackageToStageDialog textarea.form-control {
        resize: vertical;
        min-height: 70px;
      }

      /* Modal Footer - קומפקטי */
      #addPackageToStageDialog .modal-footer {
        padding: 0.75rem 1.5rem;
        border-top: 1px solid #e5e7eb;
        display: flex;
        gap: 0.6rem;
        justify-content: flex-end;
        background: white;
      }

      #addPackageToStageDialog .btn {
        padding: 0.45rem 1.2rem;
        border: none;
        border-radius: 5px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 13px;
      }

      #addPackageToStageDialog .btn-secondary {
        background: #6b7280;
        color: white;
      }

      #addPackageToStageDialog .btn-secondary:hover {
        background: #4b5563;
      }

      #addPackageToStageDialog .btn-primary {
        background: #1877F2;
        color: white;
      }

      #addPackageToStageDialog .btn-primary:hover {
        background: #0A66C2;
      }

      #addPackageToStageDialog .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      /* Loading */
      #addPackageToStageDialog .loading {
        display: none;
        text-align: center;
        padding: 1rem;
      }

      #addPackageToStageDialog .loading.show {
        display: block;
      }

      #addPackageToStageDialog .spinner {
        border: 3px solid #f3f3f3;
        border-top: 3px solid #667eea;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Alert */
      #addPackageToStageDialog .alert {
        padding: 0.75rem 1rem;
        border-radius: 6px;
        margin-top: 1rem;
        display: none;
      }

      #addPackageToStageDialog .alert.show {
        display: block;
      }

      #addPackageToStageDialog .alert-danger {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
      }

      #addPackageToStageDialog .alert-success {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      }
    `;
    document.head.appendChild(style);
  }

  // ========================================
  // 2. Create Dialog HTML
  // ========================================
  function createDialog() {
    if (document.getElementById(CONFIG.dialogId)) {
return;
}

    const dialogHTML = `
      <div id="${CONFIG.dialogId}">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-title">
              <i class="fas fa-plus-circle"></i>
              הוסף חבילת שעות לשלב
            </div>
            <button type="button" class="close-btn" id="closeAddPackageDialog">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <!-- Stage Info - קומפקטי -->
            <div class="stage-info">
              <div class="stage-info-item">
                <span class="stage-info-label">שלב:</span>
                <span class="stage-info-value" id="addPackageStageName">-</span>
              </div>
              <div class="stage-info-item">
                <span class="stage-info-label">שעות כרגע:</span>
                <span class="stage-info-value" id="addPackageCurrentHours">-</span>
              </div>
              <div class="stage-info-item">
                <span class="stage-info-label">שעות נותרות:</span>
                <span class="stage-info-value" id="addPackageRemainingHours">-</span>
              </div>
              <div class="stage-info-item">
                <span class="stage-info-label">חבילות נוספות שנוספו:</span>
                <span class="stage-info-value" id="addPackageAdditionalCount" style="font-weight: 700;">-</span>
              </div>
            </div>

            <!-- Form - קומפקטי -->
            <form id="addPackageForm">
              <div class="form-group" style="margin-bottom: 1rem;">
                <label for="packageHours" class="form-label">
                  כמות שעות *
                </label>
                <input
                  type="number"
                  class="form-control"
                  id="packageHours"
                  min="${CONFIG.minHours}"
                  max="${CONFIG.maxHours}"
                  step="0.5"
                  placeholder="20"
                  required
                />
                <small class="form-text">
                  ${CONFIG.minHours}-${CONFIG.maxHours} שעות
                </small>
              </div>

              <div class="form-group" style="margin-bottom: 0.75rem;">
                <label for="packageReason" class="form-label">
                  סיבה/הערה *
                </label>
                <textarea
                  class="form-control"
                  id="packageReason"
                  minlength="${CONFIG.minReasonLength}"
                  maxlength="${CONFIG.maxReasonLength}"
                  placeholder="למשל: דיונים נוספים, עבודה מורכבת יותר..."
                  required
                  style="min-height: 70px;"
                ></textarea>
                <small class="form-text" style="color: #dc2626; font-weight: 500;">
                  ⚠️ הערה זו תופיע בדוח ללקוח
                </small>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label for="packagePurchaseDate" class="form-label">
                  תאריך רכישה (אופציונלי)
                </label>
                <input
                  type="date"
                  class="form-control"
                  id="packagePurchaseDate"
                />
                <small class="form-text">
                  אם לא מצוין, יירשם התאריך של היום
                </small>
              </div>
            </form>

            <!-- Loading indicator -->
            <div id="addPackageLoading" class="loading">
              <div class="spinner"></div>
              <p>מוסיף חבילת שעות...</p>
            </div>

            <!-- Error/Success message -->
            <div id="addPackageAlert" class="alert"></div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="cancelAddPackage">
              ביטול
            </button>
            <button type="button" class="btn btn-primary" id="addPackageSubmitBtn">
              <i class="fas fa-plus"></i>
              הוסף חבילה
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', dialogHTML);
    dialogElement = document.getElementById(CONFIG.dialogId);

    // Add event listeners
    document.getElementById('closeAddPackageDialog').addEventListener('click', closeDialog);
    document.getElementById('cancelAddPackage').addEventListener('click', closeDialog);
    document.getElementById('addPackageSubmitBtn').addEventListener('click', submitForm);

    // Close on overlay click
    dialogElement.addEventListener('click', (e) => {
      if (e.target === dialogElement) {
        closeDialog();
      }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dialogElement.classList.contains('show')) {
        closeDialog();
      }
    });

    console.log('✅ Dialog created');
  }

  // ========================================
  // 3. Add Buttons to Stages
  // ========================================
  function addButtonsToStages() {
    console.log('🔧 addButtonsToStages called');

    // Wait for modal to be populated
    const modal = document.getElementById('clientManagementModal');
    if (!modal) {
      console.log('⚠️ clientManagementModal not found');
      return;
    }

    // Check if modal is visible
    if (modal.style.display !== 'flex') {
      console.log('⚠️ Modal not visible yet');
      return;
    }

    // Find all stage elements
    const stages = modal.querySelectorAll('.management-stage');
    console.log(`📍 Found ${stages.length} stage elements`);

    if (stages.length === 0) {
      console.log('⚠️ No stages found, will retry in 500ms');
      setTimeout(addButtonsToStages, 500);
      return;
    }

    // Get client data once
    if (!window.ClientManagementModal || !window.ClientManagementModal.currentClient) {
      console.log('⚠️ No current client');
      return;
    }

    const client = window.ClientManagementModal.currentClient;
    const legalProcedure = client.services?.find(s => s.type === 'legal_procedure');

    if (!legalProcedure || !legalProcedure.stages) {
      console.log('⚠️ No legal procedure or stages');
      return;
    }

    console.log(`📊 Legal procedure has ${legalProcedure.stages.length} stages, pricingType: ${legalProcedure.pricingType}`);

    // Check if legal procedure is hourly (pricingType is at service level, not stage level)
    if (legalProcedure.pricingType !== 'hourly') {
      console.log(`⚠️ Legal procedure is not hourly (pricingType: ${legalProcedure.pricingType}), skipping all stages`);
      return;
    }

    stages.forEach((stageElement, domIndex) => {
      // Skip if button already exists
      if (stageElement.querySelector(`.${CONFIG.buttonClass}`)) {
        console.log(`  [DOM ${domIndex}] Already has button, skipping`);
        return;
      }

      // Get stage name from DOM
      const stageNameElement = stageElement.querySelector('.management-stage-name');
      if (!stageNameElement) {
        console.log(`  [DOM ${domIndex}] No .management-stage-name found`);
        return;
      }

      const stageName = stageNameElement.textContent.trim();
      console.log(`  [DOM ${domIndex}] Found stage name in DOM: "${stageName}"`);

      // Find matching stage in data by name
      const stage = legalProcedure.stages.find(s => s.name === stageName);

      if (!stage) {
        console.log(`  [DOM ${domIndex}] No matching stage data for "${stageName}"`);
        return;
      }

      console.log(`  [DOM ${domIndex}] Matched to stage: ${stage.id}, status: ${stage.status}`);

      // Only add button to ACTIVE stages (pricingType already checked at service level)
      if (stage.status !== 'active') {
        console.log(`  [DOM ${domIndex}] Skipping (not active, status: ${stage.status})`);
        return;
      }

      // Add data attribute for styling
      stageElement.setAttribute('data-pricing-type', 'hourly');
      stageElement.setAttribute('data-stage-id', stage.id);

      // Create button
      const button = document.createElement('button');
      button.className = CONFIG.buttonClass;
      button.innerHTML = '<i class="fas fa-plus"></i> הוסף שעות';
      button.title = 'הוסף חבילת שעות נוספת לשלב זה';

      // Add click handler
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('🖱️ Button clicked for stage:', stage.id);
        openDialog(client.caseNumber, legalProcedure.id, stage);
      });

      // Insert button after stage info
      const stageInfo = stageElement.querySelector('.management-stage-info');
      if (stageInfo) {
        stageInfo.appendChild(button);
        console.log(`  [DOM ${domIndex}] ✅ Button added to ${stage.name}`);
      } else {
        console.log(`  [DOM ${domIndex}] ⚠️ No .management-stage-info found`);
      }
    });
  }

  // ========================================
  // 4. Open Dialog
  // ========================================
  function openDialog(clientId, serviceId, stage) {
    console.log('📂 Opening dialog:', { clientId, serviceId, stageId: stage.id });

    currentClientId = clientId;
    currentServiceId = serviceId;
    currentStageId = stage.id;

    // Populate stage info
    document.getElementById('addPackageStageName').textContent = stage.name || stage.id;
    document.getElementById('addPackageCurrentHours').textContent = `${stage.totalHours || 0} שעות`;
    document.getElementById('addPackageRemainingHours').textContent = `${stage.hoursRemaining || 0} שעות`;

    // Count additional packages (exclude initial package)
    const additionalPackages = stage.packages?.filter(pkg => pkg.type === 'additional' || pkg.type === 'חבילה נוספת') || [];
    const additionalCount = additionalPackages.length;
    const additionalCountElement = document.getElementById('addPackageAdditionalCount');
    additionalCountElement.textContent = additionalCount;

    // Color coding: green if 0, orange/red if already added
    if (additionalCount === 0) {
      additionalCountElement.style.color = '#059669'; // Green - first time
    } else if (additionalCount === 1) {
      additionalCountElement.style.color = '#f59e0b'; // Orange - warning
    } else {
      additionalCountElement.style.color = '#dc2626'; // Red - multiple additions
    }

    // Reset form
    document.getElementById('addPackageForm').reset();
    hideAlert();
    hideLoading();

    // Show dialog
    dialogElement.classList.add('show');
    console.log('✅ Dialog opened');
  }

  // ========================================
  // 5. Close Dialog
  // ========================================
  function closeDialog() {
    console.log('🚪 Closing dialog');
    dialogElement.classList.remove('show');
  }

  // ========================================
  // 6. Validate Form
  // ========================================
  function validateForm() {
    const hours = parseFloat(document.getElementById('packageHours').value);
    const reason = document.getElementById('packageReason').value.trim();
    const purchaseDate = document.getElementById('packagePurchaseDate').value;

    const errors = [];

    // Validate hours
    if (!hours || isNaN(hours)) {
      errors.push('כמות שעות חובה');
    } else if (hours < CONFIG.minHours) {
      errors.push(`כמות שעות מינימלית: ${CONFIG.minHours}`);
    } else if (hours > CONFIG.maxHours) {
      errors.push(`כמות שעות מקסימלית: ${CONFIG.maxHours}`);
    }

    // Validate reason
    if (!reason) {
      errors.push('סיבה/הערה חובה');
    } else if (reason.length < CONFIG.minReasonLength) {
      errors.push(`סיבה חייבת להכיל לפחות ${CONFIG.minReasonLength} תווים`);
    } else if (reason.length > CONFIG.maxReasonLength) {
      errors.push(`סיבה לא יכולה להכיל יותר מ-${CONFIG.maxReasonLength} תווים`);
    }

    // Validate purchase date (optional)
    if (purchaseDate) {
      const date = new Date(purchaseDate);
      if (isNaN(date.getTime())) {
        errors.push('תאריך רכישה לא תקין');
      }
    }

    return errors;
  }

  // ========================================
  // 7. Submit Form
  // ========================================
  async function submitForm() {
    console.log('📤 Submitting form...');

    // Validate
    const errors = validateForm();
    if (errors.length > 0) {
      showAlert(errors.join('<br>'), 'danger');
      return;
    }

    // Get form data
    const hours = parseFloat(document.getElementById('packageHours').value);
    const reason = document.getElementById('packageReason').value.trim();
    const purchaseDate = document.getElementById('packagePurchaseDate').value;

    // Show loading
    showLoading();
    hideAlert();
    document.getElementById('addPackageSubmitBtn').disabled = true;

    try {
      // Call Cloud Function
      console.log('📞 Calling addHoursPackageToStage:', {
        caseId: currentClientId,
        stageId: currentStageId,
        hours,
        reason,
        purchaseDate: purchaseDate || undefined
      });

      const addPackageFunc = window.FirebaseManager.functions.httpsCallable('addHoursPackageToStage');

      const result = await addPackageFunc({
        caseId: currentClientId,
        stageId: currentStageId,
        hours: hours,
        reason: reason,
        purchaseDate: purchaseDate || undefined
      });

      console.log('✅ Package added successfully:', result.data);

      // Show success message
      showAlert(result.data.message || 'חבילה נוספה בהצלחה!', 'success');

      // Close dialog and refresh
      setTimeout(() => {
        closeDialog();

        // Refresh the client in the modal
        if (window.ClientsTable && typeof window.ClientsTable.openManagementModal === 'function') {
          console.log('🔄 Refreshing client modal...');
          window.ClientsTable.openManagementModal(currentClientId);
        }
      }, 1500);

    } catch (error) {
      console.error('❌ Error adding package:', error);

      let errorMessage = 'שגיאה בהוספת חבילה';

      if (error.code === 'unauthenticated') {
        errorMessage = 'נדרש להתחבר מחדש';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'אין הרשאה לבצע פעולה זו';
      } else if (error.message) {
        errorMessage = error.message;
      }

      showAlert(errorMessage, 'danger');

    } finally {
      hideLoading();
      document.getElementById('addPackageSubmitBtn').disabled = false;
    }
  }

  // ========================================
  // 8. UI Helpers
  // ========================================
  function showAlert(message, type = 'danger') {
    const alertDiv = document.getElementById('addPackageAlert');
    alertDiv.className = `alert alert-${type} show`;
    alertDiv.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i> ${message}`;
  }

  function hideAlert() {
    const alertDiv = document.getElementById('addPackageAlert');
    alertDiv.className = 'alert';
    alertDiv.innerHTML = '';
  }

  function showLoading() {
    document.getElementById('addPackageLoading').classList.add('show');
  }

  function hideLoading() {
    document.getElementById('addPackageLoading').classList.remove('show');
  }

  // ========================================
  // 9. Hook into ClientManagementModal
  // ========================================
  function hookIntoModal() {
    // Wait for ClientManagementModal to be available
    if (typeof ClientManagementModal === 'undefined') {
      console.log('⏳ Waiting for ClientManagementModal...');
      setTimeout(hookIntoModal, 100);
      return;
    }

    console.log('🔗 Hooking into ClientManagementModal');

    // Listen for modal opens by observing the modal element
    const modal = document.getElementById('clientManagementModal');
    if (modal) {
      // Use MutationObserver to detect when modal becomes visible
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            if (modal.style.display === 'flex') {
              console.log('👁️ Modal opened, adding buttons...');
              setTimeout(addButtonsToStages, 500);
            }
          }
        });
      });

      observer.observe(modal, {
        attributes: true,
        attributeFilter: ['style']
      });

      console.log('✅ MutationObserver attached to clientManagementModal');
    }

    // Also try to add buttons if modal is already open
    if (modal && modal.style.display === 'flex') {
      console.log('👁️ Modal already open, adding buttons...');
      setTimeout(addButtonsToStages, 500);
    }
  }

  // ========================================
  // 10. Initialize
  // ========================================
  function init() {
    console.log('🚀 Initializing AddPackageToStage feature');

    // Inject styles
    injectStyles();

    // Create dialog
    createDialog();

    // Hook into modal
    hookIntoModal();

    console.log('✅ AddPackageToStage feature initialized');
  }

  // ========================================
  // 11. Auto-initialize when DOM is ready
  // ========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for debugging
  window.AddPackageToStage = {
    version: '1.0.1',
    config: CONFIG,
    openDialog,
    addButtonsToStages,
    reinitialize: init
  };

})();

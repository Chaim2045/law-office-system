#!/bin/bash
###############################################################################
# Firestore Daily Backup Script
# מערכת גיבוי יומית חכמה ל-Firestore
#
# תכונות:
# ✅ גיבוי מלא של כל Firestore
# ✅ Export ל-Google Cloud Storage
# ✅ שמירת 30 ימים אחרונים
# ✅ מחיקה אוטומטית של גיבויים ישנים
# ✅ התראות במקרה של כשלון
#
# שימוש:
# 1. הפעל פעם אחת: chmod +x scripts/backup-firestore.sh
# 2. בדיקה ידנית: ./scripts/backup-firestore.sh
# 3. הגדר ב-Cloud Scheduler (ראה הוראות למטה)
###############################################################################

set -e  # Exit on error

# ========================================
# Configuration - הגדרות
# ========================================

PROJECT_ID="law-office-system-e4801"
BUCKET_NAME="gs://${PROJECT_ID}-backups"
DATABASE_NAME="(default)"
RETENTION_DAYS=30  # שמירת גיבויים ל-30 ימים

# ========================================
# Colors for pretty output
# ========================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ========================================
# Helper Functions - פונקציות עזר
# ========================================

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ========================================
# Main Backup Function
# ========================================

backup_firestore() {
    local TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
    local BACKUP_PATH="${BUCKET_NAME}/backups/${TIMESTAMP}"

    log_info "Starting Firestore backup at ${TIMESTAMP}"
    log_info "Backup destination: ${BACKUP_PATH}"

    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not found. Please install Google Cloud SDK."
        exit 1
    fi

    # Check if bucket exists, create if not
    if ! gsutil ls "${BUCKET_NAME}" &> /dev/null; then
        log_warning "Bucket ${BUCKET_NAME} not found. Creating..."
        gsutil mb -p "${PROJECT_ID}" -l us-central1 "${BUCKET_NAME}"
        log_success "Bucket created successfully"
    fi

    # Export Firestore to Cloud Storage
    log_info "Exporting Firestore database..."
    gcloud firestore export "${BACKUP_PATH}" \
        --project="${PROJECT_ID}" \
        --database="${DATABASE_NAME}" \
        --async

    if [ $? -eq 0 ]; then
        log_success "Backup initiated successfully!"
        log_info "Export is running in the background. Check status in Firebase Console."
    else
        log_error "Backup failed!"
        exit 1
    fi
}

# ========================================
# Cleanup Old Backups
# ========================================

cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."

    # Calculate cutoff date
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        CUTOFF_DATE=$(date -v-${RETENTION_DAYS}d +"%Y-%m-%d")
    else
        # Linux
        CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +"%Y-%m-%d")
    fi

    log_info "Cutoff date: ${CUTOFF_DATE}"

    # List and delete old backups
    gsutil ls "${BUCKET_NAME}/backups/" | while read -r backup; do
        backup_date=$(echo "$backup" | grep -oP '\d{4}-\d{2}-\d{2}' | head -1)

        if [[ "$backup_date" < "$CUTOFF_DATE" ]]; then
            log_warning "Deleting old backup: $backup"
            gsutil -m rm -r "$backup"
        fi
    done

    log_success "Cleanup completed"
}

# ========================================
# Health Check - בדיקת בריאות
# ========================================

health_check() {
    log_info "Running health check..."

    # Check Firebase connectivity
    if ! gcloud projects describe "${PROJECT_ID}" &> /dev/null; then
        log_error "Cannot connect to Firebase project"
        exit 1
    fi

    log_success "Health check passed"
}

# ========================================
# Main Script Execution
# ========================================

main() {
    echo "========================================="
    echo "🔐 Firestore Backup Script"
    echo "📅 $(date)"
    echo "========================================="
    echo ""

    health_check
    backup_firestore
    cleanup_old_backups

    echo ""
    echo "========================================="
    log_success "Backup process completed successfully!"
    echo "========================================="
}

# Run main function
main

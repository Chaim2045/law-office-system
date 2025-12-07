#!/bin/bash
###############################################################################
# Verify Backup Status Script
# סקריפט בדיקת סטטוס גיבויים
###############################################################################

PROJECT_ID="law-office-system-e4801"

echo "=========================================="
echo "🔍 Checking Backup Configuration"
echo "📅 $(date)"
echo "=========================================="
echo ""

# Check if gcloud is available
if command -v gcloud &> /dev/null; then
    echo "✅ gcloud CLI found"
    echo ""

    # Check PITR status
    echo "📋 Checking Point-in-Time Recovery..."
    gcloud firestore databases describe --database="(default)" --project="$PROJECT_ID" 2>&1 | grep -i "pitr\|recovery\|version"
    echo ""

    # Check backup schedules
    echo "📅 Checking Backup Schedules..."
    gcloud firestore backups schedules list --database="(default)" --project="$PROJECT_ID" 2>&1
    echo ""

else
    echo "⚠️  gcloud CLI not installed"
    echo "Using Firebase CLI instead..."
    echo ""

    # Use Firebase CLI
    echo "📋 Checking Firestore Database..."
    firebase firestore:databases:list --project="$PROJECT_ID"
    echo ""
fi

echo "=========================================="
echo "✅ Verification complete"
echo "=========================================="

@echo off
echo ====================================
echo Restoring original security rules...
echo ====================================

REM Copy backup over current rules
copy /Y firestore.rules.backup firestore.rules

echo.
echo Deploying secure rules to Firebase...
firebase deploy --only firestore:rules

echo.
echo ====================================
echo Security restored successfully!
echo ====================================
pause
# Claude AI Data Cache & Scripts

This directory contains cached Firestore data and utility scripts for Claude AI to analyze the law office system.

## 🔧 Setup

1. Download Service Account Key from Firebase Console
2. Save as `firebase-admin-key.json` in project root
3. Run any script below

## 📁 Directory Structure

```
.claude/
├── README.md                          # This file
├── firestore-data/                    # Cached data from Firestore
│   ├── client-*.json                  # Individual client data
│   ├── all-clients-summary.json       # Summary of all clients
│   ├── all-users.json                 # Firebase Auth users
│   └── timesheet-*.json               # Timesheet entries per client
└── firestore-scripts/                 # Utility scripts
    ├── query-client.js                # Query specific client
    ├── list-all-clients.js            # List all clients
    ├── list-users.js                  # List Firebase Auth users
    └── query-timesheet.js             # Query timesheet entries
```

## 🚀 Available Scripts

### Query Specific Client
```bash
node .claude/firestore-scripts/query-client.js "אורי שטיינברג"
```

### List All Clients
```bash
node .claude/firestore-scripts/list-all-clients.js
```

### List Firebase Auth Users
```bash
node .claude/firestore-scripts/list-users.js
```

### Query Timesheet Entries
```bash
node .claude/firestore-scripts/query-timesheet.js "אורי שטיינברג"
```

## 📝 Notes

- All scripts cache data to `firestore-data/` directory
- Cached files include `fetchedAt` timestamp
- Scripts have **full read/write access** via Service Account
- Data is automatically saved in JSON format for analysis

## 🔒 Security

- `firebase-admin-key.json` is in `.gitignore` (NEVER commit!)
- Cached data in `firestore-data/*.json` is also in `.gitignore`
- Service Account has Editor role = full access to all Firebase services

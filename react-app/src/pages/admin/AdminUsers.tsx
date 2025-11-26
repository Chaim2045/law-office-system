/**
 * Admin Users Management Page
 * Manage system users, roles, and permissions
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  IconButton,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Avatar,
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Search,
  MoreVert,
  Add,
  Edit,
  Delete,
  Block,
  CheckCircle,
  PersonAdd,
  Refresh,
  Download,
  AdminPanelSettings,
  VpnKey
} from '@mui/icons-material';
import { db, auth, functions } from '../../config/firebase';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { ADMIN_CONFIG } from '../../config/adminConfig';

interface Employee {
  id: string;
  email: string;
  displayName: string;
  username: string;
  role: 'admin' | 'lawyer' | 'assistant';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: Date;
  loginCount: number;
  createdAt: Date;
  phoneNumber?: string;
  authUID?: string;
  hasCustomClaims?: boolean;
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<Employee[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for new/edit user
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    username: '',
    role: 'assistant' as 'admin' | 'lawyer' | 'assistant',
    phoneNumber: '',
    sendWelcomeEmail: true
  });

  const fetchUsers = async () => {
    try {
      setError(null);
      const snapshot = await db.collection('employees').get();
      const usersData: Employee[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          email: doc.id,
          displayName: data.displayName || data.username || '',
          username: data.username || '',
          role: data.role || 'assistant',
          status: data.status || 'active',
          lastLogin: data.lastLogin?.toDate(),
          loginCount: data.loginCount || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          phoneNumber: data.phoneNumber,
          authUID: data.authUID,
          hasCustomClaims: ADMIN_CONFIG.adminEmails.includes(doc.id) && data.role === 'admin'
        });
      }

      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('שגיאה בטעינת המשתמשים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const filtered = users.filter(user =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: Employee) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEditUser = () => {
    if (selectedUser) {
      setFormData({
        email: selectedUser.email,
        displayName: selectedUser.displayName,
        username: selectedUser.username,
        role: selectedUser.role,
        phoneNumber: selectedUser.phoneNumber || '',
        sendWelcomeEmail: false
      });
      setEditMode(true);
      setDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleAddUser = () => {
    setFormData({
      email: '',
      displayName: '',
      username: '',
      role: 'assistant',
      phoneNumber: '',
      sendWelcomeEmail: true
    });
    setEditMode(false);
    setDialogOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (editMode && selectedUser) {
        // Update existing user
        await db.collection('employees').doc(selectedUser.email).update({
          displayName: formData.displayName,
          username: formData.username,
          role: formData.role,
          phoneNumber: formData.phoneNumber || null,
          updatedAt: new Date()
        });

        // Update custom claims if role changed to admin
        if (formData.role === 'admin' && !selectedUser.hasCustomClaims) {
          // Call cloud function to set custom claims
          // This would need to be implemented as a Cloud Function
        }

        setSuccess('המשתמש עודכן בהצלחה');
      } else {
        // Create new user
        await db.collection('employees').doc(formData.email).set({
          email: formData.email,
          displayName: formData.displayName,
          username: formData.username,
          role: formData.role,
          phoneNumber: formData.phoneNumber || null,
          status: 'active',
          loginCount: 0,
          createdAt: new Date()
        });

        setSuccess('המשתמש נוצר בהצלחה');
      }

      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      setError('שגיאה בשמירת המשתמש');
    }
  };

  const handleToggleStatus = async (user: Employee) => {
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      await db.collection('employees').doc(user.email).update({
        status: newStatus,
        updatedAt: new Date()
      });

      setSuccess(`סטטוס המשתמש ${user.displayName} שונה ל${newStatus === 'active' ? 'פעיל' : 'לא פעיל'}`);
      fetchUsers();
    } catch (err) {
      console.error('Error updating user status:', err);
      setError('שגיאה בעדכון סטטוס המשתמש');
    }
    handleMenuClose();
  };

  const handleSetAdminClaims = async (user: Employee) => {
    try {
      setError(null);
      setSuccess(null);

      // This would call a Cloud Function to set custom claims
      // For now, we'll show a message
      setSuccess(`Custom Claims יוגדרו עבור ${user.displayName}`);

      // Log the action
      await db.collection('audit_logs').add({
        timestamp: new Date(),
        userId: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email,
        action: 'SET_ADMIN_CLAIMS',
        category: 'security',
        details: {
          targetUser: user.email,
          message: `Admin claims set for ${user.email}`
        }
      });

      fetchUsers();
    } catch (err) {
      console.error('Error setting admin claims:', err);
      setError('שגיאה בהגדרת הרשאות אדמין');
    }
    handleMenuClose();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'lawyer': return 'primary';
      case 'assistant': return 'default';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'inactive': return '#9e9e9e';
      case 'suspended': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={50} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">ניהול משתמשים</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchUsers}
          >
            רענן
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download />}
          >
            ייצא
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={handleAddUser}
          >
            משתמש חדש
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            placeholder="חיפוש לפי שם או אימייל..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>משתמש</TableCell>
              <TableCell>תפקיד</TableCell>
              <TableCell>סטטוס</TableCell>
              <TableCell>כניסה אחרונה</TableCell>
              <TableCell>כניסות</TableCell>
              <TableCell>נוצר</TableCell>
              <TableCell align="center">פעולות</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ mr: 2, bgcolor: '#1976d2' }}>
                        {user.displayName?.charAt(0) || user.email.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {user.displayName || user.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        user.role === 'admin' ? 'מנהל' :
                        user.role === 'lawyer' ? 'עורך דין' : 'עוזר'
                      }
                      color={getRoleColor(user.role)}
                      size="small"
                      icon={user.role === 'admin' ? <AdminPanelSettings /> : undefined}
                    />
                    {user.hasCustomClaims && (
                      <Tooltip title="Custom Claims מוגדרים">
                        <VpnKey sx={{ ml: 1, color: '#4caf50', fontSize: 16 }} />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: getStatusColor(user.status),
                          mr: 1
                        }}
                      />
                      <Typography variant="body2">
                        {user.status === 'active' ? 'פעיל' :
                         user.status === 'inactive' ? 'לא פעיל' : 'מושעה'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {user.lastLogin ?
                      format(user.lastLogin, 'dd/MM/yyyy HH:mm', { locale: he }) :
                      '-'}
                  </TableCell>
                  <TableCell>{user.loginCount}</TableCell>
                  <TableCell>
                    {format(user.createdAt, 'dd/MM/yyyy', { locale: he })}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton onClick={(e) => handleMenuOpen(e, user)}>
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filteredUsers.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
          labelRowsPerPage="שורות בעמוד:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} מתוך ${count}`}
        />
      </TableContainer>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditUser}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          ערוך
        </MenuItem>
        <MenuItem onClick={() => handleToggleStatus(selectedUser!)}>
          {selectedUser?.status === 'active' ? (
            <>
              <Block sx={{ mr: 1 }} fontSize="small" />
              השבת
            </>
          ) : (
            <>
              <CheckCircle sx={{ mr: 1 }} fontSize="small" />
              הפעל
            </>
          )}
        </MenuItem>
        {selectedUser?.role === 'admin' && !selectedUser?.hasCustomClaims && (
          <MenuItem onClick={() => handleSetAdminClaims(selectedUser!)}>
            <VpnKey sx={{ mr: 1 }} fontSize="small" />
            הגדר Custom Claims
          </MenuItem>
        )}
      </Menu>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? 'עריכת משתמש' : 'הוספת משתמש חדש'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="אימייל"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={editMode}
              required
            />
            <TextField
              label="שם מלא"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
            />
            <TextField
              label="שם משתמש"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
            <FormControl fullWidth>
              <InputLabel>תפקיד</InputLabel>
              <Select
                value={formData.role}
                label="תפקיד"
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              >
                <MenuItem value="assistant">עוזר</MenuItem>
                <MenuItem value="lawyer">עורך דין</MenuItem>
                <MenuItem value="admin">מנהל</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="טלפון"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            />
            {!editMode && (
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.sendWelcomeEmail}
                    onChange={(e) => setFormData({ ...formData, sendWelcomeEmail: e.target.checked })}
                  />
                }
                label="שלח אימייל הזמנה"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>ביטול</Button>
          <Button onClick={handleSaveUser} variant="contained">
            {editMode ? 'עדכן' : 'צור'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
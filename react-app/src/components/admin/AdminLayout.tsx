/**
 * Admin Layout Component
 * Main layout wrapper for admin panel pages
 */

import React, { useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Business,
  Assignment,
  AccessTime,
  Monitor,
  History,
  Settings,
  ExitToApp,
  AdminPanelSettings,
  Notifications,
  Security,
  ChevronLeft
} from '@mui/icons-material';
import { useAdmin } from '../../contexts/AdminContext';
import { useAuth } from '../../hooks/useAuth';
import { ADMIN_CONFIG } from '../../config/adminConfig';

const drawerWidth = 280;

// Icon mapping
const iconMap: { [key: string]: React.ElementType } = {
  Dashboard,
  People,
  Business,
  Assignment,
  AccessTime,
  Monitor,
  History,
  Settings
};

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isSuperAdmin, isLoadingAdmin, adminUser, canAccessFeature } = useAdmin();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Loading state
  if (isLoadingAdmin) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Access control
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleProfileMenuClose();
    await logout();
    navigate('/login');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isCurrentPath = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <Box sx={{ display: 'flex', bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerOpen ? drawerWidth : 0}px)`,
          ml: `${drawerOpen ? drawerWidth : 0}px`,
          transition: 'width 0.3s, margin 0.3s',
          bgcolor: '#1976d2',
          zIndex: (theme) => theme.zIndex.drawer + 1
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ mr: 2 }}
          >
            {drawerOpen ? <ChevronLeft /> : <MenuIcon />}
          </IconButton>

          <AdminPanelSettings sx={{ mr: 1 }} />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            לוח בקרת מנהל
          </Typography>

          {isSuperAdmin && (
            <Chip
              icon={<Security />}
              label="Super Admin"
              size="small"
              sx={{ mr: 2, bgcolor: '#ff9800', color: 'white' }}
            />
          )}

          <IconButton color="inherit" sx={{ mr: 2 }}>
            <Badge badgeContent={0} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          <IconButton onClick={handleProfileMenuOpen} color="inherit">
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#ff5722' }}>
              {adminUser?.displayName?.charAt(0) || user?.email?.charAt(0) || 'A'}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem disabled>
              <Typography variant="body2" color="textSecondary">
                {adminUser?.email}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { handleProfileMenuClose(); navigate('/admin/settings'); }}>
              <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
              הגדרות
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><ExitToApp fontSize="small" /></ListItemIcon>
              יציאה
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Drawer
        sx={{
          width: drawerOpen ? drawerWidth : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: '#fff',
            borderRight: '1px solid #e0e0e0',
            transition: 'width 0.3s',
            transform: drawerOpen ? 'translateX(0)' : `translateX(-${drawerWidth}px)`,
          },
        }}
        variant="persistent"
        anchor="left"
        open={drawerOpen}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', py: 2 }}>
          <List>
            {ADMIN_CONFIG.navigation.map((item) => {
              const Icon = iconMap[item.icon] || Dashboard;
              const hasAccess = canAccessFeature(item.path.replace('/admin/', ''));

              if (!hasAccess && !isSuperAdmin) {
                return null;
              }

              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    selected={isCurrentPath(item.path)}
                    onClick={() => handleNavigation(item.path)}
                    sx={{
                      mx: 1,
                      borderRadius: 1,
                      '&.Mui-selected': {
                        bgcolor: 'primary.light',
                        color: 'white',
                        '& .MuiListItemIcon-root': {
                          color: 'white'
                        },
                        '&:hover': {
                          bgcolor: 'primary.main'
                        }
                      }
                    }}
                  >
                    <ListItemIcon>
                      <Icon />
                    </ListItemIcon>
                    <ListItemText primary={item.title} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>

          <Divider sx={{ my: 2 }} />

          {/* Admin Info */}
          <Box sx={{ px: 2 }}>
            <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
              <Typography variant="caption" display="block">
                מחובר כ: <strong>{adminUser?.role}</strong>
              </Typography>
              <Typography variant="caption" display="block">
                גרסה: 2.0.0 (נקייה)
              </Typography>
            </Alert>
          </Box>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: `calc(100% - ${drawerOpen ? drawerWidth : 0}px)`,
          transition: 'width 0.3s, margin 0.3s',
          mt: 8
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};
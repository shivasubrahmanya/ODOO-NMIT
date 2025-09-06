import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Notification } from '../types';
import apiService from '../services/api';
import './NotificationCenter.css';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && user) {
      loadNotifications();
    }
  }, [isOpen, user]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const notificationsData = await apiService.getNotifications();
      setNotifications(notificationsData);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await apiService.markNotificationsAsRead([notificationId]);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, is_read: true }
            : notif
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(notif => !notif.is_read)
        .map(notif => notif.id);
      
      if (unreadIds.length > 0) {
        await apiService.markNotificationsAsRead(unreadIds);
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, is_read: true }))
        );
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      await apiService.deleteNotification(notificationId);
      setNotifications(prev => 
        prev.filter(notif => notif.id !== notificationId)
      );
    } catch (err) {
      console.error('Error deleting notification:', err);
      // Remove from UI even if API call fails (optimistic update)
      setNotifications(prev => 
        prev.filter(notif => notif.id !== notificationId)
      );
    }
  };

  const getFilteredNotifications = () => {
    switch (filter) {
      case 'unread':
        return notifications.filter(notif => !notif.is_read);
      case 'read':
        return notifications.filter(notif => notif.is_read);
      default:
        return notifications;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (notification: Notification) => {
    if (notification.task_id) {
      if (notification.title.includes('Assigned')) return '📋';
      if (notification.title.includes('Completed')) return '✅';
      if (notification.title.includes('Due')) return '⏰';
      return '📝';
    }
    if (notification.project_id) {
      if (notification.title.includes('Added')) return '👥';
      if (notification.title.includes('Created')) return '🚀';
      return '📁';
    }
    return '🔔';
  };

  const unreadCount = notifications.filter(notif => !notif.is_read).length;
  const filteredNotifications = getFilteredNotifications();

  if (!isOpen) return null;

  return (
    <div className="notification-overlay">
      <div className="notification-center">
        {/* Header */}
        <div className="notification-header">
          <div className="header-title">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </div>
          <div className="header-actions">
            {unreadCount > 0 && (
              <button 
                className="mark-all-read-btn"
                onClick={markAllAsRead}
                title="Mark all as read"
              >
                ✓
              </button>
            )}
            <button 
              className="close-btn"
              onClick={onClose}
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="notification-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({notifications.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </button>
          <button 
            className={`filter-btn ${filter === 'read' ? 'active' : ''}`}
            onClick={() => setFilter('read')}
          >
            Read ({notifications.length - unreadCount})
          </button>
        </div>

        {/* Content */}
        <div className="notification-content">
          {loading ? (
            <div className="notification-loading">
              <div className="loading-spinner"></div>
              <p>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="no-notifications">
              <div className="no-notifications-icon">🔔</div>
              <h4>No notifications</h4>
              <p>
                {filter === 'unread' 
                  ? "You're all caught up!" 
                  : filter === 'read'
                  ? "No read notifications"
                  : "You don't have any notifications yet"
                }
              </p>
            </div>
          ) : (
            <div className="notifications-list">
              {filteredNotifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification)}
                  </div>
                  
                  <div className="notification-body">
                    <div className="notification-title">
                      {notification.title}
                      {!notification.is_read && <div className="unread-dot"></div>}
                    </div>
                    
                    <div className="notification-message">
                      {notification.body}
                    </div>
                    
                    <div className="notification-meta">
                      {notification.project_name && (
                        <span className="project-tag">
                          📁 {notification.project_name}
                        </span>
                      )}
                      {notification.task_title && (
                        <span className="task-tag">
                          📝 {notification.task_title}
                        </span>
                      )}
                      <span className="notification-time">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="notification-actions">
                    {!notification.is_read && (
                      <button 
                        className="action-btn mark-read"
                        onClick={() => markAsRead(notification.id)}
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                    <button 
                      className="action-btn delete"
                      onClick={() => deleteNotification(notification.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <div className="notification-footer">
            <button 
              className="refresh-btn"
              onClick={loadNotifications}
              disabled={loading}
            >
              🔄 Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;

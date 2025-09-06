import React, { useState, useEffect } from 'react';
import { Notification } from '../types';
import apiService from '../services/api';
import './NotificationCenter.css';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const notificationsData = await apiService.getNotifications();
      setNotifications(notificationsData);
    } catch (err) {
      setError('Failed to load notifications');
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationIds: number[]) => {
    try {
      await apiService.markNotificationsRead(notificationIds);
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notificationIds.includes(notification.id) 
            ? { ...notification, is_read: true }
            : notification
        )
      );
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications
      .filter(n => !n.is_read)
      .map(n => n.id);
    
    if (unreadIds.length > 0) {
      await markAsRead(unreadIds);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const days = Math.floor(diffInHours / 24);
      return `${days}d ago`;
    }
  };

  const getNotificationIcon = (title: string) => {
    if (title.includes('Task Assigned')) return '📋';
    if (title.includes('Task Status')) return '✅';
    if (title.includes('Added to Project')) return '👥';
    if (title.includes('New Team Member')) return '🆕';
    if (title.includes('New Comment')) return '💬';
    return '📢';
  };

  if (!isOpen) return null;

  return (
    <div className="notification-overlay" onClick={onClose}>
      <div className="notification-center" onClick={(e) => e.stopPropagation()}>
        <div className="notification-header">
          <h3>Notifications</h3>
          <div className="notification-actions">
            {notifications.some(n => !n.is_read) && (
              <button 
                className="mark-all-read-btn"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="notification-content">
          {loading ? (
            <div className="notification-loading">
              <div className="loading-spinner"></div>
              <p>Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="notification-error">
              <p>{error}</p>
              <button onClick={loadNotifications}>Retry</button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="no-notifications">
              <p>📬 No notifications yet</p>
              <span>You'll see updates about your projects and tasks here</span>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map(notification => (
                <div 
                  key={notification.id}
                  className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                  onClick={() => !notification.is_read && markAsRead([notification.id])}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.title)}
                  </div>
                  
                  <div className="notification-body">
                    <div className="notification-title">
                      {notification.title}
                      {!notification.is_read && <span className="unread-dot"></span>}
                    </div>
                    <div className="notification-text">
                      {notification.body}
                    </div>
                    <div className="notification-meta">
                      {notification.project_name && (
                        <span className="project-name">
                          📁 {notification.project_name}
                        </span>
                      )}
                      <span className="notification-time">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;

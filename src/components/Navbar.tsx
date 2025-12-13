import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { Menu, Search, Bell, LogOut, User as UserIcon, Heart, MessageCircle, Trophy, Map, Plus, Mail, Wallet as WalletIcon } from 'lucide-react';
import { getNotifications, getUnreadCount, markNotificationRead, subscribeToNotifications, Notification } from '../services/notificationService';
import { getUnreadMessageCount } from '../services/notificationService';

export const Navbar: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Load notifications and unread counts
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadUnreadCounts();

      // Subscribe to real-time notifications
      const unsubscribe = subscribeToNotifications(user.id, (notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const data = await getNotifications(user.id, 10);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const loadUnreadCounts = async () => {
    if (!user) return;
    try {
      const [notifCount, msgCount] = await Promise.all([
        getUnreadCount(user.id),
        getUnreadMessageCount(user.id)
      ]);
      setUnreadCount(notifCount);
      setUnreadMessages(msgCount);
    } catch (error) {
      console.error('Failed to load unread counts:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read_at && user) {
      await markNotificationRead(notification.id, user.id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)
      );
    }

    // Close dropdown
    setShowNotifications(false);

    // Determine where to navigate
    if (notification.action_url) {
      // Use explicit action URL if provided
      navigate(notification.action_url);
    } else if (notification.case_id) {
      // If notification is about a case, go to that case
      navigate(`/case/${notification.case_id}`);
    } else {
      // Default: go to messages/inbox to read the full notification
      navigate('/messages');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-mystery-900/80 backdrop-blur-md border-b border-mystery-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center cursor-pointer">
              <div className="w-8 h-8 bg-mystery-500 rounded-lg flex items-center justify-center mr-2 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                <Search className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Unexplained<span className="text-mystery-400">Archive</span>
              </span>
            </Link>

            {/* Nav Links (Desktop) */}
            <div className="hidden md:flex items-center space-x-6">
              <Link to="/explore" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Explore Cases
              </Link>
              <Link to="/map" className="text-gray-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1">
                <Map className="w-4 h-4" /> Map
              </Link>
              <Link to="/forum" className="text-gray-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1">
                <MessageCircle className="w-4 h-4" /> Forum
              </Link>
              <Link to="/leaderboard" className="text-gray-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1">
                <Trophy className="w-4 h-4" /> Leaderboard
              </Link>
              <Link to="/donate" className="text-gray-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1">
                <Heart className="w-4 h-4 text-red-400" /> Donate
              </Link>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  {/* Notifications Bell */}
                  <div className="relative">
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Notifications Dropdown */}
                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-mystery-800 rounded-lg shadow-xl border border-mystery-700 max-h-[500px] overflow-y-auto z-50">
                        <div className="p-3 border-b border-mystery-700 flex justify-between items-center">
                          <h3 className="font-bold text-white text-sm">Notifications</h3>
                          {unreadCount > 0 && (
                            <span className="text-xs text-blue-400">{unreadCount} unread</span>
                          )}
                        </div>
                        
                        {notifications.length === 0 ? (
                          <p className="p-4 text-sm text-gray-400 text-center">No notifications yet</p>
                        ) : (
                          <div className="divide-y divide-mystery-700">
                            {notifications.map((notif) => (
                              <button
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={`w-full text-left p-3 hover:bg-mystery-700 transition-colors ${
                                  !notif.read_at ? 'bg-blue-900/20' : ''
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  {!notif.read_at && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">
                                      {notif.title}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                      {notif.message}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {new Date(notif.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        
                        <Link
                          to="/notifications"
                          className="block p-3 text-center text-sm text-blue-400 hover:text-blue-300 border-t border-mystery-700"
                          onClick={() => setShowNotifications(false)}
                        >
                          View All Notifications
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Messages Icon */}
                  <Link
                    to="/messages"
                    className="relative p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <Mail className="w-5 h-5" />
                    {unreadMessages > 0 && (
                      <span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                    )}
                  </Link>

                  <Link
                    to="/submit-case"
                    className="hidden sm:flex items-center gap-2 bg-mystery-500 hover:bg-mystery-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Submit Case
                  </Link>

                  {/* User Menu */}
                  <div className="relative group">
                    <button className="flex items-center gap-2 bg-mystery-800 hover:bg-mystery-700 px-3 py-2 rounded-lg transition-colors">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <UserIcon className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="text-sm font-medium text-white hidden sm:inline">
                        {profile?.username || 'User'}
                      </span>
                    </button>

                    {/* Dropdown */}
                    <div className="absolute right-0 mt-2 w-48 bg-mystery-800 rounded-lg shadow-xl border border-mystery-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      <Link to="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-mystery-700 hover:text-white rounded-t-lg">
                        My Profile
                      </Link>
                      <Link to="/wallet" className="block px-4 py-2 text-sm text-gray-300 hover:bg-mystery-700 hover:text-white flex items-center gap-2">
                        <WalletIcon className="w-4 h-4" />
                        My Wallet
                      </Link>
                      {profile?.role === 'investigator' && (
                        <>
                          <Link to="/investigator" className="block px-4 py-2 text-sm text-gray-300 hover:bg-mystery-700 hover:text-white">
                            Investigator Dashboard
                          </Link>
                          <Link to="/subscription" className="block px-4 py-2 text-sm text-mystery-400 hover:bg-mystery-700 hover:text-mystery-300 font-medium">
                            ⭐ My Subscription
                          </Link>
                        </>
                      )}
                      {profile?.role === 'admin' && (
                        <Link to="/admin" className="block px-4 py-2 text-sm text-gray-300 hover:bg-mystery-700 hover:text-white">
                          Admin Dashboard
                        </Link>
                      )}
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-mystery-700 rounded-b-lg flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="bg-mystery-500 hover:bg-mystery-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  Sign In
                </button>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden text-gray-400 hover:text-white"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden border-t border-mystery-700 py-4 space-y-2">
              <Link to="/explore" className="block px-4 py-2 text-gray-300 hover:bg-mystery-800 rounded">
                Explore Cases
              </Link>
              <Link to="/map" className="block px-4 py-2 text-gray-300 hover:bg-mystery-800 rounded">
                Map
              </Link>
              <Link to="/forum" className="block px-4 py-2 text-gray-300 hover:bg-mystery-800 rounded">
                Forum
              </Link>
              <Link to="/leaderboard" className="block px-4 py-2 text-gray-300 hover:bg-mystery-800 rounded">
                Leaderboard
              </Link>
              <Link to="/donate" className="block px-4 py-2 text-gray-300 hover:bg-mystery-800 rounded">
                Donate
              </Link>
              {user && (
                <Link to="/submit-case" className="block px-4 py-2 bg-mystery-500 text-white rounded">
                  Submit Case
                </Link>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
};

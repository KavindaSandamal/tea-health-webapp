import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Upload, 
  History, 
  MapPin, 
  BarChart3, 
  User,
  X,
  Camera
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { path: '/dashboard/upload', icon: Upload, label: 'New Scan' },
    { path: '/dashboard/realtime', icon: Camera, label: 'Real-Time Scan' },
    { path: '/dashboard/history', icon: History, label: 'History' },
    { path: '/dashboard/map', icon: MapPin, label: 'Map View' },
    { path: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/dashboard/profile', icon: User, label: 'Profile' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-gray-200 z-50
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          w-64
        `}
      >
        <div className="flex flex-col h-full">
          {/* Close button (mobile only) */}
          <div className="lg:hidden flex justify-end p-4">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-green-50 text-green-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-900 mb-1">
                Need Help?
              </h4>
              <p className="text-xs text-green-700 mb-3">
                Check our documentation for guides
              </p>
              <button className="w-full bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700 transition">
                View Docs
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
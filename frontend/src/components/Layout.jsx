import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import {
  LayoutDashboard, CalendarDays, Search, User, LogOut,
  Menu, X, Plus, ClipboardList
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/calendar',  icon: CalendarDays,    label: 'Kalender'  },
    { to: '/search',    icon: Search,          label: 'Cari'      },
    { to: '/profile',   icon: User,            label: 'Profil'    },
  ];

  const SidebarNavItem = ({ to, icon: Icon, label }) => (
    <NavLink
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 font-medium'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <Icon size={20} />
      {label}
    </NavLink>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-30 h-full w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <ClipboardList size={18} className="text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">RapatKu</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* New Meeting Button */}
        <div className="p-4">
          <button
            onClick={() => { navigate('/meetings/new'); setSidebarOpen(false); }}
            className="w-full flex items-center justify-center gap-2 btn-primary"
          >
            <Plus size={18} />
            Buat Rapat
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => <SidebarNavItem key={item.to} {...item} />)}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</div>
              <div className="text-xs text-gray-500 truncate">{user?.email}</div>
            </div>
          </div>
          {!user?.is_profile_complete && (
            <div
              onClick={() => { navigate('/profile'); setSidebarOpen(false); }}
              className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3 cursor-pointer hover:bg-amber-100 transition-colors"
            >
              <p className="text-xs text-amber-700 font-medium">⚠ Lengkapi profil Anda</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-sm"
          >
            <LogOut size={16} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                <ClipboardList size={15} className="text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">RapatKu</span>
            </div>
          </div>
          {/* Avatar shortcut */}
          <button
            onClick={() => navigate('/profile')}
            className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm"
          >
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </button>
        </header>

        {/* Page content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 p-4 pb-24 lg:pb-6 lg:p-6 max-w-6xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-16">
          {/* Dashboard */}
          <NavLink to="/dashboard" className="flex-1">
            {({ isActive }) => (
              <div className={`flex flex-col items-center gap-0.5 py-2 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>
                <LayoutDashboard size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">Dashboard</span>
              </div>
            )}
          </NavLink>

          {/* Kalender */}
          <NavLink to="/calendar" className="flex-1">
            {({ isActive }) => (
              <div className={`flex flex-col items-center gap-0.5 py-2 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>
                <CalendarDays size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">Kalender</span>
              </div>
            )}
          </NavLink>

          {/* FAB — Buat Rapat */}
          <button
            onClick={() => navigate('/meetings/new')}
            className="flex-1 flex flex-col items-center -mt-5"
          >
            <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-300">
              <Plus size={26} className="text-white" />
            </div>
            <span className="text-[10px] font-medium text-gray-500 mt-1">Buat</span>
          </button>

          {/* Cari */}
          <NavLink to="/search" className="flex-1">
            {({ isActive }) => (
              <div className={`flex flex-col items-center gap-0.5 py-2 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>
                <Search size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">Cari</span>
              </div>
            )}
          </NavLink>

          {/* Profil */}
          <NavLink to="/profile" className="flex-1">
            {({ isActive }) => (
              <div className={`flex flex-col items-center gap-0.5 py-2 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>
                <User size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">Profil</span>
              </div>
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

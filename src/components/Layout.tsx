import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Home, Compass, Library, Upload, LogOut, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-md fixed w-full z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <span className="text-red-600 text-2xl font-bold">YourTube</span>
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link
                    to="/upload"
                    className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-red-700"
                  >
                    <Upload size={20} />
                    <span>Upload</span>
                  </Link>
                  <button
                    onClick={signOut}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    <LogOut size={20} />
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <div className="fixed left-0 top-16 h-full w-64 bg-white shadow-md">
        <div className="p-4">
          <ul className="space-y-2">
            <li>
              <Link
                to="/"
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100"
              >
                <Home size={20} />
                <span>Home</span>
              </Link>
            </li>
            <li>
              <Link
                to="/explore"
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100"
              >
                <Compass size={20} />
                <span>Explore</span>
              </Link>
            </li>
            <li>
              <Link
                to="/library"
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100"
              >
                <Library size={20} />
                <span>Library</span>
              </Link>
            </li>
            {user && (
              <li>
                <Link
                  to="/profile"
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100"
                >
                  <User size={20} />
                  <span>Profile</span>
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 pt-16">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
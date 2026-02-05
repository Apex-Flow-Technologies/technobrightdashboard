import { useState } from 'react'; // Import useState
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useStore } from '@/store';
import { cn } from '@/lib/utils'; // Import cn utility

export function MainLayout() {
  const { isAuthenticated } = useStore();
  // 1. Create the state here
  const [collapsed, setCollapsed] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 2. Pass state and setter to Sidebar */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      {/* 3. Dynamically adjust padding based on state */}
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out", 
          collapsed ? "pl-16" : "pl-64" // This fixes the space problem
        )}
      >
        <TopBar />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
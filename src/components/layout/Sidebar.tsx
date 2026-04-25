import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Ticket, Settings, ChevronLeft, ChevronRight, Building2, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.jpg'; 

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

const navItems = [{
  icon: LayoutDashboard,
  label: 'Dashboard',
  path: '/dashboard'
}, {
  icon: Users,
  label: 'Staff', 
  path: '/technicians'
}, {
  icon: Ticket,
  label: 'Tickets',
  path: '/tickets'
}, {
  icon: Wrench,
  label: 'Machine List',
  path: '/machines'
}, {
  icon: Building2,
  label: 'Customers',
  path: '/Customers'
}, {
  icon: Settings,
  label: 'Settings',
  path: '/settings'
}];

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const location = useLocation();
  const logoSmall = "/image.png"; 

  return (
    <aside className={cn(
      'fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300 flex flex-col', 
      collapsed ? 'w-16' : 'w-64',
      // Mobile classes
      'max-lg:-translate-x-full',
      mobileOpen && 'max-lg:translate-x-0 max-lg:w-64'
    )}>
      {/* Logo Section */}
      <div className={cn("h-16 flex items-center border-b border-border px-4", collapsed ? "justify-center" : "justify-between")}>
        
        <div className="flex items-center gap-2 overflow-hidden">
          <img 
            src={collapsed ? logoSmall : logo} 
            alt="Techno Bright" 
            className={cn("transition-all", (collapsed && !mobileOpen) ? "h-8 w-8 object-contain" : "h-8 w-auto")} 
          />
        </div>

        {/* Internal Toggle Button (Visible when expanded on Desktop) */}
        <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-8 w-8 lg:flex hidden", collapsed && "hidden")} 
            onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Close button on Mobile */}
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 lg:hidden" 
            onClick={() => setMobileOpen?.(false)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Floating Toggle Button (Visible when collapsed on Desktop) */}
        {collapsed && (
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 absolute -right-3 top-5 bg-card border border-border rounded-full shadow-sm z-50 hover:bg-accent items-center justify-center p-0 lg:flex hidden"
                onClick={() => setCollapsed(!collapsed)}
            >
                <ChevronRight className="h-3 w-3" />
            </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2">
        <ul className="space-y-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <NavLink 
                    to={item.path} 
                    onClick={() => setMobileOpen?.(false)}
                    className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200', 
                        'hover:bg-accent', 
                        isActive ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:text-foreground',
                        (collapsed && !mobileOpen) && 'justify-center px-0'
                    )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {(!collapsed || mobileOpen) && <span className="font-medium">{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
          {(!collapsed || mobileOpen) && <div className="text-xs text-muted-foreground">© 2026 ApexFlow Technologies</div>}
      </div>
    </aside>
  );
}
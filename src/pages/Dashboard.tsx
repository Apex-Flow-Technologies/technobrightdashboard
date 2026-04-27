import { 
  Ticket as TicketIcon, 
  Clock, 
  Users, 
  CheckCircle2,
  TrendingUp,
  Activity as ActivityIcon,
  PlayCircle,
  ClipboardCheck,
  UserCheck
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';
import { useEffect } from "react";
import { TicketTrendChart, StatusDonutChart, TechnicianPerformanceChart } from '@/components/dashboard/DashboardCharts';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { 
    tickets, 
    technicians, 
    activities, 
    listenToTickets, 
    listenToTechnicians, 
    listenToActivities 
  } = useStore();

  useEffect(() => {
    const unsubTickets = listenToTickets();
    const unsubTechs = listenToTechnicians();
    const unsubActivities = listenToActivities();

    return () => {
      unsubTickets();
      unsubTechs();
      unsubActivities();
    };
  }, []);

  const stats = [
    {
      title: 'Total Tickets',
      value: tickets.length,
      icon: TicketIcon,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      description: 'Total service requests'
    },
    {
      title: 'Unassigned',
      value: tickets.filter(t => t.status === 'new').length, 
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      description: 'Pending assignment'
    },
    {
      title: 'Assigned',
      value: tickets.filter(t => t.status === 'assigned').length, 
      icon: UserCheck,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      description: 'Waiting for start'
    },
    {
      title: 'Active Work',
      value: tickets.filter(t => t.status === 'in-progress' && t.rawStatus === 'in progress').length,
      icon: PlayCircle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      description: 'Being worked on'
    },
    {
      title: 'Pending Closure',
      value: tickets.filter(t => t.rawStatus === 'waiting_for_confirmation').length,
      icon: ClipboardCheck,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      description: 'Awaiting confirmation'
    },
    {
      title: 'Completed Today',
      value: tickets.filter(t => t.status === 'completed' && new Date(t.updatedAt).toDateString() === new Date().toDateString()).length,
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      description: 'Resolved today'
    },
    {
      title: 'Active Techs',
      value: technicians.filter((t) => t.role === 'technician' && t.status === 'online').length,
      icon: Users,
      color: 'text-slate-500',
      bgColor: 'bg-slate-500/10',
      description: 'Technicians online'
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Real-time overview of service operations</p>
        </div>
        <Badge variant="outline" className="h-8 gap-2 px-3 border-primary/20 bg-primary/5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Live Sync Active
        </Badge>
      </div>

      {/* Stats Grid */}
      <motion.div 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        initial="hidden"
        animate="show"
        variants={{
          show: {
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.title}
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 }
            }}
          >
            <Card className="overflow-hidden border-border/50 hover:border-primary/50 transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={cn('p-2.5 rounded-xl', stat.bgColor)}>
                    <stat.icon className={cn('h-5 w-5', stat.color)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket Volume Chart */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Service Volume Trend
            </CardTitle>
            <CardDescription>Tickets created vs. resolved (Last 7 Days)</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 min-h-[300px]">
            <TicketTrendChart tickets={tickets} />
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="lg:col-span-1 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Status Distribution</CardTitle>
            <CardDescription>Breakdown by current state</CardDescription>
          </CardHeader>
          <CardContent className="min-h-[300px] flex items-center justify-center">
            <StatusDonutChart tickets={tickets} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed */}
        <Card className="lg:col-span-1 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <ActivityIcon className="h-5 w-5 text-primary" />
                Live Activity Stream
              </CardTitle>
              <CardDescription>Most recent system actions</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {activities.length === 0 ? (
                <div className="text-center py-12">
                   <p className="text-sm text-muted-foreground italic">Waiting for activity...</p>
                </div>
              ) : (
                activities.map((activity, idx) => (
                  <div
                    key={activity.id}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-all animate-in slide-in-from-right-4",
                      idx === 0 && "bg-primary/5 border-primary/10 shadow-sm"
                    )}
                  >
                    <div className={cn(
                      'p-2 rounded-full flex-shrink-0 shadow-sm',
                      activity.type === 'completion' ? 'bg-green-500/10 text-green-600' :
                      activity.type === 'assignment' ? 'bg-primary/10 text-primary' :
                      activity.type === 'creation' ? 'bg-purple-500/10 text-purple-600' :
                      'bg-slate-500/10 text-slate-600'
                    )}>
                      <ActivityIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-snug">{activity.action}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

         {/* Technician Performance */}
         <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Technician Workload & Performance</CardTitle>
            <CardDescription>Comparative analysis of completed tasks and current active tickets</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <TechnicianPerformanceChart technicians={technicians} tickets={tickets} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatTimeAgo(dateInput: any): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
import { 
  Ticket, 
  Clock, 
  Users, 
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';

//Firebase imports
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase";


export default function Dashboard() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const { activities, listenToActivities } = useStore();



  const stats = [
    {
      title: 'Total Tickets',
      value: tickets.length,
      icon: Ticket,
      trend: '+12%',
      trendUp: true,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Pending Assignment',
      value: tickets.filter((t) => t.status === 'open').length,
      icon: Clock,
      trend: '2 urgent',
      trendUp: false,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Active Technicians',
      value: technicians.filter((t) => t.status === 'online').length, // we don't have technician status yet
      icon: Users,
      trend: `of ${technicians.length}`,
      trendUp: true,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Completed Today',
      value: tickets.filter((t) => t.status === 'completed').length,
      icon: CheckCircle2,
      trend: '+3',
      trendUp: true,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  useEffect(() => {

  const fetchData = async () => {

    // ---- Fetch Tickets ----
    const ticketSnap = await getDocs(collection(db, "tickets"));
    const ticketData = ticketSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    setTickets(ticketData);

    // ---- Fetch Technicians ----
    const techQuery = query(
      collection(db, "user"),
      where("role", "==", "technician")
    );

    const techSnap = await getDocs(techQuery);

    const techData = techSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    setTechnicians(techData);

  };

  fetchData();

  const unsubscribe = listenToActivities();

  return () => unsubscribe();


}, []);


  const ticketsByStatus = {
    new: tickets.filter((t) => t.status === 'open').length,
    assigned: tickets.filter((t) => t.status === 'assigned').length,
    'in progress': tickets.filter((t) => t.status === 'in progress').length,
    completed: tickets.filter((t) => t.status === 'completed').length,
    declined: tickets.filter((t) => t.status === 'declined').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your service operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-card-hover transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  <div className="flex items-center gap-1">
                    {stat.trendUp && <TrendingUp className="h-3 w-3 text-success" />}
                    <span className={cn(
                      'text-xs',
                      stat.trendUp ? 'text-success' : 'text-muted-foreground'
                    )}>
                      {stat.trend}
                    </span>
                  </div>
                </div>
                <div className={cn('p-3 rounded-lg', stat.bgColor)}>
                  <stat.icon className={cn('h-5 w-5', stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket Status Overview */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Ticket Status</CardTitle>
            <CardDescription>Current distribution by status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBar label="New" count={ticketsByStatus.new} total={tickets.length} color="bg-primary" />
            <StatusBar label="Assigned" count={ticketsByStatus.assigned} total={tickets.length} color="bg-accent-foreground" />
            <StatusBar label="In Progress" count={ticketsByStatus['in progress']} total={tickets.length} color="bg-warning" />
            <StatusBar label="Completed" count={ticketsByStatus.completed} total={tickets.length} color="bg-success" />
            <StatusBar label="Declined" count={ticketsByStatus.declined} total={tickets.length} color="bg-destructive" />
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Latest actions from your team</CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              Live
              <span className="ml-1 h-2 w-2 rounded-full bg-success animate-pulse-soft inline-block" />
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.slice(0, 6).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={cn(
                    'p-2 rounded-lg flex-shrink-0',
                    activity.type === 'completion' ? 'bg-success/10' :
                    activity.type === 'assignment' ? 'bg-primary/10' :
                    activity.type === 'creation' ? 'bg-accent' :
                    'bg-muted'
                  )}>
                    {activity.type === 'completion' ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : activity.type === 'assignment' ? (
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{count}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

import { useState, useEffect } from 'react';
import { 
  Search, User, Clock, CheckCircle2, XCircle, ArrowRight, 
  Calendar, UploadCloud, Monitor, UserCheck, LayoutGrid, List, 
  Download, ChevronLeft, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

import { useStore, Ticket } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// --- Configuration ---

type TicketStatus = 'new' | 'assigned' | 'in-progress' | 'completed' | 'declined';

const ITEMS_PER_PAGE = 30;

const statusConfig: Record<TicketStatus, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  new: { label: 'Unassigned', color: 'text-slate-600', bgColor: 'bg-slate-100', borderColor: 'border-slate-200', icon: Clock },
  assigned: { label: 'Assigned', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: User },
  'in-progress': { label: 'In Progress', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: ArrowRight },
  completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: XCircle },
};

// --- Helper Functions ---

function formatTimeAgo(date: any): string {
    if (!date) return '';
    const d = date instanceof Date ? date : (date as any)?.toDate ? (date as any).toDate() : new Date();
    const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDate(date: any): string {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : (date as any)?.toDate ? (date as any).toDate() : new Date();
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(d);
}

function getSafeDate(date: any): Date {
    return date instanceof Date ? date : (date as any)?.toDate ? (date as any).toDate() : new Date(date);
}

// --- Main Component ---

export default function Tickets() {
  const { tickets, technicians, assignTicket, fetchTickets, fetchTechnicians } = useStore();
  const { toast } = useToast();
  
  useEffect(() => {
    fetchTickets();
    fetchTechnicians();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TicketStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid'); // Toggle State
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dialog States
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Selection States
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState('');

  // Export Date Range State
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // 1. Filtering & Sorting Logic
  const filteredTickets = tickets
    .filter((ticket) => {
      const matchesSearch =
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.displayId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === 'all' || ticket.status === activeTab;
      return matchesSearch && matchesTab;
    })
    .sort((a, b) => {
      const dateA = getSafeDate(a.createdAt);
      const dateB = getSafeDate(b.createdAt);
      return dateB.getTime() - dateA.getTime(); // Newest first
    });

  // 2. Pagination Logic
  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  const ticketCounts: Record<TicketStatus | 'all', number> = {
    all: tickets.length,
    new: tickets.filter((t) => t.status === 'new').length,
    assigned: tickets.filter((t) => t.status === 'assigned').length,
    'in-progress': tickets.filter((t) => t.status === 'in-progress').length,
    completed: tickets.filter((t) => t.status === 'completed').length,
    declined: tickets.filter((t) => t.status === 'declined').length,
  };

  // --- Actions ---

  const handleAssign = () => {
    if (selectedTicket && selectedTechnician) {
      assignTicket(selectedTicket.id, selectedTechnician);
      setAssignDialogOpen(false);
      setSelectedTicket(null);
      setSelectedTechnician('');
      toast({
        title: 'Ticket assigned',
        description: 'The ticket has been assigned successfully.',
      });
    }
  };

  const handleExport = () => {
    if (!dateRange.start || !dateRange.end) {
        toast({ title: "Error", description: "Please select both start and end dates.", variant: "destructive" });
        return;
    }

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59); // Include the entire end day

    // Filter tickets for export
    const ticketsToExport = tickets.filter(t => {
        const tDate = getSafeDate(t.createdAt);
        return tDate >= start && tDate <= end;
    });

    if (ticketsToExport.length === 0) {
        toast({ title: "No Data", description: "No tickets found in this date range." });
        return;
    }

    // Convert to CSV
    const csvContent = [
        ["Ticket ID", "Date", "Customer", "Machine", "Status", "Technician", "Description"], // Header
        ...ticketsToExport.map(t => {
            const tech = technicians.find(tech => tech.id === t.assignedToId)?.name || "Unassigned";
            return [
                t.displayId,
                formatDate(t.createdAt),
                `"${t.customerName}"`,
                t.machineCode || "N/A",
                t.status,
                tech,
                `"${t.description.replace(/"/g, '""')}"`
            ];
        })
    ].map(e => e.join(",")).join("\n");

    // Download File
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `tickets_report_${dateRange.start}_to_${dateRange.end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportDialogOpen(false);
    toast({ title: "Export Successful", description: `Downloaded ${ticketsToExport.length} tickets.` });
  };

  const openAssignDialog = (e: React.MouseEvent, ticket: Ticket) => {
    e.stopPropagation();
    setSelectedTicket(ticket);
    setAssignDialogOpen(true);
  };

  const openDetailsDialog = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setDetailsDialogOpen(true);
  };

  const availableTechnicians = technicians.filter((t) => t.status === 'online' && t.role === 'technician');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tickets</h1>
          <p className="text-muted-foreground mt-1 text-base">Manage and assign service tickets</p>
        </div>
        <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-muted p-1 rounded-lg border">
                <Button 
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="h-9 w-9 p-0"
                    onClick={() => setViewMode('grid')}
                >
                    <LayoutGrid className="h-5 w-5" />
                </Button>
                <Button 
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="h-9 w-9 p-0"
                    onClick={() => setViewMode('table')}
                >
                    <List className="h-5 w-5" />
                </Button>
            </div>
            
            {/* Export Button */}
            <Button variant="outline" size="sm" className="gap-2 h-9 px-4 text-sm" onClick={() => setExportDialogOpen(true)}>
                <Download className="h-4 w-4" />
                Export
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TicketStatus | 'all')} className="w-full lg:w-auto">
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full lg:w-auto h-10">
                {['all', 'new', 'assigned', 'in-progress', 'completed', 'declined'].map((tab) => (
                    <TabsTrigger key={tab} value={tab} className="text-xs sm:text-sm capitalize relative">
                        {tab === 'new' ? 'Unassigned' : tab.replace('-', ' ')} 
                        {' '}({ticketCounts[tab as keyof typeof ticketCounts]})
                    </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
            {filteredTickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No tickets found
              </div>
            ) : (
                <>
                {/* --- GRID VIEW --- */}
                {viewMode === 'grid' && (
                    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                        {paginatedTickets.map((ticket) => (
                            <TicketCard
                                key={ticket.id}
                                ticket={ticket}
                                onAssign={(e: React.MouseEvent) => openAssignDialog(e, ticket)}
                                onClick={() => openDetailsDialog(ticket)}
                            />
                        ))}
                    </div>
                )}

                {/* --- TABLE VIEW (Bigger & Better) --- */}
                {viewMode === 'table' && (
                    <div className="rounded-lg border shadow-sm bg-white overflow-hidden">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="h-12 px-4 py-3 font-semibold text-sm border-b border-r last:border-r-0 w-[140px]">Ticket ID</th>
                                        <th className="h-12 px-4 py-3 font-semibold text-sm border-b border-r last:border-r-0 w-[180px]">Date</th>
                                        <th className="h-12 px-4 py-3 font-semibold text-sm border-b border-r last:border-r-0 w-[200px]">Customer</th>
                                        <th className="h-12 px-4 py-3 font-semibold text-sm border-b border-r last:border-r-0 w-[220px]">Machine # / Name</th>
                                        <th className="h-12 px-4 py-3 font-semibold text-sm border-b border-r last:border-r-0">Description</th>
                                        <th className="h-12 px-4 py-3 font-semibold text-sm border-b border-r last:border-r-0 w-[140px]">Status</th>
                                        <th className="h-12 px-4 py-3 font-semibold text-sm border-b border-r last:border-r-0 w-[180px]">Technician</th>
                                        <th className="h-12 px-4 py-3 font-semibold text-sm border-b w-[120px] text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedTickets.map((ticket, index) => {
                                        const status = statusConfig[ticket.status];
                                        const tech = technicians.find(t => t.id === ticket.assignedToId);
                                        
                                        // Machine Code Parsing
                                        const machineParts = ticket.machineCode ? ticket.machineCode.split('|') : [];
                                        const serialNumber = machineParts[0]?.trim() || ticket.machineCode;
                                        const modelName = machineParts[1]?.trim();

                                        return (
                                            <tr 
                                                key={ticket.id} 
                                                className={cn(
                                                    "group transition-colors hover:bg-blue-50/50 cursor-pointer",
                                                    index % 2 === 0 ? "bg-white" : "bg-slate-50/40" // Zebra Striping
                                                )}
                                                onClick={() => openDetailsDialog(ticket)}
                                            >
                                                {/* ID */}
                                                <td className="p-4 border-b border-r last:border-r-0 align-top">
                                                    <span className="font-mono font-bold text-slate-700 text-sm">
                                                        {ticket.displayId}
                                                    </span>
                                                </td>

                                                {/* Date */}
                                                <td className="p-4 border-b border-r last:border-r-0 align-top text-slate-600">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-sm text-slate-900">
                                                            {formatDate(ticket.createdAt).split(',')[0]} {/* Date */}
                                                        </span>
                                                        <span className="text-xs text-slate-500 mt-0.5">
                                                            {formatDate(ticket.createdAt).split(',')[1]} {/* Time */}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Customer */}
                                                <td className="p-4 border-b border-r last:border-r-0 align-top">
                                                    <span className="font-semibold text-sm text-slate-800 block">
                                                        {ticket.customerName}
                                                    </span>
                                                </td>

                                                {/* Machine */}
                                                <td className="p-4 border-b border-r last:border-r-0 align-top">
                                                    {ticket.machineCode ? (
                                                        <div className="flex flex-col items-start gap-1">
                                                            {/* Serial Number (Bigger) */}
                                                            <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                                {serialNumber}
                                                            </span>
                                                            {/* Model Name */}
                                                            {modelName && (
                                                                <span className="text-xs text-slate-500 font-medium line-clamp-1" title={modelName}>
                                                                    {modelName}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm italic">-</span>
                                                    )}
                                                </td>

                                                {/* Description */}
                                                <td className="p-4 border-b border-r last:border-r-0 align-top">
                                                    <span className="line-clamp-2 text-sm text-slate-600 leading-relaxed">
                                                        {ticket.description}
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td className="p-4 border-b border-r last:border-r-0 align-top">
                                                    <Badge variant="outline" className={cn("whitespace-nowrap h-7 text-xs px-2.5", status.color, status.bgColor, status.borderColor)}>
                                                        {status.label}
                                                    </Badge>
                                                </td>

                                                {/* Technician */}
                                                <td className="p-4 border-b border-r last:border-r-0 align-top">
                                                    {tech ? (
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-xs text-blue-700 font-bold shrink-0">
                                                                {tech.name.substring(0,2).toUpperCase()}
                                                            </div>
                                                            <span className="text-sm font-medium text-slate-700 truncate">{tech.name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-slate-400 italic pl-1">Unassigned</span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="p-4 border-b align-top text-center">
                                                    {ticket.status === 'new' ? (
                                                        <Button 
                                                            size="sm" variant="outline" 
                                                            className="h-9 text-xs font-medium w-full border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 shadow-sm"
                                                            onClick={(e) => openAssignDialog(e, ticket)}
                                                        >
                                                            Assign
                                                        </Button>
                                                    ) : (
                                                        <Button size="sm" variant="ghost" className="h-9 w-full text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100">
                                                            View
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- PAGINATION CONTROLS --- */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between py-4">
                        <div className="text-sm text-muted-foreground">
                            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)} of {filteredTickets.length} tickets
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>
                            <div className="text-sm font-medium">
                                Page {currentPage} of {totalPages}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
                </>
            )}
        </CardContent>
      </Card>

      {/* DETAIL DIALOG (unchanged structure) */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedTicket && (
                <TicketDetailView 
                    ticket={selectedTicket} 
                    technicians={technicians} 
                />
            )}
        </DialogContent>
      </Dialog>

      {/* ASSIGN DIALOG (unchanged structure) */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Ticket</DialogTitle>
            <DialogDescription>
              Select a technician to assign {selectedTicket?.displayId}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger>
                <SelectValue placeholder="Select a technician" />
              </SelectTrigger>
              <SelectContent>
                {availableTechnicians.length === 0 ? (
                  <SelectItem value="none" disabled>No technicians available</SelectItem>
                ) : (
                  availableTechnicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 bg-success rounded-full" />
                        <span>{tech.name}</span>
                        <span className="text-muted-foreground">({tech.activeJobs} jobs)</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!selectedTechnician}>Assign Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EXPORT DIALOG (unchanged structure) */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Export Tickets</DialogTitle>
              <DialogDescription>
                Select a date range to download a CSV report of your tickets.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input 
                        id="start-date" 
                        type="date" 
                        value={dateRange.start} 
                        onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input 
                        id="end-date" 
                        type="date" 
                        value={dateRange.end} 
                        onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))}
                    />
                </div>
              </div>
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
               <Button onClick={handleExport} className="gap-2">
                   <FileSpreadsheet className="h-4 w-4" /> Download CSV
               </Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Ticket Detail Component (Same as before) ---
function TicketDetailView({ ticket, technicians }: { ticket: Ticket, technicians: any[] }) {
    const status = statusConfig[ticket.status];
    
    // Find assigned technician name
    const assignedTech = ticket.assignedToId 
        ? technicians.find(t => t.id === ticket.assignedToId) 
        : null;

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex items-start justify-between border-b pb-4">
                <div className="space-y-1.5 w-full">
                      <div className="flex justify-between items-start w-full mb-2">
                        <div className="flex flex-col">
                            <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-fit mb-1">
                                {ticket.displayId}
                            </span>
                            <h2 className="text-2xl font-bold text-foreground">{ticket.customerName || "Unknown Customer"}</h2>
                        </div>
                        
                        {/* Status Badge */}
                        <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border", status.bgColor, status.color, status.borderColor)}>
                            <status.icon className="h-3.5 w-3.5" />
                            {status.label}
                        </div>
                      </div>
                    
                    {/* CREATED DATE */}
                    <div className="flex items-center gap-3 text-muted-foreground text-sm">
                        <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Created: {formatDate(ticket.createdAt)}</span>
                        </div>
                        <span>•</span>
                        <div className="font-medium text-foreground">{ticket.title}</div>
                    </div>
                </div>
            </div>

            {/* Assignment Info Section (Technician + Assigned Date) */}
            {(ticket.status !== 'new' && ticket.status !== 'declined') && (
                <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    {/* Left: Technician Info */}
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <UserCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Assigned Technician</p>
                            <p className="text-sm font-semibold text-gray-900">{assignedTech ? assignedTech.name : 'Unknown Technician'}</p>
                        </div>
                    </div>
                    
                    {/* Right: Assigned Date Info */}
                    {ticket.assignedAt ? (
                        <div className="flex items-center gap-3 sm:text-right">
                             <div className="hidden sm:block h-8 w-px bg-blue-200" /> {/* Vertical Divider */}
                             <div>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Assigned On</p>
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mt-0.5">
                                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                                    <span>{formatDate(ticket.assignedAt)}</span>
                                </div>
                             </div>
                        </div>
                    ) : (
                        <div className="text-xs text-blue-400 italic">Date unavailable</div>
                    )}
                </div>
            )}

            {/* Content Section */}
             <div className="space-y-5">
                {/* Description */}
                <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</h3>
                    <p className="text-sm leading-relaxed text-foreground bg-muted/20 p-3 rounded-lg border shadow-sm">
                        {ticket.description}
                    </p>
                </div>

                {/* Highlighted Machine Code */}
                {ticket.machineCode && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg shadow-sm">
                        <div className="p-2 bg-slate-200 text-slate-700 rounded-md">
                            <Monitor className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Machine Model / Code</p>
                            <p className="font-mono font-semibold text-base text-foreground">{ticket.machineCode}</p>
                        </div>
                    </div>
                )}
            </div>

             {/* Attachments Section */}
             {(ticket.attachments?.length > 0) && (
                <div className="space-y-3 pt-2">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <UploadCloud className="h-4 w-4" /> Attachments
                      </h3>
                      
                      {ticket.attachments.some(a => a.type === "audio") && (
                        <div className="space-y-2">
                             {ticket.attachments.filter(a => a.type === "audio").map((audio, i) => (
                                 <div key={i} className="bg-muted/50 p-2 rounded-md border">
                                      <p className="text-xs text-muted-foreground mb-1 font-medium ml-1">Voice Note {i+1}</p>
                                      <audio src={audio.url} controls className="w-full h-8" />
                                 </div>
                             ))}
                        </div>
                      )}

                      {ticket.attachments.some(a => a.type !== "audio") && (
                          <div className="flex gap-3 overflow-x-auto pb-2">
                             {ticket.attachments.filter(a => a.type !== "audio").map((file, i) => (
                                 <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" className="block shrink-0 relative group">
                                     <img src={file.url} className="h-24 w-24 object-cover rounded-lg border hover:opacity-90 transition-opacity" alt="attachment" />
                                 </a>
                             ))}
                          </div>
                      )}
                </div>
             )}
        </div>
    )
}

// --- Ticket Card (Same as before) ---
function TicketCard({ ticket, onAssign, onClick }: any) {
    const status = statusConfig[ticket.status];
    
    return (
        <div onClick={onClick} className="group border rounded-xl p-0 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer bg-card relative overflow-hidden">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", status.bgColor.replace('/10', '').replace('-50', '-500'))} />
            <div className="flex flex-col p-4 pl-5">
                 <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                        <h3 className="font-bold text-lg text-foreground leading-tight">{ticket.customerName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                {ticket.displayId}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimeAgo(ticket.createdAt)}
                            </span>
                        </div>
                    </div>
                    <Badge variant="outline" className={cn("flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider", status.bgColor, status.color, status.borderColor)}>
                        <status.icon className="h-3.5 w-3.5" />
                        {status.label}
                    </Badge>
                 </div>
                 <div className="mt-1 mb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {ticket.description}
                    </p>
                 </div>
                 <div className="flex items-center justify-between pt-3 border-t border-dashed">
                    <div className="flex items-center">
                        {ticket.machineCode ? (
                            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-medium border border-blue-100">
                                <Monitor className="h-3.5 w-3.5" />
                                {ticket.machineCode}
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground italic">No Machine Code</div>
                        )}
                    </div>
                    {ticket.status === 'new' && (
                        <Button onClick={(e) => { e.stopPropagation(); onAssign(e); }} size="sm" className="h-8 text-xs gap-1.5 shadow-sm">
                            <User className="h-3.5 w-3.5" /> Assign
                        </Button>
                    )}
                 </div>
            </div>
        </div>
    )
}
import { useState, useEffect } from 'react';
import { 
  Search, User, Clock, CheckCircle2, XCircle, ArrowRight, 
  Calendar, UploadCloud, Monitor, UserCheck, LayoutGrid, List, 
  Download, ChevronLeft, ChevronRight, FileSpreadsheet, Eye,
  Trash2, AlertTriangle, CheckSquare, Square, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useStore, Ticket } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// --- Configuration ---

type TicketStatus = 'new' | 'assigned' | 'in-progress' | 'completed' | 'declined';

const ITEMS_PER_PAGE = 30;
const REFRESH_INTERVAL = 5000; // 5 Seconds

const statusConfig: Record<TicketStatus, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  new: { label: 'Unassigned', color: 'text-slate-600', bgColor: 'bg-slate-100', borderColor: 'border-slate-200', icon: Clock },
  assigned: { label: 'Assigned', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: User },
  'in-progress': { label: 'In Progress', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: ArrowRight },
  completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'text-red-600', bgColor: 'bg-slate-100', borderColor: 'border-slate-200', icon: XCircle },
};

const priorityConfig: Record<Ticket['priority'], { label: string; color: string; bgColor: string; borderColor: string }> = {
  low: { label: 'Low', color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' },
  medium: { label: 'Medium', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  urgent: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
};

// --- Helper Functions ---

function getSafeDate(date: any): Date {
    return date instanceof Date ? date : (date as any)?.toDate ? (date as any).toDate() : new Date(date);
}

function formatTimeAgo(date: any): string {
    if (!date) return '';
    const d = getSafeDate(date);
    const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDate(date: any): string {
    if (!date) return 'N/A';
    const d = getSafeDate(date);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(d);
}

// --- Check freshness (< 20 mins) ---
function isTicketNew(date: any): boolean {
    if (!date) return false;
    const d = getSafeDate(date);
    const now = new Date();
    const diffInMinutes = (now.getTime() - d.getTime()) / 1000 / 60;
    return diffInMinutes < 20; 
}

// --- Main Component ---

export default function Tickets() {
  const { tickets, technicians, listenToTickets, listenToTechnicians, updateTicket, addInternalNote } = useStore();
  const { toast } = useToast();
  
  // --- Auto-Refresh Logic (Now Real-time Listeners) ---
  useEffect(() => {
    const unsubTickets = listenToTickets();
    const unsubTechs = listenToTechnicians();

    return () => {
      unsubTickets();
      unsubTechs();
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TicketStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dialog States
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Selection States
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const { deleteTickets } = useStore();

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

  const handleExport = () => {
    if (!dateRange.start || !dateRange.end) {
        toast({ title: "Error", description: "Please select both start and end dates.", variant: "destructive" });
        return;
    }

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59);

    const ticketsToExport = tickets.filter(t => {
        const tDate = getSafeDate(t.createdAt);
        return tDate >= start && tDate <= end;
    });

    if (ticketsToExport.length === 0) {
        toast({ title: "No Data", description: "No tickets found in this date range." });
        return;
    }

    const csvContent = [
        ["Ticket ID", "Date", "Customer", "Machine", "Status", "Technician", "Description"],
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

  const openDetailsDialog = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setDetailsDialogOpen(true);
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedTickets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedTickets.map(t => t.id));
    }
  };

  const handleDeleteTickets = async (ids: string[]) => {
    setIsDeleting(true);
    try {
      await deleteTickets(ids);
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
      toast({
        title: "Success",
        description: `${ids.length} ticket(s) deleted successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete tickets. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setBulkDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tickets</h1>
          <p className="text-muted-foreground mt-1 text-base">Super Admin View (Read Only)</p>
        </div>
        <div className="flex items-center gap-3">
            {viewMode === 'grid' && (
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-9 px-3 gap-2 hidden md:flex",
                        selectedIds.length === paginatedTickets.length && paginatedTickets.length > 0 && "bg-blue-50 border-blue-200 text-blue-600"
                    )}
                    onClick={toggleSelectAll}
                >
                    {selectedIds.length === paginatedTickets.length && paginatedTickets.length > 0 ? (
                        <CheckSquare className="h-4 w-4" />
                    ) : (
                        <Square className="h-4 w-4" />
                    )}
                    Select All
                </Button>
            )}

            <div className="hidden md:flex bg-muted p-1 rounded-lg border">
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
            
            <Button variant="outline" size="sm" className="gap-2 h-9 px-4 text-sm" onClick={() => setExportDialogOpen(true)}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
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
                    <motion.div 
                        className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                        initial="hidden"
                        animate="show"
                        variants={{
                            show: {
                                transition: {
                                    staggerChildren: 0.05
                                }
                            }
                        }}
                    >
                        {paginatedTickets.map((ticket) => (
                            <motion.div
                                key={ticket.id}
                                variants={{
                                    hidden: { opacity: 0, scale: 0.95 },
                                    show: { opacity: 1, scale: 1 }
                                }}
                            >
                                <TicketCard
                                    ticket={ticket}
                                    isSelected={selectedIds.includes(ticket.id)}
                                    onSelect={(e) => toggleSelect(ticket.id, e)}
                                    onClick={() => openDetailsDialog(ticket)}
                                />
                            </motion.div>
                        ))}
                    </motion.div>
                )}

                {/* --- TABLE VIEW --- */}
                {viewMode === 'table' && (
                    <div className="rounded-lg border shadow-sm bg-white overflow-hidden">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="h-12 px-4 py-3 border-b border-r w-[50px] text-center">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-8 w-8 p-0"
                                                onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }}
                                            >
                                                {selectedIds.length === paginatedTickets.length && paginatedTickets.length > 0 ? (
                                                    <CheckSquare className="h-4 w-4 text-blue-600" />
                                                ) : (
                                                    <Square className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </th>
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
                                        const isNew = isTicketNew(ticket.createdAt); 
                                        
                                        // Machine Code Parsing
                                        const machineParts = ticket.machineCode ? ticket.machineCode.split('|') : [];
                                        const serialNumber = machineParts[0]?.trim() || ticket.machineCode;
                                        const modelName = machineParts[1]?.trim();

                                        return (
                                            <tr 
                                                key={ticket.id} 
                                                className={cn(
                                                    "group transition-colors cursor-pointer border-l-2", 
                                                    // Dynamic Background Logic: New vs Standard Zebra
                                                    isNew 
                                                        ? "border-l-blue-500 bg-blue-50/20" 
                                                        : cn(index % 2 === 0 ? "bg-white" : "bg-slate-50/40", "border-l-transparent"),
                                                    "hover:bg-slate-100"
                                                )}
                                                onClick={() => openDetailsDialog(ticket)}
                                            >
                                                {/* Checkbox */}
                                                <td className="p-4 border-b border-r last:border-r-0 align-top text-center" onClick={(e) => e.stopPropagation()}>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => toggleSelect(ticket.id)}
                                                    >
                                                        {selectedIds.includes(ticket.id) ? (
                                                            <CheckSquare className="h-4 w-4 text-blue-600" />
                                                        ) : (
                                                            <Square className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </td>
                                                
                                                {/* ID */}
                                                <td className="p-4 border-b border-r last:border-r-0 align-top">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn("font-mono font-bold text-sm", isNew ? "text-blue-700" : "text-slate-700")}>
                                                            {ticket.displayId}
                                                        </span>
                                                        {/* Small Dot Indicator for New Tickets */}
                                                        {isNew && (
                                                             <span className="h-1.5 w-1.5 rounded-full bg-blue-500" title="New Ticket" />
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Date */}
                                                <td className="p-4 border-b border-r last:border-r-0 align-top text-slate-600">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-sm text-slate-900">
                                                            {formatDate(ticket.createdAt).split(',')[0]}
                                                        </span>
                                                        <span className="text-xs text-slate-500 mt-0.5">
                                                            {formatDate(ticket.createdAt).split(',')[1]}
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
                                                            <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                                {serialNumber}
                                                            </span>
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

                                                {/* Actions - READ ONLY VIEW */}
                                                <td className="p-4 border-b align-top text-center">
                                                    <Button size="sm" variant="ghost" className="h-9 w-full text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 gap-2">
                                                        <Eye className="h-3.5 w-3.5" /> View
                                                    </Button>
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

      {/* DETAIL DIALOG */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="hidden">
                <DialogTitle>Ticket Details</DialogTitle>
                <DialogDescription>Full ticket information</DialogDescription>
            </DialogHeader>
            {selectedTicket && (
                <TicketDetailView 
                    ticket={selectedTicket} 
                    technicians={technicians} 
                />
            )}
        </DialogContent>
      </Dialog>

      {/* EXPORT DIALOG */}
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

      {/* BULK ACTION BAR */}
      {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 z-50">
              <span className="text-sm font-medium">{selectedIds.length} tickets selected</span>
              <div className="h-6 w-px bg-slate-700" />
              <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white hover:bg-slate-800 hover:text-white"
                    onClick={() => setSelectedIds([])}
                  >
                      Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => setBulkDeleteConfirmOpen(true)}
                  >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                  </Button>
              </div>
          </div>
      )}

      {/* BULK DELETE CONFIRMATION */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      Delete {selectedIds.length} Tickets?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                      This will permanently delete the selected tickets and all their Cloudinary attachments. This action cannot be undone.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => handleDeleteTickets(selectedIds)}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeleting}
                  >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Delete"}
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Ticket Detail Component ---
// --- Ticket Detail Component ---
function TicketDetailView({ ticket, technicians }: { ticket: Ticket, technicians: any[] }) {
    const { updateTicket, addInternalNote } = useStore();
    const [note, setNote] = useState('');
    const status = statusConfig[ticket.status];
    const priority = priorityConfig[ticket.priority];
    
    const assignedTech = ticket.assignedToId 
        ? technicians.find(t => t.id === ticket.assignedToId) 
        : null;

    const handleAddNote = () => {
        if (!note.trim()) return;
        addInternalNote(ticket.id, note);
        setNote('');
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Header Section */}
            <div className="flex flex-col gap-4 border-b pb-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <span className="font-mono text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded uppercase tracking-tighter">
                            {ticket.displayId}
                        </span>
                        <h2 className="text-2xl font-bold text-foreground mt-2">{ticket.customerName}</h2>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={cn("h-7 px-3 text-xs font-bold uppercase tracking-widest", status.bgColor, status.color, status.borderColor)}>
                            {status.label}
                        </Badge>
                        <Select 
                            value={ticket.priority} 
                            onValueChange={(v: any) => updateTicket(ticket.id, { priority: v })}
                        >
                            <SelectTrigger className={cn("h-7 w-[100px] text-[10px] font-bold uppercase", priority.bgColor, priority.color, priority.borderColor)}>
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(ticket.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        <span className="font-medium text-foreground">{ticket.title}</span>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="notes" className="relative">
                        Internal Notes
                        {ticket.internalNotes && ticket.internalNotes.length > 0 && (
                            <span className="ml-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                                {ticket.internalNotes.length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-6">
                    {/* Assignment Info */}
                    {(ticket.status !== 'new') && (
                        <div className="bg-muted/30 border border-border rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <UserCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Technician</p>
                                    <p className="text-sm font-semibold">{assignedTech?.name || 'Unknown'}</p>
                                </div>
                            </div>
                            {ticket.assignedAt && (
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned At</p>
                                    <p className="text-xs font-medium">{formatDate(ticket.assignedAt)}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Machine & Description */}
                    <div className="space-y-4">
                        {ticket.machineCode && (
                            <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                                <Monitor className="h-5 w-5 text-blue-600" />
                                <div>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Machine Serial / Model</p>
                                    <p className="font-mono text-sm font-bold text-blue-900">{ticket.machineCode}</p>
                                </div>
                            </div>
                        )}
                        <div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Description</h3>
                            <div className="text-sm leading-relaxed text-foreground bg-muted/20 p-4 rounded-xl border border-border/50">
                                {ticket.description}
                            </div>
                        </div>
                    </div>

                    {/* Attachments */}
                    {ticket.attachments && ticket.attachments.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <UploadCloud className="h-4 w-4" /> Attachments
                            </h3>
                            <div className="flex flex-wrap gap-3">
                                {ticket.attachments.map((file, i) => (
                                    <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" className="group relative">
                                        {file.type === 'audio' ? (
                                            <div className="h-20 w-48 bg-muted rounded-lg flex items-center justify-center p-3 border">
                                                <audio src={file.url} controls className="w-full h-8" />
                                            </div>
                                        ) : (
                                            <img src={file.url} className="h-20 w-20 object-cover rounded-lg border hover:opacity-80 transition-all" alt="att" />
                                        )}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="notes" className="space-y-4">
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {!ticket.internalNotes || ticket.internalNotes.length === 0 ? (
                            <p className="text-center py-8 text-sm text-muted-foreground italic">No internal notes yet.</p>
                        ) : (
                            ticket.internalNotes.map((note) => (
                                <div key={note.id} className="bg-muted/40 p-3 rounded-lg border border-border/50">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-bold text-primary uppercase">{note.author}</span>
                                        <span className="text-[10px] text-muted-foreground">{formatTimeAgo(note.timestamp)}</span>
                                    </div>
                                    <p className="text-sm text-foreground">{note.text}</p>
                                </div>
                            ))
                        )}
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                        <Input 
                            placeholder="Add an internal note..." 
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                            className="text-sm"
                        />
                        <Button size="sm" onClick={handleAddNote}>
                            Add
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// --- Ticket Card (Updated with standard border, no glow) ---
function TicketCard({ ticket, onClick, isSelected, onSelect }: any) {
    const status = statusConfig[ticket.status as TicketStatus];
    const priority = priorityConfig[ticket.priority as Ticket['priority']];
    const isNew = isTicketNew(ticket.createdAt);
    
    return (
        <div 
            onClick={onClick} 
            className={cn(
                "group border rounded-xl p-0 transition-all cursor-pointer bg-card relative overflow-hidden hover:shadow-lg hover:border-primary/30",
                isSelected && "border-blue-500 ring-1 ring-blue-500 bg-blue-50/10"
            )}
        >
            <div className={cn("absolute left-0 top-0 bottom-0 w-1", status.bgColor.replace('/10', '').replace('-50', '-500'))} />
            
            <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 bg-white shadow-sm border"
                    onClick={onSelect}
                >
                    {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                        <Square className="h-4 w-4" />
                    )}
                </Button>
            </div>

            <div className="flex flex-col p-4 pl-5">
                 <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col gap-1.5">
                        <h3 className="font-bold text-lg text-foreground leading-tight line-clamp-1">{ticket.customerName}</h3>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                                {ticket.displayId}
                            </span>
                            
                            {isNew && (
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                            )}

                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimeAgo(ticket.createdAt)}
                            </span>
                        </div>
                    </div>
                    <Badge variant="outline" className={cn("whitespace-nowrap px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", status.bgColor, status.color, status.borderColor)}>
                        {status.label}
                    </Badge>
                 </div>
                 
                 <div className="mt-2 mb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 min-h-[40px]">
                        {ticket.description}
                    </p>
                 </div>

                 <div className="flex items-center justify-between pt-3 border-t border-dashed border-border/60">
                    <div className="flex items-center gap-2">
                         <Badge variant="outline" className={cn("h-5 text-[9px] px-1.5", priority.bgColor, priority.color, priority.borderColor)}>
                            {priority.label}
                        </Badge>
                        {ticket.machineCode && (
                            <div className="flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                                <Monitor className="h-3 w-3" />
                                {ticket.machineCode.split('|')[0]}
                            </div>
                        )}
                    </div>
                    {ticket.assignedToName && (
                        <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                                {ticket.assignedToName.substring(0,2).toUpperCase()}
                            </div>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    );
}
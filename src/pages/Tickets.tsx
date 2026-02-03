// Admin view: manage & assign tickets only. Creation happens via customer flow.

import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  MapPin, 
  User, 
  Phone,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  MoreHorizontal,
  Play,
  Pause,
  FileAudio,
  Image as ImageIcon,
  Calendar,
  Mic,
  StopCircle,
  UploadCloud,
  Trash2,
  Loader2,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Ensure you have this component
import { Textarea } from '@/components/ui/textarea'; // Ensure you have this component (or use Input)
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

import { useStore, Ticket } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// --- FIREBASE IMPORTS ---
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../firebase"; // Adjust path to your firebase config

// --- Configuration ---

type TicketStatus = 'new' | 'assigned' | 'in-progress' | 'completed' | 'declined';

const statusConfig: Record<TicketStatus, { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  new: { label: 'New', color: 'text-primary', bgColor: 'bg-primary/10', icon: Clock },
  assigned: { label: 'Assigned', color: 'text-accent-foreground', bgColor: 'bg-accent', icon: User },
  'in-progress': { label: 'In Progress', color: 'text-warning', bgColor: 'bg-warning/10', icon: ArrowRight },
  completed: { label: 'Completed', color: 'text-success', bgColor: 'bg-success/10', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'text-destructive', bgColor: 'bg-destructive/10', icon: XCircle },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'Medium', color: 'bg-primary/10 text-primary' },
  high: { label: 'High', color: 'bg-warning/10 text-warning' },
  urgent: { label: 'Urgent', color: 'bg-destructive/10 text-destructive' },
};

// --- Helper Functions ---

function formatTimeAgo(date: Date): string {
    // Handle Firestore Timestamp or JS Date
    const d = date instanceof Date ? date : (date as any)?.toDate ? (date as any).toDate() : new Date();
    const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDate(date: Date): string {
    const d = date instanceof Date ? date : (date as any)?.toDate ? (date as any).toDate() : new Date();
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(d);
}

// --- Components ---

export default function Tickets() {
  const { tickets, technicians, assignTicket, fetchTickets, fetchTechnicians, updateTicket } = useStore();
  const { toast } = useToast();
  
  useEffect(() => {
    fetchTickets();
    fetchTechnicians();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TicketStatus | 'all'>('all');
  
  // Dialog States
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Selection States
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState('');

  // --- CREATE TICKET STATES ---
  const [isCreating, setIsCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    customerName: '',
    machineCode: '',
    priority: 'medium',
    location: ''
  });
  
  // Media States
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- AUDIO RECORDING LOGIC ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast({ title: "Error", description: "Could not access microphone.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- SUBMIT TICKET LOGIC ---
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const attachments = [];

      // 1. Upload Files
      for (const file of selectedFiles) {
        const fileRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        
        let type = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        
        attachments.push({ type, url, name: file.name });
      }

      // 2. Upload Audio
      if (audioBlob) {
        const audioRef = ref(storage, `voice_notes/${Date.now()}_voice.webm`);
        await uploadBytes(audioRef, audioBlob);
        const url = await getDownloadURL(audioRef);
        attachments.push({ type: 'audio', url, name: 'Voice Note' });
      }

      // 3. Create Ticket in Firestore
      // Note: We use 'addDoc' directly here to ensure it hits the DB. 
      // Ideally this logic should be in your store, but for "code to be added" request, this works standalone.
      await addDoc(collection(db, "tickets"), {
        ...newTicket,
        status: 'new',
        displayId: `TKT-${Math.floor(1000 + Math.random() * 9000)}`, // Simple ID gen
        attachments,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Success", description: "Ticket created successfully!" });
      


    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to create ticket", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  // --- EXISTING LOGIC ---
  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.displayId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || ticket.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const ticketCounts: Record<TicketStatus | 'all', number> = {
    all: tickets.length,
    new: tickets.filter((t) => t.status === 'new').length,
    assigned: tickets.filter((t) => t.status === 'assigned').length,
    'in-progress': tickets.filter((t) => t.status === 'in-progress').length,
    completed: tickets.filter((t) => t.status === 'completed').length,
    declined: tickets.filter((t) => t.status === 'declined').length,
  };

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
          <p className="text-muted-foreground mt-1">Manage and assign service tickets</p>
        </div>
        
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TicketStatus | 'all')} className="w-full lg:w-auto">
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full lg:w-auto">
                {['all', 'new', 'assigned', 'in-progress', 'completed', 'declined'].map((tab) => (
                    <TabsTrigger key={tab} value={tab} className="text-xs sm:text-sm capitalize relative">
                        {tab.replace('-', ' ')} ({ticketCounts[tab as keyof typeof ticketCounts]})
                        {tab === 'declined' && ticketCounts.declined > 0 && (
                            <span className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full" />
                        )}
                    </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {filteredTickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No tickets found
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onAssign={(e) => openAssignDialog(e, ticket)}
                  onClick={() => openDetailsDialog(ticket)}
                  onStatusChange={(status) => {
                    updateTicket(ticket.id, { status });
                    toast({
                      title: 'Status updated',
                      description: `Ticket ${ticket.id} is now ${status}`,
                    });
                  }}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

               

      {/* --- Ticket Details Dialog --- */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedTicket && <TicketDetailView ticket={selectedTicket} />}
        </DialogContent>
      </Dialog>

      {/* --- Assign Dialog --- */}
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
    </div>
  );
}

// ... Keep your TicketDetailView and TicketCard components exactly as they were ...
// (I have omitted them here to save space, but you MUST keep them in the file)

// --- Ticket Detail Component ---
function TicketDetailView({ ticket }: { ticket: Ticket }) {
    // ... Copy from your previous code ...
    const status = statusConfig[ticket.status];
    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between border-b pb-4">
                <div>
                     <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2", status.bgColor, status.color)}>
                        {status.label}
                    </div>
                    <h2 className="text-2xl font-bold">{ticket.title}</h2>
                    <div className="flex items-center gap-2 text-muted-foreground mt-1 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>Date: {formatDate(ticket.createdAt)}</span>
                        <span className="mx-1">•</span>
                        <span className="font-mono">{ticket.displayId}</span>
                    </div>
                </div>
            </div>
            {/* ... Rest of details ... */}
             <div className="space-y-2">
                <h3 className="font-semibold text-lg">Description</h3>
                <p className="text-muted-foreground text-sm">{ticket.description}</p>
            </div>
            {/* Show Audio/Media if exists */}
             {ticket.attachments?.some(a => a.type === "audio") && (
                <div className="space-y-2">
                     <h3 className="font-semibold text-lg">Voice Note</h3>
                     {ticket.attachments.filter(a => a.type === "audio").map((audio, i) => (
                         <audio key={i} src={audio.url} controls className="w-full" />
                     ))}
                </div>
             )}
             {ticket.attachments?.some(a => a.type !== "audio") && (
                 <div className="space-y-2">
                     <h3 className="font-semibold text-lg">Attachments</h3>
                     <div className="flex gap-4 overflow-x-auto pb-2">
                         {ticket.attachments.filter(a => a.type !== "audio").map((file, i) => (
                             <img key={i} src={file.url} className="h-24 rounded-lg border" />
                         ))}
                     </div>
                 </div>
             )}
        </div>
    )
}

function TicketCard({ ticket, onAssign, onStatusChange, onClick }: any) {
    // ... Copy from your previous code ...
    const status = statusConfig[ticket.status];
    const priority = priorityConfig[ticket.priority];
    return (
        <div onClick={onClick} className="border rounded-lg p-4 hover:shadow-card-hover transition-all cursor-pointer bg-card">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                 <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className={cn('p-2 rounded-lg flex-shrink-0', status.bgColor)}>
                            <status.icon className={cn('h-4 w-4', status.color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                             <h3 className="font-semibold text-foreground mt-1">{ticket.title}</h3>
                             <p className="text-sm text-muted-foreground line-clamp-1">{ticket.description}</p>
                        </div>
                    </div>
                 </div>
                 {/* ... Actions ... */}
                  {ticket.status === 'new' && (
                    <Button onClick={(e) => { e.stopPropagation(); onAssign(e); }} size="sm" className="gap-1.5">
                        <User className="h-3.5 w-3.5" /> Assign
                    </Button>
                  )}
            </div>
        </div>
    )
}
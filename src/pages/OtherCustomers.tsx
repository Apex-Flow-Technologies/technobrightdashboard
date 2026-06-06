import { useState, useEffect, useRef, useMemo } from "react";
import { 
  Plus, Search, Calendar, Clock, User, ArrowRight, CheckCircle2, 
  XCircle, ChevronLeft, ChevronRight, Eye, Trash2, Mic, Play, Pause, 
  Image as ImageIcon, FileAudio, Loader2, Sparkles
} from "lucide-react";
import { useStore, Ticket } from "@/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ITEMS_PER_PAGE = 15;

const statusConfig = {
  new: { label: "Unassigned", color: "text-slate-600", bgColor: "bg-slate-100", borderColor: "border-slate-200", icon: Clock },
  assigned: { label: "Assigned", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200", icon: User },
  "in-progress": { label: "In Progress", color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-200", icon: ArrowRight },
  completed: { label: "Completed", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-200", icon: CheckCircle2 },
  declined: { label: "Declined", color: "text-red-600", bgColor: "bg-slate-100", borderColor: "border-slate-200", icon: XCircle },
};

const priorityConfig = {
  low: { label: "Low", color: "text-slate-600", bgColor: "bg-slate-50", borderColor: "border-slate-200" },
  medium: { label: "Medium", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
  high: { label: "High", color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
  urgent: { label: "Urgent", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
};

// --- Custom Audio Visualizer Component (Bounce wave) ---
const Visualizer = () => (
  <div className="flex items-center gap-1 h-6 px-1.5">
    <div className="w-1 bg-red-500 rounded-full animate-bounce h-3" style={{ animationDelay: "0.1s", animationDuration: "0.6s" }} />
    <div className="w-1 bg-red-500 rounded-full animate-bounce h-5" style={{ animationDelay: "0.2s", animationDuration: "0.4s" }} />
    <div className="w-1 bg-red-500 rounded-full animate-bounce h-4" style={{ animationDelay: "0.3s", animationDuration: "0.5s" }} />
    <div className="w-1 bg-red-500 rounded-full animate-bounce h-6" style={{ animationDelay: "0.4s", animationDuration: "0.3s" }} />
    <div className="w-1 bg-red-500 rounded-full animate-bounce h-3" style={{ animationDelay: "0.5s", animationDuration: "0.7s" }} />
  </div>
);

// --- Custom Audio Player for previews ---
const AudioPlayer = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handleEnd = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnd);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnd);
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 bg-muted/60 p-2 rounded-lg border border-border w-full">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 shrink-0"
        onClick={togglePlay}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-primary" />}
      </Button>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground font-semibold">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default function OtherCustomers() {
  const { tickets, listenToTickets, addOtherCustomerTicket, deleteTickets } = useStore();
  const { toast } = useToast();

  // Load Tickets
  useEffect(() => {
    const unsub = listenToTickets();
    return () => unsub();
  }, []);

  // --- STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Form State
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    machineCode: "",
    description: "",
    priority: "medium" as Ticket["priority"],
  });

  // Attachments State
  const [attachedFiles, setAttachedFiles] = useState<Array<{ file: File | Blob; name: string; type: "image" | "audio"; previewUrl: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recorderTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- FILTER & STATS ---
  const otherTickets = useMemo(() => {
    return tickets.filter((t) => t.isOtherCustomer === true);
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return otherTickets;
    return otherTickets.filter((t) => 
      t.customerName.toLowerCase().includes(q) ||
      t.displayId.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.machineCode?.toLowerCase().includes(q)
    );
  }, [otherTickets, searchQuery]);

  const stats = useMemo(() => {
    const total = otherTickets.length;
    const unassigned = otherTickets.filter((t) => t.status === "new").length;
    const inProgress = otherTickets.filter((t) => t.status === "in-progress").length;
    const completed = otherTickets.filter((t) => t.status === "completed").length;
    return { total, unassigned, inProgress, completed };
  }, [otherTickets]);

  // Pagination
  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = useMemo(() => {
    return filteredTickets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredTickets, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // --- VOICE RECORDING HANDLERS ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const previewUrl = URL.createObjectURL(blob);
        const name = `Voice_Note_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
        setAttachedFiles((prev) => [...prev, { file: blob, name, type: "audio", previewUrl }]);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      recorderTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      toast({
        title: "Mic Error",
        description: "Failed to access browser microphone. Check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      if (recorderTimerRef.current) clearInterval(recorderTimerRef.current);
    }
  };

  // --- FILE ATTACHMENT HANDLERS ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: typeof attachedFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith("image/") ? "image" : "audio";
      const previewUrl = URL.createObjectURL(file);
      newAttachments.push({ file, name: file.name, type, previewUrl });
    }

    setAttachedFiles((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = ""; // Clear file selector
  };

  const removeAttachment = (idx: number) => {
    const item = attachedFiles[idx];
    URL.revokeObjectURL(item.previewUrl); // Clean up memory
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // --- SUBMISSION ---
  const handleRaiseTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim()) {
      toast({ title: "Missing Name", description: "Please enter the customer name.", variant: "destructive" });
      return;
    }
    if (form.customerPhone.replace(/\D/g, "").length !== 10) {
      toast({ title: "Invalid Phone", description: "Please enter a 10-digit phone number.", variant: "destructive" });
      return;
    }
    if (!form.machineCode.trim()) {
      toast({ title: "Missing Machine Details", description: "Please enter details about the machine.", variant: "destructive" });
      return;
    }
    if (!form.description.trim()) {
      toast({ title: "Missing Description", description: "Please enter what is wrong with the machine.", variant: "destructive" });
      return;
    }

    setIsSubmitLoading(true);
    try {
      const filesToUpload = attachedFiles.map((a) => ({ file: a.file, type: a.type }));
      await addOtherCustomerTicket({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        machineCode: form.machineCode,
        description: form.description,
        priority: form.priority,
        files: filesToUpload,
      });

      toast({ title: "Ticket Raised", description: "Service ticket has been created successfully." });
      setCreateOpen(false);
      
      // Reset form
      setForm({
        customerName: "",
        customerPhone: "",
        machineCode: "",
        description: "",
        priority: "medium",
      });
      attachedFiles.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      setAttachedFiles([]);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Failed to Create", description: err.message || "Failed to submit ticket.", variant: "destructive" });
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await deleteTickets([id]);
      toast({ title: "Ticket Deleted" });
      if (selectedTicket?.id === id) setDetailsOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to delete ticket.", variant: "destructive" });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Other Customers</h1>
          <p className="text-muted-foreground">
            Raise and track tickets for one-time customers
          </p>
        </div>
        <Button 
          onClick={() => setCreateOpen(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Raise Ticket
        </Button>
      </div>

      {/* STATS TILES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">Total Tickets</CardDescription>
            <CardTitle className="text-2xl font-bold mt-1">{stats.total}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">Unassigned</CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-700 mt-1">{stats.unassigned}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">In Progress</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600 mt-1">{stats.inProgress}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">Completed</CardDescription>
            <CardTitle className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* FILTER & TICKETS LIST */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Other Customer Tickets</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50 border-b">
              <TableRow>
                <TableHead className="font-semibold text-sm">Ticket ID</TableHead>
                <TableHead className="font-semibold text-sm">Customer</TableHead>
                <TableHead className="font-semibold text-sm">Machine Details</TableHead>
                <TableHead className="font-semibold text-sm w-[110px]">Priority</TableHead>
                <TableHead className="font-semibold text-sm w-[130px]">Status</TableHead>
                <TableHead className="font-semibold text-sm w-[155px]">Date Raised</TableHead>
                <TableHead className="font-semibold text-sm w-[100px] text-center" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No tickets found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTickets.map((t) => {
                  const status = statusConfig[t.status];
                  const priority = priorityConfig[t.priority];
                  const dateLabel = t.createdAt ? new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  }).format(t.createdAt) : "N/A";

                  return (
                    <TableRow 
                      key={t.id} 
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedTicket(t);
                        setDetailsOpen(true);
                      }}
                    >
                      <TableCell className="font-mono font-bold text-xs text-primary">{t.displayId}</TableCell>
                      <TableCell className="font-semibold text-sm">
                        <div>{t.customerName}</div>
                        <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{t.customerPhone}</div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        <span className="bg-blue-50 text-blue-700 font-mono text-xs border border-blue-100 px-1.5 py-0.5 rounded">
                          {t.machineCode}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${priority.color} ${priority.bgColor} ${priority.borderColor} h-6 text-[10px] font-bold uppercase`}>
                          {priority.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${status.color} ${status.bgColor} ${status.borderColor} h-6 text-[10px] font-bold uppercase`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{dateLabel}</TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
                            onClick={() => {
                              setSelectedTicket(t);
                              setDetailsOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-full"
                            onClick={() => handleDelete(t.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* TABLE PAGINATION */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end p-4 border-t gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="h-8"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <span className="text-xs font-semibold px-2">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-8"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- CREATE DIALOG --- */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!isSubmitLoading && !isRecording) setCreateOpen(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle>Raise Ticket</DialogTitle>
            <DialogDescription>
              Submit a service ticket for a one-time customer. All details are saved inside the ticket.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRaiseTicket} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="customerName">Customer Name <span className="text-destructive">*</span></Label>
                <Input
                  id="customerName"
                  placeholder="e.g. John Doe"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  disabled={isSubmitLoading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="customerPhone">Customer Phone <span className="text-destructive">*</span></Label>
                <Input
                  id="customerPhone"
                  placeholder="10-digit phone number"
                  maxLength={10}
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value.replace(/\D/g, "") })}
                  disabled={isSubmitLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="machineCode">Machine Details <span className="text-destructive">*</span></Label>
                <Input
                  id="machineCode"
                  placeholder="e.g. Model X-200, S/N 82"
                  value={form.machineCode}
                  onChange={(e) => setForm({ ...form, machineCode: e.target.value })}
                  disabled={isSubmitLoading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(val) => setForm({ ...form, priority: val as Ticket["priority"] })}
                  disabled={isSubmitLoading}
                >
                  <SelectTrigger id="priority" className="capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low" className="capitalize">Low</SelectItem>
                    <SelectItem value="medium" className="capitalize">Medium</SelectItem>
                    <SelectItem value="high" className="capitalize">High</SelectItem>
                    <SelectItem value="urgent" className="capitalize">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Problem Description <span className="text-destructive">*</span></Label>
              <textarea
                id="description"
                placeholder="Explain the machine issue in detail..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                disabled={isSubmitLoading}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* VOICE NOTE & MEDIA BUTTONS */}
            <div className="border border-border bg-muted/20 p-3 rounded-lg flex flex-col gap-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Media Files</span>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs gap-1.5 bg-background"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitLoading || isRecording}
                >
                  <ImageIcon className="h-4 w-4 text-blue-500" />
                  Attach Files
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  multiple
                  accept="image/*,audio/*"
                />

                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  className="flex-1 text-xs gap-1.5 bg-background relative overflow-hidden"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSubmitLoading}
                >
                  {isRecording ? (
                    <>
                      <Visualizer />
                      <span>{formatDuration(recordingDuration)} Stop</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 text-red-500" />
                      Record Audio
                    </>
                  )}
                </Button>
              </div>

              {/* ATTACHMENT PREVIEW LIST */}
              {attachedFiles.length > 0 && (
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {attachedFiles.map((a, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between bg-card p-2 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {a.type === "image" ? (
                          <div className="h-9 w-9 rounded overflow-hidden border border-border shrink-0">
                            <img src={a.previewUrl} className="h-full w-full object-cover" alt="" />
                          </div>
                        ) : (
                          <div className="h-9 w-9 rounded bg-primary/10 flex items-center justify-center shrink-0">
                            <FileAudio className="h-4.5 w-4.5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate text-foreground">{a.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{a.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.type === "audio" && (
                          <div className="w-[120px]">
                            <AudioPlayer url={a.previewUrl} />
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-full"
                          onClick={() => removeAttachment(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isSubmitLoading || isRecording}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitLoading || isRecording}
              >
                {isSubmitLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Uploading Files...
                  </>
                ) : (
                  "Create Ticket"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- DETAILS DIALOG --- */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selectedTicket && (
            <div className="space-y-5 py-2">
              <DialogHeader>
                <div className="flex justify-between items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                    {selectedTicket.displayId}
                  </span>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className={`${priorityConfig[selectedTicket.priority].color} ${priorityConfig[selectedTicket.priority].bgColor} ${priorityConfig[selectedTicket.priority].borderColor} text-[9px] font-bold uppercase`}>
                      {priorityConfig[selectedTicket.priority].label}
                    </Badge>
                    <Badge variant="outline" className={`${statusConfig[selectedTicket.status].color} ${statusConfig[selectedTicket.status].bgColor} ${statusConfig[selectedTicket.status].borderColor} text-[9px] font-bold uppercase`}>
                      {statusConfig[selectedTicket.status].label}
                    </Badge>
                  </div>
                </div>
                <DialogTitle className="text-xl font-bold mt-2 text-foreground">
                  {selectedTicket.customerName}
                </DialogTitle>
                <DialogDescription className="text-xs font-semibold text-muted-foreground">
                  Phone: {selectedTicket.customerPhone} | Machine: {selectedTicket.machineCode}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Created At */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    Raised: {selectedTicket.createdAt ? new Intl.DateTimeFormat("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    }).format(selectedTicket.createdAt) : "N/A"}
                  </span>
                </div>

                {/* Description */}
                <div className="space-y-1 bg-muted/30 p-3 rounded-lg border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Problem Description</span>
                  <p className="text-sm text-foreground/90 font-medium leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.description}
                  </p>
                </div>

                {/* Media Attachments */}
                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Attachments</span>
                    <div className="flex flex-col gap-2">
                      {selectedTicket.attachments.map((att, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center gap-3 p-2.5 border rounded-lg bg-card"
                        >
                          {att.type === "image" ? (
                            <>
                              <div className="h-10 w-10 rounded overflow-hidden border bg-muted shrink-0">
                                <img src={att.url} className="h-full w-full object-cover" alt="" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">Image File</p>
                                <a 
                                  href={att.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[10px] text-primary font-bold hover:underline"
                                >
                                  View Full Image
                                </a>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                <FileAudio className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">Audio File</p>
                                <div className="mt-1 w-full">
                                  <AudioPlayer url={att.url} />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDetailsOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDelete(selectedTicket.id)}
                  className="bg-destructive hover:bg-destructive/90 gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Ticket
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

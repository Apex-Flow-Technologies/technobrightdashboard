import { useEffect, useState } from "react";
import { 
  Upload, 
  User, 
  Phone, 
  MapPin, 
  Lock, 
  AtSign,
  Plus, 
  MoreHorizontal, 
  Wrench, 
  Search, 
  Trash2, 
  Loader2,
  ArrowUpDown,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Mail
} from "lucide-react";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  doc,
  serverTimestamp,
  deleteDoc,
  onSnapshot,
  writeBatch
} from "firebase/firestore";
import { db } from "@/firebase";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter
} from "@/components/ui/card";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";

const PAGE_SIZE = 50;

export default function Customers() {
  const { toast } = useToast();
  const { addCustomer, updateCustomer, deleteCustomer: removeCustomer } = useStore();

  // ---------------- STATE ----------------
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination & Sort State
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [jumpPage, setJumpPage] = useState("");

  // Add Dialog State
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    username: "",
    password: "",
  });

  // Edit Dialog State
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    username: "",
    password: "",
    uid: "",
  });

  // Bulk Upload State
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ---------------- FETCH DATA (REAL-TIME) ----------------
  
  useEffect(() => {
    setIsLoading(true);
    const q = query(
      collection(db, "user"),
      where("role", "==", "user")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => {
        const docData = d.data() as any;
        let createdAtDate = new Date(0);
        
        if (docData.createdAt) {
          if (typeof docData.createdAt.toDate === 'function') {
            createdAtDate = docData.createdAt.toDate();
          } else {
            createdAtDate = new Date(docData.createdAt);
          }
        }

        return { 
          id: d.id, 
          ...docData,
          createdAt: createdAtDate
        };
      });
      setAllCustomers(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      toast({ title: "Connection Error", description: "Failed to sync customers.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchMachines = async () => {
    try {
      const snap = await getDocs(collection(db, "machines"));
      setMachines(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (error) {
      console.error("Error fetching machines:", error);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  // ---------------- DERIVED STATE ----------------
  const allFiltered = allCustomers.filter(c => {
    const s = search.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(s) ||
      (c.username || "").toLowerCase().includes(s) ||
      (c.phone || "").includes(s)
    );
  });

  const allSorted = [...allFiltered].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'createdAt') {
        valA = valA instanceof Date ? valA.getTime() : new Date(valA).getTime();
        valB = valB instanceof Date ? valB.getTime() : new Date(valB).getTime();
    } else {
        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();
    }

    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const paginatedCustomers = allSorted.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const totalPages = Math.ceil(allFiltered.length / PAGE_SIZE);

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPage = parseInt(jumpPage);
    if (targetPage >= 1 && targetPage <= totalPages) {
        setPage(targetPage);
    }
    setJumpPage("");
  };

  // ---------------- VALIDATION ----------------
  const validateInputs = (data: any, isEditMode: boolean) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.name || data.name.trim().length < 2) return false;
    if (!data.email || !emailRegex.test(data.email)) return false;
    if (!data.username || data.username.trim().length < 3) return false;
    if (!data.phone || data.phone.length !== 10) return false;
    if (!isEditMode && (!data.password || data.password.length < 6)) return false;
    return true;
  };

  // ---------------- HANDLERS ----------------

  const handleEditClick = (customer: any) => {
    setEditCustomer(customer);
    setEditForm({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      username: customer.username || "",
      password: "", 
      uid: customer.uid || "",
    });
  };

  const saveCustomerEdits = async () => {
    if (!editCustomer?.id) {
        toast({ title: "Update Error", description: "Missing user ID.", variant: "destructive" });
        return;
    }

    if (!validateInputs(editForm, true)) {
      toast({ title: "Validation Error", description: "Please fix inputs.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await updateCustomer(editCustomer.id, editForm);
      toast({ title: "Customer updated successfully" });
      setEditCustomer(null);
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const createCustomer = async () => {
    if (!validateInputs(form, false)) {
      toast({ title: "Validation Error", description: "Check fields.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await addCustomer(form);
      toast({ title: "Customer created successfully" });
      setForm({ name: "", email: "", phone: "", address: "", username: "", password: "" });
      setAddOpen(false);
    } catch (error: any) {
      toast({ title: "Failed to create", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const assignMachine = async (machineId: string) => {
    if (!editCustomer?.id) return;
    try {
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, assignedTo: editCustomer.id } : m));
      await updateDoc(doc(db, "machines", machineId), { assignedTo: editCustomer.id });
      toast({ title: "Machine assigned successfully" });
    } catch (error: any) {
      console.error("Assign failed", error);
      toast({ title: "Assignment failed", description: error.message, variant: "destructive" });
      // Revert local state
      fetchMachines();
    }
  };

  const unassignMachine = async (machineId: string) => {
    try {
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, assignedTo: null } : m));
      await updateDoc(doc(db, "machines", machineId), { assignedTo: null });
      toast({ title: "Machine unassigned successfully" });
    } catch (error: any) {
      console.error("Unassign failed", error);
      toast({ title: "Unassign failed", description: error.message, variant: "destructive" });
      fetchMachines();
    }
  };

  const deleteCustomer = async (customer: any) => {
    // Temporarily removing confirm to ensure it's not the blocker
    console.log("Page: deleteCustomer called for", customer.name);
    
    try {
        const related = machines.filter((m) => m.assignedTo === customer.id);
        for (const m of related) {
          await updateDoc(doc(db, "machines", m.id), { assignedTo: null });
        }
        await removeCustomer(customer.id, customer.uid);
        toast({ title: "Customer deleted successfully" });
    } catch (error: any) {
        console.error("Delete failed", error);
        toast({ title: "Error deleting customer", description: error.message, variant: "destructive" });
    }
  };

  // ---------------- HELPERS ----------------
  const getMachineLabel = (m: any) => m?.machineCode || "Unnamed Machine";

  const assignedMachines = (customerId: string) =>
    machines.filter((m) => m.assignedTo === customerId);

  const availableMachines = () =>
    machines
      .filter((m) => !m.assignedTo)
      .sort((a, b) => (b.machineCode || "").localeCompare(a.machineCode || ""));

  const handleSort = (field: string) => {
      if (sortField === field) {
          setSortDir(sortDir === "asc" ? "desc" : "asc");
      } else {
          setSortField(field);
          setSortDir("asc");
      }
      setPage(1);
  };

  // ---------------- BATCH UPLOAD FUNCTION ----------------
  const uploadInBatches = async (rows: any[]) => {
    const CHUNK_SIZE = 50; // Smaller chunks for Auth creation
    const chunks = [];
    
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        chunks.push(rows.slice(i, i + CHUNK_SIZE));
    }

    let totalDone = 0;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

    for (const chunk of chunks) {
        const usersToCreate = chunk.map((r: any) => ({
            name: r.name || "Unknown",
            username: (r.username || r.name || "user").toLowerCase().replace(/\s+/g, ''),
            password: r.password || "Apex@123456", // Default password for bulk upload
            phone: String(r.phone || "").replace(/\D/g, '').slice(0, 10),
            address: r.address || "",
            legacyCustomerId: r.legacyCustomerId || null,
            role: "user"
        }));

        const response = await fetch(`${backendUrl}/api/users/bulk-create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: usersToCreate }),
        });

        if (!response.ok) {
            console.error("Bulk upload chunk failed");
        }

        totalDone += chunk.length;
        setUploadProgress(Math.round((totalDone / rows.length) * 100));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage customers and assign machines</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="border-green-600 text-green-600" 
            onClick={() => setBulkOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" /> 
            Bulk Upload
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Customer
          </Button>
        </div>
      </div>

      {/* CUSTOMER TABLE */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Customer List <span className="ml-2 text-sm text-muted-foreground font-normal">({search ? 'Search Results' : allFiltered.length + ' total'})</span></CardTitle>
            
            <div className="flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <ArrowUpDown className="h-4 w-4" /> Sort
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleSort("name")}>
                            Name {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSort("createdAt")}>
                            Date Created {sortField === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead 
                    className="cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-2">
                      Full Name
                      {sortField === "name" && (
                        <ArrowUpDown className={cn("h-4 w-4", sortDir === "desc" ? "rotate-180" : "")} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort("username")}
                  >
                     <div className="flex items-center gap-2">
                      Username
                      {sortField === "username" && (
                        <ArrowUpDown className={cn("h-4 w-4", sortDir === "desc" ? "rotate-180" : "")} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Machines</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><div className="h-4 w-32 bg-slate-100 rounded animate-pulse"/></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-100 rounded animate-pulse"/></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-100 rounded animate-pulse"/></TableCell>
                            <TableCell><div className="h-4 w-8 bg-slate-100 rounded animate-pulse"/></TableCell>
                            <TableCell/>
                        </TableRow>
                    ))
                ) : paginatedCustomers.length === 0 ? (
                   <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                          {search ? "No customers found matching that name." : "No customers found."}
                      </TableCell>
                   </TableRow>
                ) : (
                  paginatedCustomers.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.email || "-"}</TableCell>
                      <TableCell>{c.username || "-"}</TableCell>
                      <TableCell>{c.phone || "-"}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center justify-center bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                          {assignedMachines(c.id).length}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClick(c)}>
                              <Wrench className="mr-2 h-4 w-4" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteCustomer(c)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-border">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="p-4 space-y-3">
                  <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse"/>
                  <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse"/>
                </div>
              ))
            ) : paginatedCustomers.map((c) => (
              <div key={c.id} className="p-4 space-y-3 active:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">@{c.username || 'no-username'}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 -mr-2">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => handleEditClick(c)}>
                        <Wrench className="mr-2 h-4 w-4" /> Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive" 
                        onClick={() => deleteCustomer(c)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contact</p>
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      {c.phone || 'N/A'}
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Machines</p>
                    <div className="inline-flex items-center gap-1.5 font-bold text-primary">
                      <Wrench className="h-3.5 w-3.5" />
                      {assignedMachines(c.id).length}
                    </div>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{c.email || 'No email provided'}</span>
                </div>
              </div>
            ))}
            {paginatedCustomers.length === 0 && !isLoading && (
              <div className="py-20 text-center">
                <p className="text-muted-foreground">No customers found</p>
              </div>
            )}
          </div>
        </CardContent>
        
        {/* RIGHT ALIGNED PAGINATION */}
        <CardFooter className="flex items-center justify-end gap-6 border-t py-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Go to:</span>
                    <form onSubmit={handleJumpToPage} className="flex items-center">
                        <Input 
                            type="number" 
                            min={1} 
                            max={totalPages} 
                            value={jumpPage}
                            onChange={(e) => setJumpPage(e.target.value)}
                            className="h-8 w-16 text-center"
                            placeholder="#"
                        />
                    </form>
                </div>

                <div className="text-sm font-medium">
                    Page {page} of {totalPages || 1}
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || isLoading}>
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </CardFooter>
      </Card>

      {/* ---------------- ADD DIALOG ---------------- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="John Doe" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email Address <span className="text-red-500">*</span></Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="customer@example.com" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone (10 digits) <span className="text-red-500">*</span></Label>
                <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        className="pl-9" 
                        placeholder="9876543210" 
                        value={form.phone} 
                        maxLength={10}
                        onChange={(e) => setForm({...form, phone: e.target.value.replace(/\D/g, '')})} 
                    />
                </div>
              </div>
            </div>
            <div className="space-y-2">
                <Label>Address</Label>
                <Input placeholder="City, State" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>App Username <span className="text-red-500">*</span></Label>
                    <div className="relative">
                        <AtSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" placeholder="user123" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Password <span className="text-red-500">*</span></Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" type="password" placeholder="••••••" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} />
                    </div>
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={createCustomer} disabled={isSaving}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- EDIT DIALOG ---------------- */}
      <Dialog open={!!editCustomer} onOpenChange={() => setEditCustomer(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update details and manage machine assignments.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-name">Full Name</Label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="edit-name" className="pl-9" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-email">Email Address <span className="text-red-500">*</span></Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="edit-email" className="pl-9" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone (10 digits) <span className="text-red-500">*</span></Label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="edit-phone" 
                            className="pl-9" 
                            value={editForm.phone} 
                            maxLength={10}
                            onChange={(e) => setEditForm({...editForm, phone: e.target.value.replace(/\D/g, '')})} 
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="edit-address" className="pl-9" value={editForm.address} onChange={(e) => setEditForm({...editForm, address: e.target.value})} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-username">App Username</Label>
                    <div className="relative">
                        <AtSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input id="edit-username" className="pl-9" value={editForm.username} onChange={(e) => setEditForm({...editForm, username: e.target.value})} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-password">New Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="edit-password" 
                            className="pl-9" 
                            placeholder="Leave empty to keep current" 
                            value={editForm.password} 
                            onChange={(e) => setEditForm({...editForm, password: e.target.value})} 
                        />
                    </div>
                </div>
            </div>

            {editCustomer?.id && (
                <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Assigned Machines</h4>
                        
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 border-dashed gap-2">
                                    <Plus className="h-3 w-3" /> Assign New
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0" align="end">
                                <Command>
                                    <CommandInput placeholder="Search machine..." />
                                    <CommandGroup className="max-h-[200px] overflow-y-auto">
                                        {availableMachines().length === 0 ? (
                                            <div className="p-3 text-xs text-center text-muted-foreground">No unassigned machines found.</div>
                                        ) : (
                                            availableMachines().map((m) => (
                                                <CommandItem key={m.id} onSelect={() => assignMachine(m.id)}>
                                                    <Wrench className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    {getMachineLabel(m)}
                                                </CommandItem>
                                            ))
                                        )}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        {assignedMachines(editCustomer.id).length === 0 ? (
                            <div className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-md text-center">
                                No machines currently assigned.
                            </div>
                        ) : (
                            assignedMachines(editCustomer.id).map((m) => (
                                <div key={m.id} className="flex justify-between items-center bg-card border rounded-md p-2 pl-3 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                                            <Wrench className="h-3.5 w-3.5" />
                                        </div>
                                        <span className="text-sm font-medium">{getMachineLabel(m)}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => unassignMachine(m.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCustomer(null)}>Cancel</Button>
            <Button onClick={saveCustomerEdits} disabled={isSaving}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- BULK UPLOAD DIALOG ---------------- */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader><DialogTitle>Bulk Upload Customers</DialogTitle></DialogHeader>
          {!bulkPreview.length ? (
            <div className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer" onClick={() => document.getElementById("bulkFile")?.click()}>
              <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Click to select .xlsx file</p>
              <input id="bulkFile" type="file" accept=".xlsx" hidden onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const buffer = await file.arrayBuffer();
                  const wb = XLSX.read(buffer);
                  const ws = wb.Sheets[wb.SheetNames[0]];
                  const rawRows = XLSX.utils.sheet_to_json(ws) as any[];
                  
                  const dbData = allCustomers;
                  const dbIds = new Set(dbData.map((c: any) => String(c.legacyCustomerId || "").trim()));
                  const seenIdsInFile = new Set<string>();
                  
                  const processedRows = rawRows.map((r: any) => {
                    const name = (r.name || r.Name || r["Full Name"] || "").toString().trim();
                    const legacyId = (r.legacyCustomerId || r["legacyCustomerId"] || "").toString().trim();
                    let rawUsername = (r.username || r.Username || r["User Name"] || "").toString().trim();
                    if (!rawUsername && name) rawUsername = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    if (!name && !legacyId) return null;
                    
                    let status = "Ready";
                    if (legacyId && dbIds.has(legacyId)) status = "Already exists in database";
                    else if (legacyId && seenIdsInFile.has(legacyId)) status = "Repeated in File";
                    else { status = "Ready"; if (legacyId) seenIdsInFile.add(legacyId); }
                    
                    return { ...r, name, username: rawUsername, legacyCustomerId: legacyId, phone: (r.phone || "").toString(), address: (r.address || "").toString(), _status: status };
                  }).filter(Boolean);
                  setBulkPreview(processedRows); 
              }} />
            </div>
          ) : (
            <>
              <div className="bg-muted/30 p-3 rounded-md text-sm mb-2 flex justify-between">
                  <span>Total: {bulkPreview.length}</span>
                  <span className="text-green-600">Ready: {bulkPreview.filter((r:any)=>r._status==="Ready").length}</span>
                  <span className="text-red-600">Skipped: {bulkPreview.filter((r:any)=>r._status!=="Ready").length}</span>
              </div>
              {bulkUploading && <div className="w-full bg-muted h-2 rounded-full mb-3"><div className="bg-primary h-2 rounded-full" style={{width: `${uploadProgress}%`}}/></div>}
              
              <div className="border rounded-md max-h-[300px] overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 sticky top-0">
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {bulkPreview.map((r:any,i)=> {
                            const isReady = r._status === "Ready";
                            return (
                                <TableRow key={i} className={!isReady ? "bg-red-50" : ""}>
                                    <TableCell className="font-mono text-xs">{r.legacyCustomerId}</TableCell>
                                    <TableCell>{r.name}</TableCell>
                                    <TableCell>
                                        <div className={`flex items-center gap-2 text-xs font-medium ${isReady ? 'text-green-600' : 'text-red-600'}`}>
                                            {!isReady && <AlertCircle className="h-3 w-3"/>}
                                            {r._status}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="ghost" onClick={()=>setBulkPreview([])} disabled={bulkUploading}>Clear</Button>
                <Button onClick={async ()=>{
                    setBulkUploading(true);
                    const validRows = bulkPreview.filter((r: any) => r._status === "Ready");
                    await uploadInBatches(validRows);
                    setBulkUploading(false); setBulkPreview([]); setBulkOpen(false);
                    toast({ title: "Bulk upload complete", description: `${validRows.length} customers uploaded.` });
                }} disabled={bulkUploading || bulkPreview.filter((r:any)=>r._status==="Ready").length === 0}>
                    {bulkUploading ? "Uploading..." : `Confirm Upload (${bulkPreview.filter((r:any)=>r._status==="Ready").length})`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
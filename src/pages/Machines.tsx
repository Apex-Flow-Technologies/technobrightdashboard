import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  addDoc,
  deleteDoc,
  query, 
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
  where
} from "firebase/firestore";
import { db } from "@/firebase";
import { cn } from "@/lib/utils";

import { useState, useEffect } from "react";
import { 
  Search, 
  Wrench, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Upload, 
  Hash, 
  Tag, 
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  User
} from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 50;

/* -------------------------------------------------------------------------- */
/* TYPES */
/* -------------------------------------------------------------------------- */

type Machine = {
  id: string;
  machineCode: string;
  status: "Online" | "Offline";
  assignedTo: string | null;
  activeTicket: null;
};

type UploadRow = {
  machineCode: string;
  legacyId: string;
  customerName: string; 
  matchedCustomerName: string | null;
  customerId: string | null; 
  valid: boolean;
  statusMessage: string;
  statusType: "success" | "warning" | "error";
  machineNo: string;
  year: string;
  machineType: string;
};

/* -------------------------------------------------------------------------- */
/* HELPERS */
/* -------------------------------------------------------------------------- */

const normalize = (v: string) => v?.trim().toLowerCase();

const extractSerial = (machineCode: string) =>
  machineCode.split("|")[0].trim(); 

const normalizeStatus = (status: any): "Online" | "Offline" =>
  typeof status === "string" && status.toLowerCase() === "online"
    ? "Online"
    : "Offline";

const statusBadgeClass = (status: "Online" | "Offline") =>
  status === "Online"
    ? "bg-green-600 text-white hover:bg-green-700"
    : "bg-slate-400 text-white hover:bg-slate-500";

// Regex: Any content followed by " | " followed by any content
const isValidMachineStructure = (code: string) =>
  /^.+ \| .+$/.test(code);

/* -------------------------------------------------------------------------- */
/* COMPONENT */
/* -------------------------------------------------------------------------- */

export default function Machines() {
  const { toast } = useToast();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<any[]>([]); 
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Pagination & Sort State
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [pageHistory, setPageHistory] = useState<QueryDocumentSnapshot<DocumentData>[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortField, setSortField] = useState<string>("machineCode");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Add Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ serial: "", name: "" });

  // Edit Dialog State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editMachineId, setEditMachineId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ serial: "", name: "" });

  // Upload State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  /* LOAD DATA - PAGINATED */
  const fetchFirstPage = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "machines"),
        orderBy(sortField, sortDir),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      
      setMachines(snap.docs.map((m: any) => ({
          id: m.id,
          ...m.data(),
          status: normalizeStatus(m.data().status),
        })));
        
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setPageHistory([]);
      setPage(1);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error loading machines:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- NEW: SERVER SIDE SEARCH ---
  const performSearch = async (searchTerm: string) => {
    setIsLoading(true);
    try {
        // Firestore prefix search
        const q = query(
            collection(db, "machines"),
            where("machineCode", ">=", searchTerm),
            where("machineCode", "<=", searchTerm + '\uf8ff'),
            limit(50)
        );

        const snap = await getDocs(q);
        setMachines(snap.docs.map((m: any) => ({
            id: m.id,
            ...m.data(),
            status: normalizeStatus(m.data().status),
        })));
        
        // We don't manage page history during search
    } catch (error) {
        console.error("Search error:", error);
    } finally {
        setIsLoading(false);
    }
  };

  const fetchNextPage = async () => {
    if (!lastDoc) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "machines"),
        orderBy(sortField, sortDir),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        setPageHistory(prev => [...prev, lastDoc]);
        setMachines(snap.docs.map((m: any) => ({
            id: m.id,
            ...m.data(),
            status: normalizeStatus(m.data().status),
          })));
        setLastDoc(snap.docs[snap.docs.length - 1]);
        setPage(p => p + 1);
        setHasMore(snap.docs.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching next page:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPrevPage = async () => {
    if (page === 1 || pageHistory.length === 0) return;
    setIsLoading(true);
    try {
      const newHistory = pageHistory.slice(0, -1);
      let q;
      if (newHistory.length === 0) {
         q = query(
           collection(db, "machines"),
           orderBy(sortField, sortDir),
           limit(PAGE_SIZE)
         );
      } else {
         const startDoc = newHistory[newHistory.length - 1];
         q = query(
           collection(db, "machines"),
           orderBy(sortField, sortDir),
           startAfter(startDoc),
           limit(PAGE_SIZE)
         );
      }

      const snap = await getDocs(q);
      setMachines(snap.docs.map((m: any) => ({
        id: m.id,
        ...m.data(),
        status: normalizeStatus(m.data().status),
      })));
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setPageHistory(newHistory);
      setPage(p => p - 1);
      setHasMore(true);
    } catch (error) {
      console.error("Error fetching prev page:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for duplicate check (load all only when needed)
  const fetchAllMachinesForCheck = async () => {
      const snap = await getDocs(collection(db, "machines"));
      return snap.docs.map(d => ({id: d.id, ...d.data()}));
  }

  // Helper to fetch existing codes for manual add
  const fetchExistingMachineCodes = async (): Promise<Set<string>> => {
    const snap = await getDocs(collection(db, "machines"));
    return new Set(
      snap.docs
        .map((d: any) => d.data().machineCode)
        .filter(Boolean)
        .map((c: string) => extractSerial(c).toLowerCase())
    );
  };

  // Load ALL users to match machine assignment
  const loadUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "user"));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  // --- SEARCH & SORT EFFECT ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
        if (search.trim()) {
            performSearch(search);
        } else {
            fetchFirstPage();
        }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [search, sortField, sortDir]);

  useEffect(() => {
    // We removed explicit fetchFirstPage() here because the Search Effect 
    // above runs on mount (search="") and handles the initial load.
    loadUsers();
  }, []);

  const getCustomerName = (id: string | null) => {
      if(!id) return "Unassigned";
      const u = users.find(user => user.id === id);
      return u ? u.name : "Unknown User";
  }

  const handleSort = (field: string) => {
      if (sortField === field) {
          setSortDir(sortDir === "asc" ? "desc" : "asc");
      } else {
          setSortField(field);
          setSortDir("asc");
      }
  }

  /* ADD MACHINE (Manual) */
  const handleAddMachine = async () => {
    // 1. Check for hyphen in serial
    if (!addForm.serial.includes("-")) {
      toast({
        title: "Invalid Serial Format",
        description: "Serial number must contain a hyphen (e.g. 223-33-22 or 00-00-00).",
        variant: "destructive",
      });
      return;
    }

    // 2. Check if name is present
    if (!addForm.name.trim()) {
      toast({
        title: "Missing Name",
        description: "Please enter a machine name.",
        variant: "destructive",
      });
      return;
    }

    const fullCode = `${addForm.serial.trim()} | ${addForm.name.trim()}`;

    // 3. Check overall structure
    if (!isValidMachineStructure(fullCode)) {
      toast({
        title: "System Error",
        description: "Could not format machine code correctly.",
        variant: "destructive",
      });
      return;
    }

    const existing = await fetchExistingMachineCodes();
    const key = extractSerial(fullCode).toLowerCase();

    if (existing.has(key)) {
      toast({
        title: "Duplicate serial",
        description: "This machine serial already exists",
        variant: "destructive",
      });
      return;
    }

    await addDoc(collection(db, "machines"), {
      machineCode: fullCode,
      assignedTo: null,
      status: "offline",
      createdAt: serverTimestamp()
    });

    setIsAddDialogOpen(false);
    setAddForm({ serial: "", name: "" });
    // Refresh handled by effect or manual trigger depending on search state
    if (!search) fetchFirstPage(); 
    toast({ title: "Machine Added" });
  };

  /* EDIT MACHINE HANDLERS */
  const handleEditClick = (machine: Machine) => {
    const parts = machine.machineCode.split("|");
    const serial = parts[0]?.trim() || "";
    const name = parts.slice(1).join("|").trim() || ""; 

    setEditMachineId(machine.id);
    setEditForm({ serial, name });
    setIsEditOpen(true);
  };

  const handleUpdateMachine = async () => {
    if (!editMachineId) return;

    // 1. Check for hyphen
    if (!editForm.serial.includes("-")) {
      toast({
        title: "Invalid Serial Format",
        description: "Serial number must contain a hyphen (e.g. 223-33-22).",
        variant: "destructive",
      });
      return;
    }

    if (!editForm.name.trim()) {
      toast({
        title: "Missing Name",
        description: "Machine name is required.",
        variant: "destructive",
      });
      return;
    }

    const fullCode = `${editForm.serial.trim()} | ${editForm.name.trim()}`;

    try {
      const machineRef = doc(db, "machines", editMachineId);
      await updateDoc(machineRef, {
        machineCode: fullCode,
      });

      setIsEditOpen(false);
      setEditMachineId(null);
      setEditForm({ serial: "", name: "" });
      
      // Update local state without full refetch if possible, or refetch
      setMachines(prev => prev.map(m => m.id === editMachineId ? {...m, machineCode: fullCode} : m));
      toast({ title: "Machine Updated" });
    } catch (error) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleDeleteMachine = async (id: string) => {
    if(!confirm("Are you sure?")) return;
    try {
        await deleteDoc(doc(db, "machines", id));
        setMachines(prev => prev.filter(m => m.id !== id));
        toast({ title: "Machine Removed" });
    } catch (e) {
        toast({ title: "Error deleting", variant: "destructive"});
    }
  };

  /* BULK UPLOAD HANDLERS */
  const handleFileUpload = async (file: File) => {
    await loadUsers();
    
    // We need ALL machines to check duplicates accurately across the whole DB
    const allMachines = await fetchAllMachinesForCheck();

    // 1. Create Set of Existing IDs
    const existingIds = new Set(allMachines.map((m: any) => extractSerial(m.machineCode)));
    
    // 2. Create User Lookup
    const userLookup = new Map<string, any>();
    users.forEach(u => {
        if(u.legacyCustomerId) {
            userLookup.set(String(u.legacyCustomerId).trim(), u);
        }
    });

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    setUploadedCount(0);

    const seenInFile = new Set<string>();

    const processed = rows.map((row) => {
        const machineNo = row["MACHINE NO"] || row["machine no"];
        const year = row["YEAR"] || row["year"];
        const machineType = row["MACHINE TYPE"] || row["machine type"];
        const legacyId = row["legacyCustomerId"];
        const customerNameExcel = row["CUSTOMER NAME"];

        if (!machineNo || !machineType) return null;

        const machineCode = `${machineNo}-${year} | ${machineType}`;
        const idKey = extractSerial(machineCode); 
        
        let statusMessage = "";
        let statusType: "success" | "warning" | "error" = "success";

        // A. Check DB Duplicate
        if (existingIds.has(idKey)) {
            statusMessage = "ID already exists in DB";
            statusType = "error";
        }
        // B. Check File Duplicate
        else if (seenInFile.has(idKey)) {
            statusMessage = "Duplicate ID in this file";
            statusType = "error";
        }
        else {
            seenInFile.add(idKey);

            // C. Link Customer
            if (legacyId) {
                const user = userLookup.get(String(legacyId).trim());
                if (user) {
                    return {
                        machineCode,
                        legacyId,
                        customerName: customerNameExcel,
                        matchedCustomerName: user.name,
                        customerId: user.id,
                        valid: true,
                        statusMessage: "Ready (Matched)",
                        statusType: "success",
                        machineNo, year, machineType
                    } as UploadRow;
                } else {
                    statusMessage = `User ID '${legacyId}' not found`;
                    statusType = "warning";
                }
            } else {
                statusMessage = "No User ID provided (Unassigned)";
                statusType = "warning";
            }
        }

        return {
            machineCode,
            legacyId,
            customerName: customerNameExcel,
            matchedCustomerName: null,
            customerId: null,
            valid: statusType !== "error",
            statusMessage,
            statusType,
            machineNo, year, machineType
        } as UploadRow;

    }).filter(Boolean) as UploadRow[];

    setUploadRows(processed);
  };

  const handleConfirmUpload = async () => {
    setUploading(true);
    let count = 0;

    const validRows = uploadRows.filter((r) => r.valid);

    for (const r of validRows) {
      await addDoc(collection(db, "machines"), {
        machineCode: r.machineCode,
        assignedTo: r.customerId, 
        status: r.customerId ? "online" : "offline",
        machineNo: r.machineNo,
        year: r.year,
        machineType: r.machineType,
        legacyCustomerId: r.legacyId,
        createdAt: serverTimestamp()
      });
      count++;
      setUploadedCount(count);
    }

    setUploading(false);
    setIsUploadOpen(false);
    setUploadRows([]);
    if(!search) fetchFirstPage(); // Refresh list to show new uploads

    toast({
      title: "Bulk upload completed",
      description: `${count} machines uploaded successfully.`,
    });
  };

  // Client-side filtering REMOVED. Using direct 'machines' state.
  const displayMachines = machines;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Machine Inventory</h1>
          <p className="text-muted-foreground">
            Track and manage all machines in the system
          </p>
        </div>

        <div className="flex gap-2">
          {/* BULK UPLOAD BUTTON */}
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-green-600 text-green-600">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle>Bulk Upload Machines</DialogTitle>
                <DialogDescription>
                  Upload an Excel file with 'MACHINE NO', 'YEAR', 'MACHINE TYPE', and 'legacyCustomerId'.
                </DialogDescription>
              </DialogHeader>

              {!uploadRows.length ? (
                  <div
                    className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-slate-50 transition"
                    onClick={() => document.getElementById("bulkFile")?.click()}
                  >
                    <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Click to select .xlsx file</p>
                    <input
                      id="bulkFile"
                      type="file"
                      accept=".xlsx,.csv"
                      hidden
                      onChange={(e) =>
                        e.target.files && handleFileUpload(e.target.files[0])
                      }
                    />
                  </div>
              ) : (
                <>
                  <div className="flex gap-4 text-sm mb-2">
                    <span className="text-green-600 font-medium">Valid: {uploadRows.filter(r => r.valid).length}</span>
                    <span className="text-muted-foreground">Total: {uploadRows.length}</span>
                  </div>

                  <div className="border rounded-md max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 sticky top-0">
                          <TableHead>Machine Code (Generated)</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadRows.map((r, i) => (
                          <TableRow key={i} className={r.valid ? "" : "bg-red-50"}>
                            <TableCell className="font-mono text-xs font-medium">
                                {r.machineCode}
                            </TableCell>
                            <TableCell>
                                {r.matchedCustomerName ? (
                                    <div className="flex flex-col">
                                        <span className="text-green-700 font-medium flex items-center gap-1 text-xs">
                                            <CheckCircle2 className="h-3 w-3"/> {r.matchedCustomerName}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">Legacy ID: {r.legacyId}</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground text-xs italic">
                                            {r.customerName || "Unknown"}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">Legacy ID: {r.legacyId || "N/A"}</span>
                                    </div>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className={`flex items-center gap-2 text-xs font-medium ${
                                    r.statusType === 'success' ? 'text-green-600' :
                                    r.statusType === 'warning' ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                    {r.statusType === 'error' && <AlertCircle className="h-3 w-3"/>}
                                    {r.statusMessage}
                                </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              <DialogFooter>
                <Button variant="ghost" onClick={() => setUploadRows([])}>Clear</Button>
                <Button
                  onClick={handleConfirmUpload}
                  disabled={uploading || uploadRows.filter(r => r.valid).length === 0}
                >
                  {uploading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                  ) : (
                      `Confirm Upload (${uploadRows.filter(r => r.valid).length})`
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ADD MACHINE BUTTON */}
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Wrench className="h-4 w-4 mr-2" />
            Add Machine
          </Button>
        </div>
      </div>

      {/* MACHINE LIST CARD */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Machine List</CardTitle>
            <div className="flex items-center gap-2">
                {/* SORT MENU */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2" disabled={!!search}>
                            <ArrowUpDown className="h-4 w-4" /> Sort
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleSort("machineCode")}>
                            Code {sortField === 'machineCode' && (sortDir === 'asc' ? '↑' : '↓')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSort("status")}>
                            Status {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search code..."
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
                  <TableHead>Machine Code</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><div className="h-4 w-32 bg-slate-100 rounded animate-pulse"/></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-100 rounded animate-pulse"/></TableCell>
                            <TableCell><div className="h-4 w-12 bg-slate-100 rounded animate-pulse"/></TableCell>
                            <TableCell/>
                        </TableRow>
                    ))
                ) : displayMachines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      {search ? "No machines found matching that code." : "No machines found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayMachines.map((m) => (
                    <TableRow key={m.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono font-medium">{m.machineCode}</TableCell>
                      <TableCell>{getCustomerName(m.assignedTo)}</TableCell>
                      <TableCell>
                        <Badge className={cn("capitalize", statusBadgeClass(m.status))}>
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClick(m)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteMachine(m.id)}
                            >
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
            ) : displayMachines.map((m) => (
              <div key={m.id} className="p-4 space-y-4 active:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("h-2 w-2 rounded-full", m.status === 'Online' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-slate-400")}/>
                      <p className="font-bold text-foreground truncate font-mono text-sm tracking-tight">{m.machineCode}</p>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      {getCustomerName(m.assignedTo)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 -mr-2">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => handleEditClick(m)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Machine
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteMachine(m.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <Badge className={cn("text-[10px] uppercase h-5 font-bold tracking-wider", statusBadgeClass(m.status))}>
                        {m.status}
                    </Badge>
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase gap-2" onClick={() => handleEditClick(m)}>
                        <Wrench className="h-3 w-3" /> Manage
                    </Button>
                </div>
              </div>
            ))}
            {displayMachines.length === 0 && !isLoading && (
              <div className="py-20 text-center text-sm text-muted-foreground">
                No machines found
              </div>
            )}
          </div>
        </CardContent>
        {/* PAGINATION FOOTER - Hidden during search */}
        {!search && (
            <CardFooter className="flex items-center justify-between border-t py-4">
                <div className="text-sm text-muted-foreground">
                    Page {page}
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={fetchPrevPage} 
                        disabled={page === 1 || isLoading}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={fetchNextPage} 
                        disabled={!hasMore || isLoading}
                    >
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </CardFooter>
        )}
      </Card>

      {/* --- ADD MACHINE DIALOG --- */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Machine</DialogTitle>
            <DialogDescription>
              Enter details manually.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Machine Code (ID-Year)</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 font-mono"
                  placeholder="e.g. 223-33-22"
                  value={addForm.serial}
                  // RESTRICT INPUT TO NUMBERS AND HYPHEN ONLY
                  onChange={(e) =>
                    setAddForm({ ...addForm, serial: e.target.value.replace(/[^0-9-]/g, "") })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Machine Name / Type</Label>
              <div className="relative">
                <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="e.g. Blaster X1"
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm({ ...addForm, name: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMachine}>Add Machine</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- EDIT MACHINE DIALOG --- */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Machine</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Machine Code (ID-Year)</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 font-mono"
                  placeholder="e.g. 223-33-22"
                  value={editForm.serial}
                  // RESTRICT INPUT TO NUMBERS AND HYPHEN ONLY
                  onChange={(e) =>
                    setEditForm({ ...editForm, serial: e.target.value.replace(/[^0-9-]/g, "") })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Machine Name / Type</Label>
              <div className="relative">
                <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateMachine}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
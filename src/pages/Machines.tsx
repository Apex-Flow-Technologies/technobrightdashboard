import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import { db } from "@/firebase";

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
  FileSpreadsheet 
} from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  fetchMachines,
  addMachine as addMachineToDB,
  deleteMachine as deleteMachineFromDB,
} from "@/services/machines";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  customerName: string;
  customerId: string | null;
  valid: boolean;
  error?: string;
};

type UserDoc = {
  id: string;
  name: string;
};

/* -------------------------------------------------------------------------- */
/* HELPERS */
/* -------------------------------------------------------------------------- */

const normalize = (v: string) => v?.trim().toLowerCase();

const extractSerial = (machineCode: string) =>
  machineCode.split("|")[0].trim().toLowerCase();

const normalizeStatus = (status: any): "Online" | "Offline" =>
  typeof status === "string" && status.toLowerCase() === "online"
    ? "Online"
    : "Offline";

const statusBadgeClass = (status: "Online" | "Offline") =>
  status === "Online"
    ? "bg-green-600 text-white"
    : "bg-slate-400 text-white";

/* FORMATTER FOR SERIAL INPUT (00-00-00) */
const formatSerialInput = (val: string) => {
  const digits = val.replace(/\D/g, "").slice(0, 6);
  let out = "";
  if (digits.length >= 1) out += digits.slice(0, 2);
  if (digits.length >= 3) out += "-" + digits.slice(2, 4);
  if (digits.length >= 5) out += "-" + digits.slice(4, 6);
  return out;
};

const isValidMachineCode = (code: string) =>
  /^\d{2}-\d{2}-\d{2} \| .+$/i.test(code);

/* -------------------------------------------------------------------------- */
/* FIRESTORE HELPERS */
/* -------------------------------------------------------------------------- */

const fetchUsersDirect = async (): Promise<UserDoc[]> => {
  const snap = await getDocs(collection(db, "user"));
  return snap.docs.map((d) => ({
    id: d.id,
    name: d.data().name,
  }));
};

const fetchExistingMachineCodes = async (): Promise<Set<string>> => {
  const machines = await fetchMachines();
  return new Set(
    machines
      .map((m: any) => m.machineCode)
      .filter(Boolean)
      .map((c: string) => extractSerial(c))
  );
};

/* -------------------------------------------------------------------------- */
/* COMPONENT */
/* -------------------------------------------------------------------------- */

export default function Machines() {
  const { toast } = useToast();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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
  const [skippedRows, setSkippedRows] = useState<UploadRow[]>([]);
  const [showSkippedDialog, setShowSkippedDialog] = useState(false);

  /* LOAD MACHINES */
  const loadMachines = async () => {
    const data = await fetchMachines();
    setMachines(
      data.map((m: any) => ({
        id: m.id,
        machineCode: m.machineCode,
        status: normalizeStatus(m.status),
        assignedTo: m.assignedTo ?? null,
        activeTicket: null,
      }))
    );
  };

  useEffect(() => {
    loadMachines();
  }, []);

  /* ADD MACHINE */
  const handleAddMachine = async () => {
    const fullCode = `${addForm.serial} | ${addForm.name}`;

    if (!isValidMachineCode(fullCode)) {
      toast({
        title: "Invalid format",
        description: "Serial must be 6 digits and Name is required.",
        variant: "destructive",
      });
      return;
    }

    const existing = await fetchExistingMachineCodes();
    const key = extractSerial(fullCode);

    if (existing.has(key)) {
      toast({
        title: "Duplicate serial",
        description: "This machine serial already exists",
        variant: "destructive",
      });
      return;
    }

    await addMachineToDB({
      machineCode: fullCode,
      assignedTo: null,
      status: "offline",
    });

    setIsAddDialogOpen(false);
    setAddForm({ serial: "", name: "" });
    await loadMachines();

    toast({ title: "Machine Added" });
  };

  /* EDIT MACHINE HANDLERS */
  const handleEditClick = (machine: Machine) => {
    // Parse existing "00-00-00 | Name"
    const parts = machine.machineCode.split("|");
    const serial = parts[0]?.trim() || "";
    const name = parts.slice(1).join("|").trim() || ""; // Join rest in case name has |

    setEditMachineId(machine.id);
    setEditForm({ serial, name });
    setIsEditOpen(true);
  };

  const handleUpdateMachine = async () => {
    if (!editMachineId) return;

    const fullCode = `${editForm.serial} | ${editForm.name}`;

    if (!isValidMachineCode(fullCode)) {
      toast({
        title: "Invalid format",
        description: "Serial must be 6 digits and Name is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const machineRef = doc(db, "machines", editMachineId);
      await updateDoc(machineRef, {
        machineCode: fullCode,
      });

      setIsEditOpen(false);
      setEditMachineId(null);
      setEditForm({ serial: "", name: "" });
      await loadMachines();

      toast({ title: "Machine Updated" });
    } catch (error) {
      console.error("Update failed", error);
      toast({
        title: "Update failed",
        description: "Could not update machine details.",
        variant: "destructive",
      });
    }
  };

  /* DELETE */
  const handleDeleteMachine = async (id: string) => {
    await deleteMachineFromDB(id);
    await loadMachines();
    toast({ title: "Machine Removed", variant: "destructive" });
  };

  /* BULK UPLOAD HANDLERS */
  const handleFileUpload = async (file: File) => {
    const users = await fetchUsersDirect();
    const existing = await fetchExistingMachineCodes();
    const userMap = new Map(users.map((u) => [normalize(u.name), u]));

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    setUploadedCount(0);
    setSkippedRows([]);

    setUploadRows(
      rows.map((row) => {
        const machineCode = `${row["MACHINE NO"]}-${row["YEAR"]} | ${row["MACHINE TYPE"]}`;
        const key = extractSerial(machineCode);

        if (existing.has(key)) {
          return {
            machineCode,
            customerName: row["CUSTOMER NAME"],
            customerId: null,
            valid: false,
            error: "Duplicate serial",
          };
        }

        const user = userMap.get(normalize(row["CUSTOMER NAME"]));
        if (!user) {
          return {
            machineCode,
            customerName: row["CUSTOMER NAME"],
            customerId: null,
            valid: false,
            error: "Customer not found",
          };
        }

        return {
          machineCode,
          customerName: row["CUSTOMER NAME"],
          customerId: user.id,
          valid: true,
        };
      })
    );
  };

  const handleConfirmUpload = async () => {
    setUploading(true);
    setUploadedCount(0);

    const existing = await fetchExistingMachineCodes();
    const skipped: UploadRow[] = [];
    const validRows = uploadRows.filter((r) => r.valid);

    for (const r of validRows) {
      const key = extractSerial(r.machineCode);

      if (existing.has(key)) {
        skipped.push({ ...r, error: "Already exists" });
        continue;
      }

      await addMachineToDB({
        machineCode: r.machineCode,
        assignedTo: r.customerId,
        status: r.customerId ? "online" : "offline",
      });

      existing.add(key);
      setUploadedCount((c) => c + 1);
    }

    setUploading(false);
    setIsUploadOpen(false);
    setUploadRows([]);
    setSkippedRows(skipped);
    await loadMachines();

    if (skipped.length > 0) setShowSkippedDialog(true);

    toast({
      title: "Bulk upload completed",
      description: `${validRows.length - skipped.length} uploaded, ${skipped.length} skipped`,
    });
  };

  /* UI HELPERS */
  const validCount = uploadRows.filter((r) => r.valid).length;
  const pendingCount = validCount - uploadedCount;

  const filteredMachines = machines.filter(
    (m) =>
      typeof m.machineCode === "string" &&
      m.machineCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
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

            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Bulk Upload Machines</DialogTitle>
                <DialogDescription>
                  Preview Excel data before uploading
                </DialogDescription>
              </DialogHeader>

              <div
                className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-slate-50 transition"
                onClick={() => document.getElementById("bulkFile")?.click()}
              >
                <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Click to upload .xlsx file</p>
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

              {uploadRows.length > 0 && (
                <>
                  <div className="flex gap-3 mt-4 text-sm">
                    <Badge>Will upload: {validCount}</Badge>
                    <Badge variant="secondary">Uploaded: {uploadedCount}</Badge>
                    <Badge variant="outline">Pending: {pendingCount}</Badge>
                  </div>

                  <div className="border rounded-md max-h-[300px] overflow-y-auto mt-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Machine Code</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadRows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono">{r.machineCode}</TableCell>
                            <TableCell>{r.customerName}</TableCell>
                            <TableCell>
                              {r.valid ? (
                                <Badge className="bg-green-600">Valid</Badge>
                              ) : (
                                <Badge variant="destructive">{r.error}</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              <DialogFooter>
                <Button
                  onClick={handleConfirmUpload}
                  disabled={uploading || validCount === 0}
                >
                  {uploading ? "Uploading..." : "Confirm Upload"}
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
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Machine List</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search code..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMachines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                    No machines found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMachines.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono font-medium">
                      {m.machineCode}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadgeClass(m.status)}>
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
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
                            <Trash2 className="mr-2 h-4 w-4" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* --- ADD MACHINE DIALOG --- */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Machine</DialogTitle>
            <DialogDescription>
              Enter the serial number and machine model.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 font-mono"
                  placeholder="00-00-00"
                  maxLength={8}
                  value={addForm.serial}
                  onChange={(e) =>
                    setAddForm({ ...addForm, serial: formatSerialInput(e.target.value) })
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
            <DialogDescription>
              Update the machine serial number or model name.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 font-mono"
                  placeholder="00-00-00"
                  maxLength={8}
                  value={editForm.serial}
                  onChange={(e) =>
                    setEditForm({ ...editForm, serial: formatSerialInput(e.target.value) })
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

      {/* SKIPPED ITEMS DIALOG */}
      <Dialog open={showSkippedDialog} onOpenChange={setShowSkippedDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Skipped Uploads</DialogTitle>
            <DialogDescription>
              The following machines were not uploaded because they already exist.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine Code</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skippedRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{r.machineCode}</TableCell>
                    <TableCell className="text-destructive">{r.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSkippedDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
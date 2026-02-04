import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

import { useState, useEffect } from "react";
import { Search, Wrench, MoreHorizontal, Edit, Trash2, Upload } from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  fetchMachines,
  addMachine as addMachineToDB,
  updateMachine as updateMachineInDB,
  deleteMachine as deleteMachineFromDB,
} from "@/services/machines";

import {
  Card,
  CardContent,
  CardHeader,
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

/** SERIAL ONLY (before |) */
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

/* LOCKED FORMATTER */
const formatMachineCode = (input: string) => {
  const [raw, name = ""] = input.split("|");
  const digits = raw.replace(/\D/g, "").slice(0, 6);

  let out = "";
  if (digits.length >= 1) out += digits.slice(0, 2);
  if (digits.length >= 3) out += "-" + digits.slice(2, 4);
  if (digits.length >= 5) out += "-" + digits.slice(4, 6);

  if (digits.length === 6) {
    out += " | " + name.replace(/[^a-zA-Z0-9\s]/g, "");
  }

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

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMachine, setNewMachine] = useState({ machineCode: "" });

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

  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidMachineCode(newMachine.machineCode)) {
      toast({
        title: "Invalid format",
        description: "Use: 00-00-00 | Machine Name",
        variant: "destructive",
      });
      return;
    }

    const existing = await fetchExistingMachineCodes();
    const key = extractSerial(newMachine.machineCode);

    if (existing.has(key)) {
      toast({
        title: "Duplicate serial",
        description: "This machine serial already exists",
        variant: "destructive",
      });
      return;
    }

    await addMachineToDB({
      machineCode: newMachine.machineCode,
      assignedTo: null,
      status: "offline",
    });

    setIsAddDialogOpen(false);
    setNewMachine({ machineCode: "" });
    await loadMachines();

    toast({ title: "Machine Added" });
  };

  /* DELETE */

  const handleDeleteMachine = async (id: string) => {
    await deleteMachineFromDB(id);
    await loadMachines();
    toast({ title: "Machine Removed", variant: "destructive" });
  };

  /* BULK UPLOAD */

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

  /* UI */

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
        <h1 className="text-2xl font-bold">Machine List</h1>

        <div className="flex gap-2">
          {/* BULK */}
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
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

              <Input
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) =>
                  e.target.files && handleFileUpload(e.target.files[0])
                }
              />

              {uploadRows.length > 0 && (
                <>
                  <div className="flex gap-3 mt-2 text-sm">
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
                                <Badge className="bg-green-600 text-white">Valid</Badge>
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

          {/* ADD MACHINE */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Wrench className="h-4 w-4 mr-2" />
                Add Machine
              </Button>
            </DialogTrigger>

            <DialogContent>
              <form onSubmit={handleAddMachine} className="space-y-3">
                <Label>Machine Code</Label>
                <Input
                  value={newMachine.machineCode}
                  placeholder="00-00-00 | Machine Name"
                  onChange={(e) =>
                    setNewMachine({
                      machineCode: formatMachineCode(e.target.value),
                    })
                  }
                />
                <DialogFooter>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* SKIPPED */}
      <Dialog open={showSkippedDialog} onOpenChange={setShowSkippedDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Skipped Entries</DialogTitle>
            <DialogDescription>
              These machines already exist and were skipped
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[300px] overflow-y-auto">
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
                    <TableCell>{r.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* TABLE */}
      <Card>
        <CardHeader>
          <Input
            className="w-72"
            placeholder="Search machine..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMachines.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono">{m.machineCode}</TableCell>
                  <TableCell>
                    <Badge className={statusBadgeClass(m.status)}>
                      {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteMachine(m.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

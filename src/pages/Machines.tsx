import { useState, useEffect } from "react";
import { Search, Wrench, MoreHorizontal, Edit, Trash2 } from "lucide-react";

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
  CardDescription,
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

/* -------------------------------------------------------------------------- */
/* MOCK CUSTOMERS (TEMP) */
/* -------------------------------------------------------------------------- */

const mockCustomers = [
  { id: "cust1", name: "ABC Industries" },
  { id: "cust2", name: "Sri Motors" },
  { id: "cust3", name: "Ravi Engineering" },
];

/* -------------------------------------------------------------------------- */
/* HELPERS */
/* -------------------------------------------------------------------------- */

const normalizeStatus = (status: any): "Online" | "Offline" => {
  if (typeof status !== "string") return "Offline";
  return status.toLowerCase() === "online" ? "Online" : "Offline";
};

// 🔥 SERIAL SORT HELPER
const getMachineSerial = (machineCode: string): number => {
  if (!machineCode) return 0;

  // "98-77-451 | Compressor" → "98-77-451"
  const serialPart = machineCode.split("|")[0].trim();

  // "98-77-451" → 98
  const firstNumber = parseInt(serialPart.split("-")[0], 10);

  return isNaN(firstNumber) ? 0 : firstNumber;
};

/* -------------------------------------------------------------------------- */
/* COMPONENT */
/* -------------------------------------------------------------------------- */

export default function Machines() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  /* ------------------------------ ADD MACHINE ------------------------------ */

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMachine, setNewMachine] = useState({
    machineCode: "",
  });

  /* ------------------------------ EDIT MACHINE ----------------------------- */

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

  /* ------------------------------ LOAD DATA -------------------------------- */

  useEffect(() => {
    const loadMachines = async () => {
      setLoading(true);

      const data = await fetchMachines();

      const normalized: Machine[] = data
        .filter((m: any) => typeof m.machineCode === "string")
        .map((m: any) => ({
          id: m.id,
          machineCode: m.machineCode,
          status: normalizeStatus(m.status),
          assignedTo: m.assignedTo ?? null,
          activeTicket: null,
        }));

      setMachines(normalized);
      setLoading(false);
    };

    loadMachines();
  }, []);

  /* ------------------------------ SORT + FILTER ---------------------------- */

  const sortedMachines = [...machines].sort(
    (a, b) =>
      getMachineSerial(b.machineCode) -
      getMachineSerial(a.machineCode)
  );

  const filteredMachines = sortedMachines.filter((machine) =>
    machine.machineCode
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  /* ------------------------------- HANDLERS -------------------------------- */

  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();

    await addMachineToDB({
      machineCode: newMachine.machineCode,
      status: "offline",
      assignedTo: null,
    });

    setIsAddDialogOpen(false);
    setNewMachine({ machineCode: "" });

    const data = await fetchMachines();

    setMachines(
      data
        .filter((m: any) => typeof m.machineCode === "string")
        .map((m: any) => ({
          id: m.id,
          machineCode: m.machineCode,
          status: normalizeStatus(m.status),
          assignedTo: m.assignedTo ?? null,
          activeTicket: null,
        }))
    );

    toast({ title: "Machine Added" });
  };

  const openEditDialog = (machine: Machine) => {
    setEditingMachine(machine);
    setIsEditDialogOpen(true);
  };

  const handleUpdateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMachine) return;

    await updateMachineInDB(editingMachine.id, {
      machineCode: editingMachine.machineCode,
      status: editingMachine.status.toLowerCase(),
      assignedTo: editingMachine.assignedTo ?? null,
    });

    setIsEditDialogOpen(false);
    setEditingMachine(null);

    const data = await fetchMachines();

    setMachines(
      data
        .filter((m: any) => typeof m.machineCode === "string")
        .map((m: any) => ({
          id: m.id,
          machineCode: m.machineCode,
          status: normalizeStatus(m.status),
          assignedTo: m.assignedTo ?? null,
          activeTicket: null,
        }))
    );

    toast({ title: "Machine Updated" });
  };

  const handleDeleteMachine = async (id: string) => {
    await deleteMachineFromDB(id);
    setMachines((prev) => prev.filter((m) => m.id !== id));

    toast({
      title: "Machine Removed",
      variant: "destructive",
    });
  };

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Machine List</h1>
          <p className="text-muted-foreground">
            Inventory and customer assignment
          </p>
        </div>

        {/* ADD MACHINE */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Wrench className="h-4 w-4" />
              Add Machine
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Machine</DialogTitle>
              <DialogDescription>
                Create machine without assigning customer
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddMachine} className="space-y-4">
              <div>
                <Label className="mb-2 block">Machine Code</Label>
                <Input
                  placeholder="12-23-122 | Alternator"
                  value={newMachine.machineCode}
                  onChange={(e) =>
                    setNewMachine({ machineCode: e.target.value })
                  }
                  required
                />
              </div>

              <DialogFooter>
                <Button type="submit">Save Machine</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* TABLE */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Inventory</CardTitle>
              <CardDescription>
                {machines.length} total machines
              </CardDescription>
            </div>

            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search machine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine Code</TableHead>
                <TableHead>Assigned Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6">
                    Loading machines…
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                filteredMachines.map((machine) => (
                  <TableRow key={machine.id}>
                    <TableCell className="font-mono">
                      {machine.machineCode}
                    </TableCell>

                    <TableCell>
                      {machine.assignedTo ? (
                        <span className="font-medium">
                          {
                            mockCustomers.find(
                              (c) => c.id === machine.assignedTo
                            )?.name || "Unknown Customer"
                          }
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground">
                          Unassigned
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge
                        className={
                          machine.status === "Online"
                            ? "bg-green-600"
                            : "bg-gray-400"
                        }
                      >
                        {machine.status}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openEditDialog(machine)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteMachine(machine.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
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

      {/* EDIT MACHINE */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Machine</DialogTitle>
            <DialogDescription>
              Update machine and assign customer
            </DialogDescription>
          </DialogHeader>

          {editingMachine && (
            <form onSubmit={handleUpdateMachine} className="space-y-4">
              <div>
                <Label className="mb-2 block">Machine Code</Label>
                <Input
                  value={editingMachine.machineCode}
                  onChange={(e) =>
                    setEditingMachine({
                      ...editingMachine,
                      machineCode: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div>
                <Label className="mb-2 block">Assigned Customer</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={editingMachine.assignedTo ?? ""}
                  onChange={(e) =>
                    setEditingMachine({
                      ...editingMachine,
                      assignedTo: e.target.value || null,
                    })
                  }
                >
                  <option value="">Unassigned</option>
                  {mockCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="mb-2 block">Status</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={editingMachine.status}
                  onChange={(e) =>
                    setEditingMachine({
                      ...editingMachine,
                      status: e.target.value as "Online" | "Offline",
                    })
                  }
                >
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>

              <DialogFooter>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
/* -------------------------------------------------------------------------- */
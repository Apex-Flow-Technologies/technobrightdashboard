import { useEffect, useState } from "react";
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
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  Plus,
  MoreHorizontal,
  Wrench,
  Search,
  Check,
  ChevronsUpDown,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Users() {
  const { toast } = useToast();

  const [customers, setCustomers] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [assigningCustomer, setAssigningCustomer] = useState<any>(null);

  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2 | 3>(1);
  const [confirmName, setConfirmName] = useState("");
  const [finalChecked, setFinalChecked] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    username: "",
    password: "",
    machineId: "",
  });

  const [machinePopoverOpen, setMachinePopoverOpen] = useState(false);

  // ---------------- FETCH DATA ----------------

  const fetchCustomers = async () => {
    const q = query(collection(db, "user"), where("role", "==", "user"));
    const snap = await getDocs(q);
    setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchMachines = async () => {
    const snap = await getDocs(collection(db, "machines"));
    setMachines(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchCustomers();
    fetchMachines();
  }, []);

  // ---------------- HELPERS ----------------

  const availableMachines = machines.filter(
    (m) =>
      m.assignedTo === null ||
      m.assignedTo === undefined ||
      m.assignedTo === ""
  );

  const getMachineLabel = (m: any) =>
    m?.machineCode || m?.type || "Unnamed Machine";

  const isUsernameTaken = async (username: string) => {
    const q = query(collection(db, "user"), where("username", "==", username));
    const snap = await getDocs(q);
    return !snap.empty;
  };

  // ---------------- CREATE CUSTOMER ----------------

  const createCustomer = async () => {
    const { name, phone, address, username, password, machineId } = form;

    if (!name || !phone || !username || !password) {
      toast({
        title: "Missing fields",
        description: "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (await isUsernameTaken(username)) {
      toast({
        title: "Username already exists",
        description: "Choose a different username.",
        variant: "destructive",
      });
      return;
    }

    const userRef = await addDoc(collection(db, "user"), {
      name,
      phone,
      address,
      username,
      password,
      role: "user",
      createdAt: serverTimestamp(),
    });

    if (machineId) {
      await updateDoc(doc(db, "machines", machineId), {
        assignedTo: userRef.id,
      });
    }

    toast({ title: "Customer created successfully" });

    setForm({
      name: "",
      phone: "",
      address: "",
      username: "",
      password: "",
      machineId: "",
    });

    setAddOpen(false);
    fetchCustomers();
    fetchMachines();
  };

  // ---------------- ASSIGN MACHINE ----------------

  const assignMachine = async (machineId: string) => {
    await updateDoc(doc(db, "machines", machineId), {
      assignedTo: assigningCustomer.id,
    });

    toast({ title: "Machine assigned" });
    setAssigningCustomer(null);
    fetchMachines();
  };

  // ---------------- DELETE CUSTOMER (TRIPLE CONFIRM) ----------------

  const deleteCustomer = async () => {
    if (!deleteTarget) return;

    const relatedMachines = machines.filter(
      (m) => m.assignedTo === deleteTarget.id
    );

    for (const m of relatedMachines) {
      await updateDoc(doc(db, "machines", m.id), {
        assignedTo: null,
      });
    }

    await deleteDoc(doc(db, "user", deleteTarget.id));

    toast({
      title: "Customer deleted",
      description: "Customer removed and machines unassigned safely.",
      variant: "destructive",
    });

    setDeleteTarget(null);
    setDeleteStep(1);
    setConfirmName("");
    setFinalChecked(false);

    fetchCustomers();
    fetchMachines();
  };

  const filteredCustomers = customers.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  // ---------------- UI ----------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">
            Manage customers and assign machines
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center gap-4">
            <div>
              <CardTitle>Customer List</CardTitle>
              <CardDescription>
                {customers.length} total customers
              </CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customer..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Customer</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Assigned Machine</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((c) => {
                const machine = machines.find(
                  (m) => m.assignedTo === c.id
                );

                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.username}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>
                      {machine ? getMachineLabel(machine) : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setAssigningCustomer(c)}
                          >
                            <Wrench className="mr-2 h-4 w-4" />
                            Assign Machine
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setDeleteTarget(c);
                              setDeleteStep(1);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Customer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ADD CUSTOMER DIALOG */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Customer Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <Input
            placeholder="Address (optional)"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Username (App Login)"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <Input
              type="password"
              placeholder="Password (App Login)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <Popover open={machinePopoverOpen} onOpenChange={setMachinePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {form.machineId
                  ? getMachineLabel(
                      machines.find((m) => m.id === form.machineId)
                    )
                  : "Assign machine (optional)"}
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
              <Command>
                <CommandInput placeholder="Search machine..." />
                <CommandGroup>
                  {availableMachines.map((m) => (
                    <CommandItem
                      key={m.id}
                      onSelect={() => {
                        setForm({ ...form, machineId: m.id });
                        setMachinePopoverOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          form.machineId === m.id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {getMachineLabel(m)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          <DialogFooter>
            <Button onClick={createCustomer}>Create Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CUSTOMER DIALOG (TRIPLE CONFIRM) */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              ⚠️ Delete Customer
            </DialogTitle>
          </DialogHeader>

          {deleteStep === 1 && (
            <>
              <p className="text-sm text-muted-foreground">
                This action is dangerous and irreversible.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteStep(2)}
                >
                  Proceed
                </Button>
              </DialogFooter>
            </>
          )}

          {deleteStep === 2 && (
            <>
              <p className="text-sm">
                Type <strong>{deleteTarget?.name}</strong> to confirm.
              </p>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteStep(1)}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  disabled={confirmName !== deleteTarget?.name}
                  onClick={() => setDeleteStep(3)}
                >
                  I Understand
                </Button>
              </DialogFooter>
            </>
          )}

          {deleteStep === 3 && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={finalChecked}
                  onChange={(e) => setFinalChecked(e.target.checked)}
                />
                I understand this action is permanent
              </label>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteStep(2)}>
                  Go Back
                </Button>
                <Button
                  variant="destructive"
                  disabled={!finalChecked}
                  onClick={deleteCustomer}
                >
                  Delete Permanently
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

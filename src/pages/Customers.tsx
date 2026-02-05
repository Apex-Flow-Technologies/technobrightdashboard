import { orderBy } from "firebase/firestore";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, User, Phone, MapPin, Lock, AtSign } from "lucide-react"; // Added icons
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
  ChevronsUpDown,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Make sure to import Label
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
  DialogDescription, // Added Description
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
  CardContent,
} from "@/components/ui/card";

import { useToast } from "@/hooks/use-toast";

export default function Users() {
  const { toast } = useToast();

  // ---------------- EDIT CUSTOMER ----------------
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const editingCustomerId = editCustomer?.id || null;

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    address: "",
  });

  // ---------------- BULK UPLOAD ----------------
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkParsing, setBulkParsing] = useState(false);

  // ---------------- NORMAL STATE ----------------
  const [customers, setCustomers] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    username: "",
    password: "",
  });

  // ---------------- FETCH DATA ----------------
  const fetchCustomers = async () => {
    const q = query(
      collection(db, "user"),
      where("role", "==", "user"),
      orderBy("name", "asc")
    );
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
  const getMachineLabel = (m: any) => m?.machineCode || "Unnamed Machine";

  const assignedMachines = (customerId: string) =>
    machines.filter((m) => m.assignedTo === customerId);

  const availableMachines = (customerId: string) =>
    machines.filter((m) => !m.assignedTo || m.assignedTo === customerId);

  // ---------------- CREATE CUSTOMER ----------------
  const createCustomer = async () => {
    const { name, phone, address, username, password } = form;

    if (!name || !phone || !username || !password) {
      toast({
        title: "Missing fields",
        description: "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }

    await addDoc(collection(db, "user"), {
      name,
      phone,
      address,
      username,
      password,
      role: "user",
      createdAt: serverTimestamp(),
    });

    toast({ title: "Customer created" });

    setForm({
      name: "",
      phone: "",
      address: "",
      username: "",
      password: "",
    });

    setAddOpen(false);
    fetchCustomers();
  };

  // ---------------- EDIT CUSTOMER ----------------
  const saveCustomerEdits = async () => {
    if (!editingCustomerId) return;

    await updateDoc(doc(db, "user", editingCustomerId), {
      name: editForm.name,
      phone: editForm.phone,
      address: editForm.address,
    });

    toast({ title: "Customer updated" });
    setEditCustomer(null);
    fetchCustomers();
  };

  const assignMachine = async (machineId: string) => {
    if (!editingCustomerId) return;

    await updateDoc(doc(db, "machines", machineId), {
      assignedTo: editingCustomerId,
    });

    fetchMachines();
  };

  const unassignMachine = async (machineId: string) => {
    await updateDoc(doc(db, "machines", machineId), {
      assignedTo: null,
    });

    fetchMachines();
  };

  // ---------------- DELETE CUSTOMER ----------------
  const deleteCustomer = async (customer: any) => {
    const related = machines.filter((m) => m.assignedTo === customer.id);

    for (const m of related) {
      await updateDoc(doc(db, "machines", m.id), { assignedTo: null });
    }

    await deleteDoc(doc(db, "user", customer.id));
    toast({ title: "Customer deleted", variant: "destructive" });

    fetchCustomers();
    fetchMachines();
  };

  const filteredCustomers = customers.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  // ---------------- UI ----------------
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">
            Manage customers and assign machines
          </p>
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
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* CUSTOMER TABLE */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Customer List</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
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
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Machines</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.username}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>
                    {assignedMachines(c.id).length || "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditCustomer(c);
                            setEditForm({
                              name: c.name || "",
                              phone: c.phone || "",
                              address: c.address || "",
                            });
                          }}
                        >
                          <Wrench className="mr-2 h-4 w-4" />
                          Edit Customer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteCustomer(c)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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

      {/* ---------------- UPDATED ADD CUSTOMER DIALOG ---------------- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Customer</DialogTitle>
            <DialogDescription>
              Enter the details below to register a new customer account.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="John Doe"
                    className="pl-9"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="+91 98765 43210"
                    className="pl-9"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="address"
                  placeholder="Street, City, State"
                  className="pl-9"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="username">App Username</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="jdoe123"
                    className="pl-9"
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">App Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••"
                    className="pl-9"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createCustomer}>Create Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT CUSTOMER DIALOG */}
      <Dialog
        open={!!editCustomer}
        onOpenChange={() => setEditCustomer(null)}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>

          <Input
            value={editForm.name}
            onChange={(e) =>
              setEditForm({ ...editForm, name: e.target.value })
            }
          />
          <Input
            value={editForm.phone}
            onChange={(e) =>
              setEditForm({ ...editForm, phone: e.target.value })
            }
          />
          <Input
            value={editForm.address}
            onChange={(e) =>
              setEditForm({ ...editForm, address: e.target.value })
            }
          />

          {editingCustomerId && (
            <>
              <div className="mt-4">
                <h4 className="font-medium mb-2">Assigned Machines</h4>
                {assignedMachines(editingCustomerId).map((m) => (
                  <div
                    key={m.id}
                    className="flex justify-between items-center border rounded px-3 py-2 mb-2"
                  >
                    <span>{getMachineLabel(m)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => unassignMachine(m.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                  >
                    Assign Machine
                    <ChevronsUpDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0">
                  <Command>
                    <CommandInput placeholder="Search machine..." />
                    <CommandGroup>
                      {availableMachines(editingCustomerId).map((m) => (
                        <CommandItem
                          key={m.id}
                          onSelect={() => assignMachine(m.id)}
                        >
                          {getMachineLabel(m)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCustomer(null)}>
              Cancel
            </Button>
            <Button onClick={saveCustomerEdits}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK UPLOAD DIALOG */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Bulk Upload Customers</DialogTitle>
          </DialogHeader>

          {!bulkPreview.length ? (
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer"
              onClick={() => document.getElementById("bulkFile")?.click()}
            >
              <FileSpreadsheet className="mx-auto h-10 w-10" />
              <p className="mt-2 text-sm">Click to upload XLSX</p>
              <input
                id="bulkFile"
                type="file"
                accept=".xlsx"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setBulkParsing(true);
                  const buffer = await file.arrayBuffer();
                  const wb = XLSX.read(buffer);
                  const ws = wb.Sheets[wb.SheetNames[0]];
                  const data = XLSX.utils.sheet_to_json(ws);
                  setBulkPreview(data as any[]);
                  setBulkParsing(false);
                }}
              />
            </div>
          ) : (
            <DialogFooter>
              <Button
                disabled={bulkUploading}
                onClick={async () => {
                  setBulkUploading(true);
                  for (const r of bulkPreview) {
                    await addDoc(collection(db, "user"), {
                      ...r,
                      role: "user",
                      createdAt: serverTimestamp(),
                    });
                  }
                  setBulkUploading(false);
                  setBulkOpen(false);
                  setBulkPreview([]);
                  fetchCustomers();
                }}
              >
                Upload
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
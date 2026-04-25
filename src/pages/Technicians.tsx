import { useState, useEffect } from 'react';
import { Plus, Search, Phone, Mail, MoreHorizontal, Trash2, Edit, User as UserIcon, Lock, MapPin, AtSign, Loader2, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useStore, User } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Technicians() {
  const { technicians, addTechnician, updateTechnician, deleteTechnician, listenToTechnicians, listenToTickets } = useStore();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Add User State
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'technician' as 'technician' | 'manager',
    username: '',
    password: '',
    address: ''
  });

  // Edit User State
  const [editingUser, setEditingUser] = useState<(User & { password?: string }) | null>(null);

  useEffect(() => {
    const unsubStaff = listenToTechnicians();
    const unsubTickets = listenToTickets();
    return () => {
      unsubStaff();
      unsubTickets();
    };
  }, [listenToTechnicians, listenToTickets]);

  const filteredTechnicians = technicians.filter(
    (tech) =>
      (tech.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tech.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Validation Logic (Returns error message string or null) ---
  const getValidationError = (data: any, isEditMode: boolean = false): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // 1. Username
    if (!data.username || data.username.trim().length < 3) {
        return "Username must be at least 3 characters.";
    }

    // 2. Password
    if (!isEditMode) {
        if (!data.password || data.password.length < 6) {
            return "Password must be at least 6 characters.";
        }
    } else {
        // If editing and password field is used
        if (data.password && data.password.length < 6) {
            return "New password must be at least 6 characters.";
        }
    }

    // 3. Name
    if (!data.name || data.name.trim().length < 2) {
        return "Full Name must be at least 2 characters.";
    }

    // 4. Email
    if (!data.email) return "Email is required.";
    if (!emailRegex.test(data.email)) return "Invalid email format.";
    if (!data.email.toLowerCase().endsWith('@gmail.com')) {
        return "Email must be a valid @gmail.com address.";
    }

    // 5. Phone
    if (!data.phone) return "Phone number is required.";
    if (data.phone.length !== 10) return "Phone number must be exactly 10 digits.";

    return null; // No errors
  };

  // --- Handlers ---

  const handlePhoneChange = (val: string, setter: (v: string) => void) => {
    // Only allow numbers, max 10 digits
    const numericVal = val.replace(/\D/g, '').slice(0, 10);
    setter(numericVal);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errorMsg = getValidationError(newUser, false);
    if (errorMsg) {
        toast({
            variant: "destructive",
            title: "Input Error",
            description: errorMsg,
        });
        return;
    }

    try {
        await addTechnician(newUser);
        setIsAddDialogOpen(false);
        setNewUser({ name: '', email: '', phone: '', role: 'technician', username: '', password: '', address: '' });
        toast({
          title: 'User added',
          description: `${newUser.name} has been added to the team.`,
        });
    } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Creation Failed",
          description: err.message || "Failed to create staff member.",
        });
    }
  };

  const openEditDialog = (tech: User) => {
    setEditingUser({ ...tech, password: '' });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUser) {
        const errorMsg = getValidationError(editingUser, true);
        if (errorMsg) {
            toast({
                variant: "destructive",
                title: "Input Error",
                description: errorMsg,
            });
            return;
        }

        try {
            await updateTechnician(editingUser.id, editingUser);
            setIsEditDialogOpen(false);
            setEditingUser(null);
            toast({
                title: 'Staff updated',
                description: `${editingUser.name}'s details have been updated.`,
            });
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Update Failed",
                description: err.message || "Failed to update staff member.",
            });
        }
    }
  };

  const handleDelete = (tech: User) => {
    deleteTechnician(tech.id, tech.uid);
    toast({
      title: 'User removed',
      description: `${tech.name} has been removed from the team.`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Technicians</h1>
          <p className="text-muted-foreground mt-1">Manage your field service team</p>
        </div>

        {/* --- ADD USER DIALOG --- */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Staff
            </Button>
          </DialogTrigger>
          {/* Increased width to max-w-lg for better spacing */}
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Team Member</DialogTitle>
              <DialogDescription>
                Create a new account. All fields are validated on submit.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUser}>
              <div className="grid gap-4 py-4">
                {/* Row 1: Username & Password */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <div className="relative">
                            <UserIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="username"
                                placeholder="jdoe"
                                value={newUser.username}
                                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                className="pl-8"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                            <Lock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••"
                                value={newUser.password}
                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </div>

                {/* Row 2: Name & Role */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            placeholder="John Doe"
                            value={newUser.name}
                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                            value={newUser.role}
                            onValueChange={(value: 'technician' | 'manager') =>
                            setNewUser({ ...newUser, role: value })
                            }
                        >
                            <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="technician">Technician</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Row 3: Email & Phone */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="john@apex.com"
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <div className="relative">
                            <Phone className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="phone"
                                placeholder="10 digits"
                                value={newUser.phone}
                                maxLength={10}
                                onChange={(e) => handlePhoneChange(e.target.value, (val) => setNewUser({...newUser, phone: val}))}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </div>

                {/* Row 4: Address (Full Width) */}
                <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <div className="relative">
                        <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="address"
                            className="pl-8"
                            placeholder="City, State" 
                            value={newUser.address || ''} 
                            onChange={(e) => setNewUser({...newUser, address: e.target.value})} 
                        />
                    </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Staff</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Team Members</CardTitle>
              <CardDescription>{technicians.length} total members</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[280px]">Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-center">Active Jobs</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTechnicians.map((tech) => (
                  <TableRow key={tech.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {(tech.name || "U").split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{tech.name}</p>
                          <p className="text-xs text-muted-foreground">{tech.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={tech.role === 'manager' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {tech.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {tech.phone}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-medium">
                        {tech.activeJobs}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(tech)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(tech)}
                            className="text-destructive focus:text-destructive"
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
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-border">
            {filteredTechnicians.map((tech) => (
              <div key={tech.id} className="p-4 space-y-4 active:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                      <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
                        {(tech.name || "U").split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{tech.name}</p>
                      <Badge
                        variant={tech.role === 'manager' ? 'default' : 'secondary'}
                        className="mt-1 h-5 text-[10px] uppercase tracking-wider"
                      >
                        {tech.role}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 -mr-2">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => openEditDialog(tech)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(tech)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Staff
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contact</p>
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      {tech.phone}
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Jobs</p>
                    <div className="inline-flex items-center gap-1.5 font-bold text-primary">
                      <Ticket className="h-3.5 w-3.5" />
                      {tech.activeJobs}
                    </div>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{tech.email}</span>
                </div>
              </div>
            ))}
            {filteredTechnicians.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-muted-foreground">No matching staff found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- EDIT USER DIALOG --- */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { if(!open) setEditingUser(null); setIsEditDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit Team Member</DialogTitle>
                <DialogDescription>Update details for {editingUser?.name}</DialogDescription>
            </DialogHeader>
            {editingUser && (
                <form onSubmit={handleUpdateUser}>
                    <div className="grid gap-4 py-4">
                        {/* Row 1: Username & Password */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-username">Username</Label>
                                <div className="relative">
                                    <UserIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="edit-username"
                                        value={editingUser.username || ''}
                                        onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                                        className="pl-8"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-password">New Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="edit-password"
                                        type="password"
                                        placeholder="Blank to keep"
                                        value={editingUser.password}
                                        onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                                        className="pl-8"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Name & Role */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Full Name</Label>
                                <Input
                                    id="edit-name"
                                    value={editingUser.name}
                                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-role">Role</Label>
                                <Select
                                    value={editingUser.role}
                                    onValueChange={(value: 'technician' | 'manager') =>
                                        setEditingUser({ ...editingUser, role: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="technician">Technician</SelectItem>
                                        <SelectItem value="manager">Manager</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        {/* Row 3: Email & Phone */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-email">Email Address</Label>
                                <Input
                                    id="edit-email"
                                    type="email"
                                    value={editingUser.email}
                                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-phone">Phone Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="edit-phone"
                                        value={editingUser.phone}
                                        maxLength={10}
                                        onChange={(e) => handlePhoneChange(e.target.value, (val) => setEditingUser({...editingUser, phone: val}))}
                                        className="pl-8"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Row 4: Address */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-address">Address</Label>
                            <div className="relative">
                                <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    id="edit-address"
                                    className="pl-8"
                                    value={editingUser.address || ''}
                                    onChange={(e) => setEditingUser({...editingUser, address: e.target.value})} 
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Save Changes</Button>
                    </DialogFooter>
                </form>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, UserPlus, Eye, EyeOff, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// Schema
const addUserSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(['technician', 'manager', 'admin']),
  phone: z.string().optional(),
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

export default function AddUser() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      role: 'technician',
      name: '',
      email: '',
      password: '',
      phone: ''
    }
  });

  const onSubmit = async (data: AddUserFormValues) => {
    setIsLoading(true);

    try {
      // --- MOCK LOGIC (Replace with Firebase logic later) ---
      console.log("Creating user:", data);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
      
      toast({
        title: "User Created",
        description: `${data.name} has been added as a ${data.role}.`,
      });

      reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to create user.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto pt-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Add New User</h1>
        <p className="text-muted-foreground mt-1">Create an account for a new team member</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-primary/10">
               <UserPlus className="h-5 w-5 text-primary" />
             </div>
             <div>
                <CardTitle>User Details</CardTitle>
                <CardDescription>Enter the credentials for the new employee</CardDescription>
             </div>
          </div>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Name & Role */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="John Doe" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                
                <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select onValueChange={(val) => setValue('role', val as any)} defaultValue="technician">
                    <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">User</SelectItem>
                    </SelectContent>
                </Select>
                {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
                </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="john@company.com" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••" 
                    {...register('password')} 
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                >
                    {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                </Button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            {/* Phone (Optional) */}
            <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input id="phone" placeholder="+1 234 567 8900" {...register('phone')} />
            </div>

            <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Create Account
                </Button>
            </div>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}
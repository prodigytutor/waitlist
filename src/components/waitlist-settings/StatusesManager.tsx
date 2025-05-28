"use client";

import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { v4 as uuidv4 } from 'uuid'; // For generating new status IDs

export interface StatusDefinition {
  id: string;
  name: string;
  color?: string;
  order: number;
}

interface StatusesManagerProps {
  waitlistId: string;
}

const StatusesManager = ({ waitlistId }: StatusesManagerProps) => {
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // For the dialog form
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<Partial<StatusDefinition> | null>(null); // For add/edit
  const [isEditing, setIsEditing] = useState(false);

  const fetchStatuses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/waitlists/${waitlistId}/statuses`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch statuses: ${response.status}`);
      }
      const data: StatusDefinition[] = await response.json();
      setStatuses(data.sort((a, b) => a.order - b.order)); // Ensure sorted by order
    } catch (err: any) {
      setError(err.message);
      toast.error(`Error fetching statuses: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (waitlistId) {
      fetchStatuses();
    }
  }, [waitlistId]);

  const handleOpenDialog = (status?: StatusDefinition) => {
    if (status) {
      setCurrentStatus({ ...status });
      setIsEditing(true);
    } else {
      // Find the highest current order to suggest the next one
      const maxOrder = statuses.reduce((max, s) => Math.max(max, s.order), 0);
      setCurrentStatus({ id: `s_${uuidv4().substring(0,8)}`, name: '', color: '#000000', order: (maxOrder + 1) });
      setIsEditing(false);
    }
    setIsDialogOpen(true);
  };

  const handleDialogFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentStatus) return;
    const { name, value, type } = e.target;
    setCurrentStatus(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value,
    }));
  };

  const handleSaveStatus = () => {
    if (!currentStatus || !currentStatus.id || !currentStatus.name || currentStatus.order === undefined) {
      toast.error("ID, Name, and Order are required.");
      return;
    }

    let updatedStatuses;
    if (isEditing) {
      updatedStatuses = statuses.map(s => s.id === currentStatus.id ? currentStatus as StatusDefinition : s);
    } else {
      // Check for duplicate ID or order before adding
      if (statuses.find(s => s.id === currentStatus.id)) {
        toast.error(`Status ID "${currentStatus.id}" already exists.`);
        return;
      }
       if (statuses.find(s => s.order === currentStatus.order)) {
        toast.error(`Status order "${currentStatus.order}" already exists. Please choose a unique order.`);
        return;
      }
      updatedStatuses = [...statuses, currentStatus as StatusDefinition];
    }
    // Re-sort by order before setting local state or submitting
    updatedStatuses.sort((a, b) => a.order - b.order);
    setStatuses(updatedStatuses); // Optimistic update for UI responsiveness
    setIsDialogOpen(false);
    // Note: Actual submission happens with "Save All Changes" button
  };
  
  const handleRemoveStatus = (statusId: string) => {
    if (!window.confirm("Are you sure you want to remove this status? This will remove it from the list. Save all changes to persist.")) {
        return;
    }
    setStatuses(prev => prev.filter(s => s.id !== statusId));
    // Note: Actual submission happens with "Save All Changes" button
  };

  const handleSubmitAllChanges = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Validate unique order before submitting
      const orders = new Set();
      for(const status of statuses) {
        if(orders.has(status.order)) {
          toast.error(`Duplicate order found: ${status.order}. Please ensure all statuses have unique orders.`);
          setIsSubmitting(false);
          return;
        }
        orders.add(status.order);
      }

      const response = await fetch(`/api/waitlists/${waitlistId}/statuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statuses),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save statuses: ${response.status}`);
      }
      const data = await response.json();
      setStatuses(data.sort((a: StatusDefinition, b: StatusDefinition) => a.order - b.order));
      toast.success("Statuses saved successfully!");
    } catch (err: any) {
      setError(err.message);
      toast.error(`Error saving statuses: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Function to handle manual order changes directly in the table
  const handleOrderChange = (statusId: string, newOrder: number) => {
    setStatuses(prevStatuses => 
      prevStatuses.map(s => 
        s.id === statusId ? { ...s, order: newOrder } : s
      ).sort((a,b) => a.order - b.order) // Keep sorted by order
    );
  };


  if (isLoading) return <p>Loading statuses...</p>;
  if (error && statuses.length === 0) return <p className="text-red-500">Error: {error}</p>;


  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Manage Lead Statuses</h2>
        <Button onClick={() => handleOpenDialog()}>Add New Status</Button>
      </div>

      {error && <p className="text-red-500 mb-4">Error: {error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statuses.map((status) => (
            <TableRow key={status.id}>
              <TableCell>{status.id}</TableCell>
              <TableCell>{status.name}</TableCell>
              <TableCell>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: status.color || '#ccc', borderRadius: '4px' }} />
                  {status.color}
                </div>
              </TableCell>
              <TableCell>
                 <Input 
                    type="number" 
                    value={status.order} 
                    onChange={(e) => handleOrderChange(status.id, parseInt(e.target.value, 10))}
                    className="w-20"
                 />
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" onClick={() => handleOpenDialog(status)} className="mr-2">Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => handleRemoveStatus(status.id)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {statuses.length === 0 && !isLoading && <p className="mt-4 text-center text-gray-500">No statuses defined yet.</p>}

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSubmitAllChanges} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      {/* Dialog for Add/Edit Status */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Status' : 'Add New Status'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details of this status.' : 'Define a new status for your lead pipeline.'}
            </DialogDescription>
          </DialogHeader>
          {currentStatus && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status-id" className="text-right">ID</Label>
                <Input id="status-id" name="id" value={currentStatus.id || ''} onChange={handleDialogFormChange} className="col-span-3" disabled={isEditing} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status-name" className="text-right">Name</Label>
                <Input id="status-name" name="name" value={currentStatus.name || ''} onChange={handleDialogFormChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status-color" className="text-right">Color</Label>
                <Input id="status-color" name="color" type="color" value={currentStatus.color || '#000000'} onChange={handleDialogFormChange} className="col-span-3 h-10" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status-order" className="text-right">Order</Label>
                <Input id="status-order" name="order" type="number" value={currentStatus.order === undefined ? '' : currentStatus.order} onChange={handleDialogFormChange} className="col-span-3" />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveStatus}>Save Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StatusesManager;

"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { v4 as uuidv4 } from 'uuid'; // For generating new field IDs

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  order: number;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface CustomFieldsManagerProps {
  waitlistId: string;
}

const CustomFieldsManager = ({ waitlistId }: CustomFieldsManagerProps) => {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentField, setCurrentField] = useState<Partial<CustomFieldDefinition> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [optionsString, setOptionsString] = useState(""); // For handling options input

  const fetchDefinitions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/waitlists/${waitlistId}/customfields/definitions`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch custom fields: ${response.status}`);
      }
      const data: CustomFieldDefinition[] = await response.json();
      setDefinitions(data.sort((a, b) => a.order - b.order));
    } catch (err: any) {
      setError(err.message);
      toast.error(`Error fetching custom fields: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (waitlistId) {
      fetchDefinitions();
    }
  }, [waitlistId]);

  const handleOpenDialog = (field?: CustomFieldDefinition) => {
    if (field) {
      setCurrentField({ ...field });
      setOptionsString(field.options ? field.options.join(', ') : "");
      setIsEditing(true);
    } else {
      const maxOrder = definitions.reduce((max, f) => Math.max(max, f.order), 0);
      setCurrentField({ 
        id: `cf_${uuidv4().substring(0,8)}`, 
        name: '', 
        type: 'text', 
        order: (maxOrder + 1), 
        required: false, 
        options: [], 
        placeholder: '' 
      });
      setOptionsString("");
      setIsEditing(false);
    }
    setIsDialogOpen(true);
  };

  const handleDialogFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!currentField) return;
    const { name, value, type } = e.target;
     if (type === 'checkbox') {
        setCurrentField(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
        setCurrentField(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) : value }));
    }
  };
  
  const handleSelectChange = (value: string) => {
     if (!currentField) return;
     setCurrentField(prev => ({ ...prev, type: value as CustomFieldDefinition['type']}));
  };

  const handleSaveField = () => {
    if (!currentField || !currentField.id || !currentField.name || !currentField.type || currentField.order === undefined) {
      toast.error("ID, Name, Type, and Order are required.");
      return;
    }
    if (currentField.type === 'select' && (!optionsString || optionsString.trim() === '')) {
        toast.error("Options (comma-separated) are required for select type.");
        return;
    }

    const fieldToSave: CustomFieldDefinition = {
        ...currentField,
        options: currentField.type === 'select' ? optionsString.split(',').map(opt => opt.trim()).filter(opt => opt) : [],
    } as CustomFieldDefinition;


    let updatedDefinitions;
    if (isEditing) {
      updatedDefinitions = definitions.map(f => f.id === fieldToSave.id ? fieldToSave : f);
    } else {
      if (definitions.find(f => f.id === fieldToSave.id)) {
        toast.error(`Custom Field ID "${fieldToSave.id}" already exists.`);
        return;
      }
      if (definitions.find(f => f.order === fieldToSave.order)) {
        toast.error(`Custom Field order "${fieldToSave.order}" already exists.`);
        return;
      }
      updatedDefinitions = [...definitions, fieldToSave];
    }
    updatedDefinitions.sort((a, b) => a.order - b.order);
    setDefinitions(updatedDefinitions);
    setIsDialogOpen(false);
  };

  const handleRemoveField = (fieldId: string) => {
     if (!window.confirm("Are you sure you want to remove this custom field? This will remove it from the list. Save all changes to persist.")) {
        return;
    }
    setDefinitions(prev => prev.filter(f => f.id !== fieldId));
  };
  
  const handleOrderChange = (fieldId: string, newOrder: number) => {
    setDefinitions(prevDefs => 
      prevDefs.map(f => 
        f.id === fieldId ? { ...f, order: newOrder } : f
      ).sort((a,b) => a.order - b.order)
    );
  };

  const handleSubmitAllChanges = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Validate unique order and ID before submitting
      const orders = new Set();
      const ids = new Set();
      for(const field of definitions) {
        if(orders.has(field.order)) {
          toast.error(`Duplicate order found: ${field.order}. Please ensure all fields have unique orders.`);
          setIsSubmitting(false);
          return;
        }
        orders.add(field.order);
        if(ids.has(field.id)) {
          // This check is more for local manipulation, as server should handle ID uniqueness on creation.
          // However, for a list being sent, it's good to ensure consistency.
          toast.error(`Duplicate ID found: ${field.id}. This shouldn't happen if using UUIDs for new fields.`);
          setIsSubmitting(false);
          return;
        }
        ids.add(field.id);
      }


      const response = await fetch(`/api/waitlists/${waitlistId}/customfields/definitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(definitions),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save custom fields: ${response.status}`);
      }
      const data = await response.json();
      setDefinitions(data.sort((a: CustomFieldDefinition, b: CustomFieldDefinition) => a.order - b.order));
      toast.success("Custom fields saved successfully!");
    } catch (err: any) {
      setError(err.message);
      toast.error(`Error saving custom fields: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <p>Loading custom field definitions...</p>;
  if (error && definitions.length === 0) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Manage Custom Fields</h2>
        <Button onClick={() => handleOpenDialog()}>Add New Field</Button>
      </div>
      {error && <p className="text-red-500 mb-4">Error: {error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Required</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {definitions.map((field) => (
            <TableRow key={field.id}>
              <TableCell>{field.id}</TableCell>
              <TableCell>{field.name}</TableCell>
              <TableCell>{field.type}</TableCell>
              <TableCell>
                <Input 
                    type="number" 
                    value={field.order} 
                    onChange={(e) => handleOrderChange(field.id, parseInt(e.target.value, 10))}
                    className="w-20"
                 />
              </TableCell>
              <TableCell>{field.required ? 'Yes' : 'No'}</TableCell>
              <TableCell>
                <Button variant="outline" size="sm" onClick={() => handleOpenDialog(field)} className="mr-2">Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => handleRemoveField(field.id)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {definitions.length === 0 && !isLoading && <p className="mt-4 text-center text-gray-500">No custom fields defined yet.</p>}
      <div className="mt-6 flex justify-end">
        <Button onClick={handleSubmitAllChanges} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Custom Field' : 'Add New Custom Field'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details of this custom field.' : 'Define a new custom field for your leads.'}
            </DialogDescription>
          </DialogHeader>
          {currentField && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="field-id" className="text-right">ID</Label>
                <Input id="field-id" name="id" value={currentField.id || ''} onChange={handleDialogFormChange} className="col-span-3" disabled={isEditing} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="field-name" className="text-right">Name</Label>
                <Input id="field-name" name="name" value={currentField.name || ''} onChange={handleDialogFormChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="field-type" className="text-right">Type</Label>
                <Select name="type" value={currentField.type || 'text'} onValueChange={handleSelectChange}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select field type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="select">Select</SelectItem>
                    <SelectItem value="textarea">Textarea</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {currentField.type === 'select' && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="field-options" className="text-right">Options (CSV)</Label>
                  <Input 
                    id="field-options" 
                    name="options" 
                    value={optionsString} 
                    onChange={(e) => setOptionsString(e.target.value)} 
                    className="col-span-3" 
                    placeholder="e.g., Option A, Option B"
                  />
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="field-order" className="text-right">Order</Label>
                <Input id="field-order" name="order" type="number" value={currentField.order === undefined ? '' : currentField.order} onChange={handleDialogFormChange} className="col-span-3" />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="field-placeholder" className="text-right">Placeholder</Label>
                <Input id="field-placeholder" name="placeholder" value={currentField.placeholder || ''} onChange={handleDialogFormChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="field-required" className="text-right">Required</Label>
                <div className="col-span-3 flex items-center">
                    <Checkbox 
                        id="field-required" 
                        name="required" 
                        checked={currentField.required || false} 
                        onCheckedChange={(checked) => setCurrentField(prev => ({...prev, required: !!checked}))}
                    />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSaveField}>Save Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomFieldsManager;

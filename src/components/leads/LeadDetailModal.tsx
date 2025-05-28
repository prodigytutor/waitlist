"use client";

import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay, // Added for better modal behavior
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { StatusDefinition, CustomFieldDefinition } from '@/lib/redis'; // Assuming these types are exported

// Define a more detailed Lead interface based on what redis.ts provides
export interface LeadData {
  id: string;
  email: string;
  createdAt: string;
  originalWaitlistId: string;
  currentStatusId: string;
  currentScore: number;
  customFields?: Record<string, string>;
}

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string | null;
  // waitlistId is implicitly leadData.originalWaitlistId after fetch
}

const LeadDetailModal = ({ isOpen, onClose, leadId }: LeadDetailModalProps) => {
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [statusDefs, setStatusDefs] = useState<StatusDefinition[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For editing
  const [editableLeadData, setEditableLeadData] = useState<Partial<LeadData>>({});
  const [editableCustomFields, setEditableCustomFields] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLeadAllDetails();
    } else {
      // Reset state when modal is closed or leadId is null
      setLeadData(null);
      setCustomFieldDefs([]);
      setStatusDefs([]);
      setEditableLeadData({});
      setEditableCustomFields({});
      setError(null);
    }
  }, [isOpen, leadId]);

  const fetchLeadAllDetails = async () => {
    if (!leadId) return;
    setIsLoading(true);
    setError(null);
    try {
      // Fetch lead details first to get originalWaitlistId
      const leadDetailsRes = await fetch(`/api/leads/${leadId}`);
      if (!leadDetailsRes.ok) {
        const errorData = await leadDetailsRes.json();
        throw new Error(errorData.error || `Failed to fetch lead details: ${leadDetailsRes.status}`);
      }
      const fetchedLeadData: LeadData = await leadDetailsRes.json();
      setLeadData(fetchedLeadData);
      setEditableLeadData({ currentStatusId: fetchedLeadData.currentStatusId }); // Initialize editable status
      setEditableCustomFields(fetchedLeadData.customFields || {}); // Initialize editable custom fields

      if (fetchedLeadData.originalWaitlistId) {
        const [customFieldsRes, statusesRes] = await Promise.all([
          fetch(`/api/waitlists/${fetchedLeadData.originalWaitlistId}/customfields/definitions`),
          fetch(`/api/waitlists/${fetchedLeadData.originalWaitlistId}/statuses`),
        ]);

        if (!customFieldsRes.ok) {
          const errorData = await customFieldsRes.json();
          console.warn(`Failed to fetch custom field definitions: ${errorData.error || customFieldsRes.status}`);
          // Not throwing error, can still view basic lead info
        } else {
          const cfData: CustomFieldDefinition[] = await customFieldsRes.json();
          setCustomFieldDefs(cfData.sort((a, b) => a.order - b.order));
        }

        if (!statusesRes.ok) {
          const errorData = await statusesRes.json();
          console.warn(`Failed to fetch status definitions: ${errorData.error || statusesRes.status}`);
           // Not throwing error
        } else {
          const sData: StatusDefinition[] = await statusesRes.json();
          setStatusDefs(sData.sort((a, b) => a.order - b.order));
        }
      } else {
        console.warn("Lead data is missing originalWaitlistId. Cannot fetch related definitions.");
      }

    } catch (err: any) {
      console.error("Error fetching lead modal data:", err);
      setError(err.message);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomFieldChange = (fieldId: string, value: string) => {
    setEditableCustomFields(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleStatusChange = (newStatusId: string) => {
    setEditableLeadData(prev => ({ ...prev, currentStatusId: newStatusId }));
  };

  const handleSaveChanges = async () => {
    if (!leadId || !leadData) return;
    setIsSaving(true);

    try {
      // Save status if changed
      if (editableLeadData.currentStatusId && editableLeadData.currentStatusId !== leadData.currentStatusId) {
        const statusUpdateRes = await fetch(`/api/leads/${leadId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statusId: editableLeadData.currentStatusId }),
        });
        if (!statusUpdateRes.ok) {
          const errorData = await statusUpdateRes.json();
          throw new Error(errorData.error || 'Failed to update status');
        }
      }

      // Save custom fields (even if unchanged, could be simplified to send only diffs)
      const customFieldsUpdateRes = await fetch(`/api/leads/${leadId}/customfields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editableCustomFields),
      });
      if (!customFieldsUpdateRes.ok) {
        const errorData = await customFieldsUpdateRes.json();
        throw new Error(errorData.error || 'Failed to update custom fields');
      }
      
      toast.success("Lead details saved successfully!");
      onClose(); // Close modal on success
      // Parent page should handle refreshing its data if needed
    } catch (err: any) {
      console.error("Error saving lead details:", err);
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  const currentStatusName = statusDefs.find(s => s.id === editableLeadData.currentStatusId)?.name || editableLeadData.currentStatusId;


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}> {/* Prevent close on outside click if desired or handle specific cases */}
        <DialogHeader>
          <DialogTitle>Lead Details: {leadData?.email || 'Loading...'}</DialogTitle>
          {leadData && <DialogDescription>ID: {leadData.id}</DialogDescription>}
        </DialogHeader>
        
        {isLoading && <p>Loading details...</p>}
        {error && <p className="text-red-500">Error: {error}</p>}

        {!isLoading && !error && leadData && (
          <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-4">
            <h3 className="text-lg font-semibold mb-2">Core Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email:</Label> <p>{leadData.email}</p></div>
              <div><Label>Joined At:</Label> <p>{new Date(leadData.createdAt).toLocaleString()}</p></div>
              <div><Label>Score:</Label> <p>{leadData.currentScore}</p></div>
              <div>
                <Label htmlFor="lead-status">Status:</Label>
                <Select 
                    value={editableLeadData.currentStatusId || ''} 
                    onValueChange={handleStatusChange}
                    disabled={statusDefs.length === 0}
                >
                  <SelectTrigger id="lead-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusDefs.map(sDef => (
                      <SelectItem key={sDef.id} value={sDef.id}>
                        {sDef.name} ({sDef.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {customFieldDefs.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-4 mb-2">Custom Fields</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFieldDefs.map(def => (
                    <div key={def.id}>
                      <Label htmlFor={`cf-${def.id}`}>{def.name}{def.required && "*"}</Label>
                      {def.type === 'text' && (
                        <Input 
                          id={`cf-${def.id}`} 
                          value={editableCustomFields[def.id] || ''}
                          onChange={(e) => handleCustomFieldChange(def.id, e.target.value)}
                          placeholder={def.placeholder}
                        />
                      )}
                      {def.type === 'number' && (
                        <Input 
                          id={`cf-${def.id}`} 
                          type="number"
                          value={editableCustomFields[def.id] || ''}
                          onChange={(e) => handleCustomFieldChange(def.id, e.target.value)}
                          placeholder={def.placeholder}
                        />
                      )}
                      {def.type === 'date' && (
                        <Input 
                          id={`cf-${def.id}`} 
                          type="date"
                          value={editableCustomFields[def.id] || ''}
                          onChange={(e) => handleCustomFieldChange(def.id, e.target.value)}
                          placeholder={def.placeholder}
                        />
                      )}
                      {def.type === 'textarea' && (
                        <Textarea
                          id={`cf-${def.id}`}
                          value={editableCustomFields[def.id] || ''}
                          onChange={(e) => handleCustomFieldChange(def.id, e.target.value)}
                          placeholder={def.placeholder}
                        />
                      )}
                      {def.type === 'select' && (
                        <Select 
                          value={editableCustomFields[def.id] || ''}
                          onValueChange={(value) => handleCustomFieldChange(def.id, value)}
                        >
                          <SelectTrigger id={`cf-${def.id}`}>
                            <SelectValue placeholder={def.placeholder || "Select..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {def.options?.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        
        <DialogFooter className="mt-auto pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSaveChanges} disabled={isLoading || isSaving || !leadData}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailModal;

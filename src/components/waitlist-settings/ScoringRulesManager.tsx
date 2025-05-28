"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
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
import { v4 as uuidv4 } from 'uuid';
import { Trash2 } from 'lucide-react';
import { CustomFieldDefinition, getCustomFieldDefinitions } from '@/lib/redis'; // Server-side, use API

export interface ScoringRuleCondition {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_set' | 'is_not_set' | 'greater_than' | 'less_than' | 'domain_equals' | 'domain_not_equals';
  value?: any;
}

export interface ScoringRuleConditionGroup {
  logicalOperator: 'AND' | 'OR';
  conditions: ScoringRuleCondition[];
}

export interface ScoringRule {
  ruleId: string;
  description?: string;
  points: number;
  conditionGroup: ScoringRuleConditionGroup;
}

interface ScoringRulesManagerProps {
  waitlistId: string;
}

const ScoringRulesManager = ({ waitlistId }: ScoringRulesManagerProps) => {
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<Partial<ScoringRule> | null>(null);
  const [isEditingRule, setIsEditingRule] = useState(false);

  const fetchRulesAndFields = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rulesResponse, fieldsResponse] = await Promise.all([
        fetch(`/api/waitlists/${waitlistId}/scoring/rules`),
        fetch(`/api/waitlists/${waitlistId}/customfields/definitions`)
      ]);

      if (!rulesResponse.ok) {
        const errorData = await rulesResponse.json();
        throw new Error(errorData.error || `Failed to fetch scoring rules: ${rulesResponse.status}`);
      }
      const rulesData: ScoringRule[] = await rulesResponse.json();
      setRules(rulesData);

      if (!fieldsResponse.ok) {
        const errorData = await fieldsResponse.json();
        throw new Error(errorData.error || `Failed to fetch custom fields: ${fieldsResponse.status}`);
      }
      const fieldsData: CustomFieldDefinition[] = await fieldsResponse.json();
      setCustomFields(fieldsData);

    } catch (err: any) {
      setError(err.message);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (waitlistId) {
      fetchRulesAndFields();
    }
  }, [waitlistId]);

  const handleOpenRuleDialog = (rule?: ScoringRule) => {
    if (rule) {
      setCurrentRule(JSON.parse(JSON.stringify(rule))); // Deep copy
      setIsEditingRule(true);
    } else {
      setCurrentRule({
        ruleId: `rule_${uuidv4().substring(0,8)}`,
        points: 0,
        conditionGroup: { logicalOperator: 'AND', conditions: [{ fieldId: '', operator: 'equals', value: '' }] },
      });
      setIsEditingRule(false);
    }
    setIsDialogOpen(true);
  };
  
  const handleRuleChange = (field: keyof ScoringRule, value: any) => {
    setCurrentRule(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleConditionGroupChange = (field: keyof ScoringRuleConditionGroup, value: any) => {
    setCurrentRule(prev => prev ? { ...prev, conditionGroup: { ...prev.conditionGroup!, [field]: value } } : null);
  };
  
  const handleConditionChange = (index: number, field: keyof ScoringRuleCondition, value: any) => {
    setCurrentRule(prev => {
      if (!prev || !prev.conditionGroup) return prev;
      const newConditions = [...prev.conditionGroup.conditions];
      newConditions[index] = { ...newConditions[index], [field]: value };
      return { ...prev, conditionGroup: { ...prev.conditionGroup, conditions: newConditions } };
    });
  };

  const addCondition = () => {
    setCurrentRule(prev => {
      if (!prev || !prev.conditionGroup) return prev;
      const newConditions = [...prev.conditionGroup.conditions, { fieldId: '', operator: 'equals', value: '' }];
      return { ...prev, conditionGroup: { ...prev.conditionGroup, conditions: newConditions } };
    });
  };

  const removeCondition = (index: number) => {
    setCurrentRule(prev => {
      if (!prev || !prev.conditionGroup || prev.conditionGroup.conditions.length <= 1) return prev; // Must have at least one condition
      const newConditions = prev.conditionGroup.conditions.filter((_, i) => i !== index);
      return { ...prev, conditionGroup: { ...prev.conditionGroup, conditions: newConditions } };
    });
  };

  const handleSaveRule = () => {
    if (!currentRule || !currentRule.ruleId || !currentRule.conditionGroup || currentRule.conditionGroup.conditions.length === 0) {
      toast.error("Rule ID and at least one condition are required.");
      return;
    }
    // Further validation for each condition can be added here

    let updatedRules;
    if (isEditingRule) {
      updatedRules = rules.map(r => r.ruleId === currentRule.ruleId ? currentRule as ScoringRule : r);
    } else {
      if (rules.find(r => r.ruleId === currentRule.ruleId)) {
        toast.error(`Rule ID "${currentRule.ruleId}" already exists.`);
        return;
      }
      updatedRules = [...rules, currentRule as ScoringRule];
    }
    setRules(updatedRules);
    setIsDialogOpen(false);
  };
  
  const handleRemoveRule = (ruleId: string) => {
    if (!window.confirm("Are you sure you want to remove this scoring rule? This will remove it from the list. Save all changes to persist.")) {
        return;
    }
    setRules(prev => prev.filter(r => r.ruleId !== ruleId));
  };

  const handleSubmitAllChanges = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/waitlists/${waitlistId}/scoring/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save scoring rules: ${response.status}`);
      }
      const data = await response.json();
      setRules(data);
      toast.success("Scoring rules saved successfully!");
    } catch (err: any) {
      setError(err.message);
      toast.error(`Error saving scoring rules: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const availableFieldsForConditions = [
    { id: 'currentStatusId', name: 'Lead Status', type: 'select', options: [] }, // Status options can be fetched if needed
    ...customFields.map(cf => ({ id: cf.id, name: cf.name, type: cf.type, options: cf.options }))
  ];


  if (isLoading) return <p>Loading scoring rules and custom fields...</p>;
  if (error && rules.length === 0) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Manage Scoring Rules</h2>
        <Button onClick={() => handleOpenRuleDialog()}>Add New Rule</Button>
      </div>
      {error && <p className="text-red-500 mb-4">Error: {error}</p>}
      
      <div className="space-y-4">
        {rules.map((rule, ruleIndex) => (
          <div key={rule.ruleId} className="p-4 border rounded-md">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-semibold text-lg">{rule.description || rule.ruleId}</h3>
                    <p className="text-sm text-muted-foreground">Points: {rule.points}</p>
                </div>
                <div>
                    <Button variant="outline" size="sm" onClick={() => handleOpenRuleDialog(rule)} className="mr-2">Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleRemoveRule(rule.ruleId)}>Delete</Button>
                </div>
            </div>
            <div className="mt-2 pl-4 border-l-2">
                <p className="text-xs uppercase text-muted-foreground mb-1">
                    IF ({rule.conditionGroup.logicalOperator})
                </p>
                {rule.conditionGroup.conditions.map((cond, condIndex) => (
                    <p key={condIndex} className="text-sm">
                        - <strong>{customFields.find(cf => cf.id === cond.fieldId)?.name || cond.fieldId}</strong> {cond.operator} <strong>{String(cond.value)}</strong>
                    </p>
                ))}
            </div>
          </div>
        ))}
      </div>

      {rules.length === 0 && !isLoading && <p className="mt-4 text-center text-gray-500">No scoring rules defined yet.</p>}

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSubmitAllChanges} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditingRule ? 'Edit Scoring Rule' : 'Add New Scoring Rule'}</DialogTitle>
          </DialogHeader>
          {currentRule && (
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <Label htmlFor="rule-id">Rule ID</Label>
                <Input id="rule-id" value={currentRule.ruleId || ''} onChange={(e) => handleRuleChange('ruleId', e.target.value)} disabled={isEditingRule} />
              </div>
              <div>
                <Label htmlFor="rule-description">Description (Optional)</Label>
                <Input id="rule-description" value={currentRule.description || ''} onChange={(e) => handleRuleChange('description', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rule-points">Points</Label>
                <Input id="rule-points" type="number" value={currentRule.points || 0} onChange={(e) => handleRuleChange('points', parseInt(e.target.value, 10))} />
              </div>

              <div className="border p-3 rounded-md space-y-3">
                <Label>Condition Group</Label>
                <Select value={currentRule.conditionGroup?.logicalOperator || 'AND'} onValueChange={(val) => handleConditionGroupChange('logicalOperator', val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">All conditions must be met (AND)</SelectItem>
                    <SelectItem value="OR">Any condition can be met (OR)</SelectItem>
                  </SelectContent>
                </Select>

                {currentRule.conditionGroup?.conditions.map((condition, index) => (
                  <div key={index} className="border p-3 rounded-md space-y-2 relative">
                    <Label>Condition {index + 1}</Label>
                     {currentRule.conditionGroup!.conditions.length > 1 && (
                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeCondition(index)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                     )}
                    <Select value={condition.fieldId} onValueChange={(val) => handleConditionChange(index, 'fieldId', val)}>
                      <SelectTrigger><SelectValue placeholder="Select field..." /></SelectTrigger>
                      <SelectContent>
                        {availableFieldsForConditions.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={condition.operator} onValueChange={(val) => handleConditionChange(index, 'operator', val)}>
                      <SelectTrigger><SelectValue placeholder="Select operator..." /></SelectTrigger>
                      <SelectContent>
                        {/* Basic operators, can be expanded based on field type */}
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="not_equals">Not Equals</SelectItem>
                        <SelectItem value="contains">Contains (text)</SelectItem>
                        <SelectItem value="not_contains">Not Contains (text)</SelectItem>
                        <SelectItem value="is_set">Is Set (has a value)</SelectItem>
                        <SelectItem value="is_not_set">Is Not Set (no value)</SelectItem>
                        <SelectItem value="greater_than">Greater Than (number/date)</SelectItem>
                        <SelectItem value="less_than">Less Than (number/date)</SelectItem>
                        <SelectItem value="domain_equals">Email Domain Equals</SelectItem>
                        <SelectItem value="domain_not_equals">Email Domain Not Equals</SelectItem>
                      </SelectContent>
                    </Select>
                    {condition.operator !== 'is_set' && condition.operator !== 'is_not_set' && (
                        <Input 
                            placeholder="Value to compare" 
                            value={condition.value || ''} 
                            onChange={(e) => handleConditionChange(index, 'value', e.target.value)} 
                        />
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addCondition}>Add Condition</Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSaveRule}>Save Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScoringRulesManager;

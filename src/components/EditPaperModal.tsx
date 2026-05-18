import React, { useState, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, Paper, Folder } from '@/src/db';
import { toast } from 'sonner';
import { X, Plus, Tags } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TagInput } from './TagInput';

interface EditPaperModalProps {
  paper: Paper | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  allPapers: Paper[];
  onRefresh: () => void;
}

export function EditPaperModal({ paper, open, onOpenChange, folders, allPapers, onRefresh }: EditPaperModalProps) {
  const [formData, setFormData] = useState<Partial<Paper>>({});
  
  useHotkeys('mod+enter', () => {
    if (open) handleSave();
  }, { enableOnFormTags: true });

  useEffect(() => {
    if (paper) {
      const bib = paper.bibtex || generateBibTeX(paper);
      setFormData({ ...paper, bibtex: bib });
    }
  }, [paper]);

  const generateBibTeX = (p: Partial<Paper>) => {
    if (!p.title) return '';
    const key = p.citationKey || p.authors?.[0]?.split(' ').pop()?.toLowerCase() + (p.year || '00');
    return `@article{${key},
  title = {${p.title}},
  author = {${p.authors?.join(' and ') || ''}},
  ${p.conference ? `journal = {${p.conference}},` : ''}
  ${p.year ? `year = {${p.year}},` : ''}
  ${p.doi ? `doi = {${p.doi}},` : ''}
  ${p.url ? `url = {${p.url}}` : ''}
}`;
  };

  const handleSave = async () => {
    if (!paper || !formData.title) return;
    try {
      await api.updatePaper(paper.id, formData);
      toast.success('Paper details updated');
      onRefresh();
      onOpenChange(false);
    } catch (e) {
      toast.error('Failed to update paper');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: (formData.tags || []).filter(t => t !== tag)
    });
  };

  const allExistingTags = Array.from(new Set(allPapers.flatMap(p => p.tags || []))).sort();

  if (!paper) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Paper Details</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Title</label>
            <Input 
              value={formData.title || ''} 
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Citation Key</label>
              <Input 
                value={formData.citationKey || ''} 
                onChange={(e) => setFormData({...formData, citationKey: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Year</label>
              <Input 
                type="number"
                value={formData.year || ''} 
                onChange={(e) => setFormData({...formData, year: parseInt(e.target.value) || undefined})}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">URL</label>
            <Input 
              placeholder="https://..."
              value={formData.url || ''} 
              onChange={(e) => setFormData({...formData, url: e.target.value})}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Authors (comma separated)</label>
            <Input 
              value={formData.authors?.join(', ') || ''} 
              onChange={(e) => setFormData({...formData, authors: e.target.value.split(',').map(s => s.trim())})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Venue / Journal</label>
              <Input 
                value={formData.conference || ''} 
                onChange={(e) => setFormData({...formData, conference: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Folder</label>
              <Select 
                value={formData.folderId?.toString() || "0"} 
                onValueChange={(val) => setFormData({...formData, folderId: val === "0" ? undefined : parseInt(val)})}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="0">
                    <span className="flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5 opacity-50" />
                      All Papers (Root)
                    </span>
                  </SelectItem>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id.toString()}>
                      <span className="flex items-center gap-2 font-medium">
                        📂 {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">BibTeX Citation</label>
            <div className="relative">
              <Textarea 
                rows={6}
                className="font-mono text-xs p-3 leading-relaxed bg-muted/30"
                value={formData.bibtex || ''} 
                onChange={(e) => setFormData({...formData, bibtex: e.target.value})}
              />
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute top-2 right-2 h-7 text-[10px] bg-background/50 backdrop-blur"
                onClick={() => setFormData({...formData, bibtex: generateBibTeX(formData)})}
              >
                Regenerate
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Tags className="h-4 w-4 opacity-50" /> Tags
            </label>
            <TagInput 
              tags={formData.tags || []}
              allExistingTags={allExistingTags}
              onAddTag={(tag) => {
                const currentTags = formData.tags || [];
                if (!currentTags.includes(tag)) {
                  setFormData({ ...formData, tags: [...currentTags, tag] });
                }
              }}
              onRemoveTag={removeTag}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Abstract</label>
            <Textarea 
              rows={4}
              value={formData.abstract || ''} 
              onChange={(e) => setFormData({...formData, abstract: e.target.value})}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

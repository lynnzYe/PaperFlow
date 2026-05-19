import React, { useState, useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, Paper, Folder } from "@/src/db";
import { toast } from "sonner";
import { X, Plus, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "./TagInput";

interface EditPaperModalProps {
  paper: Paper | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  allPapers: Paper[];
  onRefresh: () => void;
}

export function EditPaperModal({
  paper,
  open,
  onOpenChange,
  folders,
  allPapers,
  onRefresh,
}: EditPaperModalProps) {
  const [formData, setFormData] = useState<Partial<Paper>>({});

  useHotkeys(
    "mod+enter",
    () => {
      if (open) handleSave();
    },
    { enableOnFormTags: true },
  );

  useEffect(() => {
    if (paper) {
      const bib = paper.bibtex || generateBibTeX(paper);
      setFormData({ ...paper, bibtex: bib });
    }
  }, [paper]);

  const generateBibTeX = (p: Partial<Paper>) => {
    if (!p.title) return "";
    const key =
      p.citationKey ||
      p.authors?.[0]?.split(" ").pop()?.toLowerCase() + (p.year || "00");
    return `@article{${key},
  title = {${p.title}},
  author = {${p.authors?.join(" and ") || ""}},
  ${p.conference ? `journal = {${p.conference}},` : ""}
  ${p.year ? `year = {${p.year}},` : ""}
  ${p.doi ? `doi = {${p.doi}},` : ""}
  ${p.url ? `url = {${p.url}}` : ""}
}`;
  };

  const handleSave = async () => {
    if (!paper || !formData.title) return;
    try {
      await api.updatePaper(paper.id, formData);
      toast.success("Paper details updated");
      onRefresh();
      onOpenChange(false);
    } catch (e) {
      toast.error("Failed to update paper");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: (formData.tags || []).filter((t) => t !== tag),
    });
  };

  const allExistingTags = Array.from(
    new Set(allPapers.flatMap((p) => p.tags || [])),
  ).sort();

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
              value={formData.title || ""}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Citation Key</label>
              <Input
                value={formData.citationKey || ""}
                onChange={(e) =>
                  setFormData({ ...formData, citationKey: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Year</label>
              <Input
                type="number"
                value={formData.year || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    year: parseInt(e.target.value) || undefined,
                  })
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">URL</label>
            <Input
              placeholder="https://..."
              value={formData.url || ""}
              onChange={(e) =>
                setFormData({ ...formData, url: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Authors (comma separated)
            </label>
            <Input
              value={formData.authors?.join(", ") || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  authors: e.target.value.split(",").map((s) => s.trim()),
                })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Venue / Journal</label>
              <Input
                value={formData.conference || ""}
                onChange={(e) =>
                  setFormData({ ...formData, conference: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Folders</label>
              <div className="flex flex-wrap gap-2 min-h-[38px] p-2 rounded-md border bg-background">
                {formData.folderIds?.map((fid) => {
                  const f = folders.find((fold) => fold.id === fid);
                  if (!f) return null;
                  return (
                    <Badge
                      key={fid}
                      variant="secondary"
                      className="gap-1 bg-primary/10 text-primary hover:bg-primary/20 transition-colors py-0.5 px-2"
                    >
                      {f.name}
                      <button
                        type="button"
                        className="p-0.5 hover:text-destructive transition-colors outline-none cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setFormData({
                            ...formData,
                            folderIds: (formData.folderIds || []).filter(
                              (id) => id !== fid,
                            ),
                          });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={(triggerProps) => (
                      <Button
                        {...triggerProps}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1 rounded-full border border-dashed"
                      >
                        <Plus className="h-3 w-3" /> Add to folder
                      </Button>
                    )}
                  />
                  <DropdownMenuContent
                    align="start"
                    className="w-[200px] z-[100]"
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
                        Select Folder
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {folders
                        .filter((f) => !formData.folderIds?.includes(f.id))
                        .map((f) => (
                          <DropdownMenuItem
                            key={f.id}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                folderIds: [
                                  ...(formData.folderIds || []),
                                  f.id,
                                ],
                              });
                            }}
                          >
                          {f.name}
                          </DropdownMenuItem>
                        ))}
                      {folders.filter(
                        (f) => !formData.folderIds?.includes(f.id),
                      ).length === 0 && (
                        <div className="p-2 text-xs text-center text-muted-foreground italic">
                          All folders assigned
                        </div>
                      )}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">BibTeX Citation</label>
            <div className="relative">
              <Textarea
                rows={6}
                className="font-mono text-xs p-3 leading-relaxed bg-muted/30"
                value={formData.bibtex || ""}
                onChange={(e) =>
                  setFormData({ ...formData, bibtex: e.target.value })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-7 text-[10px] bg-background/50 backdrop-blur"
                onClick={() =>
                  setFormData({ ...formData, bibtex: generateBibTeX(formData) })
                }
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
              value={formData.abstract || ""}
              onChange={(e) =>
                setFormData({ ...formData, abstract: e.target.value })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

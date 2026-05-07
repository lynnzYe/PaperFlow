import React, { useState, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Star,
  Trash2,
  ExternalLink,
  MoreHorizontal,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Circle,
  Hash,
  Copy,
  ChevronDown,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { api, Paper, Folder } from "@/src/db";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import copy from "copy-to-clipboard";
import { EditPaperModal } from "./EditPaperModal";
import { PaperDetailsModal } from "./PaperDetailsModal";
import { Badge } from "@/components/ui/badge";
import { useHotkeys } from "react-hotkeys-hook";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Keyboard, Info } from "lucide-react";

interface PaperListProps {
  papers: Paper[];
  folders: Folder[];
  isLoading: boolean;
  onRefresh: () => void;
  sortField: keyof Paper;
  sortOrder: "asc" | "desc";
  onSort: (field: keyof Paper) => void;
}

export function PaperList({
  papers,
  folders,
  isLoading,
  onRefresh,
  sortField,
  sortOrder,
  onSort,
}: PaperListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [editPaper, setEditPaper] = useState<Paper | null>(null);
  const [detailPaper, setDetailPaper] = useState<Paper | null>(null);
  const [trashConfirmPaper, setTrashConfirmPaper] = useState<Paper | null>(
    null,
  );
  const [showHelp, setShowHelp] = useState(false);

  const generateBibTeX = (p: Paper) => {
    const key =
      p.citationKey ||
      p.authors[0]?.split(" ").pop()?.toLowerCase() + (p.year || "00");
    return `@article{${key},
  title = {${p.title}},
  author = {${p.authors.join(" and ")}},
  ${p.conference ? `journal = {${p.conference}},` : ""}
  ${p.year ? `year = {${p.year}},` : ""}
  ${p.doi ? `doi = {${p.doi}},` : ""}
  ${p.url ? `url = {${p.url}}` : ""}
}`;
  };

  // Shortcuts
  useHotkeys(
    "mod+a",
    (e) => {
      e.preventDefault();
      if (selectedIds.size === papers.length && papers.length > 0) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(papers.map((p) => p.id)));
      }
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "?",
    (e) => {
      e.preventDefault();
      setShowHelp(!showHelp);
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "c",
    () => {
      const paper = papers.find((p) => p.id === hoveredId);
      if (paper) {
        const bib = paper.bibtex || generateBibTeX(paper);
        copy(bib);
        toast.info("BibTeX copied to clipboard");
      }
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "k",
    () => {
      const paper = papers.find((p) => p.id === hoveredId);
      if (paper && paper.citationKey) {
        copy(paper.citationKey);
        toast.info("Citation key copied");
      }
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "d, delete",
    () => {
      const paper = papers.find((p) => p.id === hoveredId);
      if (paper) setTrashConfirmPaper(paper);
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "e",
    () => {
      const paper = papers.find((p) => p.id === hoveredId);
      if (paper) setEditPaper(paper);
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "mod+enter, enter",
    () => {
      if (trashConfirmPaper) confirmMoveToTrash();
    },
    { enableOnFormTags: true, enabled: !!trashConfirmPaper },
  );

  const toggleStar = async (paper: Paper) => {
    try {
      await api.updatePaper(paper.id, { isStarred: !paper.isStarred });
      onRefresh();
    } catch (e) {
      toast.error("Failed to update");
    }
  };

  const confirmMoveToTrash = async () => {
    if (!trashConfirmPaper) return;
    try {
      if (trashConfirmPaper.isTrashed) {
        await api.deletePaper(trashConfirmPaper.id);
        toast.success("Deleted forever");
      } else {
        await api.updatePaper(trashConfirmPaper.id, { isTrashed: true });
        toast.success("Moved to trash");
      }
      onRefresh();
    } catch (e) {
      toast.error("Failed to update");
    } finally {
      setTrashConfirmPaper(null);
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === papers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(papers.map((p) => p.id)));
    }
  };

  const handleBulkTrash = async () => {
    try {
      const ids = Array.from(selectedIds) as number[];
      await Promise.all(
        ids.map((id) => api.updatePaper(id, { isTrashed: true })),
      );
      toast.success(`${selectedIds.size} papers moved to trash`);
      setSelectedIds(new Set());
      onRefresh();
    } catch (e) {
      toast.error("Bulk move failed");
    }
  };

  const SortIcon = ({ field }: { field: keyof Paper }) => {
    if (sortField !== field)
      return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-2 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-2 h-3 w-3" />
    );
  };

  if (papers.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <FileStack className="h-12 w-12 mb-4 opacity-20" />
        <p>No papers found here.</p>
        <p className="text-sm">Try adding one from a URL [p]</p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      <div className="flex-1 overflow-auto rounded-md border bg-card/50 shadow-sm">
        <Table className="table-fixed w-full">
          <TableHeader className="bg-muted/40 sticky top-0 z-20 shadow-sm">
            <TableRow className="hover:bg-transparent h-10">
              <TableHead className="w-[48px] px-2 text-center">
                <Checkbox
                  checked={
                    selectedIds.size === papers.length && papers.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[48px] px-0"></TableHead>
              <TableHead
                className="w-auto cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSort("title")}
              >
                <div className="flex items-center text-left">
                  Publication Info <SortIcon field="title" />
                </div>
              </TableHead>
              <TableHead
                className="w-[80px] cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSort("year")}
              >
                <div className="flex items-center text-center justify-center">
                  Year <SortIcon field="year" />
                </div>
              </TableHead>
              <TableHead
                className="w-[120px] cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSort("createdAt")}
              >
                <div className="flex items-center text-right justify-end">
                  Added <SortIcon field="createdAt" />
                </div>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {papers.map((paper) => {
              const folder = folders.find((f) => f.id === paper.folderId);
              const isSelected = selectedIds.has(paper.id);

              return (
                <TableRow
                  key={paper.id}
                  className={cn(
                    "group h-auto py-3 hover:bg-muted/30 transition-colors cursor-default border-b",
                    isSelected &&
                      "bg-primary/5 hover:bg-primary/10 border-primary/20",
                  )}
                  onMouseEnter={() => setHoveredId(paper.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onDoubleClick={() => setDetailPaper(paper)}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey) {
                      if (paper.url) window.open(paper.url, "_blank");
                      return;
                    }
                    if (
                      e.target === e.currentTarget ||
                      ((e.target as HTMLElement).closest("td") &&
                        !(e.target as HTMLElement).closest("button"))
                    ) {
                      toggleSelect(paper.id);
                    }
                  }}
                >
                  <TableCell
                    className="px-2 text-center align-top pt-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(paper.id)}
                    />
                  </TableCell>
                  <TableCell
                    className="px-0 relative align-top pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 transition-all hover:bg-yellow-500/10 hover:text-yellow-600",
                        paper.isStarred
                          ? "text-yellow-500"
                          : "text-muted-foreground opacity-0 group-hover:opacity-100",
                      )}
                      onClick={() => toggleStar(paper)}
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          paper.isStarred && "fill-current",
                        )}
                      />
                    </Button>
                  </TableCell>
                  <TableCell className="overflow-hidden py-3 align-top">
                    <div className="flex flex-col gap-1 min-w-0 pr-4">
                      <span
                        className="font-semibold text-sm leading-snug text-foreground/90 group-hover:text-primary transition-colors"
                        title={paper.title}
                      >
                        {paper.title}
                      </span>
                      <span className="text-xs text-muted-foreground/90 font-medium">
                        {paper.authors.length > 3
                          ? `${paper.authors.slice(0, 3).join(", ")} et al.`
                          : paper.authors.join(", ")}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 opacity-70">
                        {paper.conference && (
                          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                            {paper.conference}
                          </span>
                        )}
                        {folder && (
                          <span className="text-[10px] text-primary font-bold flex items-center gap-1">
                            📂 {folder.name}
                          </span>
                        )}
                        {paper.tags?.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-[9px] py-0 px-1.5 h-4 font-normal bg-primary/5 text-primary/80 border-primary/20"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium opacity-80 text-center align-top pt-4">
                    {paper.year || "—"}
                  </TableCell>
                  <TableCell className="text-[10px] text-muted-foreground tabular-nums text-right align-top pt-4 pr-4">
                    {format(paper.createdAt, "MMM d, yyyy")}
                  </TableCell>
                  <TableCell
                    className="align-top pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus:bg-accent hover:bg-accent h-8 w-8 outline-none">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => setEditPaper(paper)}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" /> Edit
                              Metadata
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const bib =
                                  paper.bibtex || generateBibTeX(paper);
                                copy(bib);
                                toast.success("BibTeX copied");
                              }}
                            >
                              <Copy className="mr-2 h-4 w-4" /> Copy BibTeX
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (paper.citationKey) {
                                  copy(paper.citationKey);
                                  toast.success("Citation key copied");
                                } else toast.error("No key");
                              }}
                            >
                              <Hash className="mr-2 h-4 w-4" /> Copy Citation
                              Key
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setTrashConfirmPaper(paper)}
                              className="text-destructive"
                            >
                              {paper.isTrashed ? (
                                <>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  Forever
                                </>
                              ) : (
                                <>
                                  <Trash2 className="mr-2 h-4 w-4" /> Move to
                                  Trash
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenuPortal>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Floating Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-primary text-primary-foreground rounded-full shadow-2xl z-50 animate-in slide-in-from-bottom-8 duration-300">
          <span className="text-sm font-bold">{selectedIds.size} Selected</span>
          <div className="h-4 w-px bg-primary-foreground/30 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBulkTrash}
            className="h-8 hover:bg-white/20 text-white"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Move To Trash
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="h-8 hover:bg-white/20 text-white"
          >
            Deselect
          </Button>
        </div>
      )}

      {/* Help Panel */}
      <div className="fixed bottom-6 right-6 z-40">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              className="rounded-full h-10 w-10 shadow-lg bg-background border-2 border-primary/20 hover:border-primary transition-all inline-flex items-center justify-center p-0 cursor-pointer"
              onClick={() => setShowHelp(true)}
            >
              <Keyboard className="h-5 w-5 text-primary" />
            </TooltipTrigger>
            <TooltipContent
              side="left"
              className="bg-primary text-primary-foreground border-none font-bold"
            >
              Keyboard Shortcuts (?)
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <AlertDialog open={showHelp} onOpenChange={setShowHelp}>
        <AlertDialogContent className="sm:max-w-[400px] min-h-[500px] flex flex-col">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Keyboard className="h-5 w-5 text-primary" />
              </div>
              <AlertDialogTitle>Keyboard Shortcuts</AlertDialogTitle>
            </div>
          </AlertDialogHeader>

          {/* Using a div instead of putting everything in Description for better layout control */}
          <div className="flex-1 flex flex-col gap-3 py-2">
            {[
              { label: "Copy BibTeX", key: "C" },
              { label: "Copy Citation Key", key: "K" },
              { label: "Rename (Hover)", key: "E" },
              { label: "Delete (Hover)", key: "D / DEL" },
              { label: "Save Changes", key: "⌘ ↵" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex justify-between items-center"
              >
                <span className="text-sm text-muted-foreground">
                  {item.label}
                </span>
                <kbd className="px-2 py-1 bg-muted rounded border text-[10px] font-mono shadow-sm">
                  {item.key}
                </kbd>
              </div>
            ))}

            <div className="border-t my-2" />

            {[
              { label: "Select All Papers", key: "⌘ A" },
              { label: "Open Paper URL", key: "⌘ Click" },
              { label: "Selection Mode", key: "Click Row" },
              { label: "Help", key: "?" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex justify-between items-center"
              >
                <span className="text-sm text-muted-foreground">
                  {item.label}
                </span>
                <kbd className="px-2 py-1 bg-muted rounded border text-[10px] font-mono shadow-sm">
                  {item.key}
                </kbd>
              </div>
            ))}
          </div>

          <AlertDialogFooter className="mt-auto pt-4">
            <AlertDialogAction className="w-full">Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditPaperModal
        paper={editPaper}
        open={!!editPaper}
        onOpenChange={(open) => !open && setEditPaper(null)}
        folders={folders}
        onRefresh={onRefresh}
      />

      <PaperDetailsModal
        paper={detailPaper}
        open={!!detailPaper}
        onOpenChange={(open) => !open && setDetailPaper(null)}
      />

      <AlertDialog
        open={!!trashConfirmPaper}
        onOpenChange={(o) => !o && setTrashConfirmPaper(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {trashConfirmPaper?.isTrashed
                ? "This will permanently delete the paper from your database. This action cannot be undone."
                : "This will move the paper to the trash. You can restore it later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmMoveToTrash}
              className={
                trashConfirmPaper?.isTrashed
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {trashConfirmPaper?.isTrashed
                ? "Delete Forever"
                : "Move to Trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FileStack({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m21 8-9-4-9 4" />
      <path d="m21 16-9-4-9 4" />
      <path d="m21 12-9-4-9 4" />
      <path d="m3 8 9 4 9-4" />
    </svg>
  );
}

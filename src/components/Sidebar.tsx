import React, { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  FileText,
  Star,
  Trash2,
  Folder as FolderIcon,
  Plus,
  MoreVertical,
  Pencil,
  Tags,
  Calendar,
} from "lucide-react";
import { api, Folder, Paper } from "@/src/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
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

interface AppSidebarProps {
  onFilterChange: (filter: {
    type: "all" | "starred" | "trash" | "folder" | "tag" | "year";
    folderId?: number;
    searchValue?: string;
  }) => void;
  activeFilter: string;
  folders: Folder[];
  papers: Paper[];
  onRefresh: () => void;
}

export function AppSidebar({
  onFilterChange,
  activeFilter,
  folders,
  papers,
  onRefresh,
}: AppSidebarProps) {
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null);
  const [hoveredFolderId, setHoveredFolderId] = useState<number | null>(null);

  // Hotkeys for hovered folder
  useHotkeys(
    "e",
    () => {
      if (hoveredFolderId) {
        const folder = folders.find((f) => f.id === hoveredFolderId);
        if (folder) {
          setEditFolder(folder);
          setEditFolderName(folder.name);
        }
      }
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "d, delete",
    () => {
      if (hoveredFolderId) {
        const folder = folders.find((f) => f.id === hoveredFolderId);
        if (folder) {
          setDeleteFolder(folder);
        }
      }
    },
    { enableOnFormTags: false },
  );

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.addFolder(newFolderName);
      setNewFolderName("");
      setNewFolderDialogOpen(false);
      onRefresh();
      toast.success("Folder created");
    } catch (e) {
      toast.error("Failed to create folder");
    }
  };

  const handleUpdateFolder = async () => {
    if (!editFolder || !editFolderName.trim()) return;
    try {
      await api.updateFolder(editFolder.id, editFolderName);
      setEditFolder(null);
      onRefresh();
      toast.success("Folder renamed");
    } catch (e) {
      toast.error("Failed to rename folder");
    }
  };

  const allTags = Array.from(
    new Set(papers.flatMap((p) => p.tags || [])),
  ).sort();
  const allYears = Array.from(
    new Set(papers.map((p) => p.year).filter(Boolean) as number[]),
  ).sort((a, b) => b - a);

  const handleDeleteFolder = async () => {
    if (!deleteFolder) return;
    try {
      await api.deleteFolder(deleteFolder.id);
      setDeleteFolder(null);
      // If the deleted folder was active, switch to "All Papers"
      if (activeFilter === `folder-${deleteFolder.id}`) {
        onFilterChange({ type: "all" });
      }
      onRefresh();
      toast.success("Folder deleted");
    } catch (e) {
      toast.error("Failed to delete folder");
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 flex flex-row items-center gap-2">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold tracking-tight">PaperFlow</h1>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Library</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeFilter === "all"}
                  onClick={() => onFilterChange({ type: "all" })}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>All Papers</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeFilter === "starred"}
                  onClick={() => onFilterChange({ type: "starred" })}
                >
                  <Star className="mr-2 h-4 w-4" />
                  <span>Starred</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeFilter === "trash"}
                  onClick={() => onFilterChange({ type: "trash" })}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Trash</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="py-0">
          <div className="flex items-center justify-between px-2 pr-4 h-8">
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Folders
            </SidebarGroupLabel>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-muted"
              onClick={() => setNewFolderDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {folders?.map((folder) => (
                <SidebarMenuItem
                  key={folder.id}
                  className="group/item relative"
                  onMouseEnter={() => setHoveredFolderId(folder.id)}
                  onMouseLeave={() => setHoveredFolderId(null)}
                >
                  <SidebarMenuButton
                    isActive={activeFilter === `folder-${folder.id}`}
                    onClick={() =>
                      onFilterChange({ type: "folder", folderId: folder.id })
                    }
                    className="h-9 px-3 group-hover/item:pr-10 transition-all"
                  >
                    <FolderIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground/60 group-hover/item:text-primary transition-colors" />
                    <span className="truncate text-[13.5px] font-medium">
                      {folder.name}
                    </span>
                  </SidebarMenuButton>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={(triggerProps) => (
                        <SidebarMenuAction
                          {...triggerProps}
                          showOnHover
                          className="absolute right-2 inset-y-0 flex items-center text-muted-foreground/40 hover:text-foreground"
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">More</span>
                        </SidebarMenuAction>
                      )}
                    />
                    <DropdownMenuContent
                      align="start"
                      side="right"
                      sideOffset={8}
                      className="w-40 shadow-md z-[100]"
                    >
                      <DropdownMenuItem
                        onClick={() => {
                          setEditFolder(folder);
                          setEditFolderName(folder.name);
                        }}
                        className="text-sm cursor-pointer"
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        className="text-sm cursor-pointer"
                        onClick={() => setDeleteFolder(folder)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border">
          Tip: Press <strong>[p]</strong> to paste a paper link
        </div>
      </SidebarFooter>

      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" ||
                  (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                ) {
                  handleCreateFolder();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewFolderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editFolder}
        onOpenChange={(o) => !o && setEditFolder(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name..."
              value={editFolderName}
              onChange={(e) => setEditFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" ||
                  (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                ) {
                  handleUpdateFolder();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFolder(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFolder}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteFolder}
        onOpenChange={(o) => !o && setDeleteFolder(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the folder "{deleteFolder?.name}". All papers in
              this folder will be moved to the root library. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}

import React, { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter
} from '@/components/ui/sidebar';
import { 
  FileText, 
  Star, 
  Trash2, 
  Folder as FolderIcon, 
  Plus,
  MoreVertical,
  Pencil,
  Tags,
  Calendar
} from 'lucide-react';
import { api, Folder, Paper } from '@/src/db';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AppSidebarProps {
  onFilterChange: (filter: { type: 'all' | 'starred' | 'trash' | 'folder' | 'tag' | 'year', folderId?: number, searchValue?: string }) => void;
  activeFilter: string;
  folders: Folder[];
  papers: Paper[];
  onRefresh: () => void;
}

export function AppSidebar({ onFilterChange, activeFilter, folders, papers, onRefresh }: AppSidebarProps) {
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  
  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null);
  const [hoveredFolderId, setHoveredFolderId] = useState<number | null>(null);

  // Hotkeys for hovered folder
  useHotkeys('e', () => {
    if (hoveredFolderId) {
      const folder = folders.find(f => f.id === hoveredFolderId);
      if (folder) {
        setEditFolder(folder);
        setEditFolderName(folder.name);
      }
    }
  }, { enableOnFormTags: false });

  useHotkeys('d, delete', () => {
    if (hoveredFolderId) {
      const folder = folders.find(f => f.id === hoveredFolderId);
      if (folder) {
        setDeleteFolder(folder);
      }
    }
  }, { enableOnFormTags: false });

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.addFolder(newFolderName);
      setNewFolderName('');
      setNewFolderDialogOpen(false);
      onRefresh();
      toast.success('Folder created');
    } catch (e) {
      toast.error('Failed to create folder');
    }
  };

  const handleUpdateFolder = async () => {
    if (!editFolder || !editFolderName.trim()) return;
    try {
      await api.updateFolder(editFolder.id, editFolderName);
      setEditFolder(null);
      onRefresh();
      toast.success('Folder renamed');
    } catch (e) {
      toast.error('Failed to rename folder');
    }
  };

  const allTags = Array.from(new Set(papers.flatMap(p => p.tags || []))).sort();
  const allYears = Array.from(new Set(papers.map(p => p.year).filter(Boolean) as number[])).sort((a, b) => b - a);

  const handleDeleteFolder = async () => {
    if (!deleteFolder) return;
    try {
      await api.deleteFolder(deleteFolder.id);
      setDeleteFolder(null);
      // If the deleted folder was active, switch to "All Papers"
      if (activeFilter === `folder-${deleteFolder.id}`) {
        onFilterChange({ type: 'all' });
      }
      onRefresh();
      toast.success('Folder deleted');
    } catch (e) {
      toast.error('Failed to delete folder');
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
                  isActive={activeFilter === 'all'} 
                  onClick={() => onFilterChange({ type: 'all' })}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>All Papers</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={activeFilter === 'starred'} 
                  onClick={() => onFilterChange({ type: 'starred' })}
                >
                  <Star className="mr-2 h-4 w-4" />
                  <span>Starred</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={activeFilter === 'trash'} 
                  onClick={() => onFilterChange({ type: 'trash' })}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Trash</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <div className="flex items-center justify-between px-2 pr-4">
            <SidebarGroupLabel>Folders</SidebarGroupLabel>
            <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setNewFolderDialogOpen(true)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {folders?.map(folder => (
                <SidebarMenuItem 
                  key={folder.id} 
                  className="group/item"
                  onMouseEnter={() => setHoveredFolderId(folder.id)}
                  onMouseLeave={() => setHoveredFolderId(null)}
                >
                  <div className="flex items-center w-full">
                    <SidebarMenuButton 
                      isActive={activeFilter === `folder-${folder.id}`} 
                      onClick={() => onFilterChange({ type: 'folder', folderId: folder.id })}
                      className="flex-1"
                    >
                      <FolderIcon className="mr-2 h-4 w-4" />
                      <span>{folder.name}</span>
                    </SidebarMenuButton>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger 
                        className="h-7 w-7 opacity-0 group-hover/item:opacity-100 transition-opacity inline-flex items-center justify-center rounded-md hover:bg-muted cursor-pointer"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem onClick={() => {
                          setEditFolder(folder);
                          setEditFolderName(folder.name);
                        }}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteFolder(folder)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tags</SidebarGroupLabel>
          <SidebarGroupContent>
            <ScrollArea className="h-40 px-3">
              <div className="flex flex-wrap gap-1 py-1">
                {allTags.length > 0 ? (
                  allTags.map(tag => (
                    <Badge 
                      key={tag} 
                      variant={activeFilter === `tag-${tag}` ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => onFilterChange({ type: 'tag', searchValue: tag })}
                    >
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground px-1 italic">No tags yet</span>
                )}
              </div>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Years</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allYears.map(year => (
                <SidebarMenuItem key={year}>
                  <SidebarMenuButton 
                    isActive={activeFilter === `year-${year}`}
                    onClick={() => onFilterChange({ type: 'year', searchValue: year.toString() })}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>{year}</span>
                  </SidebarMenuButton>
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
                if (e.key === 'Enter' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
                  handleCreateFolder();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editFolder} onOpenChange={(o) => !o && setEditFolder(null)}>
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
                if (e.key === 'Enter' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
                  handleUpdateFolder();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFolder(null)}>Cancel</Button>
            <Button onClick={handleUpdateFolder}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFolder} onOpenChange={(o) => !o && setDeleteFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the folder "{deleteFolder?.name}". All papers in this folder will be moved to the root library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}

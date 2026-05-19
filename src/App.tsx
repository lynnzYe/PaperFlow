/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/src/components/Sidebar';
import { PaperList } from '@/src/components/PaperList';
import { PasteModal } from '@/src/components/PasteModal';
import { api, Paper, Folder } from '@/src/db';
import { useHotkeys } from 'react-hotkeys-hook';
import { Toaster } from '@/components/ui/sonner';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';

type FilterType = {
  type: 'all' | 'starred' | 'trash' | 'folder' | 'tag' | 'year';
  folderId?: number;
  searchValue?: string;
};

export default function App() {
  const [filter, setFilter] = useState<FilterType>({ type: 'all' });
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<keyof Paper>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allPapers, allFolders] = await Promise.all([
        api.getPapers(),
        api.getFolders()
      ]);
      setPapers(allPapers);
      setFolders(allFolders);
    } catch (err) {
      console.error('Failed to load data from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Global [p] hotkey
  useHotkeys('p', (e) => {
    e.preventDefault();
    setPasteModalOpen(true);
  }, { enableOnFormTags: false });

  const filteredPapers = papers.filter(p => {
    // View filter
    if (filter.type === 'trash') return p.isTrashed;
    if (p.isTrashed) return false;

    if (filter.type === 'starred') return p.isStarred;
    if (filter.type === 'folder') return p.folderIds?.includes(filter.folderId || 0);
    if (filter.type === 'tag') return p.tags?.includes(filter.searchValue || '');
    if (filter.type === 'year') return p.year?.toString() === filter.searchValue;
    
    return true;
  }).sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal === undefined || aVal === null) return sortOrder === 'asc' ? -1 : 1;
    if (bVal === undefined || bVal === null) return sortOrder === 'asc' ? 1 : -1;

    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: keyof Paper) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'year' || field === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const activeFolder = folders.find(f => f.id === filter.folderId);

  const viewTitle = () => {
    if (filter.type === 'all') return 'All Papers';
    if (filter.type === 'starred') return 'Starred';
    if (filter.type === 'trash') return 'Trash';
    if (filter.type === 'folder' && activeFolder) return activeFolder.name;
    if (filter.type === 'tag') return `Tag: ${filter.searchValue}`;
    if (filter.type === 'year') return `Year: ${filter.searchValue}`;
    return 'Library';
  };

  const getSidebarActiveFilter = () => {
    if (filter.type === 'folder') return `folder-${filter.folderId}`;
    if (filter.type === 'tag') return `tag-${filter.searchValue}`;
    if (filter.type === 'year') return `year-${filter.searchValue}`;
    return filter.type;
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar 
          activeFilter={getSidebarActiveFilter()}
          onFilterChange={setFilter} 
          folders={folders}
          papers={papers}
          onRefresh={refreshData}
        />
        <SidebarInset className="flex flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-6 bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <div className="h-4 w-px bg-muted mx-2" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{viewTitle()}</h2>
              {papers && <span className="text-xs text-muted-foreground/50 font-mono ml-2">[{papers.length}]</span>}
            </div>
            
            <div className="flex items-center gap-3">
              <Button size="sm" variant="default" onClick={() => setPasteModalOpen(true)} className="h-8 rounded-full shadow-sm hover:shadow-md transition-all">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add Paper
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <PaperList 
              papers={filteredPapers} 
              folders={folders}
              isLoading={isLoading} 
              onRefresh={refreshData} 
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
          </main>
        </SidebarInset>

        <PasteModal 
          open={pasteModalOpen} 
          onOpenChange={setPasteModalOpen} 
          folderId={filter.type === 'folder' ? filter.folderId : undefined}
          folders={folders}
          allPapers={papers}
          onRefresh={refreshData}
        />
        <Toaster position="top-center" richColors />
      </SidebarProvider>
    </TooltipProvider>
  );
}


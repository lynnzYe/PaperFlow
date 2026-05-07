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
  type: 'all' | 'starred' | 'trash' | 'folder';
  folderId?: number;
};

export default function App() {
  const [filter, setFilter] = useState<FilterType>({ type: 'all' });
  const [searchQuery, setSearchQuery] = useState('');
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
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = p.title.toLowerCase().includes(q) || 
        p.authors.some(a => a.toLowerCase().includes(q)) ||
        p.conference?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    // View filter
    if (filter.type === 'trash') return p.isTrashed;
    if (p.isTrashed) return false;

    if (filter.type === 'starred') return p.isStarred;
    if (filter.type === 'folder') return p.folderId === filter.folderId;
    
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
    return 'Library';
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar 
          activeFilter={filter.type === 'folder' ? `folder-${filter.folderId}` : filter.type}
          onFilterChange={setFilter} 
          folders={folders}
          onRefresh={refreshData}
        />
        <SidebarInset className="flex flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <h2 className="text-lg font-semibold">{viewTitle()}</h2>
              {papers && <span className="text-xs text-muted-foreground ml-2">({papers.length})</span>}
            </div>
            
            <div className="flex flex-1 max-w-md items-center gap-2 px-4">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search titles, authors, venues..."
                  className="w-full bg-background pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => setPasteModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
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
          onRefresh={refreshData}
        />
        <Toaster position="top-center" richColors />
      </SidebarProvider>
    </TooltipProvider>
  );
}


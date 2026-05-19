import React, { useState, useRef } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
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
  Settings2,
  Filter,
  Plus,
  X,
  Search,
  Pencil,
  Loader2
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuPortal,
  DropdownMenuGroup,
  DropdownMenuLabel, 
  DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { api, Paper, Folder } from '@/src/db';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import copy from 'copy-to-clipboard';
import { EditPaperModal } from './EditPaperModal';
import { PaperDetailsModal } from './PaperDetailsModal';
import { Badge } from '@/components/ui/badge';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { Keyboard, Info } from 'lucide-react';

interface FilterCondition {
  id: string;
  field: 'title' | 'conference' | 'year' | 'tag' | 'folder' | 'starred';
  operator: 'contains' | 'equals' | 'is' | 'greater' | 'less';
  value: string;
}

interface PaperListProps {
  papers: Paper[];
  folders: Folder[];
  isLoading: boolean;
  onRefresh: () => void;
  sortField: keyof Paper;
  sortOrder: 'asc' | 'desc';
  onSort: (field: keyof Paper) => void;
}

export function PaperList({ papers, folders, isLoading, onRefresh, sortField, sortOrder, onSort }: PaperListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [editPaper, setEditPaper] = useState<Paper | null>(null);
  const [detailPaper, setDetailPaper] = useState<Paper | null>(null);
  const [trashConfirmPaper, setTrashConfirmPaper] = useState<Paper | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Notion-style filters
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    star: true,
    title: true,
    folders: true,
    tags: true,
    year: true,
    dateAdded: true,
    doi: false,
    actions: true
  });

  const allTags = Array.from(new Set(papers.flatMap(p => p.tags || []))).sort();

  const addFilter = () => {
    const newFilter: FilterCondition = {
      id: Math.random().toString(36).substr(2, 9),
      field: 'tag',
      operator: 'is',
      value: allTags[0] || ''
    };
    setFilters([...filters, newFilter]);
    setIsFilterOpen(true);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const filteredPapers = papers.filter(paper => {
    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        paper.title.toLowerCase().includes(q) || 
        paper.authors.some(a => a.toLowerCase().includes(q)) ||
        paper.conference?.toLowerCase().includes(q) ||
        paper.tags?.some(t => t.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }

    // Custom filters
    return filters.every(f => {
      if (!f.value && f.field !== 'starred') return true;
      
      switch (f.field) {
        case 'tag':
          return f.operator === 'is' ? paper.tags?.includes(f.value) : !paper.tags?.includes(f.value);
        case 'year':
          const y = paper.year || 0;
          const v = parseInt(f.value) || 0;
          if (f.operator === 'equals') return y === v;
          if (f.operator === 'greater') return y >= v;
          if (f.operator === 'less') return y <= v;
          return true;
        case 'folder':
          return paper.folderIds?.includes(parseInt(f.value));
        case 'starred':
          return paper.isStarred === (f.value === 'true');
        case 'conference':
          return paper.conference?.toLowerCase().includes(f.value.toLowerCase());
        case 'title':
          return paper.title.toLowerCase().includes(f.value.toLowerCase());
        default:
          return true;
      }
    });
  });
  
  const generateBibTeX = (p: Paper) => {
    const key = p.citationKey || p.authors[0]?.split(' ').pop()?.toLowerCase() + (p.year || '00');
    return `@article{${key},
  title = {${p.title}},
  author = {${p.authors.join(' and ')}},
  ${p.conference ? `journal = {${p.conference}},` : ''}
  ${p.year ? `year = {${p.year}},` : ''}
  ${p.doi ? `doi = {${p.doi}},` : ''}
  ${p.url ? `url = {${p.url}}` : ''}
}`;
  };

  // Shortcuts
  useHotkeys('mod+a', (e) => {
    e.preventDefault();
    if (selectedIds.size === papers.length && papers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(papers.map(p => p.id)));
    }
  }, { enableOnFormTags: false });

  useHotkeys('?', (e) => {
    e.preventDefault();
    setShowHelp(!showHelp);
  }, { enableOnFormTags: false });

  useHotkeys('c', () => {
    const paper = papers.find(p => p.id === hoveredId);
    if (paper) {
      const bib = paper.bibtex || generateBibTeX(paper);
      copy(bib);
      toast.info('BibTeX copied to clipboard');
    }
  }, { enableOnFormTags: false });

  useHotkeys('k', () => {
    const paper = papers.find(p => p.id === hoveredId);
    if (paper && paper.citationKey) {
      copy(paper.citationKey);
      toast.info('Citation key copied');
    }
  }, { enableOnFormTags: false });

  useHotkeys('d, delete', () => {
    const paper = papers.find(p => p.id === hoveredId);
    if (paper) setTrashConfirmPaper(paper);
  }, { enableOnFormTags: false });

  useHotkeys('e', () => {
    const paper = papers.find(p => p.id === hoveredId);
    if (paper) setEditPaper(paper);
  }, { enableOnFormTags: false });

  useHotkeys('mod+enter, enter', () => {
    if (trashConfirmPaper) confirmMoveToTrash();
  }, { enableOnFormTags: true, enabled: !!trashConfirmPaper });

  const toggleStar = async (paper: Paper) => {
    try {
      await api.updatePaper(paper.id, { isStarred: !paper.isStarred });
      onRefresh();
    } catch (e) {
      toast.error('Failed to update');
    }
  };

  const confirmMoveToTrash = async () => {
    if (!trashConfirmPaper) return;
    try {
      if (trashConfirmPaper.isTrashed) {
        await api.deletePaper(trashConfirmPaper.id);
        toast.success('Deleted forever');
      } else {
        await api.updatePaper(trashConfirmPaper.id, { isTrashed: true });
        toast.success('Moved to trash');
      }
      onRefresh();
    } catch (e) {
      toast.error('Failed to update');
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
    if (selectedIds.size === filteredPapers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPapers.map(p => p.id)));
    }
  };

  const handleBulkTrash = async () => {
    try {
      const ids = Array.from(selectedIds) as number[];
      await Promise.all(ids.map(id => api.updatePaper(id, { isTrashed: true })));
      toast.success(`${selectedIds.size} papers moved to trash`);
      setSelectedIds(new Set());
      onRefresh();
    } catch (e) {
      toast.error('Bulk move failed');
    }
  };

  const SortIcon = ({ field }: { field: keyof Paper }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    return sortOrder === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
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
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* Notion-style Header */}
      <div className="flex flex-col gap-2 p-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search by title, author, tag..." 
              className="pl-9 h-9 bg-muted/40 border-transparent focus-visible:bg-background transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant={filters.length > 0 ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-9 gap-2 font-medium transition-all", filters.length > 0 && "text-primary bg-primary/10 border-primary/20")}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Filter className="h-4 w-4" />
              Filter
              {filters.length > 0 && (
                <Badge variant="default" className="ml-1 h-5 min-w-5 px-1.5 flex items-center justify-center bg-primary text-primary-foreground text-[10px]">
                  {filters.length}
                </Badge>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={(triggerProps) => (
                  <Button {...triggerProps} variant="ghost" size="sm" className="h-9 gap-2 font-medium">
                    <Settings2 className="h-4 w-4" />
                    View
                  </Button>
                )}
              />
              <DropdownMenuContent align="end" className="w-56 z-[100]">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground p-3">Show in table</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {Object.keys(visibleColumns).map((col) => (
                    col !== 'star' && col !== 'title' && col !== 'actions' && (
                      <DropdownMenuCheckboxItem
                        key={col}
                        checked={visibleColumns[col]}
                        onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, [col]: checked }))}
                        className="text-sm"
                      >
                        {col === 'dateAdded' ? 'Date Added' : col.charAt(0).toUpperCase() + col.slice(1).replace(/([A-Z])/g, ' $1')}
                      </DropdownMenuCheckboxItem>
                    )
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Notion-style Filter Condition List */}
        {isFilterOpen && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t mt-1 animate-in slide-in-from-top-2 duration-300">
            {filters.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5 bg-muted/60 border rounded-full pl-3 pr-1.5 py-1 group hover:border-primary/30 transition-colors">
                <select 
                  className="bg-transparent text-[11px] font-semibold uppercase tracking-wider text-muted-foreground focus:outline-none cursor-pointer hover:text-foreground transition-colors"
                  value={f.field}
                  onChange={(e) => updateFilter(f.id, { field: e.target.value as any })}
                >
                  <option value="tag">Tag</option>
                  <option value="year">Year</option>
                  <option value="folder">Folder</option>
                  <option value="conference">Venue</option>
                  <option value="starred">Starred</option>
                  <option value="title">Title</option>
                </select>

                <select 
                  className="bg-transparent text-[11px] focus:outline-none text-muted-foreground/70 border-l ml-1 pl-2 cursor-pointer hover:text-foreground transition-colors"
                  value={f.operator}
                  onChange={(e) => updateFilter(f.id, { operator: e.target.value as any })}
                >
                  {f.field === 'year' ? (
                    <>
                      <option value="equals">is</option>
                      <option value="greater">≥</option>
                      <option value="less">≤</option>
                    </>
                  ) : (
                    <>
                      <option value="is">is</option>
                      <option value="contains">contains</option>
                    </>
                  )}
                </select>

                <div className="border-l ml-1 pl-2 flex items-center pr-1">
                  {f.field === 'tag' ? (
                    <select 
                      className="bg-transparent text-xs font-medium focus:outline-none max-w-[120px] truncate"
                      value={f.value}
                      onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                    >
                      <option value="">Select tag...</option>
                      {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : f.field === 'folder' ? (
                    <select 
                      className="bg-transparent text-xs font-medium focus:outline-none max-w-[120px] truncate"
                      value={f.value}
                      onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                    >
                      <option value="">Select folder...</option>
                      {folders.map(fol => <option key={fol.id} value={fol.id}>{fol.name}</option>)}
                    </select>
                  ) : f.field === 'starred' ? (
                    <select 
                      className="bg-transparent text-xs font-medium focus:outline-none"
                      value={f.value}
                      onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                    >
                      <option value="true">Starred</option>
                      <option value="false">Not Starred</option>
                    </select>
                  ) : (
                    <input 
                      className="bg-transparent text-xs font-medium focus:outline-none w-24 placeholder:text-muted-foreground/50 placeholder:font-normal"
                      placeholder="Type or select..."
                      value={f.value}
                      onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                    />
                  )}
                </div>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 rounded-full hover:bg-muted-foreground/10 transition-colors" 
                  onClick={() => removeFilter(f.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-primary gap-1.5 rounded-full transition-all" onClick={addFilter}>
              <Plus className="h-3.5 w-3.5" /> Add filter condition
            </Button>
            {filters.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full" onClick={() => setFilters([])}>
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-slate-50/20">
        <Table className="table-fixed w-full">
          <TableHeader className="bg-muted/30 sticky top-0 z-20 shadow-sm border-b">
            <TableRow className="hover:bg-transparent h-11">
              <TableHead className="w-[48px] px-2 text-center border-r last:border-r-0">
                <Checkbox 
                  checked={selectedIds.size === filteredPapers.length && filteredPapers.length > 0} 
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              {visibleColumns.star && <TableHead className="w-[48px] px-0 border-r last:border-r-0"></TableHead>}
              <TableHead 
                className="w-auto min-w-[350px] cursor-pointer hover:bg-muted/50 transition-colors border-r last:border-r-0" 
                onClick={() => onSort('title')}
              >
                <div className="flex items-center text-left gap-1 truncate font-semibold text-foreground">
                  Paper Info <SortIcon field="title" />
                </div>
              </TableHead>
              {visibleColumns.folders && (
                <TableHead className="w-[140px] border-r last:border-r-0">Folders</TableHead>
              )}
              {visibleColumns.tags && (
                <TableHead className="w-[150px] border-r last:border-r-0">Tags</TableHead>
              )}
              {visibleColumns.year && (
                <TableHead className="w-[70px] cursor-pointer hover:bg-muted/50 transition-colors text-center border-r last:border-r-0" onClick={() => onSort('year')}>
                  <div className="flex items-center justify-center gap-1">
                    Year <SortIcon field="year" />
                  </div>
                </TableHead>
              )}
              {visibleColumns.dateAdded && (
                <TableHead className="w-[110px] cursor-pointer hover:bg-muted/50 transition-colors text-right pr-4 border-r last:border-r-0" onClick={() => onSort('createdAt')}>
                  <div className="flex items-center justify-end gap-1">
                    Added <SortIcon field="createdAt" />
                  </div>
                </TableHead>
              )}
              {visibleColumns.doi && (
                <TableHead className="w-[120px] border-r last:border-r-0">DOI</TableHead>
              )}
              {visibleColumns.actions && (
                <TableHead className="w-[50px] last:border-r-0"></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-64 text-center">
                  <div className="flex flex-col items-center gap-2 py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    <p className="text-sm text-muted-foreground animate-pulse">Loading your library...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPapers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-64 text-center">
                   <div className="flex flex-col items-center gap-4 py-12">
                    <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center">
                      <Search className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-foreground">No matches found</p>
                      <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">Try broadening your search or adjusting your filter conditions.</p>
                    </div>
                    {(filters.length > 0 || searchQuery) && (
                      <Button variant="outline" size="sm" onClick={() => { setFilters([]); setSearchQuery(''); }} className="mt-2 h-9 rounded-full px-6">
                        Reset All Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPapers.map((paper) => {
                const isSelected = selectedIds.has(paper.id);
                
                return (
                  <TableRow 
                    key={paper.id} 
                    className={cn(
                      "group h-auto hover:bg-muted/30 transition-colors cursor-default border-b tabular-nums",
                      isSelected && "bg-primary/[0.03] hover:bg-primary/[0.06]"
                    )}
                    onMouseEnter={() => setHoveredId(paper.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onDoubleClick={() => setDetailPaper(paper)}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey) {
                        if (paper.url) window.open(paper.url, '_blank');
                        return;
                      }
                      // Special condition to toggle selection on click anywhere in row (Notion-style)
                      // unless it's a specific button/link
                      if (!(e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('a')) {
                        toggleSelect(paper.id);
                      }
                    }}
                  >
                    <TableCell className="px-2 text-center align-middle border-r last:border-r-0" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(paper.id)} />
                    </TableCell>
                    
                    {visibleColumns.star && (
                      <TableCell className="px-0 relative align-middle border-r last:border-r-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn(
                              "h-8 w-8 transition-all hover:bg-yellow-500/10 hover:text-yellow-600",
                              paper.isStarred ? 'text-yellow-500' : 'text-muted-foreground opacity-10 group-hover:opacity-100'
                            )}
                            onClick={() => toggleStar(paper)}
                          >
                            <Star className={cn("h-4 w-4", paper.isStarred && "fill-current")} />
                          </Button>
                        </div>
                      </TableCell>
                    )}

                    <TableCell className="overflow-hidden py-3 align-middle border-r last:border-r-0">
                      <div className="flex flex-col gap-1 min-w-0 pr-4">
                        <span className="font-bold text-[14.5px] leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2" title={paper.title}>
                          {paper.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 opacity-80">
                          {paper.authors.length > 0 && (
                            <span className="text-[13px] text-muted-foreground font-medium">
                              {paper.authors.length > 3 
                                ? `${paper.authors.slice(0, 3).join(', ')} et al.` 
                                : paper.authors.join(', ')}
                            </span>
                          )}
                          {paper.conference && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                              <span className="text-[12px] text-muted-foreground italic font-medium truncate max-w-[200px]" title={paper.conference}>
                                {paper.conference}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {visibleColumns.folders && (
                      <TableCell className="align-middle border-r last:border-r-0">
                        <div className="flex flex-wrap gap-1 max-w-[130px]">
                          {paper.folderIds?.map(fid => {
                            const f = folders.find(fold => fold.id === fid);
                            if (!f) return null;
                            return (
                              <Badge key={fid} variant="outline" className="text-[10px] py-0 px-2 h-5 font-bold bg-primary/5 text-primary border-primary/20 shrink-0 truncate whitespace-nowrap max-w-full">
                                {f.name}
                              </Badge>
                            );
                          })}
                          {(!paper.folderIds || paper.folderIds.length === 0) && <span className="text-muted-foreground/20 italic text-[11px]">No folders</span>}
                        </div>
                      </TableCell>
                    )}

                    {visibleColumns.tags && (
                      <TableCell className="align-middle border-r last:border-r-0">
                        <div className="flex flex-wrap gap-1 max-w-[140px]">
                          {paper.tags?.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-1.5 h-4 font-normal bg-primary/[0.04] text-primary/70 border-none truncate max-w-full">
                              {tag}
                            </Badge>
                          ))}
                          {(paper.tags?.length || 0) > 3 && (
                            <span className="text-[10px] text-muted-foreground px-1">+{paper.tags!.length - 3}</span>
                          )}
                          {(!paper.tags || paper.tags.length === 0) && <span className="text-muted-foreground/20 italic text-[11px]">No tags</span>}
                        </div>
                      </TableCell>
                    )}

                    {visibleColumns.year && (
                      <TableCell className="text-[13px] font-medium opacity-80 text-center align-middle border-r last:border-r-0">
                        {paper.year || '—'}
                      </TableCell>
                    )}

                    {visibleColumns.dateAdded && (
                      <TableCell className="text-[11px] text-muted-foreground tabular-nums text-right align-middle pr-4 border-r last:border-r-0">
                        {format(new Date(paper.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                    )}

                    {visibleColumns.doi && (
                      <TableCell className="text-[11px] font-mono text-muted-foreground align-middle border-r last:border-r-0 truncate" title={paper.doi || ''}>
                        {paper.doi || '—'}
                      </TableCell>
                    )}

                    {visibleColumns.actions && (
                      <TableCell className="py-0 align-middle pr-2 last:border-r-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={(triggerProps) => (
                                <button
                                  {...triggerProps}
                                  className="inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus:bg-accent hover:bg-accent h-7 w-7 outline-none"
                                >
                                  <MoreHorizontal className="h-4 w-4 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity" />
                                </button>
                              )}
                            />
                            <DropdownMenuContent align="end" className="w-48 shadow-lg border-muted/50 p-1 z-[100]">
                              <DropdownMenuItem onClick={() => setEditPaper(paper)} className="rounded-sm">
                                <Pencil className="mr-2 h-4 w-4 opacity-70" /> Edit Metadata
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                const bib = paper.bibtex || generateBibTeX(paper);
                                copy(bib); 
                                toast.success('BibTeX copied to clipboard');
                              }} className="rounded-sm">
                                <Copy className="mr-2 h-4 w-4 opacity-70" /> Copy BibTeX
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                if (paper.citationKey) { copy(paper.citationKey); toast.success('Citation key copied'); }
                                else toast.error('No citation key defined');
                              }} className="rounded-sm">
                                <Hash className="mr-2 h-4 w-4 opacity-70" /> Copy Citation Key
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-1" />
                              <DropdownMenuItem onClick={() => setTrashConfirmPaper(paper)} className="text-destructive focus:bg-destructive focus:text-destructive-foreground rounded-sm">
                                {paper.isTrashed ? (
                                  <><Trash2 className="mr-2 h-4 w-4" /> Delete Forever</>
                                ) : (
                                  <><Trash2 className="mr-2 h-4 w-4" /> Move to Trash</>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>


      {/* Floating Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-primary text-primary-foreground rounded-full shadow-2xl z-50 animate-in slide-in-from-bottom-8 duration-300">
          <span className="text-sm font-bold">{selectedIds.size} Selected</span>
          <div className="h-4 w-px bg-primary-foreground/30 mx-1" />
          <Button variant="ghost" size="sm" onClick={handleBulkTrash} className="h-8 hover:bg-white/20 text-white">
            <Trash2 className="h-4 w-4 mr-2" /> Move To Trash
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="h-8 hover:bg-white/20 text-white">
            Deselect
          </Button>
        </div>
      )}

      {/* Help Panel */}
      <div className="fixed bottom-6 right-6 z-40">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={(triggerProps) => (
                <Button
                  {...triggerProps}
                  variant="outline"
                  size="icon"
                  className="rounded-full h-10 w-10 shadow-lg bg-background border-2 border-primary/20 hover:border-primary transition-all p-0 cursor-pointer"
                  onClick={() => setShowHelp(true)}
                >
                  <Keyboard className="h-5 w-5 text-primary" />
                </Button>
              )}
            />
            <TooltipContent side="left" className="bg-primary text-primary-foreground border-none font-bold z-[100]">
              Keyboard Shortcuts (?)
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <AlertDialog open={showHelp} onOpenChange={setShowHelp}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Keyboard className="h-5 w-5 text-primary" />
              </div>
              <AlertDialogTitle>Keyboard Shortcuts</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="grid gap-1 pt-1">
              <div className="flex justify-between items-center text-foreground py-0.5">
                <span className="text-sm text-muted-foreground mr-4">Copy BibTeX</span>
                <kbd className="px-2 py-0.5 bg-muted rounded border text-[10px] font-mono whitespace-nowrap flex-shrink-0">C</kbd>
              </div>
              <div className="flex justify-between items-center text-foreground py-0.5">
                <span className="text-sm text-muted-foreground mr-4">Copy Citation Key</span>
                <kbd className="px-2 py-0.5 bg-muted rounded border text-[10px] font-mono whitespace-nowrap flex-shrink-0">K</kbd>
              </div>
              <div className="flex justify-between items-center text-foreground py-0.5">
                <span className="text-sm text-muted-foreground mr-4">Rename (Hover row/folder)</span>
                <kbd className="px-2 py-0.5 bg-muted rounded border text-[10px] font-mono whitespace-nowrap flex-shrink-0">E</kbd>
              </div>
              <div className="flex justify-between items-center text-foreground py-0.5">
                <span className="text-sm text-muted-foreground mr-4">Delete (Hover row/folder)</span>
                <kbd className="px-2 py-0.5 bg-muted rounded border text-[10px] font-mono whitespace-nowrap flex-shrink-0">D / DEL</kbd>
              </div>
              <div className="flex justify-between items-center text-foreground py-0.5">
                <span className="text-sm text-muted-foreground mr-4">Save Changes (Modals)</span>
                <kbd className="px-2 py-0.5 bg-muted rounded border text-[10px] font-mono whitespace-nowrap flex-shrink-0">⌘ ↵</kbd>
              </div>
              
              <div className="flex justify-between items-center text-foreground border-t pt-2 mt-1 py-0.5">
                <span className="text-sm text-muted-foreground mr-4">Select All Papers</span>
                <kbd className="px-2 py-0.5 bg-muted rounded border text-[10px] font-mono whitespace-nowrap flex-shrink-0">⌘ A</kbd>
              </div>
              <div className="flex justify-between items-center text-foreground py-0.5">
                <span className="text-sm text-muted-foreground mr-4">Open Paper URL</span>
                <kbd className="px-2 py-0.5 bg-muted rounded border text-[10px] font-mono whitespace-nowrap flex-shrink-0">⌘ Click</kbd>
              </div>
              <div className="flex justify-between items-center text-foreground py-0.5">
                <span className="text-sm text-muted-foreground mr-4">Selection Mode</span>
                <kbd className="px-2 py-0.5 bg-muted rounded border text-[10px] font-mono whitespace-nowrap flex-shrink-0">Click Row</kbd>
              </div>
              <div className="flex justify-between items-center text-foreground py-0.5">
                <span className="text-sm text-muted-foreground mr-4">Help</span>
                <kbd className="px-2 py-0.5 bg-muted rounded border text-[10px] font-mono whitespace-nowrap flex-shrink-0">?</kbd>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditPaperModal 
        paper={editPaper} 
        open={!!editPaper} 
        onOpenChange={(open) => !open && setEditPaper(null)} 
        folders={folders}
        allPapers={papers}
        onRefresh={onRefresh}
      />

      <PaperDetailsModal 
        paper={detailPaper} 
        open={!!detailPaper} 
        onOpenChange={(open) => !open && setDetailPaper(null)} 
      />

      <AlertDialog open={!!trashConfirmPaper} onOpenChange={(o) => !o && setTrashConfirmPaper(null)}>
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
              className={trashConfirmPaper?.isTrashed ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {trashConfirmPaper?.isTrashed ? "Delete Forever" : "Move to Trash"}
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

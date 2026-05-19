import React, { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Link as LinkIcon, Tags, Plus, X } from 'lucide-react';
import { api, Paper, Folder } from '@/src/db';
import bibtexParse from 'bibtex-parse-js';
import { TagInput } from './TagInput';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuGroup,
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

interface PasteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: number;
  folders: Folder[];
  allPapers: Paper[];
  onRefresh: () => void;
}

export function PasteModal({ open, onOpenChange, folderId, folders, allPapers, onRefresh }: PasteModalProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  
  const initFolders = folderId ? [folderId] : [];
  
  useHotkeys('mod+enter', () => {
    if (open) {
      if (extractedData) handleSave();
      else handleInputSubmit();
    }
  }, { enableOnFormTags: true });

  const generateCitationKey = (authors: string[], year?: number, title?: string) => {
    const firstAuthor = authors[0]?.split(' ').pop()?.toLowerCase() || 'unknown';
    const yearSuffix = year ? year.toString().slice(-2) : '00';
    const titleSnippet = title?.split(' ')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'paper';
    return `${firstAuthor}${yearSuffix}${titleSnippet}`;
  };

  const parseBibTeX = (bib: string) => {
    try {
      const parsed = bibtexParse.toJSON(bib);
      if (!parsed || parsed.length === 0) return null;
      const entry = parsed[0];
      const tags = entry.entryTags;
      
      const authors = (tags.author || tags.authors || '')
        .split(' and ')
        .map((a: string) => a.trim());

      return {
        title: tags.title?.replace(/[{}]/g, '') || 'Untitled',
        authors: authors.length > 0 ? authors : ['Unknown Author'],
        conference: tags.booktitle || tags.journal || tags.publisher,
        year: parseInt(tags.year) || undefined,
        abstract: tags.abstract,
        doi: tags.doi,
        bibtex: bib,
        citationKey: entry.citationKey
      };
    } catch (e) {
      console.error('BibTeX parse error', e);
      return null;
    }
  };

  const localParse = (html: string, url: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const getMeta = (name: string) => 
      doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || 
      doc.querySelector(`meta[property="${name}"]`)?.getAttribute('content') || 
      doc.querySelector(`meta[property="og:${name}"]`)?.getAttribute('content');

    let title = getMeta('citation_title') || getMeta('dc.Title') || doc.title || '';
    
    let authors: string[] = [];
    const authorTags = doc.querySelectorAll('meta[name="citation_author"], meta[name="dc.Creator"]');
    if (authorTags.length > 0) {
      authors = Array.from(authorTags).map(t => t.getAttribute('content') || '').filter(Boolean);
    } else {
      const authorMeta = getMeta('author') || getMeta('citation_authors');
      if (authorMeta) authors = authorMeta.split(/, |; | and /);
    }

    const yearString = getMeta('citation_publication_date') || getMeta('citation_date') || getMeta('dc.Date') || '';
    const yearParsed = parseInt(yearString.split(/[-/]/)[0]) || undefined;

    const conference = getMeta('citation_conference_title') || 
                      getMeta('citation_journal_title') || 
                      getMeta('dc.Relation.ispartof') ||
                      getMeta('dc.Publisher');

    const abstract = getMeta('description') || getMeta('og:description') || getMeta('dc.Description');
    const doi = getMeta('citation_doi') || getMeta('dc.Identifier');

    if (url.includes('arxiv.org')) {
      if (!title) title = doc.querySelector('.title.mathjax')?.textContent?.replace('Title:', '').trim() || title;
      if (authors.length === 0) {
        authors = Array.from(doc.querySelectorAll('.authors a')).map(a => a.textContent || '').filter(Boolean);
      }
    }

    const res = {
      title: title.trim().replace(/\n/g, ' '),
      authors: authors.length > 0 ? authors : ['Unknown Author'],
      conference: conference?.trim(),
      year: yearParsed,
      abstract: abstract?.trim(),
      doi: doi?.trim(),
      citationKey: ''
    };
    res.citationKey = generateCitationKey(res.authors, res.year, res.title);
    return res;
  };

  const handleInputSubmit = async () => {
    let inputUrl = url.trim();
    if (!inputUrl) return;
    setIsLoading(true);
    setExtractedData(null);

    if (inputUrl.includes('arxiv.org/pdf/')) {
      inputUrl = inputUrl.replace('arxiv.org/pdf/', 'arxiv.org/abs/').replace('.pdf', '');
      setUrl(inputUrl);
    }

    try {
      if (inputUrl.startsWith('@')) {
        const data = parseBibTeX(inputUrl);
        if (data) {
          setExtractedData({ ...data, folderIds: initFolders, tags: [] });
          toast.success('BibTeX metadata parsed!');
        } else {
          toast.error('Failed to parse BibTeX');
        }
        setIsLoading(false);
        return;
      }

      const fetchResponse = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl }),
      });

      if (!fetchResponse.ok) throw new Error('Failed to fetch URL content');
      const { html } = await fetchResponse.json();

      const data = localParse(html, inputUrl);
      setExtractedData({ ...data, folderIds: initFolders, tags: [] });
      if (!data.title) {
        toast.warning('Possible incomplete metadata. Please verify.');
      } else {
        toast.success('Paper metadata extracted!');
      }
    } catch (error: any) {
      console.error('Error parsing paper:', error);
      toast.error('Failed to parse paper: ' + error.message);
      handleManualAdd();
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualAdd = () => {
    setExtractedData({
      title: '',
      authors: [],
      conference: '',
      year: new Date().getFullYear(),
      abstract: '',
      folderIds: initFolders,
      tags: []
    });
  };

  const handleSave = async () => {
    if (!extractedData || !extractedData.title) {
      toast.error('Title is required');
      return;
    }
    try {
      await api.addPaper({
        ...extractedData,
        url,
        isStarred: false,
        isTrashed: false,
      });
      toast.success('Paper saved to library');
      onRefresh();
      onOpenChange(false);
      setUrl('');
      setExtractedData(null);
    } catch (error) {
      toast.error('Failed to save paper');
    }
  };

  const allExistingTags = Array.from(new Set(allPapers?.flatMap(p => p.tags || []) || [])).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Paper</DialogTitle>
          <DialogDescription>
            Paste a link (Arxiv, DOI, etc.) or a BibTeX entry.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          <div className="flex gap-2">
            <Input 
              placeholder="https://... or @article{...}" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
              autoFocus
            />
            <Button onClick={handleInputSubmit} disabled={isLoading || !url}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
              Fetch
            </Button>
          </div>

          {!extractedData && !isLoading && (
            <div className="flex justify-center flex-col gap-2">
              <Button variant="ghost" size="sm" onClick={handleManualAdd} className="text-xs">
                Or enter details manually
              </Button>
            </div>
          )}
        </div>

        {extractedData && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Title</label>
              <Input 
                value={extractedData.title} 
                onChange={(e) => setExtractedData({...extractedData, title: e.target.value})}
                className="mt-1"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Citation Key</label>
                <Input 
                  value={extractedData.citationKey || ''} 
                  onChange={(e) => setExtractedData({...extractedData, citationKey: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div className="w-24">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Year</label>
                <Input 
                  type="number"
                  value={extractedData.year || ''} 
                  onChange={(e) => setExtractedData({...extractedData, year: parseInt(e.target.value) || undefined})}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Authors (comma separated)</label>
              <Input 
                value={extractedData.authors.join(', ')} 
                onChange={(e) => setExtractedData({...extractedData, authors: e.target.value.split(',').map((s: string) => s.trim())})}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Venue</label>
              <Input 
                value={extractedData.conference || ''} 
                onChange={(e) => setExtractedData({...extractedData, conference: e.target.value})}
                className="mt-1"
              />
            </div>
            
            <div className="grid gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Folders</label>
              <div className="flex flex-wrap gap-2 min-h-[38px] p-2 rounded-md border bg-background">
                {extractedData.folderIds?.map((fid: number) => {
                  const f = folders.find(fold => fold.id === fid);
                  if (!f) return null;
                  return (
                    <Badge key={fid} variant="secondary" className="gap-1 bg-primary/10 text-primary hover:bg-primary/20 transition-colors py-0.5 px-2">
                      {f.name}
                      <button
                        type="button"
                        className="p-0.5 hover:text-destructive transition-colors outline-none cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setExtractedData({
                            ...extractedData,
                            folderIds: (extractedData.folderIds || []).filter((id: number) => id !== fid)
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
                      <Button {...triggerProps} variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 rounded-full border border-dashed">
                        <Plus className="h-3 w-3" /> Add folder
                      </Button>
                    )}
                  />
                  <DropdownMenuContent align="start" className="w-[180px] z-[100]">
                    <DropdownMenuGroup>
                      {folders.filter(f => !extractedData.folderIds?.includes(f.id)).map(f => (
                        <DropdownMenuItem key={f.id} onClick={() => setExtractedData({...extractedData, folderIds: [...(extractedData.folderIds || []), f.id]})}>
                          📂 {f.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                <Tags className="h-3 w-3" /> Tags
              </label>
              <div className="mt-2 bg-background p-2 rounded-md border">
                <TagInput 
                  tags={extractedData.tags || []}
                  allExistingTags={allExistingTags}
                  onAddTag={(tag) => {
                    const currentTags = extractedData.tags || [];
                    if (!currentTags.includes(tag)) {
                      setExtractedData({ ...extractedData, tags: [...currentTags, tag] });
                    }
                  }}
                  onRemoveTag={(tag) => {
                    setExtractedData({
                      ...extractedData,
                      tags: (extractedData.tags || []).filter((t: string) => t !== tag)
                    });
                  }}
                  placeholder="Add tags..."
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!extractedData}>Add to Library</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

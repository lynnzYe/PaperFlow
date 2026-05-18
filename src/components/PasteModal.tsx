import React, { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Link as LinkIcon, FileText, Tags } from 'lucide-react';
import { api, Paper } from '@/src/db';
import bibtexParse from 'bibtex-parse-js';
import { TagInput } from './TagInput';

interface PasteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: number;
  allPapers: Paper[];
  onRefresh: () => void;
}

export function PasteModal({ open, onOpenChange, folderId, allPapers, onRefresh }: PasteModalProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const allExistingTags = Array.from(new Set(allPapers.flatMap(p => p.tags || []))).sort();
  
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

    // Normalize ArXiv PDF URLs to abstract page for better parsing
    if (inputUrl.includes('arxiv.org/pdf/')) {
      inputUrl = inputUrl.replace('arxiv.org/pdf/', 'arxiv.org/abs/').replace('.pdf', '');
      setUrl(inputUrl); // Update the state too
    }

    // Check if it's BibTeX
    if (inputUrl.startsWith('@')) {
      const data = parseBibTeX(inputUrl);
      if (data) {
        setExtractedData(data);
        toast.success('BibTeX metadata parsed!');
      } else {
        toast.error('Failed to parse BibTeX');
      }
      setIsLoading(false);
      return;
    }

    // Otherwise treat as URL
    try {
      const fetchResponse = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl }),
      });

      if (!fetchResponse.ok) throw new Error('Failed to fetch URL content');
      const { html } = await fetchResponse.json();

      const data = localParse(html, inputUrl);
      setExtractedData(data);
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
        folderId: folderId,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
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
              <Button variant="ghost" size="sm" onClick={handleManualAdd}>
                Or enter details manually
              </Button>
            </div>
          )}
        </div>

        {extractedData && (
          <div className="space-y-4 max-h-[400px] overflow-y-auto p-4 border rounded-lg bg-muted/30">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Title</label>
              <Input 
                value={extractedData.title} 
                onChange={(e) => setExtractedData({...extractedData, title: e.target.value})}
                className="mt-1"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Citation Key</label>
                <Input 
                  value={extractedData.citationKey || ''} 
                  onChange={(e) => setExtractedData({...extractedData, citationKey: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
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
                  placeholder="Categorize this paper..."
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

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Paper } from '@/src/db';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, FileText, Calendar, Building, Hash } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaperDetailsModalProps {
  paper: Paper | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaperDetailsModal({ paper, open, onOpenChange }: PaperDetailsModalProps) {
  if (!paper) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl leading-tight pr-8">{paper.title}</DialogTitle>
          <div className="flex flex-wrap gap-2 mt-3">
            {paper.tags?.map(tag => (
              <Badge key={tag} variant="outline" className="bg-primary/5">{tag}</Badge>
            ))}
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="space-y-6 pt-4">
            <section>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Authors</h4>
              <p className="text-base text-foreground leading-relaxed">
                {paper.authors?.join(', ')}
              </p>
              </section>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {paper.year && (
                <div className="bg-muted/30 p-3 rounded-lg border border-muted flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <span className="block text-[10px] font-bold text-muted-foreground uppercase">Year</span>
                    <span className="text-sm font-medium">{paper.year}</span>
                  </div>
                </div>
              )}
              {paper.conference && (
                <div className="bg-muted/30 p-3 rounded-lg border border-muted flex items-start gap-2 col-span-2 lg:col-span-1">
                  <Building className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <span className="block text-[10px] font-bold text-muted-foreground uppercase">Venue</span>
                    <span className="text-sm font-medium">{paper.conference}</span>
                  </div>
                </div>
              )}
              {paper.citationKey && (
                <div className="bg-muted/30 p-3 rounded-lg border border-muted flex items-start gap-2">
                  <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <span className="block text-[10px] font-bold text-muted-foreground uppercase">Citation Key</span>
                    <span className="text-sm font-medium">{paper.citationKey}</span>
                  </div>
                </div>
              )}
            </div>

            {paper.abstract && (
              <section>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Abstract</h4>
                <p className="text-sm text-foreground leading-relaxed text-justify opacity-90">
                  {paper.abstract}
                </p>
              </section>
            )}

            {paper.bibtex && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">BibTeX</h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px]"
                    onClick={() => {
                      navigator.clipboard.writeText(paper.bibtex!);
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <pre className="text-[11px] font-mono bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap leading-tight text-muted-foreground">
                  {paper.bibtex}
                </pre>
              </section>
            )}

            <div className="flex gap-3 pt-2">
              {paper.url && (
                <a 
                  href={paper.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "default" }), "flex-1")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Source
                </a>
              )}
              {paper.doi && (
                <a 
                  href={`https://doi.org/${paper.doi}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
                >
                  <Hash className="mr-2 h-4 w-4" />
                  View DOI
                </a>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

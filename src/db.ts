export interface Folder {
  id: number;
  name: string;
  parentId?: number;
  createdAt: number;
}

export interface Paper {
  id: number;
  title: string;
  authors: string[];
  conference?: string;
  year?: number;
  abstract?: string;
  url?: string;
  folderIds: number[];
  isStarred: boolean;
  isTrashed: boolean;
  createdAt: number;
  updatedAt: number;
  notes?: string;
  doi?: string;
  bibtex?: string;
  citationKey?: string;
  tags: string[];
}

export const api = {
  async getPapers(): Promise<Paper[]> {
    const res = await fetch('/api/papers');
    if (!res.ok) throw new Error('Failed to fetch papers');
    return res.json();
  },

  async addPaper(paper: Partial<Paper>): Promise<Paper> {
    const res = await fetch('/api/papers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paper),
    });
    if (!res.ok) throw new Error('Failed to add paper');
    return res.json();
  },

  async updatePaper(id: number, updates: Partial<Paper>): Promise<Paper> {
    const res = await fetch(`/api/papers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update paper');
    return res.json();
  },

  async deletePaper(id: number): Promise<void> {
    const res = await fetch(`/api/papers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete paper');
  },

  async getFolders(): Promise<Folder[]> {
    const res = await fetch('/api/folders');
    if (!res.ok) throw new Error('Failed to fetch folders');
    return res.json();
  },

  async addFolder(name: string, parentId?: number): Promise<Folder> {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    });
    if (!res.ok) throw new Error('Failed to add folder');
    return res.json();
  },

  async updateFolder(id: number, name: string): Promise<Folder> {
    const res = await fetch(`/api/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to update folder');
    return res.json();
  },

  async deleteFolder(id: number): Promise<void> {
    const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete folder');
  },
};

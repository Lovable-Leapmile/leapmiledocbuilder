// Backup and restore utilities for localStorage data

import { getDocuments, saveDocument, type Document } from './localStorage';

export interface BackupData {
  version: string;
  timestamp: string;
  documents: Document[];
}

// Create a backup of all documents
export const createBackup = (): BackupData => {
  const documents = getDocuments();
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    documents,
  };
};

// Export backup as JSON file
export const exportBackup = (filename?: string): void => {
  const backup = createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename || `backup-${new Date().toISOString().split('T')[0]}.json`;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Import backup from JSON file
export const importBackup = (file: File): Promise<BackupData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as BackupData;
        if (!data.version || !data.documents) {
          throw new Error('Invalid backup file format');
        }
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// Restore documents from backup
export const restoreBackup = (backup: BackupData, userId: string): void => {
  backup.documents.forEach(doc => {
    // Only restore documents for the current user
    if (doc.userId === userId) {
      saveDocument(doc);
    }
  });
};

// Auto-backup functionality
let autoBackupInterval: NodeJS.Timeout | null = null;

export const startAutoBackup = (intervalMinutes: number = 10): void => {
  stopAutoBackup(); // Clear any existing interval
  
  autoBackupInterval = setInterval(() => {
    const backup = createBackup();
    // Store in localStorage with timestamp
    const key = `auto_backup_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(backup));
    
    // Keep only last 5 auto-backups
    const autoBackups = Object.keys(localStorage)
      .filter(k => k.startsWith('auto_backup_'))
      .sort();
    
    if (autoBackups.length > 5) {
      autoBackups.slice(0, autoBackups.length - 5).forEach(k => {
        localStorage.removeItem(k);
      });
    }
    
    console.log(`Auto-backup created at ${new Date().toLocaleTimeString()}`);
  }, intervalMinutes * 60 * 1000);
};

export const stopAutoBackup = (): void => {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
    autoBackupInterval = null;
  }
};

// Get list of auto-backups
export const getAutoBackups = (): Array<{ key: string; timestamp: Date; backup: BackupData }> => {
  const backups = Object.keys(localStorage)
    .filter(k => k.startsWith('auto_backup_'))
    .map(key => {
      const backup = JSON.parse(localStorage.getItem(key) || '{}') as BackupData;
      const timestamp = new Date(parseInt(key.replace('auto_backup_', '')));
      return { key, timestamp, backup };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  return backups;
};

// Export a single document
export const exportDocument = (document: Document): void => {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = `${document.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Import a single document
export const importDocument = (file: File): Promise<Document> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as Document;
        if (!data.id || !data.title || !data.content) {
          throw new Error('Invalid document file format');
        }
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

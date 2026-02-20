import fs from 'fs/promises';
import type { UserDataStore } from '../types';

export class UserData {
  private data: UserDataStore = { tags: {}, favorites: [] };

  constructor(private filePath: string) {}

  get tags(): Record<string, string[]> {
    return this.data.tags;
  }

  get favorites(): string[] {
    return this.data.favorites;
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const loaded = JSON.parse(raw);
      this.data = {
        tags: loaded.tags || {},
        favorites: loaded.favorites || [],
      };
      console.log(
        `👤 Loaded user data: ${Object.keys(this.data.tags).length} projects with custom tags, ${this.data.favorites.length} favorites`
      );
    } catch {
      console.log('👤 No user data file found, starting fresh');
    }
  }

  async save(): Promise<void> {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
      console.log('💾 Saved user data');
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  }

  getTagsForProject(projectPath: string): string[] {
    return this.data.tags[projectPath] || [];
  }

  setTagsForProject(projectPath: string, tags: string[]): void {
    this.data.tags[projectPath] = tags;
  }

  removeTagFromAll(tagName: string): number {
    let removedFromCount = 0;
    for (const projectPath of Object.keys(this.data.tags)) {
      const tags = this.data.tags[projectPath];
      const index = tags.indexOf(tagName);
      if (index !== -1) {
        tags.splice(index, 1);
        removedFromCount++;
      }
    }
    return removedFromCount;
  }

  isFavorite(projectPath: string): boolean {
    return this.data.favorites.includes(projectPath);
  }

  addFavorite(projectPath: string): boolean {
    if (!this.data.favorites.includes(projectPath)) {
      this.data.favorites.push(projectPath);
      return true;
    }
    return false;
  }

  removeFavorite(projectPath: string): boolean {
    const index = this.data.favorites.indexOf(projectPath);
    if (index > -1) {
      this.data.favorites.splice(index, 1);
      return true;
    }
    return false;
  }
}

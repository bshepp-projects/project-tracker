import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { UserData } from '../../services/user-data';

describe('UserData', () => {
  let userData: UserData;
  let dataFilePath: string;

  beforeEach(async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'userdata-test-'));
    dataFilePath = path.join(tmpDir, 'test-user-data.json');
    userData = new UserData(dataFilePath);
  });

  afterEach(async () => {
    try {
      await fs.unlink(dataFilePath);
      await fs.rmdir(path.dirname(dataFilePath));
    } catch {
      // Cleanup best-effort
    }
  });

  describe('initialization', () => {
    it('starts with empty state', () => {
      expect(userData.tags).toEqual({});
      expect(userData.favorites).toEqual([]);
    });

    it('loads gracefully when file does not exist', async () => {
      await userData.load();
      expect(userData.tags).toEqual({});
      expect(userData.favorites).toEqual([]);
    });
  });

  describe('save / load round-trip', () => {
    it('persists tags and favorites', async () => {
      userData.setTagsForProject('/path/to/project', ['web', 'backend']);
      userData.addFavorite('/path/to/project');
      await userData.save();

      const newData = new UserData(dataFilePath);
      await newData.load();

      expect(newData.getTagsForProject('/path/to/project')).toEqual(['web', 'backend']);
      expect(newData.isFavorite('/path/to/project')).toBe(true);
    });
  });

  describe('favorites', () => {
    it('adds a favorite', () => {
      const added = userData.addFavorite('/path/a');
      expect(added).toBe(true);
      expect(userData.isFavorite('/path/a')).toBe(true);
    });

    it('does not add duplicate favorites', () => {
      userData.addFavorite('/path/a');
      const addedAgain = userData.addFavorite('/path/a');
      expect(addedAgain).toBe(false);
      expect(userData.favorites).toHaveLength(1);
    });

    it('removes a favorite', () => {
      userData.addFavorite('/path/a');
      const removed = userData.removeFavorite('/path/a');
      expect(removed).toBe(true);
      expect(userData.isFavorite('/path/a')).toBe(false);
    });

    it('returns false when removing non-existent favorite', () => {
      const removed = userData.removeFavorite('/nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('tags', () => {
    it('sets and gets tags for a project', () => {
      userData.setTagsForProject('/path/a', ['web', 'ai']);
      expect(userData.getTagsForProject('/path/a')).toEqual(['web', 'ai']);
    });

    it('returns empty array for project with no tags', () => {
      expect(userData.getTagsForProject('/nonexistent')).toEqual([]);
    });

    it('removes a tag from all projects', () => {
      userData.setTagsForProject('/path/a', ['web', 'ai']);
      userData.setTagsForProject('/path/b', ['web', 'backend']);
      userData.setTagsForProject('/path/c', ['ai']);

      const removedCount = userData.removeTagFromAll('web');

      expect(removedCount).toBe(2);
      expect(userData.getTagsForProject('/path/a')).toEqual(['ai']);
      expect(userData.getTagsForProject('/path/b')).toEqual(['backend']);
      expect(userData.getTagsForProject('/path/c')).toEqual(['ai']);
    });
  });
});

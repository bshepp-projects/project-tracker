import request from 'supertest';
import { createTestApp, createTestUserData, createTestCacheManager } from '../test-helpers';
import type { Project } from '../../types';

describe('Tags API', () => {
  describe('DELETE /api/tags/:tagName', () => {
    it('removes tag from user data and cache', async () => {
      const userData = createTestUserData();
      userData.setTagsForProject('/path/a', ['web', 'backend']);
      userData.setTagsForProject('/path/b', ['web', 'ai']);

      const cacheManager = createTestCacheManager();
      cacheManager.cache.tags.add('web');
      cacheManager.cache.tags.add('backend');
      cacheManager.cache.tags.add('ai');
      cacheManager.cache.projects = [
        { path: '/path/a', tags: ['web', 'backend'] } as unknown as Project,
        { path: '/path/b', tags: ['web', 'ai'] } as unknown as Project,
      ];

      const app = createTestApp({ userData, cacheManager });

      const res = await request(app).delete('/api/tags/web');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('2 project(s)');

      expect(userData.getTagsForProject('/path/a')).toEqual(['backend']);
      expect(userData.getTagsForProject('/path/b')).toEqual(['ai']);
      expect(cacheManager.cache.tags.has('web')).toBe(false);
    });
  });

  describe('GET /api/projects/:projectPath/tags', () => {
    it('returns tags for a project', async () => {
      const userData = createTestUserData();
      userData.setTagsForProject('/path/to/project', ['web', 'ai']);
      const app = createTestApp({ userData });

      const encodedPath = encodeURIComponent('/path/to/project');
      const res = await request(app).get(`/api/projects/${encodedPath}/tags`);

      expect(res.status).toBe(200);
      expect(res.body.tags).toEqual(['web', 'ai']);
    });
  });
});

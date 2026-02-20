import request from 'supertest';
import { createTestApp } from '../test-helpers';

describe('GET /api/health', () => {
  it('returns OK status', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.service).toBe('Project Tracker Backend');
    expect(res.body.timestamp).toBeDefined();
  });
});

import request from 'supertest';
import { createTestApp } from './test-helpers';

describe('CORS policy', () => {
  it('does not grant CORS access to arbitrary external origins', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.com');

    expect(res.status).toBe(200); // request still served...
    expect(res.headers['access-control-allow-origin']).toBeUndefined(); // ...but browser cannot read it cross-origin
  });

  it('grants CORS access to localhost origins', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('still serves requests that have no Origin header', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
  });
});

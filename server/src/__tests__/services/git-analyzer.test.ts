import fs from 'fs';
import os from 'os';
import path from 'path';
import { GitAnalyzer } from '../../services/git-analyzer';

describe('GitAnalyzer', () => {
  let analyzer: GitAnalyzer;

  beforeEach(() => {
    analyzer = new GitAnalyzer();
  });

  describe('command injection safety', () => {
    // `&` chains commands and `echo > file` works in both POSIX sh and
    // Windows cmd.exe, so this payload triggers on the dev box and in CI.
    const marker = path.join(os.tmpdir(), `pt-injection-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    afterEach(() => {
      if (fs.existsSync(marker)) fs.unlinkSync(marker);
    });

    it('does not execute shell commands embedded in a project path', async () => {
      const evilPath = `${os.tmpdir()}" & echo pwned > "${marker}`;

      await analyzer.getCurrentBranch(evilPath);

      expect(fs.existsSync(marker)).toBe(false);
    });
  });

  describe('isGitHubRepo', () => {
    it('returns true for GitHub HTTPS URL', () => {
      expect(analyzer.isGitHubRepo('https://github.com/user/repo.git')).toBe(true);
    });

    it('returns true for GitHub SSH URL', () => {
      expect(analyzer.isGitHubRepo('git@github.com:user/repo.git')).toBe(true);
    });

    it('returns false for GitLab URL', () => {
      expect(analyzer.isGitHubRepo('https://gitlab.com/user/repo.git')).toBe(false);
    });

    it('returns false for null URL', () => {
      expect(analyzer.isGitHubRepo(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(analyzer.isGitHubRepo('')).toBe(false);
    });
  });

  describe('formatDate', () => {
    it('returns Today for today', () => {
      const today = new Date().toISOString();
      expect(analyzer.formatDate(today)).toBe('Today');
    });

    it('returns Yesterday for yesterday', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(analyzer.formatDate(yesterday)).toBe('Yesterday');
    });

    it('returns N days ago for recent dates', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(analyzer.formatDate(threeDaysAgo)).toBe('3 days ago');
    });

    it('returns N weeks ago for older dates', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      expect(analyzer.formatDate(twoWeeksAgo)).toBe('2 weeks ago');
    });

    it('returns Unknown for invalid date', () => {
      expect(analyzer.formatDate('invalid-date')).toBe('Unknown');
    });
  });
});

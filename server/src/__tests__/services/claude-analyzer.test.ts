import { ClaudeAnalyzer } from '../../services/claude-analyzer';

describe('ClaudeAnalyzer', () => {
  let analyzer: ClaudeAnalyzer;

  beforeEach(() => {
    analyzer = new ClaudeAnalyzer();
  });

  describe('extractClaudeMetadata', () => {
    it('extracts name from content', () => {
      const content = '**Name:** My Project\n**Role:** Assistant';
      const metadata = analyzer.extractClaudeMetadata(content);
      expect(metadata.name).toBe('My Project');
    });

    it('extracts role from content', () => {
      const content = '**Name:** My Project\n**Role:** AI coding assistant';
      const metadata = analyzer.extractClaudeMetadata(content);
      expect(metadata.role).toBe('AI coding assistant');
    });

    it('returns null for missing fields', () => {
      const metadata = analyzer.extractClaudeMetadata('Some random content');
      expect(metadata.name).toBeNull();
      expect(metadata.role).toBeNull();
    });

    it('handles empty content', () => {
      const metadata = analyzer.extractClaudeMetadata('');
      expect(metadata.name).toBeNull();
      expect(metadata.role).toBeNull();
    });
  });

  describe('determineClaudeStatus', () => {
    it('returns Active for recent full setup', () => {
      const recentDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
      expect(analyzer.determineClaudeStatus(true, true, recentDate)).toBe('Active');
    });

    it('returns Configured for old full setup', () => {
      const oldDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // 30 days ago
      expect(analyzer.determineClaudeStatus(true, true, oldDate)).toBe('Configured');
    });

    it('returns Partial Setup for file only', () => {
      const date = new Date();
      expect(analyzer.determineClaudeStatus(true, false, date)).toBe('Partial Setup');
    });

    it('returns Directory Only for dir only', () => {
      const date = new Date();
      expect(analyzer.determineClaudeStatus(false, true, date)).toBe('Directory Only');
    });
  });

  describe('inferProjectType', () => {
    it('infers Web Development', () => {
      expect(analyzer.inferProjectType('Frontend web developer')).toBe('Web Development');
    });

    it('infers AI/ML', () => {
      expect(analyzer.inferProjectType('Machine learning researcher')).toBe('AI/ML');
    });

    it('infers Data Science', () => {
      expect(analyzer.inferProjectType('Data analysis assistant')).toBe('Data Science');
    });

    it('infers Game Development', () => {
      expect(analyzer.inferProjectType('Unity game developer')).toBe('Game Development');
    });

    it('infers Mathematical Computing', () => {
      expect(analyzer.inferProjectType('Geometry algorithm helper')).toBe('Mathematical Computing');
    });

    it('defaults to General', () => {
      expect(analyzer.inferProjectType('General helper')).toBe('General');
    });

    it('returns General for null role', () => {
      expect(analyzer.inferProjectType(null)).toBe('General');
    });
  });
});

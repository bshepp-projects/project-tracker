import { ProjectAnalyzer } from '../../services/project-analyzer';
import { GitAnalyzer } from '../../services/git-analyzer';
import { UserData } from '../../services/user-data';

describe('ProjectAnalyzer', () => {
  let analyzer: ProjectAnalyzer;

  beforeEach(() => {
    const gitAnalyzer = new GitAnalyzer();
    const userData = new UserData('/dev/null');
    analyzer = new ProjectAnalyzer(gitAnalyzer, userData);
  });

  describe('detectTechnologies', () => {
    it('maps common extensions to technology names', () => {
      const result = analyzer.detectTechnologies(['py', 'js', 'ts'], []);
      expect(result).toContain('Python');
      expect(result).toContain('JavaScript');
      expect(result).toContain('TypeScript');
    });

    it('detects Node.js from package.json', () => {
      const result = analyzer.detectTechnologies([], ['package.json']);
      expect(result).toContain('Node.js');
    });

    it('detects Docker from dockerfile', () => {
      const result = analyzer.detectTechnologies([], ['dockerfile']);
      expect(result).toContain('Docker');
    });

    it('detects Rust from cargo.toml', () => {
      const result = analyzer.detectTechnologies([], ['cargo.toml']);
      expect(result).toContain('Rust');
    });

    it('returns Mixed for unknown extensions', () => {
      const result = analyzer.detectTechnologies(['xyz'], []);
      expect(result).toBe('Mixed');
    });

    it('deduplicates technologies', () => {
      const result = analyzer.detectTechnologies(['py', 'py', 'py'], ['requirements.txt']);
      const parts = result.split(', ');
      const uniqueParts = [...new Set(parts)];
      expect(parts.length).toBe(uniqueParts.length);
    });
  });

  describe('detectCategory', () => {
    it('detects web application from project name', () => {
      expect(analyzer.detectCategory([], [], 'my-website')).toBe('Web Application');
    });

    it('detects web application from index.html', () => {
      expect(analyzer.detectCategory([], ['index.html'], 'project')).toBe('Web Application');
    });

    it('detects AI/ML project', () => {
      expect(analyzer.detectCategory([], [], 'neural-network')).toBe('AI/ML Project');
    });

    it('detects backend service', () => {
      expect(analyzer.detectCategory([], [], 'my-api-server')).toBe('Backend Service');
    });

    it('detects game development', () => {
      expect(analyzer.detectCategory([], [], 'unity-game')).toBe('Game Development');
    });

    it('detects Python package from setup.py', () => {
      expect(analyzer.detectCategory([], ['setup.py'], 'my-lib')).toBe('Python Package');
    });

    it('defaults to General Project', () => {
      expect(analyzer.detectCategory([], [], 'something')).toBe('General Project');
    });
  });

  describe('detectStatus', () => {
    it('detects Production from dockerfile', () => {
      expect(analyzer.detectStatus(['dockerfile'])).toBe('Production');
    });

    it('detects Production from docker-compose.yml', () => {
      expect(analyzer.detectStatus(['docker-compose.yml'])).toBe('Production');
    });

    it('defaults to Development', () => {
      expect(analyzer.detectStatus(['readme.md', 'main.py'])).toBe('Development');
    });
  });

  describe('generateTags', () => {
    it('adds production tag for production status', () => {
      const tags = analyzer.generateTags('Production', '', '', '', '');
      expect(tags).toContain('production');
    });

    it('adds web tag for JavaScript technologies', () => {
      const tags = analyzer.generateTags('Development', 'JavaScript, HTML', '', '', '');
      expect(tags).toContain('web');
    });

    it('adds backend tag for Node.js', () => {
      const tags = analyzer.generateTags('Development', 'Node.js', '', '', '');
      expect(tags).toContain('backend');
    });

    it('adds ai tag for Python + AI category', () => {
      const tags = analyzer.generateTags('Development', 'Python', 'AI/ML Project', '', '');
      expect(tags).toContain('ai');
    });

    it('applies data-driven tag rules', () => {
      analyzer.loadTagRules([
        { tag: 'quantum', namePatterns: ['quantum'], pathPatterns: [] },
        { tag: 'science', namePatterns: ['physics'], pathPatterns: ['science'] },
      ]);

      const tags1 = analyzer.generateTags('Development', '', '', 'quantum-simulator', '');
      expect(tags1).toContain('quantum');

      const tags2 = analyzer.generateTags('Development', '', '', 'project', '/home/science/proj');
      expect(tags2).toContain('science');
    });

    it('does not add duplicate tags', () => {
      const tags = analyzer.generateTags('Development', 'JavaScript, HTML', 'Web Application', '', '');
      const webCount = tags.filter((t) => t === 'web').length;
      expect(webCount).toBe(1);
    });
  });
});

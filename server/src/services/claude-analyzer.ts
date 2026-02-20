import fs from 'fs/promises';
import path from 'path';
import type { ClaudeProject, ClaudeMetadata } from '../types';
import { fileExists } from '../utils';

export class ClaudeAnalyzer {
  async analyzeClaudeProject(
    projectPath: string,
    projectName: string
  ): Promise<ClaudeProject | null> {
    try {
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
      const claudeDirPath = path.join(projectPath, '.claude');

      const hasClaudeFile = await fileExists(claudeMdPath);
      const hasClaudeDir = await fileExists(claudeDirPath);

      if (!hasClaudeFile && !hasClaudeDir) {
        return null;
      }

      let claudeRole: string | null = null;
      let claudeName = projectName;
      let permissions: string[] = [];

      if (hasClaudeFile) {
        const claudeContent = await fs.readFile(claudeMdPath, 'utf8').catch(() => '');
        const metadata = this.extractClaudeMetadata(claudeContent);
        claudeRole = metadata.role;
        claudeName = metadata.name || projectName;
      }

      if (hasClaudeDir) {
        const settingsPath = path.join(claudeDirPath, 'settings.local.json');
        try {
          const settingsContent = await fs.readFile(settingsPath, 'utf8');
          const settings = JSON.parse(settingsContent);
          permissions = settings.permissions?.allow || [];
        } catch {
          // Settings file might not exist or be invalid
        }
      }

      const stats = await fs.stat(hasClaudeFile ? claudeMdPath : claudeDirPath);
      const lastActivity = stats.mtime;
      const status = this.determineClaudeStatus(hasClaudeFile, hasClaudeDir, lastActivity);

      return {
        name: claudeName,
        path: projectPath,
        claudeRole,
        hasClaudeFile,
        hasClaudeDir,
        permissions,
        permissionCount: permissions.length,
        lastActivity: lastActivity.toISOString(),
        lastModified: lastActivity.getFullYear().toString(),
        status,
        projectType: this.inferProjectType(claudeRole),
        isClaudeEnabled: true,
        dateScanned: new Date().toISOString(),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`Error analyzing Claude project ${projectName}:`, msg);
      return null;
    }
  }

  extractClaudeMetadata(content: string): ClaudeMetadata {
    const metadata: ClaudeMetadata = { name: null, role: null };

    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/i);
    if (nameMatch) {
      metadata.name = nameMatch[1].trim();
    }

    const roleMatch = content.match(/\*\*Role:\*\*\s*(.+)/i);
    if (roleMatch) {
      metadata.role = roleMatch[1].trim();
    }

    return metadata;
  }

  determineClaudeStatus(
    hasClaudeFile: boolean,
    hasClaudeDir: boolean,
    lastActivity: Date
  ): string {
    const daysSinceActivity =
      (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);

    if (hasClaudeFile && hasClaudeDir) {
      return daysSinceActivity < 7 ? 'Active' : 'Configured';
    } else if (hasClaudeFile) {
      return 'Partial Setup';
    } else {
      return 'Directory Only';
    }
  }

  inferProjectType(role: string | null): string {
    if (!role) return 'General';

    const roleLower = role.toLowerCase();
    if (
      roleLower.includes('web') ||
      roleLower.includes('frontend') ||
      roleLower.includes('backend')
    ) {
      return 'Web Development';
    }
    if (
      roleLower.includes('ai') ||
      roleLower.includes('ml') ||
      roleLower.includes('machine learning')
    ) {
      return 'AI/ML';
    }
    if (
      roleLower.includes('data') ||
      roleLower.includes('analysis') ||
      roleLower.includes('science')
    ) {
      return 'Data Science';
    }
    if (roleLower.includes('game') || roleLower.includes('unity')) {
      return 'Game Development';
    }
    if (
      roleLower.includes('math') ||
      roleLower.includes('geometry') ||
      roleLower.includes('algorithm')
    ) {
      return 'Mathematical Computing';
    }

    return 'General';
  }
}

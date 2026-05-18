export interface Project {
  name: string;
  path: string;
  description: string;
  status: string;
  technologies: string;
  category: string;
  tags: string[];
  userTags: string[];
  hasReadme: boolean;
  hasClaude: boolean;
  hasVenv: boolean;
  isGitHub: boolean;
  gitHubUrl: string | null;
  lastCommitDate: string | null;
  githubActions: GitHubActionsInfo | null;
  localVsRemote: SyncStatus | null;
  lastUpdated: string;
  isFavorite: boolean;
  isScanned: boolean;
  dateScanned: string;
}

export interface SyncStatus {
  isSynced: boolean;
  hasUncommittedChanges: boolean;
  aheadCount: number;
  behindCount: number;
  description: string;
}

export interface ClaudeProject {
  name: string;
  path: string;
  claudeRole: string | null;
  hasClaudeFile: boolean;
  hasClaudeDir: boolean;
  permissions: string[];
  permissionCount: number;
  lastActivity: string;
  lastModified: string;
  status: string;
  projectType: string;
  isClaudeEnabled: boolean;
  dateScanned: string;
}

export interface GitRepo {
  name: string;
  path: string;
  isGitRepo: boolean;
  currentBranch: string | null;
  remoteUrl: string | null;
  isGitHub: boolean;
  hasGitignore: boolean;
  lastCommit: CommitInfo | null;
  branchStatus: string;
  aheadCount: number;
  behindCount: number;
  workingTreeClean: boolean | null;
  uncommittedChanges: number;
  untrackedFiles: number;
  totalBranches: number;
  lastActivity: string;
  githubActions: GitHubActionsInfo | null;
  dateScanned: string;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface BranchStatus {
  ahead: number;
  behind: number;
  aheadCount: number;
  behindCount: number;
  isSynced: boolean;
  description: string;
}

export interface WorkingTreeStatus {
  isClean: boolean | null;
  modified: number;
  untracked: number;
}

export interface GitHubActionsInfo {
  status: string;
  workflowName: string;
  lastRun: string;
}

export interface ClaudeMetadata {
  name: string | null;
  role: string | null;
}

export interface TagRule {
  tag: string;
  namePatterns: string[];
  pathPatterns: string[];
}

export interface TagRulesConfig {
  rules: TagRule[];
}

export interface UserDataStore {
  tags: Record<string, string[]>;
  favorites: string[];
}

export interface CacheData {
  version: string;
  timestamp: number | null;
  projects: Project[];
  claudeProjects: ClaudeProject[];
  gitRepos: GitRepo[];
  tags: Set<string>;
}

export interface DirectoriesConfig {
  /** Explicit project directories (legacy / pins). */
  directories?: string[];
  /** Parent folders auto-scanned for project roots. */
  roots?: string[];
  /** Additional directory basenames to skip during discovery. */
  exclude?: string[];
  /** How deep to walk under each root (default 3). */
  maxDepth?: number;
  lastUpdated: string;
}

/**
 * Pure translation of an allowlisted action + project path into either a
 * process to spawn (no shell, path as a standalone argv element) or a
 * command string for the client to copy. The client never supplies a
 * command — only the action name and path — so there is no path from user
 * input to a shell.
 */

export const ACTION_NAMES = [
  'open-folder',
  'open-terminal',
  'launch-claude',
  'launch-claude-yolo',
  'activate-venv',
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

export type ActionCommand =
  | { kind: 'spawn'; file: string; args: string[] }
  | { kind: 'copy'; text: string };

export function isActionName(value: string): value is ActionName {
  return (ACTION_NAMES as readonly string[]).includes(value);
}

export function buildActionCommand(
  action: ActionName,
  projectPath: string,
  platform: NodeJS.Platform
): ActionCommand {
  const isWin = platform === 'win32';
  const isMac = platform === 'darwin';

  switch (action) {
    case 'open-folder':
      if (isWin) return { kind: 'spawn', file: 'explorer.exe', args: [projectPath] };
      if (isMac) return { kind: 'spawn', file: 'open', args: [projectPath] };
      return { kind: 'spawn', file: 'xdg-open', args: [projectPath] };

    case 'open-terminal':
      if (isWin) return { kind: 'spawn', file: 'wt.exe', args: ['-d', projectPath] };
      if (isMac) return { kind: 'spawn', file: 'open', args: ['-a', 'Terminal', projectPath] };
      return {
        kind: 'spawn',
        file: 'x-terminal-emulator',
        args: ['--working-directory', projectPath],
      };

    case 'launch-claude':
      if (isWin) {
        return { kind: 'spawn', file: 'wt.exe', args: ['-d', projectPath, 'cmd', '/k', 'claude'] };
      }
      if (isMac) {
        return { kind: 'copy', text: `cd "${projectPath}" && claude` };
      }
      return {
        kind: 'spawn',
        file: 'x-terminal-emulator',
        args: ['--working-directory', projectPath, '-e', 'claude'],
      };

    case 'launch-claude-yolo':
      if (isWin) {
        return {
          kind: 'spawn',
          file: 'wt.exe',
          args: ['-d', projectPath, 'cmd', '/k', 'claude', '--dangerously-skip-permissions'],
        };
      }
      if (isMac) {
        return { kind: 'copy', text: `cd "${projectPath}" && claude --dangerously-skip-permissions` };
      }
      return {
        kind: 'spawn',
        file: 'x-terminal-emulator',
        args: ['--working-directory', projectPath, '-e', 'claude', '--dangerously-skip-permissions'],
      };

    case 'activate-venv':
      // Cannot inject into the user's shell — always a copy, OS-correct.
      if (isWin) return { kind: 'copy', text: `${projectPath}\\venv\\Scripts\\activate` };
      return { kind: 'copy', text: `source "${projectPath}/venv/bin/activate"` };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

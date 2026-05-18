import { buildActionCommand } from '../../services/action-command';

describe('buildActionCommand', () => {
  const P = '/home/user/projects/demo';

  it('open-folder uses the right opener per platform, path as a lone arg', () => {
    expect(buildActionCommand('open-folder', P, 'win32')).toEqual({
      kind: 'spawn',
      file: 'explorer.exe',
      args: [P],
    });
    expect(buildActionCommand('open-folder', P, 'darwin')).toEqual({
      kind: 'spawn',
      file: 'open',
      args: [P],
    });
    expect(buildActionCommand('open-folder', P, 'linux')).toEqual({
      kind: 'spawn',
      file: 'xdg-open',
      args: [P],
    });
  });

  it('launch-claude on Windows opens a terminal in the dir running claude', () => {
    const cmd = buildActionCommand('launch-claude', P, 'win32');
    expect(cmd.kind).toBe('spawn');
    if (cmd.kind !== 'spawn') throw new Error('expected spawn');
    expect(cmd.file).toBe('wt.exe');
    // path is its own argv element, not concatenated into a command string
    expect(cmd.args).toContain(P);
    expect(cmd.args).toContain('claude');
    expect(cmd.args.some((a) => a.includes('claude') && a.includes(P))).toBe(false);
  });

  it('launch-claude-yolo adds the skip-permissions flag as its own arg', () => {
    const cmd = buildActionCommand('launch-claude-yolo', P, 'win32');
    if (cmd.kind !== 'spawn') throw new Error('expected spawn');
    expect(cmd.args).toContain('--dangerously-skip-permissions');
  });

  it('launch-claude on macOS falls back to a copy command (AppleScript out of scope)', () => {
    const cmd = buildActionCommand('launch-claude', P, 'darwin');
    expect(cmd.kind).toBe('copy');
    if (cmd.kind !== 'copy') throw new Error('expected copy');
    expect(cmd.text).toContain(P);
    expect(cmd.text).toContain('claude');
  });

  it('activate-venv is always a copy action, OS-correct', () => {
    const win = buildActionCommand('activate-venv', 'C:\\proj\\app', 'win32');
    expect(win).toEqual({ kind: 'copy', text: 'C:\\proj\\app\\venv\\Scripts\\activate' });

    const nix = buildActionCommand('activate-venv', P, 'linux');
    expect(nix).toEqual({ kind: 'copy', text: `source "${P}/venv/bin/activate"` });
  });

  it('open-terminal opens a terminal at the path', () => {
    expect(buildActionCommand('open-terminal', P, 'win32')).toEqual({
      kind: 'spawn',
      file: 'wt.exe',
      args: ['-d', P],
    });
  });

  it('throws on an unknown action', () => {
    expect(() => buildActionCommand('rm-rf' as never, P, 'linux')).toThrow(/unknown action/i);
  });

  it('keeps a hostile path as a single argv element (no shell, no split)', () => {
    const evil = 'C:\\a b\\x" && calc & rem';
    const cmd = buildActionCommand('open-folder', evil, 'win32');
    if (cmd.kind !== 'spawn') throw new Error('expected spawn');
    expect(cmd.args).toEqual([evil]); // exactly one element, verbatim
  });
});

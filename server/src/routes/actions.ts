import { Router } from 'express';
import { spawn } from 'child_process';
import { isLoopbackAddress, isPathWithinScanDirs } from '../utils';
import { buildActionCommand, isActionName } from '../services/action-command';

export interface ActionsRouterOptions {
  /** ENABLE_LOCAL_ACTIONS flag. */
  enabled: boolean;
  /** Server is bound to a loopback host (defense in depth — inert on 0.0.0.0). */
  hostIsLoopback: boolean;
  /** Allowed path-containment set (pins + roots). */
  validationPaths: () => string[];
  platform?: NodeJS.Platform;
  spawnAction?: (file: string, args: string[]) => void;
}

function defaultSpawn(file: string, args: string[]): void {
  // No shell. Detached + unref so the GUI/terminal outlives the request
  // and the server never blocks on it.
  const child = spawn(file, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

export function createActionsRouter(opts: ActionsRouterOptions): Router {
  const router = Router();
  const platform = opts.platform ?? process.platform;
  const run = opts.spawnAction ?? defaultSpawn;

  // All three must hold: feature flag on, server bound to loopback, and the
  // request itself originating from this machine.
  const gateOpen = (remoteAddress: string | undefined): boolean =>
    opts.enabled && opts.hostIsLoopback && isLoopbackAddress(remoteAddress);

  router.get('/actions/status', (req, res) => {
    res.json({ enabled: gateOpen(req.socket.remoteAddress) });
  });

  router.post('/actions/:action', (req, res) => {
    try {
      const action = req.params.action;
      if (!isActionName(action)) {
        res.status(400).json({ success: false, error: `Unknown action: ${action}` });
        return;
      }

      if (!gateOpen(req.socket.remoteAddress)) {
        res.status(403).json({
          success: false,
          actionsDisabled: true,
          error:
            'Local actions are disabled (requires ENABLE_LOCAL_ACTIONS, a loopback bind, and a same-machine request)',
        });
        return;
      }

      const { projectPath } = req.body;
      if (!projectPath || typeof projectPath !== 'string') {
        res.status(400).json({ success: false, error: 'projectPath is required' });
        return;
      }
      if (!isPathWithinScanDirs(projectPath, opts.validationPaths())) {
        res
          .status(403)
          .json({ success: false, error: 'Path is outside the configured scan directories' });
        return;
      }

      const cmd = buildActionCommand(action, projectPath, platform);
      if (cmd.kind === 'copy') {
        res.json({ success: true, mode: 'copy', text: cmd.text });
        return;
      }

      run(cmd.file, cmd.args);
      console.log(`▶️  Launched ${action} for ${projectPath}`);
      res.json({ success: true, mode: 'launched' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Action error:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const treeKill = require('tree-kill');

// ---------------------------------------------------------------------------
// App & Server Setup
// ---------------------------------------------------------------------------

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'DELETE'],
  },
});

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const PORT = 4000;

// ---------------------------------------------------------------------------
// Data persistence helpers
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(__dirname, 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('[data] Created data/ directory');
  }
  if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(PROJECTS_FILE, '[]', 'utf-8');
    console.log('[data] Initialized projects.json');
  }
}

function readProjects() {
  ensureDataDir();
  const raw = fs.readFileSync(PROJECTS_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeProjects(projects) {
  ensureDataDir();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// In-memory process tracking
// ---------------------------------------------------------------------------

/** @type {Map<string, { id: string, projectId: string, projectName: string, script: string, pid: number, startedAt: string, child: import('child_process').ChildProcess }>} */
const runningProcesses = new Map();

function getProcessList() {
  return Array.from(runningProcesses.values()).map(
    ({ id, projectId, projectName, script, pid, startedAt }) => ({
      id,
      projectId,
      projectName,
      script,
      pid,
      startedAt,
    })
  );
}

function broadcastProcesses() {
  io.emit('processes:update', getProcessList());
}

// ---------------------------------------------------------------------------
// Helper – read a project's package.json safely
// ---------------------------------------------------------------------------

function readProjectPackageJson(projectPath) {
  try {
    const pkgPath = path.join(projectPath, 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    return {
      scripts: pkg.scripts || {},
      dependenciesCount:
        Object.keys(pkg.dependencies || {}).length +
        Object.keys(pkg.devDependencies || {}).length,
    };
  } catch {
    return { scripts: {}, dependenciesCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// GET /api/projects – list all projects with package.json metadata
app.get('/api/projects', (_req, res) => {
  try {
    const projects = readProjects();
    const enriched = projects.map((project) => {
      const { scripts, dependenciesCount } = readProjectPackageJson(project.path);
      return { ...project, scripts, dependenciesCount };
    });
    res.json(enriched);
  } catch (err) {
    console.error('[api] Error reading projects:', err.message);
    res.status(500).json({ error: 'Failed to read projects' });
  }
});

// POST /api/projects – add a new project by path
app.post('/api/projects', (req, res) => {
  try {
    const { path: projectPath } = req.body;

    if (!projectPath) {
      return res.status(400).json({ error: 'path is required' });
    }

    const resolvedPath = path.resolve(projectPath);

    // Validate directory exists
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
      return res.status(400).json({ error: 'Path does not exist or is not a directory' });
    }

    // Validate package.json exists
    const pkgPath = path.join(resolvedPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return res.status(400).json({ error: 'No package.json found at the given path' });
    }

    // Read name from package.json
    let pkgName = path.basename(resolvedPath);
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) pkgName = pkg.name;
    } catch {
      // fall back to directory name
    }

    const projects = readProjects();

    // Prevent duplicates
    if (projects.some((p) => path.resolve(p.path) === resolvedPath)) {
      return res.status(409).json({ error: 'Project already added' });
    }

    const newProject = {
      id: uuidv4(),
      name: pkgName,
      path: resolvedPath,
      addedAt: new Date().toISOString(),
    };

    projects.push(newProject);
    writeProjects(projects);

    console.log(`[api] Added project "${newProject.name}" (${newProject.id})`);

    // Return enriched project
    const { scripts, dependenciesCount } = readProjectPackageJson(resolvedPath);
    res.status(201).json({ ...newProject, scripts, dependenciesCount });
  } catch (err) {
    console.error('[api] Error adding project:', err.message);
    res.status(500).json({ error: 'Failed to add project' });
  }
});

// DELETE /api/projects/:id – remove a project (and stop its processes)
app.delete('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const projects = readProjects();
    const index = projects.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Stop any running processes belonging to this project
    for (const [processId, proc] of runningProcesses) {
      if (proc.projectId === id) {
        killProcess(processId);
      }
    }

    const removed = projects.splice(index, 1)[0];
    writeProjects(projects);
    console.log(`[api] Removed project "${removed.name}" (${id})`);
    res.json({ message: 'Project removed', project: removed });
  } catch (err) {
    console.error('[api] Error removing project:', err.message);
    res.status(500).json({ error: 'Failed to remove project' });
  }
});

// GET /api/processes – list running processes
app.get('/api/processes', (_req, res) => {
  res.json(getProcessList());
});

// Direct npm commands that don't use 'npm run'
const DIRECT_COMMANDS = ['install', 'ci', 'update', 'audit', 'outdated', 'prune', 'dedupe'];

function buildCommand(script) {
  if (DIRECT_COMMANDS.includes(script)) {
    return `npm ${script}`;
  }
  return `npm run ${script}`;
}

// POST /api/projects/:id/start – start a script for a project
app.post('/api/projects/:id/start', (req, res) => {
  try {
    const { id } = req.params;
    const { script } = req.body;

    if (!script) {
      return res.status(400).json({ error: 'script is required' });
    }

    const projects = readProjects();
    const project = projects.find((p) => p.id === id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check the project directory still exists
    if (!fs.existsSync(project.path)) {
      return res.status(400).json({ error: 'Project path no longer exists on disk' });
    }

    const processId = uuidv4();
    const command = buildCommand(script);

    console.log(`[process] Starting "${command}" in ${project.path} (processId: ${processId})`);

    const child = spawn('cmd.exe', ['/c', command], {
      cwd: project.path,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const entry = {
      id: processId,
      projectId: id,
      projectName: project.name,
      script,
      pid: child.pid,
      startedAt: new Date().toISOString(),
      child,
    };

    runningProcesses.set(processId, entry);

    // Stream stdout
    child.stdout.on('data', (data) => {
      const text = data.toString();
      io.to(`process:${processId}`).emit('process:output', {
        processId,
        data: text,
        type: 'stdout',
      });
    });

    // Stream stderr
    child.stderr.on('data', (data) => {
      const text = data.toString();
      io.to(`process:${processId}`).emit('process:output', {
        processId,
        data: text,
        type: 'stderr',
      });
    });

    // Handle exit
    child.on('exit', (code) => {
      console.log(`[process] Process ${processId} exited with code ${code}`);
      runningProcesses.delete(processId);
      io.to(`process:${processId}`).emit('process:exit', { processId, code });
      broadcastProcesses();
    });

    child.on('error', (err) => {
      console.error(`[process] Process ${processId} error:`, err.message);
      runningProcesses.delete(processId);
      io.to(`process:${processId}`).emit('process:exit', { processId, code: -1 });
      broadcastProcesses();
    });

    // Broadcast updated list & emit started event
    broadcastProcesses();
    io.emit('process:started', {
      processId,
      projectId: id,
      script,
      pid: child.pid,
    });

    console.log(`[process] Started (pid: ${child.pid})`);
    res.status(201).json({ processId, pid: child.pid });
  } catch (err) {
    console.error('[api] Error starting process:', err.message);
    res.status(500).json({ error: 'Failed to start process' });
  }
});

// POST /api/processes/:processId/stop – stop a running process
app.post('/api/processes/:processId/stop', (req, res) => {
  const { processId } = req.params;

  if (!runningProcesses.has(processId)) {
    return res.status(404).json({ error: 'Process not found or already stopped' });
  }

  killProcess(processId);
  res.json({ message: 'Process stopped', processId });
});

// POST /api/processes/:processId/restart – restart a running process
app.post('/api/processes/:processId/restart', async (req, res) => {
  const { processId } = req.params;
  const entry = runningProcesses.get(processId);

  if (!entry) {
    return res.status(404).json({ error: 'Process not found or already stopped' });
  }

  const { projectId, script } = entry;

  // Stop existing process and wait briefly for cleanup
  killProcess(processId);

  // Give the OS a moment to release resources
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Re-dispatch to the start endpoint logic
  // Build a fake req/res to reuse the start handler inline isn't clean,
  // so we just duplicate the core logic here for clarity.
  try {
    const projects = readProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project no longer exists' });
    }

    const newProcessId = uuidv4();
    const command = buildCommand(script);

    console.log(`[process] Restarting "${command}" in ${project.path} (processId: ${newProcessId})`);

    const child = spawn('cmd.exe', ['/c', command], {
      cwd: project.path,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const newEntry = {
      id: newProcessId,
      projectId,
      projectName: project.name,
      script,
      pid: child.pid,
      startedAt: new Date().toISOString(),
      child,
    };

    runningProcesses.set(newProcessId, newEntry);

    child.stdout.on('data', (data) => {
      io.to(`process:${newProcessId}`).emit('process:output', {
        processId: newProcessId,
        data: data.toString(),
        type: 'stdout',
      });
    });

    child.stderr.on('data', (data) => {
      io.to(`process:${newProcessId}`).emit('process:output', {
        processId: newProcessId,
        data: data.toString(),
        type: 'stderr',
      });
    });

    child.on('exit', (code) => {
      console.log(`[process] Process ${newProcessId} exited with code ${code}`);
      runningProcesses.delete(newProcessId);
      io.to(`process:${newProcessId}`).emit('process:exit', { processId: newProcessId, code });
      broadcastProcesses();
    });

    child.on('error', (err) => {
      console.error(`[process] Process ${newProcessId} error:`, err.message);
      runningProcesses.delete(newProcessId);
      io.to(`process:${newProcessId}`).emit('process:exit', { processId: newProcessId, code: -1 });
      broadcastProcesses();
    });

    broadcastProcesses();
    io.emit('process:started', {
      processId: newProcessId,
      projectId,
      script,
      pid: child.pid,
    });

    console.log(`[process] Restarted (pid: ${child.pid})`);
    res.status(201).json({ processId: newProcessId, pid: child.pid });
  } catch (err) {
    console.error('[api] Error restarting process:', err.message);
    res.status(500).json({ error: 'Failed to restart process' });
  }
});

// ---------------------------------------------------------------------------
// Process kill helper
// ---------------------------------------------------------------------------

function killProcess(processId) {
  const entry = runningProcesses.get(processId);
  if (!entry) return;

  console.log(`[process] Killing process ${processId} (pid: ${entry.pid})`);

  try {
    treeKill(entry.pid, 'SIGTERM', (err) => {
      if (err) {
        console.error(`[process] tree-kill error for ${processId}:`, err.message);
      }
    });
  } catch (err) {
    console.error(`[process] Error killing ${processId}:`, err.message);
  }

  runningProcesses.delete(processId);
  io.to(`process:${processId}`).emit('process:stopped', { processId });
  broadcastProcesses();
}

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);

  socket.on('join', (room) => {
    socket.join(room);
    console.log(`[socket] ${socket.id} joined room ${room}`);
  });

  socket.on('leave', (room) => {
    socket.leave(room);
    console.log(`[socket] ${socket.id} left room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal) {
  console.log(`\n[server] Received ${signal}. Shutting down gracefully...`);

  // Kill all running processes
  for (const [processId] of runningProcesses) {
    killProcess(processId);
  }

  server.close(() => {
    console.log('[server] HTTP server closed');
    process.exit(0);
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    console.error('[server] Forcing shutdown after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

ensureDataDir();

server.listen(PORT, () => {
  console.log(`[server] Nexus backend running on http://localhost:${PORT}`);
});

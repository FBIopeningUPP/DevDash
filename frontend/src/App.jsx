import { useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import Sidebar from './components/Sidebar.jsx'
import ProjectView from './components/ProjectView.jsx'
import RunningInstances from './components/RunningInstances.jsx'
import AddProjectModal from './components/AddProjectModal.jsx'

const socket = io('/', { autoConnect: true })

export default function App() {
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [processes, setProcesses] = useState({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [activeTab, setActiveTab] = useState('project')

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(data)
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }, [])

  const fetchProcesses = useCallback(async () => {
    try {
      const res = await fetch('/api/processes')
      const data = await res.json()
      const processMap = {}
      if (Array.isArray(data)) {
        data.forEach(p => { processMap[p.id] = p })
      } else if (data && typeof data === 'object') {
        Object.assign(processMap, data)
      }
      setProcesses(processMap)
    } catch (err) {
      console.error('Failed to fetch processes:', err)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
    fetchProcesses()
  }, [fetchProjects, fetchProcesses])

  useEffect(() => {
    const interval = setInterval(fetchProcesses, 5000)
    return () => clearInterval(interval)
  }, [fetchProcesses])

  useEffect(() => {
    socket.on('process:started', (data) => {
      const proc = {
        id: data.processId,
        projectId: data.projectId,
        projectName: data.projectName || '',
        script: data.script,
        pid: data.pid,
        startedAt: new Date().toISOString()
      }
      setProcesses(prev => ({ ...prev, [proc.id]: proc }))
    })

    socket.on('process:exit', ({ processId }) => {
      setProcesses(prev => {
        const next = { ...prev }
        delete next[processId]
        return next
      })
    })

    socket.on('process:stopped', ({ processId }) => {
      setProcesses(prev => {
        const next = { ...prev }
        delete next[processId]
        return next
      })
    })

    socket.on('processes:update', (processList) => {
      const processMap = {}
      if (Array.isArray(processList)) {
        processList.forEach(p => { processMap[p.id] = p })
      }
      setProcesses(processMap)
    })

    return () => {
      socket.off('process:started')
      socket.off('process:exit')
      socket.off('process:stopped')
      socket.off('processes:update')
    }
  }, [])

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null

  const projectProcesses = Object.values(processes).filter(
    p => p.projectId === selectedProjectId
  )

  const handleStartScript = async (projectId, script) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script })
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('Failed to start script:', err.error)
      }
      // The socket 'process:started' event will update state
    } catch (err) {
      console.error('Failed to start script:', err)
    }
  }

  const handleStopProcess = async (processId) => {
    try {
      await fetch(`/api/processes/${processId}/stop`, { method: 'POST' })
      setProcesses(prev => {
        const next = { ...prev }
        delete next[processId]
        return next
      })
    } catch (err) {
      console.error('Failed to stop process:', err)
    }
  }

  const handleRestartProcess = async (processId) => {
    try {
      const res = await fetch(`/api/processes/${processId}/restart`, { method: 'POST' })
      if (res.ok) {
        // Remove old process, socket events will add the new one
        setProcesses(prev => {
          const next = { ...prev }
          delete next[processId]
          return next
        })
      }
    } catch (err) {
      console.error('Failed to restart process:', err)
    }
  }

  const handleProjectAdded = (project) => {
    setProjects(prev => [...prev, project])
    setSelectedProjectId(project.id)
    setShowAddModal(false)
    setActiveTab('project')
  }

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId)
    setActiveTab('project')
  }

  const handleShowInstances = () => {
    setActiveTab('instances')
  }

  const runningProcesses = Object.values(processes)

  return (
    <div className="app-layout">
      <Sidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        onAddProject={() => setShowAddModal(true)}
        onShowInstances={handleShowInstances}
        activeTab={activeTab}
        runningProcesses={runningProcesses}
      />

      <main className="main-content">
        {activeTab === 'instances' ? (
          <RunningInstances
            processes={runningProcesses}
            projects={projects}
            onStopProcess={handleStopProcess}
            onRestartProcess={handleRestartProcess}
            onSelectProject={handleSelectProject}
            socket={socket}
          />
        ) : selectedProject ? (
          <ProjectView
            project={selectedProject}
            processes={projectProcesses}
            onStartScript={handleStartScript}
            onStopProcess={handleStopProcess}
            onRestartProcess={handleRestartProcess}
            socket={socket}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <h2>Select a project</h2>
            <p>Choose a project from the sidebar or add a new one to get started.</p>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              Add Project
            </button>
          </div>
        )}
      </main>

      <AddProjectModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onProjectAdded={handleProjectAdded}
      />
    </div>
  )
}

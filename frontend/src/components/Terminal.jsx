import { useState, useEffect, useRef } from 'react'
import './Terminal.css'

export default function Terminal({ processId, socket }) {
  const [lines, setLines] = useState([])
  const [exited, setExited] = useState(false)
  const [exitCode, setExitCode] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!socket || !processId) return

    socket.emit('join', `process:${processId}`)

    const handleOutput = (data) => {
      if (data.processId === processId) {
        setLines(prev => [...prev, { type: data.type || 'stdout', text: data.data }])
      }
    }

    const handleExit = (data) => {
      if (data.processId === processId) {
        setExited(true)
        setExitCode(data.code)
        setLines(prev => [
          ...prev,
          {
            type: 'system',
            text: `Process exited with code ${data.code}`
          }
        ])
      }
    }

    socket.on('process:output', handleOutput)
    socket.on('process:exit', handleExit)

    return () => {
      socket.off('process:output', handleOutput)
      socket.off('process:exit', handleExit)
      socket.emit('leave', `process:${processId}`)
    }
  }, [processId, socket])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  const handleClear = () => {
    setLines([])
  }

  return (
    <div className="terminal">
      <div className="terminal-header">
        <span className="terminal-title">
          {exited ? `Process exited (${exitCode})` : 'Terminal'}
        </span>
        <button className="btn btn-ghost btn-sm terminal-clear" onClick={handleClear}>
          Clear
        </button>
      </div>

      <div className="terminal-output" ref={scrollRef}>
        {lines.length === 0 ? (
          <div className="terminal-placeholder">Waiting for output...</div>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={`terminal-line ${
                line.type === 'stderr' ? 'terminal-line-error' :
                line.type === 'system' ? 'terminal-line-system' :
                ''
              }`}
            >
              {line.text}
            </div>
          ))
        )}
        {!exited && <span className="terminal-cursor">▊</span>}
      </div>
    </div>
  )
}

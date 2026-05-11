import { useRef } from 'react'

const PDFUploader = ({ file, onChange, extracting }) => {
    const inputRef = useRef(null)

    const handleDrop = (e) => {
        e.preventDefault()
        const dropped = e.dataTransfer.files[0]
        if (dropped?.type === 'application/pdf') onChange(dropped)
    }

    const handleChange = (e) => {
        const selected = e.target.files[0]
        if (selected) onChange(selected)
    }

    return (
        <div className="animate-fade-in">
            <div
                className={`pdf-dropzone${file ? ' pdf-dropzone--selected' : ''}`}
                onClick={() => !extracting && inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                aria-label="Upload PDF"
                onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
            >
                {extracting ? (
                    <div className="pdf-extracting">
                        <div className="loading-spinner" style={{ margin: '0 auto 0.75rem' }} />
                        <p>Extracting concepts from PDF…</p>
                    </div>
                ) : file ? (
                    <div className="pdf-selected">
                        <span className="pdf-icon">📄</span>
                        <span className="pdf-filename">{file.name}</span>
                        <button
                            className="btn btn-ghost pdf-remove"
                            onClick={e => { e.stopPropagation(); onChange(null) }}
                            aria-label="Remove file"
                        >✕</button>
                    </div>
                ) : (
                    <div className="pdf-placeholder">
                        <span className="pdf-upload-icon">⬆</span>
                        <p className="pdf-drop-label">Drop a PDF here or <span className="pdf-browse">browse</span></p>
                        <p className="pdf-hint">Only .pdf files are accepted</p>
                    </div>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={handleChange}
            />
        </div>
    )
}

export default PDFUploader

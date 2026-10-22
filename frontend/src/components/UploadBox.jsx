import { useState } from 'react';

const ACCEPT = '.pdf,.docx,.txt';

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadBox({ file, onFile, disabled }) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      className={`drop${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
      }}
    >
      <input
        type="file"
        accept={ACCEPT}
        disabled={disabled}
        onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
      />
      <span className="drop-title">{file ? file.name : 'Choose a resume file'}</span>
      <span className="drop-hint">
        {file ? `${formatSize(file.size)} · click to choose a different file` : 'PDF, Word (.docx), or .txt, up to 5 MB. You can also drag it here.'}
      </span>
    </label>
  );
}

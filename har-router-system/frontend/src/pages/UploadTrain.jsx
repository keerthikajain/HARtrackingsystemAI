import { useState, useRef, useEffect } from 'react'
import { uploadDataset, trainModels, listFiles } from '../services/ApiService'
import { UploadCloud, FileText } from 'lucide-react'

export default function UploadTrain() {
  const [file, setFile]               = useState(null)
  const [files, setFiles]             = useState([])
  const [uploading, setUploading]     = useState(false)
  const [training, setTraining]       = useState(false)
  const [uploadedName, setUploadedName] = useState('')
  const [metrics, setMetrics]         = useState(null)
  const [error, setError]             = useState('')
  const [dragging, setDragging]       = useState(false)
  const inputRef = useRef()

  useEffect(() => { listFiles().then(d => setFiles(d.files || [])).catch(() => {}) }, [])

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) setFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true); setError('')
    try {
      const res = await uploadDataset(file)
      setUploadedName(res.filename)
      setFiles(f => [...new Set([...f, res.filename])])
    } catch (e) { setError(e.response?.data?.detail || 'Upload failed.') }
    finally { setUploading(false) }
  }

  const handleTrain = async () => {
    const fname = uploadedName || (files.length > 0 ? files[0] : null)
    if (!fname) { setError('Upload a file first.'); return }
    setTraining(true); setError('')
    try {
      const res = await trainModels({ filename: fname, n_pca_components: 50, n_clusters: 6 })
      setMetrics(res)
    } catch (e) { setError(e.response?.data?.detail || 'Training failed.') }
    finally { setTraining(false) }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Prepare Your Model</h2>
        <p className="text-sm text-gray-500 mt-1">Upload sensor data and train the HAR classification model.</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`bg-white rounded-2xl border-2 border-dashed p-10 flex flex-col items-center gap-4 text-center transition-colors
          ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
      >
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
          <UploadCloud size={28} strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-bold text-gray-800">Upload Dataset for Training</p>
          <p className="text-sm text-gray-500 mt-1">Drag and drop your CSV file here, or click to browse.</p>
        </div>
        {file && <p className="text-sm text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-lg">📄 {file.name}</p>}
        <input ref={inputRef} type="file" accept=".csv" hidden onChange={e => setFile(e.target.files[0])} />
        <div className="flex gap-3">
          <button onClick={() => inputRef.current.click()} className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Choose File
          </button>
          <button
            onClick={file ? handleUpload : handleTrain}
            disabled={uploading || training}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold shadow-md shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : training ? 'Training…' : uploadedName ? 'Start Training' : files.length > 0 ? 'Train Existing' : 'Upload & Train'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

      {/* Accuracy cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Baseline Accuracy</p>
            <p className="text-3xl font-extrabold text-amber-700">{(metrics.baseline_accuracy * 100).toFixed(1)}%</p>
            <p className="text-sm text-amber-600 mt-1">Standard HAR model performance.</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Routed Accuracy</p>
            <p className="text-3xl font-extrabold text-green-700">{(metrics.routed_accuracy * 100).toFixed(1)}%</p>
            <p className="text-sm text-green-600 mt-1">Performance after cluster-based routing.</p>
          </div>
        </div>
      )}

      {/* File history */}
      {files.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Training Session History</h3>
            <p className="text-sm text-gray-500 mt-0.5">Available datasets for training.</p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left whitespace-nowrap">Run ID</th>
                <th className="px-5 py-3 text-left">Dataset Name</th>
                <th className="px-5 py-3 text-left whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {files.map((f, i) => (
                <tr key={f} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">TR-{9000 + i}</td>
                  <td className="px-5 py-3 text-gray-700 max-w-[160px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate">{f}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className="bg-green-50 text-green-700 border border-green-200 text-xs font-semibold px-2.5 py-1 rounded-full">Available</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

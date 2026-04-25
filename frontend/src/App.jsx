import { useState } from 'react'
import { HiOutlineVideoCamera, HiOutlineClock } from 'react-icons/hi2'
import { downloadVideoByFormat, extractVideoInfo, getApiErrorMessage } from './api/downloaderApi'
import Footer from './components/Footer'
import { formatDuration, formatFileSize } from './utils/formatters'
import { isValidHttpUrl } from './utils/validators'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [videoData, setVideoData] = useState(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [downloadingFormatId, setDownloadingFormatId] = useState('')
  const [message, setMessage] = useState(null)

  const notify = (text, tone = 'error') => {
    setMessage({ text, tone })
  }

  const handleExtract = async () => {
    const trimmedUrl = url.trim()

    if (!trimmedUrl) {
      notify('Please enter a video URL.', 'warning')
      return
    }

    if (!isValidHttpUrl(trimmedUrl)) {
      notify('Please enter a valid http/https URL.', 'warning')
      return
    }

    setIsExtracting(true)
    setVideoData(null)
    setMessage(null)

    try {
      const data = await extractVideoInfo(trimmedUrl)
      setVideoData(data)
      notify('Extraction completed successfully.', 'success')
    } catch (error) {
      notify(await getApiErrorMessage(error, 'Failed to extract video info.'))
    } finally {
      setIsExtracting(false)
    }
  }

  const handleDownload = async (formatId) => {
    const trimmedUrl = url.trim()

    if (!trimmedUrl) {
      notify('Please enter a video URL before downloading.', 'warning')
      return
    }

    setDownloadingFormatId(formatId)

    try {
      const { blob, fileName } = await downloadVideoByFormat({
        url: trimmedUrl,
        formatId,
      })

      const downloadUrl = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = downloadUrl
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(downloadUrl)

      notify('Download started.', 'success')
    } catch (error) {
      notify(await getApiErrorMessage(error, 'Failed to download this format.'))
    } finally {
      setDownloadingFormatId('')
    }
  }

  const hasFormats = Array.isArray(videoData?.formats) && videoData.formats.length > 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-header">
          <img src="/logo.png" alt="ALL Video Downloader" className="brand-logo" />
          <span className="brand-title">ALL Video Downloader</span>
        </div>
        <span className="brand-tagline">Fast &amp; Free</span>
      </header>

      <main className="page-main">
        <section className="hero-section">
          <h1>Download Videos From Any Platform</h1>
          <p>Paste your link and download instantly.</p>
        </section>

        <section className="downloader-shell" aria-label="Video downloader">
          <div className="downloader-card">
            <label htmlFor="video-url" className="input-label">
              Video URL
            </label>
            <div className="input-row">
              <input
                id="video-url"
                className="url-input"
                type="url"
                placeholder="https://example.com/video"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
              <button type="button" className="btn btn-primary" onClick={handleExtract} disabled={isExtracting}>
                {isExtracting ? (
                  <img src="/logo.png" alt="" className="logo-spinner" aria-hidden="true" />
                ) : null}
                {isExtracting ? 'Extracting...' : 'Extract'}
              </button>
            </div>

            {message ? (
              <div className={`status-banner status-banner--${message.tone}`} role="status" aria-live="polite">
                {message.text}
              </div>
            ) : null}

            {videoData ? (
              <div className="result-area">
                <article className="video-info-card">
                  <div className="video-thumb-wrap">
                    {videoData.thumbnail ? (
                      <img
                        src={videoData.thumbnail}
                        alt={videoData.title || 'Video thumbnail'}
                        className="video-thumb"
                        loading="lazy"
                      />
                    ) : (
                      <div className="video-thumb video-thumb--placeholder">No thumbnail</div>
                    )}
                  </div>

                  <div className="video-meta">
                    <h2 className="video-title">{videoData.title || 'Untitled video'}</h2>
                    <div className="meta-grid">
                      <div className="meta-item">
                        <HiOutlineClock aria-hidden="true" />
                        <span>{formatDuration(videoData.duration)}</span>
                      </div>
                      <div className="meta-item">
                        <HiOutlineVideoCamera aria-hidden="true" />
                        <span>{videoData.extractor || 'Unknown platform'}</span>
                      </div>
                      <div className="meta-item meta-item--full">
                        <strong>Uploader</strong>
                        <span>{videoData.uploader || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                </article>

                <div className="formats-head">
                  <h3>Available Downloads</h3>
                  <span>{videoData.formats?.length || 0} formats</span>
                </div>

                {hasFormats ? (
                  <div className="formats-grid">
                    {videoData.formats.map((format) => (
                      <article key={`${format.format_id}-${format.ext}-${format.resolution}`} className="format-card">
                        <div className="format-main">
                          <div>
                            <span className="format-label">Quality</span>
                            <strong>{format.quality || 'Unknown'}</strong>
                          </div>
                          <div>
                            <span className="format-label">Type</span>
                            <strong>{format.ext || 'Unknown'}</strong>
                          </div>
                          <div>
                            <span className="format-label">Resolution</span>
                            <strong>{format.resolution || 'Unknown'}</strong>
                          </div>
                          <div>
                            <span className="format-label">File size</span>
                            <strong>{formatFileSize(format.filesize)}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleDownload(format.format_id)}
                          disabled={downloadingFormatId === format.format_id}
                        >
                          {downloadingFormatId === format.format_id ? <span className="spinner" aria-hidden="true" /> : null}
                          {downloadingFormatId === format.format_id ? 'Downloading...' : 'Download'}
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No downloadable formats were returned for this URL.</p>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default App

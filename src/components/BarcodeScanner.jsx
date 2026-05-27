import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

function BarcodeScanner({ active, onDetected, onError }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const [status, setStatus] = useState('Starting camera...')

  useEffect(() => {
    if (!active || !videoRef.current) {
      return undefined
    }

    let cancelled = false
    const reader = new BrowserMultiFormatReader()
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
      },
      audio: false,
    }

    async function startScanner() {
      try {
        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result, error) => {
            if (result) {
              const text = result.getText()

              controlsRef.current?.stop()
              setStatus('Barcode found')
              onDetected(text)
              return
            }

            if (error && error.name !== 'NotFoundException') {
              setStatus('Still looking for a barcode...')
            }
          },
        )

        if (cancelled) {
          controls.stop()
          return
        }

        controlsRef.current = controls
        setStatus('Point the camera at the barcode')
      } catch (error) {
        const message =
          error?.name === 'NotAllowedError'
            ? 'Camera permission was denied.'
            : 'Camera could not start. You can enter the barcode manually.'

        setStatus(message)
        onError(message)
      }
    }

    startScanner()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [active, onDetected, onError])

  return (
    <div className="scanner-shell">
      <video ref={videoRef} className="scanner-video" muted playsInline />
      <div className="scanner-frame" aria-hidden="true" />
      <p className="scanner-status">{status}</p>
    </div>
  )
}

export default BarcodeScanner

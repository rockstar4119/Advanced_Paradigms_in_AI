import { useState } from 'react'
import { apiClient } from '../lib/api'
import { rangeProgress } from '../lib/ui'
import { useGraphStore } from '../hooks/useGraphStore'
import { Spinner } from './Spinner'
import type { DatasetType } from '../types'

const N_SAMPLES_RANGE = { min: 40, max: 500 }
const NOISE_RANGE = { min: 0, max: 0.5 }
const IMBALANCE_RANGE = { min: 0.05, max: 0.5 }
const LABEL_FRACTION_RANGE = { min: 0.02, max: 0.5 }

export function DatasetSelector() {
  const setDataset = useGraphStore((state) => state.setDataset)
  const [datasetType, setDatasetType] = useState<DatasetType>('two_moons')
  const [nSamples, setNSamples] = useState(200)
  const [noise, setNoise] = useState(0.1)
  const [imbalanceRatio, setImbalanceRatio] = useState(0.5)
  const [labelFraction, setLabelFraction] = useState(0.1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.generateDataset({
        dataset_type: datasetType,
        n_samples: nSamples,
        noise,
        imbalance_ratio: imbalanceRatio,
        label_fraction: labelFraction,
      })
      setDataset(response.session_id, response.nodes, response.n_classes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate dataset')
    } finally {
      setIsLoading(false)
    }
  }

  const uploadCsv = async (file: File) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.uploadDataset(file, labelFraction)
      setDataset(response.session_id, response.nodes, response.n_classes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload dataset')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-index">1</span>
        <h2>Dataset</h2>
      </div>

      <div className="field select-field">
        <div className="field-row">
          <span className="field-label">Source</span>
        </div>
        <select value={datasetType} onChange={(e) => setDatasetType(e.target.value as DatasetType)}>
          <option value="two_moons">Two moons</option>
          <option value="circles">Concentric circles</option>
          <option value="blobs">Blobs (imbalance-adjustable)</option>
        </select>
      </div>

      <div className="field">
        <div className="field-row">
          <span className="field-label">Samples</span>
          <span className="field-value">{nSamples}</span>
        </div>
        <input
          type="range"
          min={N_SAMPLES_RANGE.min}
          max={N_SAMPLES_RANGE.max}
          value={nSamples}
          style={rangeProgress(nSamples, N_SAMPLES_RANGE.min, N_SAMPLES_RANGE.max)}
          onChange={(e) => setNSamples(Number(e.target.value))}
        />
      </div>

      <div className="field">
        <div className="field-row">
          <span className="field-label">Noise</span>
          <span className="field-value">{noise.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={NOISE_RANGE.min}
          max={NOISE_RANGE.max}
          step={0.01}
          value={noise}
          style={rangeProgress(noise, NOISE_RANGE.min, NOISE_RANGE.max)}
          onChange={(e) => setNoise(Number(e.target.value))}
        />
      </div>

      {datasetType === 'blobs' && (
        <div className="field">
          <div className="field-row">
            <span className="field-label">Imbalance ratio</span>
            <span className="field-value">{imbalanceRatio.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={IMBALANCE_RANGE.min}
            max={IMBALANCE_RANGE.max}
            step={0.01}
            value={imbalanceRatio}
            style={rangeProgress(imbalanceRatio, IMBALANCE_RANGE.min, IMBALANCE_RANGE.max)}
            onChange={(e) => setImbalanceRatio(Number(e.target.value))}
          />
        </div>
      )}

      <div className="field">
        <div className="field-row">
          <span className="field-label">Label fraction</span>
          <span className="field-value">{labelFraction.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={LABEL_FRACTION_RANGE.min}
          max={LABEL_FRACTION_RANGE.max}
          step={0.01}
          value={labelFraction}
          style={rangeProgress(labelFraction, LABEL_FRACTION_RANGE.min, LABEL_FRACTION_RANGE.max)}
          onChange={(e) => setLabelFraction(Number(e.target.value))}
        />
      </div>

      <button onClick={generate} disabled={isLoading}>
        {isLoading && <Spinner />}
        Generate
      </button>

      <label className="upload-label" htmlFor="csv-upload">
        or upload CSV
      </label>
      <input
        id="csv-upload"
        type="file"
        accept=".csv"
        onChange={(e) => e.target.files?.[0] && uploadCsv(e.target.files[0])}
      />

      {error && <p className="error-text">{error}</p>}
    </section>
  )
}

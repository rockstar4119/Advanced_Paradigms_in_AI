export type DatasetType = 'two_moons' | 'circles' | 'blobs' | 'patient_zero'
export type GraphMethod = 'knn' | 'rbf'
export type Algorithm = 'harmonic' | 'mincut'

export interface GenerateDatasetRequest {
  dataset_type: DatasetType
  n_samples: number
  noise: number
  imbalance_ratio: number
  label_fraction: number
  seed?: number
}

export interface NodeOut {
  id: number
  x: number
  y: number
  true_label: number
  observed_label: number | null
}

export interface DatasetResponse {
  session_id: string
  nodes: NodeOut[]
  n_classes: number
}

export interface GraphBuildParams {
  method: GraphMethod
  k: number
  sigma: number
  mutual: boolean
  sparsify_threshold: number
}

export interface PropagationRunParams {
  algorithm: Algorithm
  max_iter: number
  tol: number
  source_class: number
  sink_class: number
}

export interface EdgeAddedEvent {
  type: 'edge_added'
  source: number
  target: number
  weight: number
  step: number
}

export interface BuildDoneEvent {
  type: 'build_done'
  edge_count: number
  density: number
  avg_degree: number
  n_components: number
  algebraic_connectivity: number
  mean_edge_weight: number
}

export interface StreamErrorEvent {
  type: 'error'
  message: string
}

export type GraphStreamEvent = EdgeAddedEvent | BuildDoneEvent | StreamErrorEvent

export interface IterationEvent {
  type: 'iteration'
  t: number
  soft_labels: number[][]
  energy: number
}

export interface AugmentPathEvent {
  type: 'augment_path'
  path: number[]
  flow_added: number
  total_flow: number
  class_index?: number
}

export interface MincutFoundEvent {
  type: 'mincut_found'
  cut_edges: [number, number][]
  side_s: number[]
  side_t: number[]
  class_index?: number
}

export interface ClassMetric {
  class_index: number
  precision: number
  recall: number
  f1: number
  support: number
}

export interface DoneEvent {
  type: 'done'
  labels: Record<number, number>
  accuracy: number
  confusion_matrix: number[][]
  per_class: ClassMetric[]
  energy_trace?: number[]

  // Argmax scores — always present.
  n_evaluated?: number
  balanced_accuracy?: number
  macro_precision?: number
  macro_recall?: number
  macro_f1?: number
  weighted_f1?: number
  cohen_kappa?: number
  matthews_corrcoef?: number

  // Posterior scores — harmonic only; min-cut returns a hard partition.
  mean_entropy?: number
  mean_confidence?: number
  mean_margin?: number
  confidence_gap?: number
  brier_score?: number
  log_loss?: number
  auroc_macro?: number
}

export type PropagationStreamEvent =
  | IterationEvent
  | AugmentPathEvent
  | MincutFoundEvent
  | DoneEvent
  | StreamErrorEvent

export interface EfficiencyPoint {
  label_fraction: number
  accuracy: number
}

export interface LabelEfficiencyResponse {
  points: EfficiencyPoint[]
}

// ---------------------------------------------------------------- interpretability

export interface LeakEdge {
  source: number
  target: number
  weight: number
  source_class: number
  target_class: number
}

export interface Histogram {
  bin_edges: number[]
  counts: number[]
}

export interface ComponentInfo {
  component_id: number
  size: number
  n_labeled: number
  classes_present: number[]
}

export interface GraphExplanation {
  homophily_weighted: number
  homophily_unweighted: number
  n_cross_class_edges: number
  cross_class_weight_fraction: number
  top_leaks: LeakEdge[]
  degree_histogram: Histogram
  weight_histogram: Histogram
  isolated_nodes: number[]
  weak_nodes: number[]
  components: ComponentInfo[]
  n_unreachable: number
  node_degree: number[]
  node_neighbors: number[]
  node_local_homophily: number[]
}

export interface SeedContribution {
  seed_node: number
  seed_class: number
  mass: number
}

export interface NodeExplanation {
  node_id: number
  predicted: number
  true_label: number
  soft_labels: number[]
  entropy: number
  margin: number
  degree: number
  n_neighbors: number
  local_homophily: number
  reachable: boolean
  top_seeds: SeedContribution[]
  class_mass: number[]
}

export interface SeedInfluence {
  seed_node: number
  seed_class: number
  total_mass: number
  share: number
  n_nodes_dominated: number
}

export interface InfluenceSummary {
  seed_influence: SeedInfluence[]
  unreachable: number[]
  entropy: number[]
  margin: number[]
  redundant_seeds: number[]
}

export interface CalibrationBin {
  lower: number
  upper: number
  count: number
  mean_confidence: number
  accuracy: number
}

export interface RiskCoveragePoint {
  threshold: number
  coverage: number
  accuracy: number
  n_kept: number
}

export interface ConfidentError {
  node_id: number
  true_label: number
  predicted: number
  confidence: number
  margin: number
  local_homophily: number
}

export interface ErrorProfile {
  n_evaluated: number
  n_errors: number
  mean_margin_correct: number
  mean_margin_error: number
  mean_homophily_correct: number
  mean_homophily_error: number
  errors_in_lowest_margin_quartile: number
  unreachable_errors: number
}

export interface ResultExplanation {
  accuracy: number
  homophily_ceiling: number
  expected_calibration_error: number
  calibration: CalibrationBin[]
  risk_coverage: RiskCoveragePoint[]
  error_profile: ErrorProfile
  confident_errors: ConfidentError[]
}

// ------------------------------------------------------------- active learning

export type AcquisitionStrategy = 'entropy' | 'margin' | 'density_entropy' | 'random'

export interface Suggestion {
  node_id: number
  score: number
  entropy: number
  margin: number
  degree: number
}

export interface RoundPoint {
  round_index: number
  n_labels: number
  accuracy: number
  mean_entropy: number
}

export interface ArenaTrack {
  name: string
  strategy: string
  n_labels: number
  accuracy: number
  mean_entropy: number
  history: RoundPoint[]
  predictions: number[]
  confidence: number[]
  entropy: number[]
  observed: number[]
  newly_labeled: number[]
}

export interface ArenaState {
  round_index: number
  batch_size: number
  strategy: string
  holdout: number[]
  pool_size: number
  exhausted: boolean
  n_classes: number
  tracks: Record<string, ArenaTrack>
  suggestions: Suggestion[]
}

export interface StartArenaRequest {
  batch_size: number
  strategy: AcquisitionStrategy
  holdout_fraction: number
  seed?: number
}

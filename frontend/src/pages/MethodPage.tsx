import 'katex/dist/katex.min.css'
import '../styles/method.css'
import { HarmonicSolver } from '../components/method/HarmonicSolver'
import { KernelExplorer } from '../components/method/KernelExplorer'
import { Eq, M } from '../components/method/Math'
import { MincutFigure } from '../components/method/MincutFigure'
import { Caveat, Contents, InApp, Section, Source, type SectionSpec } from '../components/method/Scaffold'

const SECTIONS: SectionSpec[] = [
  { id: 'notation', stage: '00', title: 'Notation' },
  { id: 'data', stage: '01', title: 'Data & the label mask' },
  { id: 'graph', stage: '02', title: 'Graph construction' },
  { id: 'laplacian', stage: '03', title: 'The Laplacian' },
  { id: 'harmonic', stage: '04', title: 'Harmonic propagation' },
  { id: 'mincut', stage: '05', title: 'Graph mincut' },
  { id: 'duel', stage: '06', title: 'Why they disagree' },
  { id: 'evaluation', stage: '07', title: 'Evaluation' },
  { id: 'cost', stage: '08', title: 'Cost & limits' },
  { id: 'failure', stage: '09', title: 'When this breaks' },
  { id: 'references', stage: '—', title: 'References' },
]

export function MethodPage() {
  return (
    <div className="method-page">
      <div className="method-shell">
        <Contents sections={SECTIONS} />

        <article className="method-body">
          <header className="m-hero">
            <p className="m-hero-eyebrow">The method</p>
            <h1>
              You label 10% of the data.
              <br />
              <em>Geometry</em> labels the rest.
            </h1>
            <p className="m-hero-lede">
              Propagation Studio is built on one assumption, and everything downstream is a
              consequence of it: points that sit near each other in feature space tend to share a
              label. Make that assumption explicit — as a weighted graph — and a handful of labels
              becomes enough to classify everything else. This page is the full derivation, from raw
              coordinates to the accuracy number in the metrics rail.
            </p>

            <div className="m-hero-claim">
              <Eq
                note="The smoothness assumption. Every algorithm here is a different way of enforcing it."
              >
                {String.raw`\text{if } \; \lVert \mathbf{x}_i - \mathbf{x}_j \rVert \; \text{is small} \;\; \Longrightarrow \;\; y_i = y_j \;\; \text{is likely}`}
              </Eq>
            </div>

            <div className="m-pipeline">
              {['Points', 'Graph', 'Laplacian', 'Propagate', 'Score'].map((stage, index) => (
                <span key={stage} className="m-pipeline-node">
                  <span className="m-pipeline-dot">{index + 1}</span>
                  {stage}
                </span>
              ))}
            </div>
          </header>

          {/* ------------------------------------------------------------ */}
          <Section
            id="notation"
            stage="00"
            title="Notation"
            lede="Eleven symbols carry the whole page. They are worth thirty seconds."
          >
            <dl className="m-notation">
              {[
                [String.raw`n,\; d,\; C`, 'sample count, feature dimension, number of classes'],
                [String.raw`X \in \mathbb{R}^{n \times d}`, 'the feature matrix; row i is the point x_i'],
                [String.raw`y \in \{0,\dots,C-1\}^n`, 'ground truth — known to the evaluator, never to the algorithm'],
                [String.raw`\tilde{y}_i`, 'the observed label, or −1 where the label is withheld'],
                [String.raw`\mathcal{L},\; \mathcal{U}`, 'labeled and unlabeled index sets; they partition all n nodes'],
                [String.raw`W \in \mathbb{R}^{n \times n}`, 'symmetric weight matrix; w_ij is the affinity of i and j'],
                [String.raw`d_i = \textstyle\sum_j w_{ij}`, 'weighted degree of node i'],
                [String.raw`D = \mathrm{diag}(d_1,\dots,d_n)`, 'degree matrix'],
                [String.raw`L = D - W`, 'the unnormalized graph Laplacian'],
                [String.raw`f \in \mathbb{R}^{n \times C}`, 'soft label matrix; row f_i is a distribution over classes'],
                [String.raw`\sigma,\; k,\; \tau,\; \rho`, 'kernel bandwidth, neighbour count, sparsify cutoff, label fraction'],
              ].map(([tex, gloss]) => (
                <div key={tex} className="m-def">
                  <dt>
                    <M>{tex}</M>
                  </dt>
                  <dd>{gloss}</dd>
                </div>
              ))}
            </dl>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section
            id="data"
            stage="01"
            title="Data & the label mask"
            lede="Before any learning happens, the studio deliberately throws labels away — and it does so in a way that is reproducible and never starves a class."
          >
            <p>
              Each generator emits a matrix <M>{String.raw`X \in \mathbb{R}^{n \times d}`}</M> together with
              its true labels <M>y</M>. Two moons and concentric circles are the canonical stress
              tests: both are linearly inseparable, so any method that succeeds on them has to be
              using the <em>shape</em> of the data rather than a hyperplane through it. Blobs adds a
              controllable class imbalance.
            </p>

            <h3>Stratified revealing</h3>
            <p>
              The label mask is drawn per class rather than uniformly at random. For each class{' '}
              <M>c</M> with index set <M>{String.raw`I_c`}</M>, the studio reveals
            </p>
            <Eq
              label="1.1"
              note="Round to the nearest node, but never reveal fewer than one — a class with zero labels is unreachable by construction."
            >
              {String.raw`m_c \;=\; \max\bigl(1,\; \min(|I_c|,\; \mathrm{round}(|I_c| \cdot \rho))\bigr)`}
            </Eq>
            <p>
              indices chosen uniformly without replacement from <M>{String.raw`I_c`}</M>; everything
              else is set to <M>-1</M>. Stratifying matters more than it looks: at{' '}
              <M>{String.raw`\rho = 0.02`}</M> on an imbalanced blob, uniform sampling can plausibly
              return zero labels for the minority class, and both algorithms would then be
              structurally incapable of ever predicting it. The seed makes the draw reproducible so
              that comparisons across algorithms hold the label set fixed.
            </p>
            <Source path="app/core/datasets.py" symbol="LabelRevealer.reveal" />

            <h3>Layout is not the model</h3>
            <p>
              When <M>{String.raw`d > 2`}</M>, node positions on the canvas come from a 2-component
              PCA projection. This is a <strong>display transform only</strong>. The graph in{' '}
              <a href="#graph" onClick={jumpTo('graph')}>stage 02</a> is built on the full{' '}
              <M>d</M>-dimensional <M>X</M>, never on the projected coordinates.
            </p>
            <Eq label="1.2" note="Used for the canvas; discarded before any distance is computed.">
              {String.raw`Z \;=\; \mathrm{PCA}_2(X) \in \mathbb{R}^{n \times 2}`}
            </Eq>
            <Caveat title="Read the canvas carefully">
              Because the layout is a projection, two nodes can look adjacent on screen and carry no
              edge, or look distant and be strongly connected. The drawn edges are always the truth;
              the positions are a convenience.
            </Caveat>
            <Source path="app/core/dimensionality.py" symbol="LayoutProjector.project" />

            <InApp control="Dataset panel.">
              <em>Label fraction</em> is <M>{String.raw`\rho`}</M>, <em>Samples</em> is <M>n</M>,{' '}
              <em>Imbalance ratio</em> sets the split between blob sizes.
            </InApp>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section
            id="graph"
            stage="02"
            title="Graph construction"
            lede="This is the modelling step that matters most. Every later algorithm reads only W — get this wrong and nothing downstream can recover."
          >
            <p>
              Affinity between two points is a Gaussian (RBF) kernel of their squared Euclidean
              distance:
            </p>
            <Eq label="2.1" note="Weights live in (0, 1]; identical points score 1, distant pairs decay superexponentially.">
              {String.raw`w_{ij} \;=\; \exp\!\left(-\frac{\lVert \mathbf{x}_i - \mathbf{x}_j \rVert^2}{2\sigma^2}\right)`}
            </Eq>
            <p>
              The bandwidth <M>{String.raw`\sigma`}</M> is the single most consequential number in the
              application. It defines the length scale at which the data is considered locally
              connected — and because the decay is Gaussian, the transition from "connected" to
              "invisible" is sharp.
            </p>

            <KernelExplorer />

            <h3>Two ways to sparsify</h3>
            <p>
              Equation 2.1 alone yields a complete graph with{' '}
              <M>{String.raw`\binom{n}{2}`}</M> edges, most of them negligible. The studio offers two
              sparsification strategies.
            </p>

            <p>
              <strong>Weighted k-NN.</strong> Let <M>{String.raw`N_k(i)`}</M> be the <M>k</M> nearest
              neighbours of <M>i</M> under Euclidean distance, excluding <M>i</M> itself. An edge
              survives by <em>union</em> — the default, and asymmetric on purpose:
            </p>
            <Eq label="2.2" note="Union k-NN. Node i keeps j if either one considers the other close.">
              {String.raw`w^{\mathrm{knn}}_{ij} \;=\; \begin{cases} w_{ij} & j \in N_k(i) \;\lor\; i \in N_k(j) \\[2pt] 0 & \text{otherwise} \end{cases}`}
            </Eq>
            <p>
              Enabling <em>mutual neighbours only</em> replaces the disjunction with a conjunction:
            </p>
            <Eq label="2.3" note="Mutual k-NN. Strictly sparser, and far more likely to fragment the graph.">
              {String.raw`w^{\mathrm{mut}}_{ij} \;=\; \begin{cases} w_{ij} & j \in N_k(i) \;\land\; i \in N_k(j) \\[2pt] 0 & \text{otherwise} \end{cases}`}
            </Eq>
            <p>
              Mutual k-NN prunes the "hub" edges that a dense region pushes into a sparse one, which
              cleans up the boundary between clusters — at the cost of isolating genuinely sparse
              regions. Watch the component count when you turn it on.
            </p>

            <p>
              <strong>Thresholded RBF.</strong> Keep the complete graph but drop everything below a
              cutoff:
            </p>
            <Eq label="2.4" note="Every pair is scored; only those clearing τ become edges.">
              {String.raw`w^{\mathrm{rbf}}_{ij} \;=\; w_{ij} \cdot \mathbb{1}\!\left[\, w_{ij} \geq \tau \,\right]`}
            </Eq>
            <p>
              Because equation 2.1 is monotone in distance, thresholding at{' '}
              <M>{String.raw`\tau`}</M> is exactly a distance ball of radius{' '}
              <M>{String.raw`\delta_\tau = \sigma\sqrt{-2\ln\tau}`}</M> — the "edge radius" the figure
              above reports. So the RBF builder is a <M>{String.raw`\varepsilon`}</M>-neighbourhood
              graph in disguise, with <M>{String.raw`\tau`}</M> and <M>{String.raw`\sigma`}</M> as
              two knobs on the same underlying radius.
            </p>

            <div className="m-compare-grid">
              <div>
                <h4>k-NN adapts, RBF doesn't</h4>
                <p>
                  k-NN gives every node the same degree regardless of local density, so it survives
                  data where one cluster is much tighter than another. A single global{' '}
                  <M>{String.raw`\tau`}</M> cannot do that: it will over-connect the dense cluster and
                  isolate the sparse one.
                </p>
              </div>
              <div>
                <h4>RBF is smoother at the boundary</h4>
                <p>
                  k-NN's hard cutoff at the <M>k</M>-th neighbour introduces a discontinuity that has
                  nothing to do with the data. RBF's boundary is set by the kernel itself, which is
                  why it often produces the better-conditioned graph when density is uniform.
                </p>
              </div>
            </div>
            <Source path="app/core/graph_builder.py" symbol="KNNGraphBuilder · RBFGraphBuilder" />

            <InApp control="Graph construction panel.">
              <em>Method</em> selects 2.2/2.3 against 2.4, <em>σ (sigma)</em> is the bandwidth in 2.1,{' '}
              <em>k</em> and <em>Sparsify threshold</em> are the respective sparsifiers. Edges stream
              onto the canvas in the order the builder emits them — k-NN by node index, RBF by
              descending weight, which is why an RBF build draws its strongest structure first.
            </InApp>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section
            id="laplacian"
            stage="03"
            title="The Laplacian"
            lede="One matrix answers every structural question the graph stats panel asks — and defines the objective that stage 04 minimizes."
          >
            <p>
              With degrees <M>{String.raw`d_i = \sum_j w_{ij}`}</M> collected into{' '}
              <M>{String.raw`D`}</M>, the unnormalized Laplacian is
            </p>
            <Eq label="3.1" note="Symmetric, positive semi-definite, and singular by construction.">
              {String.raw`L \;=\; D - W`}
            </Eq>
            <p>
              Its importance comes entirely from one identity. For any vector{' '}
              <M>{String.raw`v \in \mathbb{R}^n`}</M>,
            </p>
            <Eq
              label="3.2"
              note="The Laplacian quadratic form: a weighted measure of how much v disagrees with itself across edges."
            >
              {String.raw`v^{\top} L v \;=\; \tfrac{1}{2}\sum_{i,j} w_{ij}\,(v_i - v_j)^2`}
            </Eq>
            <p>
              Read the right-hand side as a penalty. It is zero when <M>v</M> is constant on every
              connected component, and it grows whenever a heavy edge connects two nodes with
              different values. That is precisely the smoothness assumption from the top of this
              page, written as something you can minimize — which is what{' '}
              <a href="#harmonic" onClick={jumpTo('harmonic')}>stage 04</a> does.
            </p>

            <h3>The spectrum tells you whether propagation can work</h3>
            <p>
              Order the eigenvalues <M>{String.raw`0 = \lambda_1 \le \lambda_2 \le \dots \le \lambda_n`}</M>.
              The multiplicity of eigenvalue <M>0</M> equals the number of connected components, so
              the second-smallest eigenvalue — the <strong>Fiedler value</strong> — is a direct test:
            </p>
            <Eq label="3.3" note="Algebraic connectivity. Zero means the graph is in pieces.">
              {String.raw`\lambda_2 > 0 \;\;\Longleftrightarrow\;\; \text{the graph is connected}`}
            </Eq>
            <p>
              This is not academic. If <M>{String.raw`\lambda_2 = 0`}</M> and some component contains
              no labeled node, then no amount of iteration will ever reach it — the harmonic solution
              on that component is undetermined and mincut cannot separate what was never joined. A
              small but positive <M>{String.raw`\lambda_2`}</M> is the intermediate warning: the graph
              is technically connected but has a bottleneck, and propagation across it will be slow
              and low-confidence.
            </p>

            <h3>The rest of the stats panel</h3>
            <Eq label="3.4" note="Edge density: realized edges over the complete-graph maximum.">
              {String.raw`\mathrm{density} \;=\; \frac{|E|}{\binom{n}{2}} \;=\; \frac{2|E|}{n(n-1)}`}
            </Eq>
            <Eq label="3.5" note="Mean weighted degree — a sum of weights, not a count of neighbours.">
              {String.raw`\bar{d} \;=\; \frac{1}{n}\sum_{i=1}^{n} d_i \;=\; \frac{1}{n}\sum_{i,j} w_{ij}`}
            </Eq>
            <Caveat title="Avg degree is weighted">
              The panel's <em>Avg degree</em> reports equation 3.5, which sums kernel weights rather
              than counting neighbours. On a k-NN graph with weak edges it will read well below{' '}
              <M>k</M>, and that gap is informative: it means the neighbours being retained are far
              away in feature space, so the edges exist but carry almost no propagating power.
            </Caveat>
            <p>
              Component count is computed by breadth-first search over the non-zero support of{' '}
              <M>W</M>, which agrees with the multiplicity of <M>0</M> in the spectrum but is cheap
              enough to run on every build.
            </p>
            <Source path="app/core/graph_metrics.py" symbol="GraphAnalyzer.analyze" />

            <InApp control="Graph statistics panel.">
              <em>Connectivity λ₂</em> is equation 3.3, <em>Density</em> is 3.4, <em>Avg degree</em> is
              3.5. A <em>Components</em> reading above 1 turns the panel red, because that is the one
              structural fault the algorithms cannot work around.
            </InApp>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section
            id="harmonic"
            stage="04"
            title="Harmonic propagation"
            lede="Relax the labels to continuous values, minimize the Laplacian quadratic form, and the answer is the one function that is its own local average."
          >
            <p>
              Represent labels as a soft matrix <M>{String.raw`f \in \mathbb{R}^{n \times C}`}</M>, where row{' '}
              <M>{String.raw`f_i`}</M> is a distribution over classes. Extend equation 3.2 to vector
              values and we have the energy the algorithm minimizes:
            </p>
            <Eq label="4.1" note="Total disagreement across all edges, weighted by affinity.">
              {String.raw`E(f) \;=\; \tfrac{1}{2}\sum_{i,j} w_{ij}\,\lVert f_i - f_j \rVert^2 \;=\; \mathrm{tr}\!\left(f^{\top} L f\right)`}
            </Eq>
            <p>
              Minimizing this without constraints gives the useless constant solution. The observed
              labels supply the boundary condition:
            </p>
            <Eq label="4.2" note="Minimize the energy subject to the labeled rows being pinned to their one-hot values.">
              {String.raw`f^{\star} \;=\; \operatorname*{arg\,min}_{f} \; E(f) \quad \text{s.t.} \quad f_i = e_{\tilde{y}_i} \;\; \forall\, i \in \mathcal{L}`}
            </Eq>

            <h3>The optimality condition</h3>
            <p>
              Setting the gradient to zero on the free (unlabeled) rows gives{' '}
              <M>{String.raw`(Lf)_i = 0`}</M> for all <M>{String.raw`i \in \mathcal{U}`}</M>. Expanding{' '}
              <M>{String.raw`L = D - W`}</M> turns that into a statement with a plain-English
              reading:
            </p>
            <Eq
              label="4.3"
              note="The harmonic property: every unlabeled node equals the degree-weighted average of its neighbours."
            >
              {String.raw`f_i \;=\; \frac{1}{d_i}\sum_{j} w_{ij}\, f_j \qquad \forall\, i \in \mathcal{U}`}
            </Eq>
            <p>
              A function satisfying 4.3 is called <em>harmonic</em> — it has no interior maxima or
              minima, so every extreme value sits on the labeled boundary. This is why the method
              cannot hallucinate a confident class in the middle of an unlabeled void: the values
              there are averages of averages, and they decay toward the uniform mixture.
            </p>

            <h3>Solving it by iteration</h3>
            <p>
              Let <M>{String.raw`P = D^{-1} W`}</M> be the row-stochastic transition matrix. The
              studio solves 4.3 by the clamped Jacobi sweep:
            </p>
            <Eq label="4.4" note="Propagate, then restore. The clamp is what keeps the labels from washing out.">
              {String.raw`f^{(t+1)} \;\leftarrow\; P f^{(t)}, \qquad\text{then}\qquad f^{(t+1)}_i \leftarrow e_{\tilde{y}_i} \;\; \forall\, i \in \mathcal{L}`}
            </Eq>
            <p>
              Initialization sets labeled rows to their one-hot vectors and unlabeled rows to the
              uniform distribution <M>{String.raw`1/C`}</M>. The fixed point is unique, so the
              initialization affects only the path taken, never the destination.
            </p>

            <HarmonicSolver />

            <h3>Why it converges, and to what</h3>
            <p>
              Partition the matrices by labeled and unlabeled blocks. The stationary point of 4.4 has
              a closed form:
            </p>
            <Eq label="4.5" note="The exact harmonic solution. The iteration is a matrix-free way of computing this inverse.">
              {String.raw`f_{\mathcal{U}} \;=\; \left(D_{\mathcal{U}\mathcal{U}} - W_{\mathcal{U}\mathcal{U}}\right)^{-1} W_{\mathcal{U}\mathcal{L}}\, f_{\mathcal{L}} \;=\; \left(I - P_{\mathcal{U}\mathcal{U}}\right)^{-1} P_{\mathcal{U}\mathcal{L}}\, f_{\mathcal{L}}`}
            </Eq>
            <p>
              The iteration converges geometrically whenever the spectral radius{' '}
              <M>{String.raw`\varrho(P_{\mathcal{U}\mathcal{U}}) < 1`}</M>, and that holds exactly when every
              connected component containing an unlabeled node also contains at least one labeled
              node. This is the same condition stage 03 diagnoses — which is why the components
              warning is worth acting on before you read any accuracy number.
            </p>
            <p>
              There is also a probabilistic reading of 4.5 worth carrying around:{' '}
              <M>{String.raw`f_{ic}`}</M> is the probability that a random walk starting at node{' '}
              <M>i</M>, stepping with transition matrix <M>P</M>, is <em>absorbed</em> at a labeled
              node of class <M>c</M>. Soft labels are hitting probabilities, and the clamped rows are
              the absorbing states.
            </p>

            <h3>Stopping and reading off the answer</h3>
            <p>
              The sweep halts when the energy stops moving, or at the iteration cap:
            </p>
            <Eq label="4.6" note="Energy-based stopping. Cheaper than tracking the full residual and monotone by construction.">
              {String.raw`\bigl|\,E(f^{(t)}) - E(f^{(t-1)})\,\bigr| \;<\; \mathrm{tol} \qquad\text{or}\qquad t \geq t_{\max}`}
            </Eq>
            <Eq label="4.7" note="Hard prediction and the confidence readout.">
              {String.raw`\hat{y}_i \;=\; \operatorname*{arg\,max}_{c}\; f_{ic}, \qquad \bar{H} \;=\; -\frac{1}{|\mathcal{U}|}\sum_{i \in \mathcal{U}} \sum_{c} f_{ic}\log_2 f_{ic}`}
            </Eq>
            <p>
              The mean entropy <M>{String.raw`\bar{H}`}</M> is reported as <em>Mean uncertainty</em> in
              bits. It is the most actionable number the app produces: it is high exactly where the
              graph is ambiguous, so ranking unlabeled nodes by entropy gives you a ready-made active
              learning queue — label those first and the accuracy curve in stage 07 climbs fastest.
            </p>
            <Source path="app/core/label_propagation/harmonic.py" symbol="HarmonicPropagator.run" />

            <Caveat title="Isolated nodes degenerate">
              A node with <M>{String.raw`d_i = 0`}</M> has no neighbours to average. The
              implementation substitutes a degree of 1 to avoid dividing by zero, which sends that
              row to the zero vector rather than a distribution — its entropy reads 0 and its{' '}
              <M>{String.raw`\operatorname*{arg\,max}`}</M> falls to class 0 by tie-break. Those predictions are
              arbitrary, not confident. Raise <M>k</M> or <M>{String.raw`\sigma`}</M> to give the node
              an edge.
            </Caveat>

            <InApp control="Label propagation panel.">
              <em>Max iterations</em> is <M>{String.raw`t_{\max}`}</M> and <em>Tolerance</em> is the{' '}
              <M>{String.raw`\mathrm{tol}`}</M> of 4.6. The energy trace streams to the telemetry
              strip one iteration at a time — if it plateaus long before the cap, the tolerance is
              doing its job.
            </InApp>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section
            id="mincut"
            stage="05"
            title="Graph mincut"
            lede="Refuse the continuous relaxation. Insist on a hard 0/1 assignment, and the optimal one is a maximum flow away."
          >
            <p>
              Mincut asks a combinatorial version of the same question. Keep the labels binary and
              minimize the total weight of edges whose endpoints disagree:
            </p>
            <Eq label="5.1" note="Same smoothness idea as 4.1, but with an L1 penalty on binary variables.">
              {String.raw`\min_{y \in \{0,1\}^n} \;\; \tfrac{1}{2}\sum_{i,j} w_{ij}\,\bigl| y_i - y_j \bigr| \quad \text{s.t.} \quad y_i = \tilde{y}_i \;\; \forall\, i \in \mathcal{L}`}
            </Eq>
            <p>
              Integer programs of this shape are usually intractable. This one is not, because it is
              exactly a minimum s–t cut — and minimum cuts are solvable in polynomial time.
            </p>

            <h3>Building the flow network</h3>
            <p>
              Add two terminals <M>s</M> and <M>t</M> to the <M>n</M> data nodes. Interior edges keep
              their kernel weight as capacity in both directions; labeled nodes are wired to their
              terminal with capacity large enough that no minimum cut would ever sever one:
            </p>
            <Eq label="5.2" note="Terminal arcs are effectively infinite, which hard-constrains the observed labels.">
              {String.raw`c(s,i) = \infty \;\; \forall i \in \mathcal{L}_0, \qquad c(i,t) = \infty \;\; \forall i \in \mathcal{L}_1, \qquad c(i,j) = w_{ij}`}
            </Eq>
            <p>
              The implementation realizes <M>{String.raw`\infty`}</M> as{' '}
              <M>{String.raw`10\sum_{i,j} w_{ij} + 1`}</M> — strictly greater than the total weight of
              the entire graph, so cutting a single terminal arc always costs more than cutting every
              interior edge at once. The constraint is therefore exact, not approximate.
            </p>

            <MincutFigure />

            <h3>Max-flow, min-cut</h3>
            <p>
              The Ford–Fulkerson theorem gives the equivalence the whole method rests on:
            </p>
            <Eq
              label="5.3"
              note="Maximum flow value equals minimum cut capacity. Compute the easy one, read off the hard one."
            >
              {String.raw`\max_{\text{flow } \phi} \; |\phi| \;\;=\;\; \min_{(S,T)} \; \sum_{i \in S,\, j \in T} c(i,j)`}
            </Eq>
            <p>
              The studio computes the flow with <strong>Edmonds–Karp</strong>: repeatedly find a
              shortest augmenting path in the residual network by breadth-first search, push the
              bottleneck capacity along it, and update residuals both ways. When no augmenting path
              remains, the set <M>S</M> of nodes still reachable from <M>s</M> in the residual graph
              is one side of the minimum cut; everything else is the other.
            </p>
            <Eq label="5.4" note="The cut is read off the residual graph after saturation — no separate search required.">
              {String.raw`S = \{\, v : v \text{ reachable from } s \text{ in the residual graph} \,\}, \qquad T = V \setminus S`}
            </Eq>
            <p>
              Choosing the <em>shortest</em> augmenting path is not a performance detail, it is a
              correctness one. Kernel weights are irrational reals, and generic Ford–Fulkerson with
              irrational capacities can augment forever without converging to the maximum. The BFS
              rule bounds the number of augmentations at <M>{String.raw`O(VE)`}</M> independently of
              the capacity values, which is what guarantees termination here.
            </p>
            <Source path="app/core/label_propagation/mincut.py" symbol="GraphMincutClassifier.run" />

            <h3>More than two classes</h3>
            <p>
              A minimum cut is intrinsically binary. For <M>{String.raw`C > 2`}</M> the studio runs
              one-vs-rest: for each class <M>c</M>, nodes labeled <M>c</M> feed the source, all other
              labeled nodes feed the sink, and the resulting source side is recorded.
            </p>
            <Caveat title="One-vs-rest is a heuristic, not an optimum">
              The <M>C</M> independent cuts are not constrained to agree. A node can land on the
              source side of several classes, or of none. The implementation resolves overlaps by
              first match in class-index order and assigns anything left over to a fallback label.
              This is a documented approximation — treat multiclass mincut results as indicative, and
              prefer harmonic propagation when <M>{String.raw`C > 2`}</M> and calibration matters.
            </Caveat>

            <InApp control="Label propagation panel.">
              <em>Source class</em> and <em>Sink class</em> pick the two terminals in the binary case.
              Each augmenting path animates on the canvas as it is pushed, and the final cut edges
              are drawn severed — the playback scrubber replays the whole search.
            </InApp>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section
            id="duel"
            stage="06"
            title="Why they disagree"
            lede="Both methods minimize edge disagreement. They differ in one exponent, and everything else follows from it."
          >
            <p>
              Put the two objectives side by side. Harmonic propagation minimizes{' '}
              <M>{String.raw`\sum w_{ij}(f_i - f_j)^2`}</M> over the reals; mincut minimizes{' '}
              <M>{String.raw`\sum w_{ij}|y_i - y_j|`}</M> over <M>{String.raw`\{0,1\}`}</M>. Squared
              versus absolute, continuous versus integral. That is the entire difference, and it
              explains every behaviour you will see on the canvas.
            </p>

            <div className="m-table-wrap">
              <table className="m-table">
                <thead>
                  <tr>
                    <th />
                    <th>Harmonic</th>
                    <th>Mincut</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Penalty', <M key="a">{String.raw`(f_i - f_j)^2`}</M>, <M key="b">{String.raw`|y_i - y_j|`}</M>],
                    ['Variables', <M key="c">{String.raw`f \in \mathbb{R}^{n \times C}`}</M>, <M key="d">{String.raw`y \in \{0,1\}^n`}</M>],
                    ['Output', 'Calibrated distribution per node', 'Hard partition, no confidence'],
                    ['Solution', 'Unique (given connectivity)', 'Optimal, but can be non-unique'],
                    ['Boundary', 'Graded — widens across weak links', 'Sharp — lands on the cheapest cut'],
                    ['Multiclass', 'Native, one solve', 'One-vs-rest, C solves, heuristic merge'],
                    ['Gives you entropy', 'Yes — drives active learning', 'No'],
                    ['Degenerate mode', 'Washes toward uniform far from labels', 'Can peel off a tiny cluster'],
                  ].map(([label, a, b]) => (
                    <tr key={String(label)}>
                      <th scope="row">{label}</th>
                      <td>{a}</td>
                      <td>{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>The failure each one owns</h3>
            <p>
              The squared penalty is <em>convex and smooth</em>, so harmonic propagation spreads
              influence gradually and refuses to commit far from any label — which degrades into a
              near-uniform mixture across a long weakly-connected chain. The absolute penalty is
              indifferent to how many nodes end up on each side, so mincut suffers the opposite
              pathology: <strong>degenerate cuts</strong>, where isolating a handful of nodes around a
              single labeled point is cheaper than finding the real class boundary. Sparse labels and
              a weakly connected graph is the regime where you will actually see it.
            </p>
            <p>
              The practical reading: use harmonic when you want confidence estimates, calibrated
              boundaries, or an active-learning signal. Use mincut when the clusters really are
              separated by a genuine bottleneck and you want the crisp partition that finds it. Run
              both — the comparison panel keeps the last result from each — and treat a large
              disagreement as evidence about the graph, not about the algorithms.
            </p>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section
            id="evaluation"
            stage="07"
            title="Evaluation"
            lede="Every number in the metrics rail is computed on the unlabeled nodes only. The nodes the algorithm was given are excluded from its own score."
          >
            <p>
              This is the transductive setting: there is no held-out test set, because the unlabeled
              nodes <em>are</em> the test set. They were present during propagation as graph
              structure, but their labels were never revealed, so scoring on them is honest.
            </p>
            <Eq label="7.1" note="Accuracy over withheld nodes only — labeled nodes would be trivially correct and would inflate this.">
              {String.raw`\mathrm{acc} \;=\; \frac{1}{|\mathcal{U}|}\sum_{i \in \mathcal{U}} \mathbb{1}\!\left[\, \hat{y}_i = y_i \,\right]`}
            </Eq>
            <p>
              The confusion matrix <M>{String.raw`M_{ab}`}</M> counts unlabeled nodes with true class{' '}
              <M>a</M> predicted as <M>b</M>, and the per-class table follows from it directly:
            </p>
            <Eq label="7.2" note="Standard per-class rates, read off the confusion matrix's row, column, and diagonal.">
              {String.raw`\mathrm{prec}_c = \frac{M_{cc}}{\sum_a M_{ac}}, \qquad \mathrm{rec}_c = \frac{M_{cc}}{\sum_b M_{cb}}, \qquad F_{1,c} = \frac{2\,\mathrm{prec}_c \cdot \mathrm{rec}_c}{\mathrm{prec}_c + \mathrm{rec}_c}`}
            </Eq>
            <p>
              On an imbalanced blob, accuracy alone will mislead — a model that predicts the majority
              class everywhere can score well above 0.8. Per-class recall is the column that exposes
              it.
            </p>
            <Source path="app/core/metrics.py" symbol="MetricsCalculator.evaluate" />

            <h3>The label-efficiency sweep</h3>
            <p>
              The most product-relevant experiment in the app answers the question a practitioner
              actually has: <em>how many labels do I need to buy?</em> For each fraction{' '}
              <M>{String.raw`\rho`}</M> in the sweep, the studio re-draws the stratified mask, runs
              harmonic propagation to convergence, and scores on that run's unlabeled set:
            </p>
            <Eq label="7.3" note="The graph is held fixed across the sweep — only the label mask varies.">
              {String.raw`\rho \;\longmapsto\; \mathrm{acc}\bigl(f^{\star}(\tilde{y}^{(\rho)})\bigr), \qquad \rho \in \{0.02,\, 0.05,\, 0.1,\, 0.2,\, 0.35,\, 0.5\}`}
            </Eq>
            <p>
              Holding <M>W</M> fixed is what makes the curve interpretable: the only thing changing is
              how much supervision the same structure receives. The shape is the deliverable. A curve
              that saturates by <M>{String.raw`\rho = 0.1`}</M> is telling you that further labelling
              is wasted budget and the graph is carrying the information. A curve still climbing at{' '}
              <M>{String.raw`\rho = 0.5`}</M> is telling you the graph is wrong — go back to stage 02
              before you commission another annotation round.
            </p>
            <Caveat title="One draw per point">
              Each fraction is evaluated on a single random mask, not averaged over repeats, so the
              curve carries sampling noise and is not guaranteed to be monotone. Treat a small dip as
              variance rather than signal; fix the seed if you need run-to-run comparability.
            </Caveat>
            <Source path="app/core/label_efficiency.py" symbol="LabelEfficiencyAnalyzer.sweep" />
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section
            id="cost"
            stage="08"
            title="Cost & limits"
            lede="The dataset ceiling of 500 nodes is not arbitrary. It falls out of the cubic term below."
          >
            <div className="m-table-wrap">
              <table className="m-table">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Complexity</th>
                    <th>Dominant term</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['k-NN construction', String.raw`O(n^2 d + nk)`, 'pairwise distances'],
                    ['RBF construction', String.raw`O(n^2 d + n^2 \log n)`, 'scoring, then sorting every pair'],
                    ['Component count (BFS)', String.raw`O(n^2)`, 'scan of the dense adjacency'],
                    ['Fiedler value λ₂', String.raw`O(n^3)`, 'dense symmetric eigendecomposition'],
                    ['Harmonic, per sweep', String.raw`O(n^2 C)`, 'dense matrix–matrix product'],
                    ['Harmonic, total', String.raw`O(T n^2 C)`, 'T sweeps to tolerance'],
                    ['Mincut (Edmonds–Karp)', String.raw`O(V E^2) = O(n^5)`, 'augmentations on a dense graph'],
                  ].map(([stage, complexity, note]) => (
                    <tr key={stage}>
                      <th scope="row">{stage}</th>
                      <td>
                        <M>{complexity}</M>
                      </td>
                      <td className="m-table-note">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Two things stand out. First, the graph statistics are more expensive than the
              propagation: computing <M>{String.raw`\lambda_2`}</M> is a full{' '}
              <M>{String.raw`O(n^3)`}</M> eigendecomposition, and it runs on every build. Second,
              mincut's worst case is brutal on a dense RBF graph — the <M>{String.raw`O(n^5)`}</M>{' '}
              bound is pessimistic in practice, but it is the reason mincut on a fully connected graph
              feels slow while harmonic on the same graph does not.
            </p>
            <p>
              Both facts point the same way, and together they set the{' '}
              <M>{String.raw`n \leq 500`}</M> cap the API enforces: at that size the cubic term stays
              in the low hundreds of milliseconds. Everything is dense{' '}
              <M>{String.raw`n \times n`}</M> NumPy — no sparse structures — so memory grows as{' '}
              <M>{String.raw`O(n^2)`}</M> too.
            </p>
            <Source path="app/config.py" symbol="Settings.max_dataset_size" />
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section
            id="failure"
            stage="09"
            title="When this breaks"
            lede="Five failure modes, each with the symptom you will actually observe first."
          >
            <ol className="m-failures">
              {[
                {
                  head: 'The graph is disconnected',
                  symptom: 'Components > 1, λ₂ = 0',
                  body: (
                    <>
                      A component with no labeled node is unreachable. Harmonic leaves it at the
                      uniform mixture; mincut assigns it by fallback. Both are guesses.{' '}
                      <strong>Fix:</strong> raise <M>k</M> or <M>{String.raw`\sigma`}</M>, turn off
                      mutual neighbours, or lower <M>{String.raw`\tau`}</M>.
                    </>
                  ),
                },
                {
                  head: 'The bandwidth is wrong',
                  symptom: 'Density near 0% or near 100%',
                  body: (
                    <>
                      Too small and the kernel underflows to a graph of isolated points; too large and
                      every pair is weight ≈ 1, erasing the structure entirely.{' '}
                      <strong>Fix:</strong> set <M>{String.raw`\sigma`}</M> near the typical
                      nearest-neighbour distance — the kernel figure in stage 02 shows the trade
                      directly.
                    </>
                  ),
                },
                {
                  head: 'The manifold assumption is false',
                  symptom: 'High accuracy on moons, poor accuracy on your data',
                  body: (
                    <>
                      If classes genuinely interleave at small distances, no graph over raw Euclidean
                      distance can separate them, and every method here inherits that failure.{' '}
                      <strong>Fix:</strong> this is a feature-representation problem, not a
                      propagation one.
                    </>
                  ),
                },
                {
                  head: 'Class imbalance',
                  symptom: 'High accuracy, one class with near-zero recall',
                  body: (
                    <>
                      Stratified revealing guarantees at least one minority label, but a minority
                      cluster that is small and weakly connected still loses the weighted vote.{' '}
                      <strong>Fix:</strong> read per-class F1 rather than accuracy, and raise{' '}
                      <M>{String.raw`\rho`}</M> for the affected class.
                    </>
                  ),
                },
                {
                  head: 'Degenerate mincut',
                  symptom: 'A cut isolating a handful of nodes around one labeled point',
                  body: (
                    <>
                      Equation 5.1 has no balance term, so a tiny cut can be cheaper than the true
                      boundary — most likely at low <M>{String.raw`\rho`}</M> on a weakly connected
                      graph. <strong>Fix:</strong> compare against harmonic; a large disagreement
                      between the two is the tell.
                    </>
                  ),
                },
              ].map((item, index) => (
                <li key={item.head}>
                  <span className="m-failure-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h4>{item.head}</h4>
                    <p className="m-failure-symptom">{item.symptom}</p>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {/* ------------------------------------------------------------ */}
          <Section id="references" stage="—" title="References" lede="The two algorithms implemented here are faithful to these papers.">
            <ol className="m-refs">
              <li>
                <strong>Zhu, X., Ghahramani, Z., &amp; Lafferty, J.</strong> (2003). Semi-Supervised
                Learning Using Gaussian Fields and Harmonic Functions. <em>ICML</em>.
                <span className="m-ref-tag">stage 04 — equations 4.1–4.5</span>
              </li>
              <li>
                <strong>Blum, A., &amp; Chawla, S.</strong> (2001). Learning from Labeled and
                Unlabeled Data using Graph Mincuts. <em>ICML</em>.
                <span className="m-ref-tag">stage 05 — equations 5.1–5.4</span>
              </li>
              <li>
                <strong>Fiedler, M.</strong> (1973). Algebraic connectivity of graphs.{' '}
                <em>Czechoslovak Mathematical Journal</em>, 23(2), 298–305.
                <span className="m-ref-tag">stage 03 — equation 3.3</span>
              </li>
              <li>
                <strong>Edmonds, J., &amp; Karp, R. M.</strong> (1972). Theoretical Improvements in
                Algorithmic Efficiency for Network Flow Problems. <em>Journal of the ACM</em>, 19(2),
                248–264.
                <span className="m-ref-tag">stage 05 — termination bound</span>
              </li>
              <li>
                <strong>von Luxburg, U.</strong> (2007). A Tutorial on Spectral Clustering.{' '}
                <em>Statistics and Computing</em>, 17(4), 395–416.
                <span className="m-ref-tag">stage 02–03 — graph construction trade-offs</span>
              </li>
              <li>
                <strong>Chapelle, O., Schölkopf, B., &amp; Zien, A.</strong> (Eds.) (2006).{' '}
                <em>Semi-Supervised Learning</em>. MIT Press.
                <span className="m-ref-tag">background — the smoothness assumption</span>
              </li>
            </ol>
          </Section>

          <footer className="m-footer">
            <p>
              Every equation on this page is implemented in the backend modules cited beneath it.
              Where the implementation departs from the paper — the one-vs-rest multiclass extension,
              the finite stand-in for infinite capacity, the isolated-node degeneracy — it is called
              out in a caveat rather than smoothed over.
            </p>
            <a className="m-footer-cta" href="#/">
              Back to the studio →
            </a>
          </footer>
        </article>
      </div>
    </div>
  )
}

function jumpTo(id: string) {
  return (event: React.MouseEvent) => {
    event.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

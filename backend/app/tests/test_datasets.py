import numpy as np
import pytest

from app.core.datasets import DATASET_GENERATORS, LabelRevealer, PatientZeroGenerator


def generate(n_samples=200, noise=0.1, seed=0):
    return PatientZeroGenerator().generate(n_samples=n_samples, noise=noise, seed=seed)


def test_patient_zero_is_registered():
    assert isinstance(DATASET_GENERATORS["patient_zero"], PatientZeroGenerator)


@pytest.mark.parametrize("seed", [0, 1, 7, 42])
@pytest.mark.parametrize("n_samples", [20, 60, 200])
def test_outbreak_always_leaves_both_classes_populated(seed, n_samples):
    """A cascade that fizzles or burns everything would hand the revealer a
    single-class dataset, and every metric downstream would be meaningless."""
    dataset = generate(n_samples=n_samples, seed=seed)

    assert dataset.X.shape == (n_samples, 2)
    assert dataset.n_classes == 2
    assert set(np.unique(dataset.y_true)) == {0, 1}


def test_outbreak_is_reproducible_for_a_seed():
    first = generate(seed=5)
    second = generate(seed=5)

    assert np.array_equal(first.y_true, second.y_true)
    assert np.allclose(first.X, second.X)


def test_attack_rate_usually_lands_in_the_target_band():
    low, high = PatientZeroGenerator.TARGET_ATTACK_RATE
    rates = [float(generate(seed=seed).y_true.mean()) for seed in range(20)]

    assert sum(low <= rate <= high for rate in rates) >= 14
    assert all(0.0 < rate < 1.0 for rate in rates)


@pytest.mark.parametrize("seed", [3, 11, 26])
def test_infection_spreads_only_along_the_contact_network(seed):
    """The invariant that makes this scenario what it is: a cascade from one
    index case can only reach people through contacts, so the infected always
    form a single connected set *in the contact graph*. Where that set lands in
    feature space is incidental — which is precisely why the label is not a
    function of position the way it is for every other generator here.

    This reaches into the generator's internals deliberately: the contact
    network is the mechanism under test, and it is not otherwise observable.
    """
    generator = PatientZeroGenerator()
    rng = np.random.default_rng(seed)
    X, community = generator._social_space(rng, 200, 0.1)
    contacts = generator._contact_network(rng, X, community)
    infected = generator._run_outbreak(rng, contacts, X)

    cases = np.where(infected)[0]
    assert len(cases) > 0

    reached = {int(cases[0])}
    queue = [int(cases[0])]
    while queue:
        person = queue.pop()
        for contact, _ in contacts[person]:
            if infected[contact] and contact not in reached:
                reached.add(contact)
                queue.append(contact)

    assert len(reached) == len(cases)


def test_communities_stay_close_enough_to_form_one_graph():
    """A ring wide enough to split into four k-NN components would let every
    algorithm 'win' without ever carrying a label across a gap."""
    from app.core.graph_builder import KNNGraphBuilder
    from app.core.graph_metrics import GraphAnalyzer

    for seed in range(6):
        dataset = generate(seed=seed)
        builder = KNNGraphBuilder(k=6, sigma=1.0)
        list(builder.build(dataset.X))
        assert GraphAnalyzer().analyze(builder.adjacency).n_components == 1


def test_label_revealer_seeds_both_outcomes():
    dataset = generate(seed=9)
    observed = LabelRevealer().reveal(dataset.y_true, label_fraction=0.1, seed=9)

    revealed = observed[observed >= 0]
    assert set(np.unique(revealed)) == {0, 1}

import numpy as np

from app.core.active_learning import ActiveLearningArena
from app.core.datasets import TwoMoonsGenerator
from app.core.graph_builder import KNNGraphBuilder


def moons_arena(strategy="entropy", batch_size=4, seed=7):
    dataset = TwoMoonsGenerator().generate(n_samples=120, noise=0.09, seed=seed)
    builder = KNNGraphBuilder(k=6, sigma=0.4)
    for _ in builder.build(dataset.X):
        pass

    observed = np.full(dataset.y_true.shape, -1)
    rng = np.random.default_rng(seed)
    for cls in range(dataset.n_classes):
        members = np.where(dataset.y_true == cls)[0]
        observed[rng.choice(members, size=2, replace=False)] = cls

    return ActiveLearningArena(
        adjacency=builder.adjacency,
        y_true=dataset.y_true,
        n_classes=dataset.n_classes,
        initial_observed=observed,
        batch_size=batch_size,
        strategy=strategy,
        holdout_fraction=0.3,
        seed=seed,
    )


def test_holdout_is_never_offered_to_either_track():
    arena = moons_arena()
    holdout = set(arena.holdout.tolist())

    for _ in range(6):
        arena.step()

    for track in arena.tracks.values():
        labeled = set(np.where(track.observed >= 0)[0].tolist())
        assert labeled.isdisjoint(holdout)


def test_both_tracks_spend_an_identical_budget():
    arena = moons_arena(batch_size=3)
    for _ in range(5):
        arena.step()

    counts = {name: int((track.observed >= 0).sum()) for name, track in arena.tracks.items()}
    assert counts["guided"] == counts["random"]


def test_suggestions_are_drawn_from_the_pool_and_ranked():
    arena = moons_arena()
    snapshot = arena.snapshot()

    holdout = set(snapshot.holdout)
    labeled = {i for i, v in enumerate(arena.tracks["guided"].observed) if v >= 0}

    assert len(snapshot.suggestions) == arena.batch_size
    for suggestion in snapshot.suggestions:
        assert suggestion.node_id not in holdout
        assert suggestion.node_id not in labeled

    scores = [s.score for s in snapshot.suggestions]
    assert scores == sorted(scores, reverse=True)


def test_entropy_strategy_picks_more_uncertain_nodes_than_random():
    arena = moons_arena(strategy="entropy")
    snapshot = arena.snapshot()

    guided_entropy = np.mean([s.entropy for s in snapshot.suggestions])
    pool = arena._pool(arena.tracks["guided"])
    _, all_entropy, _ = arena._score("entropy", arena.tracks["guided"].soft, pool)

    assert guided_entropy > float(all_entropy.mean())


def test_margin_strategy_picks_the_narrowest_margins():
    arena = moons_arena(strategy="margin")
    snapshot = arena.snapshot()

    pool = arena._pool(arena.tracks["guided"])
    _, _, all_margin = arena._score("margin", arena.tracks["guided"].soft, pool)
    picked_margin = np.mean([s.margin for s in snapshot.suggestions])

    assert picked_margin < float(all_margin.mean())


def test_history_grows_by_one_point_per_round():
    arena = moons_arena()
    assert len(arena.tracks["guided"].history) == 1  # the round-zero baseline

    arena.step()
    arena.step()

    assert len(arena.tracks["guided"].history) == 3
    assert arena.tracks["guided"].history[-1].round_index == 2


def test_snapshot_serializes_per_node_arrays_at_full_length():
    arena = moons_arena()
    snapshot = arena.snapshot()
    n = len(arena.y_true)

    for track in snapshot.tracks.values():
        assert len(track.predictions) == n
        assert len(track.confidence) == n
        assert len(track.entropy) == n
        assert len(track.observed) == n

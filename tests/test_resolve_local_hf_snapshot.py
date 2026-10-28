"""Self-check for _resolve_local_hf_snapshot's dangling-symlink detection.

A snapshot with fully-downloaded weights but a dangling tokenizer symlink
(interrupted download) must be treated as "not cached" so the caller falls
back to downloading instead of transformers silently passing None to
open() (the bug behind "expected str, bytes or os.PathLike, not NoneType").

Run: `uv run python tests/test_resolve_local_hf_snapshot.py` (no pytest needed).
"""
from pathlib import Path
from unittest.mock import patch

from lapp.utils.models import _resolve_local_hf_snapshot


def _make_snapshot(tmp_path: Path, repo_name: str) -> Path:
    repo_dir = tmp_path / ".cache" / "huggingface" / "hub" / f"models--{repo_name.replace('/', '--')}"
    snapshot = repo_dir / "snapshots" / "abc123"
    snapshot.mkdir(parents=True)
    blobs = repo_dir / "blobs"
    blobs.mkdir(parents=True)
    return snapshot


def _link_real_blob(snapshot: Path, blobs_dir: Path, filename: str, content: bytes = b"x") -> None:
    blob = blobs_dir / f"blob-{filename}"
    blob.write_bytes(content)
    (snapshot / filename).symlink_to(blob)


def _link_dangling_blob(snapshot: Path, blobs_dir: Path, filename: str) -> None:
    (snapshot / filename).symlink_to(blobs_dir / f"missing-{filename}")


def test_complete_snapshot_is_returned(tmp_path):
    repo_name = "Org/Complete"
    snapshot = _make_snapshot(tmp_path, repo_name)
    blobs = snapshot.parent.parent / "blobs"
    _link_real_blob(snapshot, blobs, "model.safetensors")
    _link_real_blob(snapshot, blobs, "config.json")
    _link_real_blob(snapshot, blobs, "tokenizer.json")

    with patch("lapp.utils.models.Path.home", return_value=tmp_path):
        assert _resolve_local_hf_snapshot(repo_name) == str(snapshot)


def test_dangling_tokenizer_symlink_is_treated_as_uncached(tmp_path):
    repo_name = "Org/BrokenTokenizer"
    snapshot = _make_snapshot(tmp_path, repo_name)
    blobs = snapshot.parent.parent / "blobs"
    _link_real_blob(snapshot, blobs, "model.safetensors")
    _link_dangling_blob(snapshot, blobs, "tokenizer.json")

    with patch("lapp.utils.models.Path.home", return_value=tmp_path):
        assert _resolve_local_hf_snapshot(repo_name) is None


def test_dangling_weight_symlink_is_treated_as_uncached(tmp_path):
    repo_name = "Org/BrokenWeights"
    snapshot = _make_snapshot(tmp_path, repo_name)
    blobs = snapshot.parent.parent / "blobs"
    _link_dangling_blob(snapshot, blobs, "model.safetensors")

    with patch("lapp.utils.models.Path.home", return_value=tmp_path):
        assert _resolve_local_hf_snapshot(repo_name) is None


def test_model_with_no_tokenizer_files_at_all_is_fine(tmp_path):
    """A non-text model (e.g. the TTS model) has no tokenizer files — that's
    not the same as a broken download, so it must not be rejected."""
    repo_name = "Org/AudioOnly"
    snapshot = _make_snapshot(tmp_path, repo_name)
    blobs = snapshot.parent.parent / "blobs"
    _link_real_blob(snapshot, blobs, "model.safetensors")
    _link_real_blob(snapshot, blobs, "config.json")

    with patch("lapp.utils.models.Path.home", return_value=tmp_path):
        assert _resolve_local_hf_snapshot(repo_name) == str(snapshot)


if __name__ == "__main__":
    import tempfile

    for fn in (
        test_complete_snapshot_is_returned,
        test_dangling_tokenizer_symlink_is_treated_as_uncached,
        test_dangling_weight_symlink_is_treated_as_uncached,
        test_model_with_no_tokenizer_files_at_all_is_fine,
    ):
        with tempfile.TemporaryDirectory() as d:
            fn(Path(d))
        print(f"ok: {fn.__name__}")
    print("All checks passed.")

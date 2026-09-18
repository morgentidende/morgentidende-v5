from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEXT_EXT = {'.md', '.ts', '.astro', '.css', '.sql', '.mjs', '.json', '.jsonc'}


def all_text():
    for p in ROOT.rglob('*'):
        if p.is_file() and p.suffix in TEXT_EXT:
            yield p, p.read_text(errors='ignore')


def test_no_v4_runtime_code_or_livecenter():
    allowed = {'README.md'}
    for path, text in all_text():
        rel = str(path.relative_to(ROOT))
        if rel in allowed:
            continue
        assert 'V4Layout' not in text
        assert 'v4-' not in text.lower()
        assert 'LiveCenter' not in text
        assert 'livecenter' not in text.lower()


def test_single_editorial_authority_files_exist():
    assert (ROOT / 'docs/v5-editorial.md').exists()
    assert (ROOT / 'docs/v5-engine-prompt.md').exists()
    assert (ROOT / 'docs/v5-discovery-sources.md').exists()


def test_no_old_pipeline_roles():
    forbidden = ['media worker', 'article qa', 'producer', 'watchdog', 'release runner', 'github publish bridge']
    for path, text in all_text():
        if path.name in {'README.md', 'v5-engine-prompt.md'}:
            continue
        low = text.lower()
        for term in forbidden:
            assert term not in low, f'{term} in {path}'

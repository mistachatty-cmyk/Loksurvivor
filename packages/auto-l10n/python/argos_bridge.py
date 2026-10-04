#!/usr/bin/env python3
"""Argos Translate bridge for @lok/auto-l10n.

Reads one JSON object per line on stdin: {"id": 1, "text": "...", "from": "en", "to": "es"}
and answers one line on stdout:          {"id": 1, "text": "..."} or {"id": 1, "error": "..."}

Language models are downloaded the first time a pair is needed and cached in
Argos' own data folder (~100 MB per language), so CI should cache that folder.
Nothing here needs an account, a key or a network quota.
"""
import json
import sys

try:
    import argostranslate.package as package
    import argostranslate.translate as translate
except ImportError:  # pragma: no cover - reported to the caller instead of crashing
    package = translate = None

_index_loaded = False


def _have(from_code, to_code):
    try:
        languages = {lang.code: lang for lang in translate.get_installed_languages()}
        source = languages.get(from_code)
        target = languages.get(to_code)
        return bool(source and target and source.get_translation(target))
    except Exception:
        return False


def _install(from_code, to_code):
    global _index_loaded
    if not _index_loaded:
        package.update_package_index()
        _index_loaded = True
    for candidate in package.get_available_packages():
        if candidate.from_code == from_code and candidate.to_code == to_code:
            package.install_from_path(candidate.download())
            return
    raise RuntimeError(f"Argos has no {from_code} -> {to_code} model")


def handle(request):
    if translate is None:
        raise RuntimeError("argostranslate is not installed. Run: pip install argostranslate")
    from_code, to_code = request["from"], request["to"]
    if not _have(from_code, to_code):
        _install(from_code, to_code)
    return translate.translate(request["text"], from_code, to_code)


def main():
    # Libraries sometimes print progress to stdout; keep the protocol on a private handle.
    out = sys.stdout
    sys.stdout = sys.stderr
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request_id = None
        try:
            request = json.loads(line)
            request_id = request.get("id")
            reply = {"id": request_id, "text": handle(request)}
        except Exception as error:  # noqa: BLE001 - every failure goes back to the caller
            reply = {"id": request_id, "error": f"{type(error).__name__}: {error}"}
        out.write(json.dumps(reply, ensure_ascii=False) + "\n")
        out.flush()


if __name__ == "__main__":
    main()

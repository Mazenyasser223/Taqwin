from app.services.plan_catalog_stable import stable_sort_plan_catalogs


def test_stable_sort_plan_catalogs() -> None:
    foods, exercises, books = stable_sort_plan_catalogs(
        [{"name": "Z", "webtebId": 2}, {"name": "A", "id": "f1"}],
        [{"name": "Squat", "id": "ex-2"}, {"name": "Bench", "id": "ex-1"}],
        [{"topic": "b", "text": "beta"}, {"topic": "a", "text": "alpha"}],
    )
    assert foods[0]["id"] == "f1"
    assert exercises[0]["id"] == "ex-1"
    assert books[0]["topic"] == "a"

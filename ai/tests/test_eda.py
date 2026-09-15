import json
from pathlib import Path

from src.data.eda_analysis import main


def test_eda_analysis_executes_and_writes_summary():
    summary = main()
    output_path = Path("docs/eda_summary.json")

    assert output_path.exists()
    assert isinstance(summary, dict)
    assert "summary_stats" in summary
    assert "target_skewness" in summary
    assert "correlations" in summary
    assert "subcity_counts" in summary

    data = json.loads(output_path.read_text(encoding="utf-8"))
    assert data["summary_stats"]["price_etb"]["count"] > 0
    assert "raw" in data["target_skewness"]
    assert "log1p" in data["target_skewness"]
    assert isinstance(data["correlations"], dict)
    assert isinstance(data["subcity_counts"], dict)

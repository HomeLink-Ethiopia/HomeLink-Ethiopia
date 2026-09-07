from pathlib import Path

import pandas as pd

from src.eda_and_feature_prep import METADATA_PATH, OUTPUT_PATH, main


def test_encoded_rentals_are_numeric_and_complete():
    main()

    output_path = Path(OUTPUT_PATH)
    metadata_path = Path(METADATA_PATH)
    assert output_path.exists()
    assert metadata_path.exists()

    encoded = pd.read_csv(output_path)
    assert not encoded.empty
    assert all(pd.api.types.is_numeric_dtype(dtype) for dtype in encoded.dtypes)
    assert not encoded.isna().any().any()

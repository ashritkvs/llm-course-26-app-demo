import pandas as pd


def _serialize_float(value: float) -> float | None:
    if pd.isna(value):
        return None
    return float(value)


def _infer_label_column(dataframe: pd.DataFrame) -> str | None:
    explicit_candidates = {"label", "target", "class", "y"}
    lowered = {column.lower(): column for column in dataframe.columns}
    for candidate in explicit_candidates:
        if candidate in lowered:
            return lowered[candidate]
    return None


def _compute_health_score(
    dataframe: pd.DataFrame,
    missing_percentages: dict[str, float | None],
    duplicate_row_count: int,
    high_correlation_pairs: list[dict[str, float | str]],
) -> dict:
    total_rows = len(dataframe)
    penalties: dict[str, dict] = {}
    total_penalty = 0.0

    # Missing values penalty:
    # - >20% missing in a column is treated as severe.
    severe_missing_columns = []
    moderate_missing_columns = []
    for column, pct in missing_percentages.items():
        if pct is None:
            continue
        if pct > 20:
            severe_missing_columns.append({"column": column, "missing_percentage": pct})
        elif pct > 5:
            moderate_missing_columns.append({"column": column, "missing_percentage": pct})

    missing_penalty = min(40.0, (len(severe_missing_columns) * 8.0) + (len(moderate_missing_columns) * 2.0))
    total_penalty += missing_penalty
    penalties["missing_values"] = {
        "penalty": round(missing_penalty, 2),
        "severe_threshold_percentage": 20,
        "severe_columns": severe_missing_columns,
        "moderate_columns": moderate_missing_columns,
    }

    duplicate_ratio = (duplicate_row_count / total_rows) if total_rows else 0.0
    duplicate_penalty = min(20.0, duplicate_ratio * 100.0)
    total_penalty += duplicate_penalty
    penalties["duplicate_rows"] = {
        "penalty": round(duplicate_penalty, 2),
        "duplicate_count": duplicate_row_count,
        "duplicate_ratio_percentage": round(duplicate_ratio * 100.0, 2),
    }

    correlation_penalty = min(20.0, len(high_correlation_pairs) * 2.5)
    total_penalty += correlation_penalty
    penalties["high_correlation"] = {
        "penalty": round(correlation_penalty, 2),
        "pair_count": len(high_correlation_pairs),
        "pairs": high_correlation_pairs,
        "threshold": 0.8,
    }

    imbalance_penalty = 0.0
    imbalance_details: dict[str, float | str | int | None] = {
        "label_column": None,
        "majority_class": None,
        "majority_ratio_percentage": None,
        "is_severe": False,
    }
    label_column = _infer_label_column(dataframe)
    if label_column and total_rows:
        value_distribution = dataframe[label_column].value_counts(dropna=False)
        if not value_distribution.empty:
            majority_class = value_distribution.index[0]
            majority_ratio = float(value_distribution.iloc[0] / total_rows)
            is_severe = majority_ratio > 0.8
            if is_severe:
                # Up to 20 points based on how concentrated the largest class is.
                imbalance_penalty = min(20.0, ((majority_ratio - 0.8) / 0.2) * 20.0)
            imbalance_details = {
                "label_column": label_column,
                "majority_class": str(majority_class),
                "majority_ratio_percentage": round(majority_ratio * 100.0, 2),
                "is_severe": is_severe,
            }
    total_penalty += imbalance_penalty
    penalties["class_imbalance"] = {
        "penalty": round(imbalance_penalty, 2),
        **imbalance_details,
    }

    final_score = max(0.0, 100.0 - total_penalty)
    return {
        "final_score": round(final_score, 2),
        "max_score": 100,
        "total_penalty": round(total_penalty, 2),
        "penalties": penalties,
    }


def build_upload_summary(dataframe: pd.DataFrame) -> dict:
    return {
        "preview": dataframe.head(5).fillna("").to_dict(orient="records"),
        "columns": dataframe.columns.tolist(),
        "shape": {"rows": int(dataframe.shape[0]), "columns": int(dataframe.shape[1])},
    }


def analyze_dataset(dataframe: pd.DataFrame, correlation_threshold: float = 0.8) -> dict:
    total_rows = len(dataframe)

    if total_rows == 0:
        missing_percentages = {column: None for column in dataframe.columns}
    else:
        missing_percentages = {
            column: round(float((dataframe[column].isna().sum() / total_rows) * 100), 2)
            for column in dataframe.columns
        }

    duplicate_row_count = int(dataframe.duplicated().sum())
    data_types = {column: str(dtype) for column, dtype in dataframe.dtypes.items()}

    numeric_df = dataframe.select_dtypes(include=["number"])
    basic_statistics = {
        column: {
            "mean": _serialize_float(numeric_df[column].mean()),
            "std": _serialize_float(numeric_df[column].std()),
        }
        for column in numeric_df.columns
    }

    correlation_matrix: dict[str, dict[str, float | None]] = {}
    high_correlation_pairs: list[dict[str, float | str]] = []

    if not numeric_df.empty:
        corr_df = numeric_df.corr()
        correlation_matrix = {
            row: {col: _serialize_float(corr_df.loc[row, col]) for col in corr_df.columns}
            for row in corr_df.index
        }

        columns = list(corr_df.columns)
        for i, left_col in enumerate(columns):
            for right_col in columns[i + 1 :]:
                corr_value = corr_df.loc[left_col, right_col]
                if pd.notna(corr_value) and abs(float(corr_value)) > correlation_threshold:
                    high_correlation_pairs.append(
                        {
                            "column_1": left_col,
                            "column_2": right_col,
                            "correlation": round(float(corr_value), 4),
                        }
                    )

    health_score = _compute_health_score(
        dataframe=dataframe,
        missing_percentages=missing_percentages,
        duplicate_row_count=duplicate_row_count,
        high_correlation_pairs=high_correlation_pairs,
    )

    return {
        "shape": {"rows": int(dataframe.shape[0]), "columns": int(dataframe.shape[1])},
        "missing_values_percentage": missing_percentages,
        "duplicate_row_count": duplicate_row_count,
        "data_types": data_types,
        "basic_statistics": basic_statistics,
        "correlation_matrix": correlation_matrix,
        "high_correlation_pairs": high_correlation_pairs,
        "correlation_threshold": correlation_threshold,
        "dataset_health": health_score,
    }

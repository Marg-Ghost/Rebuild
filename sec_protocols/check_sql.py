import re

_SQL_PATTERN = re.compile(
    r"(?:;|--|/\*|\*/|\b(?:SELECT|DROP|WHERE|UNION|INSERT|UPDATE|DELETE|OR)\b|"
    r"'\s*OR\s*'\s*1\s*=\s*'\s*1)",
    re.IGNORECASE,
)


def is_safe_input(value: str) -> bool:
    """Reject common SQL injection syntax in user supplied auth fields."""
    return isinstance(value, str) and _SQL_PATTERN.search(value) is None


def check_sql(value: str) -> bool:
    return is_safe_input(value)

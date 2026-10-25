"""Deterministic finite automaton for common input validation."""


class DeterministischerEndlicherAutomat:
    """Validates email addresses with explicit DFA states and transitions."""

    LOCAL_CHARACTERS = frozenset(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.+-"
    )
    DOMAIN_CHARACTERS = frozenset(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"
    )
    LETTERS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

    @classmethod
    def is_valid_email(cls, value: str) -> bool:
        """Accept an address with a local part, domain, dot, and 2–3 letter TLD."""
        if not isinstance(value, str):
            return False

        state = "start"
        for character in value:
            match state:
                case "start":
                    state = "local" if character in cls.LOCAL_CHARACTERS else "reject"
                case "local":
                    if character in cls.LOCAL_CHARACTERS:
                        state = "local"
                    elif character == "@":
                        state = "after_at"
                    else:
                        state = "reject"
                case "after_at":
                    state = "domain" if character in cls.DOMAIN_CHARACTERS else "reject"
                case "domain":
                    if character in cls.DOMAIN_CHARACTERS:
                        state = "domain"
                    elif character == ".":
                        state = "after_dot"
                    else:
                        state = "reject"
                case "after_dot":
                    state = "tld_one" if character in cls.LETTERS else "reject"
                case "tld_one":
                    state = "tld_two" if character in cls.LETTERS else "reject"
                case "tld_two":
                    state = "tld_three" if character in cls.LETTERS else "reject"
                case "tld_three" | "reject":
                    state = "reject"
                case _:
                    state = "reject"

            if state == "reject":
                return False

        return state in {"tld_two", "tld_three"}

    @staticmethod
    def has_valid_length(
        value: str, minimum: int = 0, maximum: int | None = None
    ) -> bool:
        if not isinstance(value, str) or len(value) < minimum:
            return False
        return maximum is None or len(value) <= maximum

    @staticmethod
    def is_non_empty(value: str) -> bool:
        return isinstance(value, str) and bool(value)

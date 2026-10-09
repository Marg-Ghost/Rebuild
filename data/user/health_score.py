def calculate_burnout_score(sleep_hours: float,stress_level: int,workload_level: int,) -> dict:
    """Return a transparent self-report indicator, not a medical assessment."""
    if not 0 <= sleep_hours <= 24:
        raise ValueError("Schlafstunden müssen zwischen 0 und 24 liegen")
    if not 0 <= stress_level <= 10 or not 0 <= workload_level <= 10:
        raise ValueError("Stress und Workload müssen zwischen 0 und 10 liegen")

    sleep_score = max(0.0, 100.0 - max(0.0, 7 - sleep_hours, sleep_hours - 9) * 20)
    stress_score = (10 - stress_level) * 10
    workload_score = (10 - workload_level) * 10
    score = round(sleep_score * 0.4 + stress_score * 0.3 + workload_score * 0.3)

    if score >= 80:
        risk_level, color = "low", "green"
        label = "Niedriges Risiko"
    elif score >= 50:
        risk_level, color = "moderate", "yellow"
        label = "Moderates Risiko"
    else:
        risk_level, color = "high", "red"
        label = "Hohes Burnout-Risiko"

    return {
        "score": score,
        "burnout_risk_level": risk_level,
        "label": label,
        "color": color,
        "explanation": (
            "Orientierungswert aus deinen Angaben zu Schlaf, Stress und Workload. "
            "Kein medizinischer Test und keine Diagnose."
        ),
    }

from datetime import datetime, timezone
import math


USABLE_EFFICIENCY_THRESHOLD = 20.0
BASE_DECAY_RATE_PER_HOUR = 10.0


def _normalized_component(value: float | None, name: str) -> float | None:
    if value is None:
        return None
    result = float(value)
    if not math.isfinite(result) or not 0.0 <= result <= 100.0:
        raise ValueError(f"{name} must be between 0 and 100")
    return result


def normalize_sleep_quality(sleep_hours: float, sleep_quality: float | None) -> float:
    """Map the existing sleep-hours/timing signal onto a 0-100 component score."""
    hours = float(sleep_hours)
    if not math.isfinite(hours) or not 0.0 < hours <= 24.0:
        raise ValueError("Sleep hours must be greater than 0 and at most 24")
    if sleep_quality is not None:
        quality = float(sleep_quality)
        if not math.isfinite(quality) or not -24.0 <= quality <= 24.0:
            raise ValueError("Sleep quality must be between -24 and 24")
    else:
        quality = hours

    duration_score = 100.0 - max(0.0, 7.0 - hours, hours - 9.0) * 20.0
    timing_penalty = min(15.0, max(0.0, hours - quality) * 2.0)
    return round(max(0.0, duration_score - timing_penalty), 1)


def calculate_efficiency_metrics(
    stress: int,
    sleep_hours: float,
    sleep_quality: float | None,
    food_score: float | None,
    activity_score: float | None,
) -> dict:
    """Calculate a transparent estimate from existing health check-in signals.

    Available sleep, food, and activity components receive equal weight. Stress
    adds 0.3 points per rating point (up to 3 points); workload is deliberately
    excluded because it is used only to shape activity recommendations.
    """
    if not 1 <= stress <= 10:
        raise ValueError("Stress must be between 1 and 10")

    sleep_score = normalize_sleep_quality(sleep_hours, sleep_quality)
    food_score = _normalized_component(food_score, "Food score")
    activity_score = _normalized_component(activity_score, "Activity score")

    components = [sleep_score]
    if food_score is not None:
        components.append(food_score)
    if activity_score is not None:
        components.append(activity_score)

    base_efficiency = sum(components) / len(components)
    stress_bonus = round(stress * 0.3, 1)
    efficiency_score = max(5.0, min(100.0, base_efficiency + stress_bonus))
    usable_efficiency = max(0.0, efficiency_score - USABLE_EFFICIENCY_THRESHOLD)
    time_left_minutes = int((usable_efficiency / BASE_DECAY_RATE_PER_HOUR) * 60)

    return {
        "sleep_score": sleep_score,
        "food_score": food_score,
        "activity_score": activity_score,
        "stress_bonus": stress_bonus,
        "base_efficiency": round(base_efficiency, 1),
        "efficiency_score": round(efficiency_score, 1),
        "decay_rate_per_hour": BASE_DECAY_RATE_PER_HOUR,
        "time_left_minutes": time_left_minutes,
    }


def calculate_live_efficiency_metrics(log: dict, now: datetime | None = None) -> dict:
    """Apply the saved decay rate since a check-in and return a live estimate."""
    now = now or datetime.now(timezone.utc)
    timestamp = datetime.fromisoformat(str(log["timestamp"]).replace("Z", "+00:00"))
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    elapsed_seconds = max(0.0, (now - timestamp).total_seconds())

    decay_rate = float(log.get("decay_rate_per_hour") or BASE_DECAY_RATE_PER_HOUR)
    snapshot_score = float(log["efficiency_score"])
    current_score = max(0.0, snapshot_score - decay_rate * elapsed_seconds / 3600.0)
    time_left_seconds = (
        int(max(0.0, (current_score - USABLE_EFFICIENCY_THRESHOLD) / decay_rate * 3600.0))
        if current_score > USABLE_EFFICIENCY_THRESHOLD
        else 0
    )

    return {
        **log,
        "timestamp": timestamp.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "calculated_at": now.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "efficiency_score": round(current_score, 1),
        "decay_rate_per_hour": round(decay_rate, 1),
        "time_left_minutes": time_left_seconds // 60,
        "time_left_seconds": time_left_seconds,
    }

from datetime import date, datetime

from data.user import db_interaction


def _parse_iso_datetime(value: str, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} fehlt")

    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        try:
            parsed_date = date.fromisoformat(normalized)
        except ValueError as error:
            raise ValueError(f"{field_name} muss ein ISO-Datum sein") from error
        return parsed_date.isoformat()
    return parsed.isoformat()


def list_month_events(username: str, year: int, month: int) -> list[dict]:
    if month < 1 or month > 12:
        raise ValueError("Monat muss zwischen 1 und 12 liegen")

    month_start = date(year, month, 1)
    next_month = date(year + (month == 12), month % 12 + 1, 1)
    return_val = db_interaction.get_calendar_events(
        username,
        month_start.isoformat(),
        next_month.isoformat(),
    )
    return return_val


def add_event(username: str, payload: dict) -> int:
    title = str(payload.get("title") or "").strip()
    if not title:
        raise ValueError("Titel fehlt")

    priority = payload.get("priority", 3)
    try:
        priority = int(priority)
    except (TypeError, ValueError) as error:
        raise ValueError("Priorität muss eine Zahl sein") from error
    if priority < 1 or priority > 5:
        raise ValueError("Priorität muss zwischen 1 und 5 liegen")

    start_at = _parse_iso_datetime(payload.get("start_at"), "Startdatum")
    end_at = payload.get("end_at")
    if end_at:
        end_at = _parse_iso_datetime(end_at, "Enddatum")
        if end_at < start_at:
            raise ValueError("Enddatum darf nicht vor dem Startdatum liegen")

    return db_interaction.create_calendar_event(
        username=username,
        title=title,
        start_at=start_at,
        end_at=end_at,
        description=str(payload.get("description") or "").strip() or None,
        priority=priority,
        all_day=bool(payload.get("all_day", False)),
    )


def remove_event(username: str, event_id: int) -> bool:
    return db_interaction.delete_calendar_event(username, event_id)